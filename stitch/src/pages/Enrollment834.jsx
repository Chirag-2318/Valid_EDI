import { useState, useEffect } from 'react';
import { authFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import {
  canAny,
  CLAIMS_ACCESS_PERMISSIONS,
  ENROLLMENT_ACCESS_PERMISSIONS,
  REMITTANCE_ACCESS_PERMISSIONS
} from '../auth/permissions';

const bodyClassName = 'bg-background font-body text-on-background antialiased selection:bg-primary/10 selection:text-primary page-enrollment';

function parseEDISegments(rawContent) {
  // Split raw EDI into individual segments by ~ separator, then also by newlines
  const allSegments = (rawContent || '')
    .split(/~|\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const data = { members: [], employer: '', sponsor: '', purpose: '', coveragePlans: [] };
  let currentMember = null;
  let pendingIns = null; // INS comes before NM1*IL in 834

  for (const seg of allSegments) {
    const parts = seg.split('*');
    const segId = parts[0];

    if (segId === 'BGN') {
      const purpose = parts[1] || '';
      if (purpose === '00') data.purpose = 'Original';
      else if (purpose === '15') data.purpose = 'Re-Enrollment';
      else if (purpose === '22') data.purpose = 'Information Copy';
      else data.purpose = 'Enrollment';
    }

    // Employer (NM1 with entity code 36)
    if (segId === 'NM1' && parts[1] === '36') {
      data.employer = [parts[3], parts[4]].filter(Boolean).join(' ').trim();
    }

    // Plan sponsor (NM1 with entity code P5)
    if (segId === 'NM1' && parts[1] === 'P5') {
      data.sponsor = [parts[3], parts[4]].filter(Boolean).join(' ').trim();
    }

    // INS segment — comes BEFORE the NM1*IL for this member
    if (segId === 'INS') {
      const rel = parts[2] || '';
      const maint = parts[3] || '';
      pendingIns = {
        relationship: rel === '18' ? 'Self' : rel === '01' ? 'Spouse' : rel === '19' ? 'Child' : rel,
        maintenanceType: maint === '030' ? 'Cancellation' : maint === '001' ? 'Addition' : maint === '025' ? 'Change' : maint === '021' ? 'Disability' : maint,
      };
    }

    // Member (NM1 with entity code IL = Insured/Subscriber)
    if (segId === 'NM1' && parts[1] === 'IL') {
      currentMember = {
        lastName: parts[3] || '',
        firstName: parts[4] || '',
        middleName: parts[5] || '',
        ssn: '', dob: '', gender: '',
        address: '', city: '', state: '', zip: '',
        relationship: pendingIns?.relationship || '',
        maintenanceType: pendingIns?.maintenanceType || '',
        plans: [],
      };
      pendingIns = null;
      data.members.push(currentMember);
    }

    // Demographics
    if (segId === 'DMG' && currentMember) {
      const dob = parts[2] || '';
      const gender = parts[3] || '';
      if (dob.length === 8) {
        currentMember.dob = dob.substring(4, 6) + '/' + dob.substring(6, 8) + '/' + dob.substring(0, 4);
      }
      currentMember.gender = gender === 'M' ? 'Male' : gender === 'F' ? 'Female' : gender === 'U' ? 'Non-Binary' : gender;
    }

    // Address line
    if (segId === 'N3' && currentMember) {
      currentMember.address = [parts[1], parts[2]].filter(Boolean).join(', ');
    }

    // City/State/Zip
    if (segId === 'N4' && currentMember) {
      currentMember.city = parts[1] || '';
      currentMember.state = parts[2] || '';
      currentMember.zip = parts[3] || '';
    }

    // Reference IDs (SSN, member ID)
    if (segId === 'REF' && currentMember) {
      const qualifier = parts[1] || '';
      const value = parts[2] || '';
      if (['0F', 'SY', '23', '1L'].includes(qualifier) && value) {
        currentMember.ssn = 'XXX-XX-' + value.slice(-4);
      }
    }

    // Health coverage (HD segment)
    if (segId === 'HD' && currentMember) {
      const planCode = parts[3] || '';
      const planName = parts[4] || '';
      const label = planCode === 'HLT' ? 'Medical' : planCode === 'DEN' ? 'Dental' : planCode === 'VIS' ? 'Vision' : planCode === 'FAC' ? 'Facility' : planCode || 'Coverage';
      currentMember.plans.push({ type: label, name: planName, code: planCode });
    }
  }
  return data;
}

function EnrollmentDataView({ report, parseResult }) {
  const parsed = parseEDISegments(report);
  if (!report && !parseResult) {
    return <div className="text-sm text-slate-400 italic p-4">Loading enrollment data...</div>;
  }
  return (
    <div className="space-y-5">
      <div className="bg-white/60 glass-panel p-5 rounded-2xl shadow-sm border border-white/40">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Transaction Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Purpose</p><p className="text-sm font-semibold text-on-surface">{parsed.purpose || 'ï¿½'}</p></div>
          <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Sender ID</p><p className="text-sm font-mono text-on-surface">{parseResult?.sender_id || 'ï¿½'}</p></div>
          <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Receiver ID</p><p className="text-sm font-mono text-on-surface">{parseResult?.receiver_id || 'ï¿½'}</p></div>
          {parsed.employer && <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Employer</p><p className="text-sm font-semibold text-on-surface">{parsed.employer}</p></div>}
          {parsed.sponsor && <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Sponsor</p><p className="text-sm font-semibold text-on-surface">{parsed.sponsor}</p></div>}
          <div><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Members</p><p className="text-sm font-bold text-primary">{parsed.members.length || 'ï¿½'}</p></div>
        </div>
      </div>
      {parsed.members.length > 0 && (
        <div className="bg-white/60 glass-panel p-5 rounded-2xl shadow-sm border border-white/40">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Member Records ({parsed.members.length})</h3>
          <div className="space-y-4">
            {parsed.members.map((m, i) => (
              <div key={i} className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {(m.firstName?.[0] || '')}{(m.lastName?.[0] || '')}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-on-surface">{[m.firstName, m.middleName, m.lastName].filter(Boolean).join(' ') || 'Member ' + (i + 1)}</p>
                      {m.ssn && <p className="text-[10px] text-slate-400 font-mono">{m.ssn}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {m.relationship && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">{m.relationship}</span>}
                    {m.maintenanceType && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${m.maintenanceType === 'Cancellation' ? 'bg-error/10 text-error' : m.maintenanceType === 'Addition' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {m.maintenanceType}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {m.dob && <div><span className="text-slate-400 font-bold uppercase text-[10px]">DOB</span><p className="font-semibold mt-0.5">{m.dob}</p></div>}
                  {m.gender && <div><span className="text-slate-400 font-bold uppercase text-[10px]">Gender</span><p className="font-semibold mt-0.5">{m.gender}</p></div>}
                  {m.address && <div className="col-span-2"><span className="text-slate-400 font-bold uppercase text-[10px]">Address</span><p className="font-semibold mt-0.5">{[m.address, m.city, m.state, m.zip].filter(Boolean).join(', ')}</p></div>}
                  {m.plans.length > 0 && (
                    <div className="col-span-3 mt-1">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Coverage Plans</span>
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        {m.plans.map((p, pi) => (
                          <span key={pi} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                            {p.type}{p.name ? ' ï¿½ ' + p.name : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RawEDISection({ report }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800 transition-colors" type="button">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Raw EDI Report</h3>
        <span className="material-symbols-outlined text-slate-500 text-lg">{expanded ? 'expand_less' : 'expand_more'}</span>
      </button>
      {expanded && (
        <pre className="px-6 pb-6 font-mono text-[11px] leading-relaxed text-blue-300 whitespace-pre-wrap overflow-x-auto max-h-64">{report}</pre>
      )}
    </div>
  );
}

function MemberDetailCard({ member, parsed, file, parseResult, report }) {
  const [ediExpanded, setEdiExpanded] = useState(false);
  const mainMember = member || (parsed?.members?.[0]);
  const envelope = parseResult?.raw_json?.json_export?.envelope || {};
  const senderId = envelope.sender_id || parseResult?.sender_id || parseResult?.raw_json?.sender_id || 'N/A';
  const receiverId = envelope.receiver_id || parseResult?.receiver_id || parseResult?.raw_json?.receiver_id || 'N/A';
  const txId = `834-${senderId.slice(0,6)}-${(file.id || '').toString().slice(0,4).toUpperCase()}`;

  if (!mainMember) {
    return <div className="text-sm text-slate-400 italic p-4">No member data found in this file.</div>;
  }

  const fullName = [mainMember.firstName, mainMember.middleName, mainMember.lastName].filter(Boolean).join(' ') || 'Unknown Member';
  const maintBadge = mainMember.maintenanceType || 'Update';
  const maintColor = maintBadge === 'Addition' ? 'bg-green-500' : maintBadge === 'Cancellation' ? 'bg-red-500' : 'bg-blue-500';

  const allPlans = mainMember.plans || [];
  const planColors = ['bg-blue-500', 'bg-purple-500', 'bg-teal-500', 'bg-amber-500', 'bg-pink-500', 'bg-indigo-500'];
  const planIcons = ['shield', 'local_hospital', 'health_and_safety', 'medical_services', 'healing', 'emergency'];

  const ediLines = (report || '').split(/~|\r?\n/).map(s => s.trim()).filter(l => l.length > 0).slice(0, 20);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold tracking-tight text-on-surface">{fullName}</h2>
            <span className={`${maintColor} text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-wide`}>{maintBadge}</span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Effective Date: {mainMember.dob || 'N/A'} &bull; Transaction ID: {txId}
          </p>
        </div>
      </div>

      {/* Demographic & Communication */}
      <div className="bg-white/80 border border-slate-200/60 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Demographic Data</h3>
          <span className="material-symbols-outlined text-slate-300 text-lg">person</span>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Legal Name</p>
            <p className="text-sm font-bold text-on-surface mt-0.5">{fullName}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gender / DOB</p>
            <p className="text-sm font-bold text-on-surface mt-0.5">{mainMember.gender || 'N/A'} &bull; {mainMember.dob || 'N/A'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary Address</p>
            <p className="text-sm font-semibold text-on-surface mt-0.5">{mainMember.address || 'N/A'}{mainMember.city ? ', ' + mainMember.city : ''}{mainMember.state ? ', ' + mainMember.state : ''} {mainMember.zip || ''}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SSN (masked)</p>
            <p className="text-sm font-mono font-semibold text-on-surface mt-0.5">{mainMember.ssn || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Health Coverage Plans */}
      <div className="bg-white/80 border border-slate-200/60 rounded-2xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Plans</h3>
        {allPlans.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No coverage plans found in this file.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {allPlans.map((plan, i) => (
              <div key={i} className="flex items-center gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
                <div className={`w-10 h-10 ${planColors[i % planColors.length]} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <span className="material-symbols-outlined text-white text-lg">{planIcons[i % planIcons.length]}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{plan.type || 'Plan'}</p>
                  <p className="text-sm font-bold text-on-surface truncate">{plan.name || 'Active'}</p>
                  <p className="text-[10px] font-semibold text-blue-500">{plan.code || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Employment */}
      <div className="bg-white/80 border border-slate-200/60 rounded-2xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Employment</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employer Name</p>
            <p className="text-sm font-bold text-on-surface mt-0.5">{parsed?.employer || 'N/A'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employment Status</p>
            <p className="mt-0.5"><span className="inline-block text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-green-100 text-green-700 tracking-wide">{mainMember.maintenanceType === 'Cancellation' ? 'Terminated' : 'Full-Time Active'}</span></p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Relationship</p>
            <p className="text-sm font-bold text-on-surface mt-0.5">{mainMember.relationship || 'N/A'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sponsor</p>
            <p className="text-sm font-bold text-on-surface mt-0.5">{parsed?.sponsor || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* EDI Segment Stream */}
      {ediLines.length > 0 && (
        <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl">
          <button onClick={() => setEdiExpanded(!ediExpanded)} className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800 transition-colors" type="button">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">EDI Segment Stream</h3>
            <div className="flex items-center gap-3">
              <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(report); }} className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-blue-400 transition-colors" type="button">Copy Segment</button>
              <span className="material-symbols-outlined text-slate-500 text-lg">{ediExpanded ? 'expand_less' : 'expand_more'}</span>
            </div>
          </button>
          {ediExpanded && (
            <div className="px-6 pb-6 font-mono text-[11px] leading-loose overflow-x-auto max-h-64">
              {ediLines.map((line, i) => {
                const segId = line.trim().split(/[*~]/)[0];
                const colorMap = { ISA: 'text-green-400', GS: 'text-green-400', ST: 'text-green-400', BGN: 'text-yellow-400', NM1: 'text-blue-400', N3: 'text-cyan-400', N4: 'text-cyan-400', INS: 'text-purple-400', DMG: 'text-orange-400', HD: 'text-pink-400', REF: 'text-amber-300', DTP: 'text-red-400', SE: 'text-green-400', GE: 'text-green-400', IEA: 'text-green-400' };
                const color = colorMap[segId] || 'text-blue-300';
                return <div key={i} className={color}>{line}</div>;
              })}
            </div>
          )}
        </div>
      )}

      {/* Additional members */}
      {parsed?.members?.length > 1 && (
        <div className="bg-white/80 border border-slate-200/60 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Additional Members ({parsed.members.length - 1})</h3>
          <div className="space-y-3">
            {parsed.members.slice(1).map((m, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{(m.firstName?.[0] || '')}{(m.lastName?.[0] || '')}</div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{[m.firstName, m.lastName].filter(Boolean).join(' ')}</p>
                    <p className="text-[10px] text-slate-400">{m.relationship || ''} &bull; {m.gender || ''} &bull; {m.dob || ''}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {m.maintenanceType && <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${m.maintenanceType === 'Cancellation' ? 'bg-error/10 text-error' : m.maintenanceType === 'Addition' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{m.maintenanceType}</span>}
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{m.plans?.length || 0} plans</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function useFileParsedData(file) {
  const [parseResult, setParseResult] = useState(null);
  const [rawEdi, setRawEdi] = useState('');

  useEffect(() => {
    if (!file?.id) return;
    setParseResult(null);
    setRawEdi('');
    authFetch('/api/files/' + file.id + '/parse-result')
      .then((r) => r.json())
      .then((data) => setParseResult(data))
      .catch(() => setParseResult(null));
    authFetch('/api/files/' + file.id + '/raw')
      .then((r) => r.text())
      .then((text) => setRawEdi(text))
      .catch(() => setRawEdi(''));
  }, [file?.id]);

  if (!parseResult) return { loading: true, parsed: null, parseResult: null, rawEdi: '' };

  const structuredData = parseResult?.raw_json?.structured_data;
  const report = parseResult?.raw_json?.report || '';
  let parsed = parseEDISegments(rawEdi);

  if (parsed.members.length === 0 && Array.isArray(structuredData) && structuredData.length > 0) {
    parsed = {
      members: structuredData.map((rec) => ({
        lastName: rec.last_name || rec.subscriber_last_name || '',
        firstName: rec.first_name || rec.subscriber_first_name || '',
        middleName: rec.middle_name || '',
        ssn: rec.ssn ? 'XXX-XX-' + String(rec.ssn).slice(-4) : (rec.subscriber_id ? 'ID: ' + rec.subscriber_id : ''),
        dob: rec.date_of_birth || rec.dob || '',
        gender: rec.gender === 'M' ? 'Male' : rec.gender === 'F' ? 'Female' : rec.gender || '',
        address: rec.address_line_1 || rec.address || '',
        city: rec.city || '', state: rec.state || '', zip: rec.zip_code || rec.zip || '',
        relationship: rec.relationship_code === '18' ? 'Self' : rec.relationship_code === '01' ? 'Spouse' : rec.relationship_code === '19' ? 'Child' : rec.relationship || rec.relationship_code || '',
        maintenanceType: rec.maintenance_type_code === '021' ? 'Addition' : rec.maintenance_type_code === '024' ? 'Cancellation' : rec.maintenance_type || rec.action || 'Enrollment',
        plans: (rec.coverage || rec.plans || []).map((c) => ({
          type: c.insurance_line_code === 'HLT' ? 'Medical' : c.insurance_line_code === 'DEN' ? 'Dental' : c.insurance_line_code === 'VIS' ? 'Vision' : c.coverage_type || c.type || c.insurance_line_code || '',
          name: c.plan_name || c.coverage_level || c.name || '', code: c.insurance_line_code || c.code || '',
        })),
      })),
      employer: structuredData[0]?.employer_name || structuredData[0]?.sponsor_name || '',
      sponsor: structuredData[0]?.plan_sponsor || '',
      purpose: structuredData[0]?.transaction_purpose || 'Enrollment',
      coveragePlans: [],
    };
  }

  if (parsed.members.length === 0) {
    const segments = parseResult?.raw_json?.json_export?.segments || [];
    if (segments.length > 0) {
      const segText = segments.map(s => (typeof s === 'string' ? s : (s.raw || s.text || ''))).join('\n');
      parsed = parseEDISegments(segText);
    }
  }

  const envelope = parseResult?.raw_json?.json_export?.envelope || {};
  const senderId = envelope.sender_id || parseResult?.sender_id || parseResult?.raw_json?.sender_id || '';
  const receiverId = envelope.receiver_id || parseResult?.receiver_id || parseResult?.raw_json?.receiver_id || '';

  return { loading: false, parsed, parseResult, rawEdi, report, senderId, receiverId };
}

function FileDetailPanel({ file }) {
  const { loading, parsed, parseResult, rawEdi, report } = useFileParsedData(file);
  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-slate-400 text-sm italic">Loading...</p></div>;
  const mainMember = parsed?.members?.[0];
  return <MemberDetailCard member={mainMember} parsed={parsed} file={file} parseResult={parseResult} report={rawEdi || report} />;
}

function ComparisonDiffPanel({ fileA, fileB }) {
  const dataA = useFileParsedData(fileA);
  const dataB = useFileParsedData(fileB);

  if (dataA.loading || dataB.loading) {
    return (
      <div className="bg-white/80 border border-slate-200/60 rounded-2xl p-8 text-center">
        <p className="text-sm text-slate-400 italic">Loading comparison data...</p>
      </div>
    );
  }

  const membersA = dataA.parsed?.members || [];
  const membersB = dataB.parsed?.members || [];

  if (membersA.length === 0 && membersB.length === 0) {
    return (
      <div className="bg-white/80 border border-slate-200/60 rounded-2xl p-8 text-center">
        <p className="text-sm text-slate-400 italic">No member data available in either file for comparison.</p>
      </div>
    );
  }

  const sameSource = dataA.senderId && dataB.senderId && dataA.senderId === dataB.senderId && dataA.receiverId === dataB.receiverId;

  // Helper: get a member key for matching
  const memberKey = (m) => [m.firstName, m.lastName].filter(Boolean).join(' ').toUpperCase() || m.ssn || '';

  // Helper: compare fields of two members
  const compareMemberFields = (mA, mB) => {
    const fields = [
      { label: 'Full Name', a: [mA?.firstName, mA?.middleName, mA?.lastName].filter(Boolean).join(' '), b: [mB?.firstName, mB?.middleName, mB?.lastName].filter(Boolean).join(' ') },
      { label: 'Date of Birth', a: mA?.dob || '', b: mB?.dob || '' },
      { label: 'Gender', a: mA?.gender || '', b: mB?.gender || '' },
      { label: 'SSN', a: mA?.ssn || '', b: mB?.ssn || '' },
      { label: 'Address', a: [mA?.address, mA?.city, mA?.state, mA?.zip].filter(Boolean).join(', '), b: [mB?.address, mB?.city, mB?.state, mB?.zip].filter(Boolean).join(', ') },
      { label: 'Relationship', a: mA?.relationship || '', b: mB?.relationship || '' },
      { label: 'Maintenance Type', a: mA?.maintenanceType || '', b: mB?.maintenanceType || '' },
    ];
    return { changed: fields.filter(f => f.a !== f.b), unchanged: fields.filter(f => f.a === f.b && (f.a || f.b)) };
  };

  // Match members between A and B
  const keysA = membersA.map(memberKey);
  const keysB = membersB.map(memberKey);

  const matchedPairs = []; // { memberA, memberB, key }
  const addedMembers = [];  // in B but not A
  const removedMembers = []; // in A but not B
  const usedB = new Set();

  keysA.forEach((keyA, idxA) => {
    const idxB = keysB.findIndex((keyB, i) => !usedB.has(i) && keyB === keyA);
    if (idxB !== -1) {
      matchedPairs.push({ memberA: membersA[idxA], memberB: membersB[idxB], key: keyA });
      usedB.add(idxB);
    } else {
      removedMembers.push(membersA[idxA]);
    }
  });
  keysB.forEach((keyB, idxB) => {
    if (!usedB.has(idxB)) {
      addedMembers.push(membersB[idxB]);
    }
  });

  // Envelope-level fields
  const envelopeFields = [
    { label: 'Employer', a: dataA.parsed?.employer || '', b: dataB.parsed?.employer || '' },
    { label: 'Sponsor', a: dataA.parsed?.sponsor || '', b: dataB.parsed?.sponsor || '' },
    { label: 'Transaction Purpose', a: dataA.parsed?.purpose || '', b: dataB.parsed?.purpose || '' },
    { label: 'Total Members', a: String(membersA.length), b: String(membersB.length) },
  ];
  const changedEnvelope = envelopeFields.filter(f => f.a !== f.b);
  const unchangedEnvelope = envelopeFields.filter(f => f.a === f.b && (f.a || f.b));

  // Count total changes
  let totalFieldChanges = changedEnvelope.length;
  matchedPairs.forEach(({ memberA, memberB }) => {
    totalFieldChanges += compareMemberFields(memberA, memberB).changed.length;
  });
  const totalChanges = totalFieldChanges + addedMembers.length + removedMembers.length;

  return (
    <div className="bg-white/80 border border-slate-200/60 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-200/40 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="material-symbols-outlined text-white text-lg">difference</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface">Comparison Analysis</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {totalChanges === 0 ? 'No differences found between the two files.' : `${totalChanges} difference${totalChanges > 1 ? 's' : ''} detected across ${membersA.length + membersB.length} member records`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sameSource && (
              <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">link</span>Same Source
              </span>
            )}
            <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${totalChanges === 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {totalChanges === 0 ? 'Identical' : `${totalChanges} Changes`}
            </span>
          </div>
        </div>
        {sameSource && (
          <div className="mt-3 p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-start gap-2">
            <span className="material-symbols-outlined text-indigo-500 text-base mt-0.5">info</span>
            <p className="text-[11px] text-indigo-700 leading-relaxed">
              Both files originate from the same source (<strong>{dataA.senderId}</strong> → <strong>{dataA.receiverId}</strong>). Differences below represent changes between enrollment records.
            </p>
          </div>
        )}
      </div>

      {/* Envelope-level changes */}
      {changedEnvelope.length > 0 && (
        <div className="p-5 border-b border-slate-200/40">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-amber-500 text-sm">edit_note</span>Transaction-Level Changes
          </h4>
          <div className="rounded-xl overflow-hidden border border-slate-200/60">
            <div className="grid grid-cols-[160px_1fr_1fr] bg-slate-100/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <div className="px-4 py-2.5">Field</div>
              <div className="px-4 py-2.5 flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center text-[9px] font-black text-primary">A</span>{fileA.filename}</div>
              <div className="px-4 py-2.5 flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-amber-500/10 flex items-center justify-center text-[9px] font-black text-amber-600">B</span>{fileB.filename}</div>
            </div>
            {changedEnvelope.map((f, i) => (
              <div key={f.label} className={`grid grid-cols-[160px_1fr_1fr] ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                <div className="px-4 py-3 text-xs font-semibold text-slate-600 border-r border-slate-100">{f.label}</div>
                <div className="px-4 py-3 text-xs border-r border-slate-100">{f.a ? <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-semibold">{f.a}</span> : <span className="text-slate-300 italic">Empty</span>}</div>
                <div className="px-4 py-3 text-xs">{f.b ? <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-semibold">{f.b}</span> : <span className="text-slate-300 italic">Empty</span>}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Added members (only in File B) */}
      {addedMembers.length > 0 && (
        <div className="p-5 border-b border-slate-200/40">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-green-500 text-sm">person_add</span>New Members in File B ({addedMembers.length})
          </h4>
          <div className="space-y-2">
            {addedMembers.map((m, i) => {
              const name = [m.firstName, m.middleName, m.lastName].filter(Boolean).join(' ') || 'Unknown';
              return (
                <div key={'add-' + i} className="p-4 bg-green-50/80 rounded-xl border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-green-600 text-base">person_add</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-green-800">{name}</p>
                        <p className="text-[10px] text-green-600">{m.relationship || ''} {m.dob ? '• ' + m.dob : ''} {m.gender ? '• ' + m.gender : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {m.maintenanceType && <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${m.maintenanceType === 'Cancellation' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{m.maintenanceType}</span>}
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-200 text-green-800 uppercase">Added</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {m.address && <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700">{[m.address, m.city, m.state, m.zip].filter(Boolean).join(', ')}</span>}
                    {m.ssn && <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700 font-mono">{m.ssn}</span>}
                    {(m.plans || []).map((p, pi) => <span key={pi} className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700">{p.type}{p.name ? ' — ' + p.name : ''}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Removed members (only in File A) */}
      {removedMembers.length > 0 && (
        <div className="p-5 border-b border-slate-200/40">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-red-500 text-sm">person_remove</span>Removed Members from File A ({removedMembers.length})
          </h4>
          <div className="space-y-2">
            {removedMembers.map((m, i) => {
              const name = [m.firstName, m.middleName, m.lastName].filter(Boolean).join(' ') || 'Unknown';
              return (
                <div key={'rem-' + i} className="p-4 bg-red-50/80 rounded-xl border border-red-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-red-600 text-base">person_remove</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-red-800">{name}</p>
                        <p className="text-[10px] text-red-600">{m.relationship || ''} {m.dob ? '• ' + m.dob : ''} {m.gender ? '• ' + m.gender : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {m.maintenanceType && <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${m.maintenanceType === 'Cancellation' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{m.maintenanceType}</span>}
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-200 text-red-800 uppercase">Removed</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {m.address && <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700">{[m.address, m.city, m.state, m.zip].filter(Boolean).join(', ')}</span>}
                    {m.ssn && <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700 font-mono">{m.ssn}</span>}
                    {(m.plans || []).map((p, pi) => <span key={pi} className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700">{p.type}{p.name ? ' — ' + p.name : ''}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modified matched members */}
      {matchedPairs.map(({ memberA, memberB, key }, pairIdx) => {
        const { changed, unchanged } = compareMemberFields(memberA, memberB);
        const plansAStr = (memberA.plans || []).map(p => `${p.type}${p.name ? ' — ' + p.name : ''}`);
        const plansBStr = (memberB.plans || []).map(p => `${p.type}${p.name ? ' — ' + p.name : ''}`);
        const addedP = plansBStr.filter(p => !plansAStr.includes(p));
        const removedP = plansAStr.filter(p => !plansBStr.includes(p));
        const hasDiffs = changed.length > 0 || addedP.length > 0 || removedP.length > 0;
        if (!hasDiffs) return null;

        const name = [memberA.firstName, memberA.lastName].filter(Boolean).join(' ') || key;
        return (
          <div key={'pair-' + pairIdx} className="p-5 border-b border-slate-200/40">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-500 text-sm">swap_horiz</span>
              Changed Member: <span className="text-slate-700 normal-case font-extrabold">{name}</span>
            </h4>
            {changed.length > 0 && (
              <div className="rounded-xl overflow-hidden border border-slate-200/60 mb-3">
                <div className="grid grid-cols-[140px_1fr_1fr] bg-slate-100/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <div className="px-3 py-2">Field</div>
                  <div className="px-3 py-2">File A</div>
                  <div className="px-3 py-2">File B</div>
                </div>
                {changed.map((f, i) => (
                  <div key={f.label} className={`grid grid-cols-[140px_1fr_1fr] ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <div className="px-3 py-2.5 text-xs font-semibold text-slate-600 border-r border-slate-100">{f.label}</div>
                    <div className="px-3 py-2.5 text-xs border-r border-slate-100">{f.a ? <span className="bg-red-50 text-red-700 px-1 py-0.5 rounded font-semibold">{f.a}</span> : <span className="text-slate-300 italic">Empty</span>}</div>
                    <div className="px-3 py-2.5 text-xs">{f.b ? <span className="bg-green-50 text-green-700 px-1 py-0.5 rounded font-semibold">{f.b}</span> : <span className="text-slate-300 italic">Empty</span>}</div>
                  </div>
                ))}
              </div>
            )}
            {(addedP.length > 0 || removedP.length > 0) && (
              <div className="space-y-1.5">
                {removedP.map((p, i) => (
                  <div key={'rp-' + i} className="flex items-center gap-2 text-xs p-2 bg-red-50/80 rounded-lg border border-red-100">
                    <span className="material-symbols-outlined text-red-400 text-sm">remove_circle</span>
                    <span className="font-semibold text-red-700">{p}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 uppercase ml-auto">Removed</span>
                  </div>
                ))}
                {addedP.map((p, i) => (
                  <div key={'ap-' + i} className="flex items-center gap-2 text-xs p-2 bg-green-50/80 rounded-lg border border-green-100">
                    <span className="material-symbols-outlined text-green-500 text-sm">add_circle</span>
                    <span className="font-semibold text-green-700">{p}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-600 uppercase ml-auto">Added</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Unchanged members */}
      {matchedPairs.filter(({ memberA, memberB }) => {
        const { changed } = compareMemberFields(memberA, memberB);
        const plA = (memberA.plans || []).map(p => `${p.type}${p.name ? ' — ' + p.name : ''}`);
        const plB = (memberB.plans || []).map(p => `${p.type}${p.name ? ' — ' + p.name : ''}`);
        return changed.length === 0 && plA.join(',') === plB.join(',');
      }).length > 0 && (
        <div className="p-5 border-b border-slate-200/40">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
            Unchanged Members ({matchedPairs.filter(({ memberA, memberB }) => {
              const { changed } = compareMemberFields(memberA, memberB);
              const plA = (memberA.plans || []).map(p => `${p.type}${p.name ? ' — ' + p.name : ''}`);
              const plB = (memberB.plans || []).map(p => `${p.type}${p.name ? ' — ' + p.name : ''}`);
              return changed.length === 0 && plA.join(',') === plB.join(',');
            }).length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {matchedPairs.filter(({ memberA, memberB }) => {
              const { changed } = compareMemberFields(memberA, memberB);
              const plA = (memberA.plans || []).map(p => `${p.type}${p.name ? ' — ' + p.name : ''}`);
              const plB = (memberB.plans || []).map(p => `${p.type}${p.name ? ' — ' + p.name : ''}`);
              return changed.length === 0 && plA.join(',') === plB.join(',');
            }).map(({ memberA, key }, i) => (
              <span key={i} className="text-[10px] font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-green-400 text-[12px]">check</span>
                {[memberA.firstName, memberA.lastName].filter(Boolean).join(' ') || key}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Unchanged envelope fields */}
      {unchangedEnvelope.length > 0 && (
        <div className="p-5">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>Unchanged Fields ({unchangedEnvelope.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {unchangedEnvelope.map((f) => (
              <span key={f.label} className="text-[10px] font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1.5">
                {f.label}: <strong className="text-slate-700">{f.a || 'N/A'}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-5 border-t border-slate-200/40">
        <div className="p-4 text-center border-r border-slate-200/40">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Modified Fields</p>
          <p className="text-lg font-black text-amber-500">{totalFieldChanges}</p>
        </div>
        <div className="p-4 text-center border-r border-slate-200/40">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Members Added</p>
          <p className="text-lg font-black text-green-600">{addedMembers.length}</p>
        </div>
        <div className="p-4 text-center border-r border-slate-200/40">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Members Removed</p>
          <p className="text-lg font-black text-red-500">{removedMembers.length}</p>
        </div>
        <div className="p-4 text-center border-r border-slate-200/40">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Members Matched</p>
          <p className="text-lg font-black text-blue-500">{matchedPairs.length}</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Members</p>
          <p className="text-lg font-black text-slate-400">{membersA.length} → {membersB.length}</p>
        </div>
      </div>
    </div>
  );
}


export function Enrollment834Page() {
  const { permissions } = useAuth();
  const canClaims = canAny(permissions, CLAIMS_ACCESS_PERMISSIONS);
  const canEnrollment = canAny(permissions, ENROLLMENT_ACCESS_PERMISSIONS);
  const canRemittance = canAny(permissions, REMITTANCE_ACCESS_PERMISSIONS);

  const [collapsed, setCollapsed] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [enrollFiles, setEnrollFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareFile, setCompareFile] = useState(null);

  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;
    return () => { document.body.className = previous; };
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const files = await authFetch('/api/files').then((r) => r.json());
        const ef = Array.isArray(files) ? files.filter((f) => f.transaction_type === '834') : [];
        setEnrollFiles(ef);
        if (ef.length > 0) {
          setSelectedFile(ef[0]);
        }
      } catch (e) { console.error(e); }
    }
    load();
  }, []);

  function handleFileClick(file) {
    if (compareMode && selectedFile && file.id !== selectedFile.id) {
      setCompareFile(file);
    } else {
      setSelectedFile(file);
      setCompareFile(null);
      setCompareMode(false);
    }
  }

  function toggleCompare() {
    if (compareMode) {
      setCompareMode(false);
      setCompareFile(null);
    } else {
      setCompareMode(true);
      setCompareFile(null);
    }
  }

  const displayedFiles = enrollFiles.filter((f) =>
    !searchQuery || f.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col overflow-y-auto overflow-x-hidden">
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-between items-center px-6 py-3 shadow-sm dark:shadow-none transition-all duration-200">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white cursor-pointer" onClick={() => { window.location.href = '/dashboard_sleek'; }}>EdiPro</span>
          <nav className="hidden md:flex gap-6">
            <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/dashboard_sleek">Dashboard</a>
            {canClaims ? (
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/837_claims_view">Reports</a>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-full px-3 py-1.5 transition-all">
            <span className="material-symbols-outlined text-[20px] text-slate-500">search</span>
            <input
              className="bg-transparent border-none focus:ring-0 text-sm w-48 placeholder:text-slate-400"
              placeholder="Search files..."
              type="text"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  localStorage.setItem('globalSearch', e.target.value.trim());
                  window.location.href = '/master_parser_sleek';
                }
              }}
            />
          </div>
          <a className="p-2 hover:bg-slate-100/50 rounded-full transition-all active:scale-95" href="/notifications" aria-label="Open notifications">
            <span className="material-symbols-outlined text-slate-600">notifications</span>
          </a>
          <a className="p-2 hover:bg-slate-100/50 rounded-full transition-all active:scale-95" href="/settings" aria-label="Open settings">
            <span className="material-symbols-outlined text-slate-600">settings</span>
          </a>
          <a className="h-8 w-8 rounded-full overflow-hidden bg-primary/10 ring-2 ring-white shadow-sm" href="/user_profile" aria-label="Open user profile">
            <img className="w-full h-full object-cover" data-alt="User Profile Avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCgEW3dXZf1xhBDmpkybJnr21bF6HNiuHphHXF5ZMfTdghbWasho84cnLb8S8iQpaeSBw-fhCGaMQOMakuyIgNossftgFDuvXrrfI8AS1HQ8aXsiiN5jRf5UzMPR3aYhNr7MVZQn2pGVvp51bgB4LzOmkYlr8r84vKcVrNDmd6f9yQ467G7lXlyPhygUgNeyILrY9rjqiqU5HuLzz86Snbq7D27lzvqCYzPfDWO80nIxy6mb85n7yl0OJhP3SQqzcbgwDSKCUiG7ach" alt="User Profile Avatar" />
          </a>
        </div>
      </header>

      <div className="flex flex-1 pt-16">
        <aside className="fixed left-0 top-0 h-full w-64 z-40 bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-2xl border-r border-slate-200/30 dark:border-slate-800/30 shadow-xl dark:shadow-2xl flex flex-col py-6 pt-20">
          <div className="px-6 mb-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white leading-none">HealthConnect</h2>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">EDI Gateway</p>
            </div>
          </div>
          <nav className="flex-1 px-2 space-y-1">
            <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]" href="/dashboard_sleek">
              <span className="material-symbols-outlined">dashboard</span>
              <span className="text-sm font-medium">Dashboard</span>
            </a>
            <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]" href="/master_parser_sleek">
              <span className="material-symbols-outlined">analytics</span>
              <span className="text-sm font-medium">Master Parser</span>
            </a>
            {canRemittance ? (
              <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]" href="/835_remittance_sleek">
                <span className="material-symbols-outlined">payments</span>
                <span className="text-sm font-medium">835 Remittance</span>
              </a>
            ) : null}
            {canEnrollment ? (
              <a className="bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg mx-2 flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide scale-100 active:scale-[0.98] transition-transform duration-300" href="/834_enrollment_sleek">
                <span className="material-symbols-outlined">group_add</span>
                <span className="text-sm font-bold">834 Enrollment</span>
              </a>
            ) : null}
            {canClaims ? (
              <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]" href="/837_claims_view">
                <span className="material-symbols-outlined">description</span>
                <span className="text-sm font-medium">837 Claims</span>
              </a>
            ) : null}
          </nav>
          <div className="mt-auto px-4 pb-4">
            <button className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all mb-4" onClick={() => window.location.href = '/dashboard_sleek'} type="button">
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              New Submission
            </button>
            <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 rounded-lg flex items-center gap-3 px-4 py-2 text-xs font-medium tracking-wide hover:translate-x-1 transition-transform duration-300" href="/help_center">
              <span className="material-symbols-outlined">help</span>
              <span className="text-xs font-medium">Help Center</span>
            </a>
            <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 rounded-lg flex items-center gap-3 px-4 py-2 text-xs font-medium tracking-wide hover:translate-x-1 transition-transform duration-300" href="/documentation">
              <span className="material-symbols-outlined">menu_book</span>
              <span className="text-xs font-medium">Documentation</span>
            </a>
          </div>
        </aside>

        <main className="ml-64 flex-1 flex bg-surface-container-low relative">
          <div className={`${collapsed ? 'w-0 overflow-hidden' : 'w-1/3 min-w-[280px]'} bg-white/40 glass-panel border-r border-outline-variant/10 flex flex-col overflow-hidden transition-all duration-300 relative`}>
            {!collapsed && (
              <>
                <div className="p-6 border-b border-outline-variant/5">
                  <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold tracking-tight text-on-surface">Members</h1>
                    <div className="flex items-center gap-2">
                      <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">{enrollFiles.length > 0 ? 'ACTIVE BATCH' : 'NO FILES'}</span>
                      <button onClick={() => setCollapsed(true)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors" title="Collapse panel" type="button">
                        <span className="material-symbols-outlined text-slate-400 text-lg">chevron_left</span>
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-surface-container-lowest border-none rounded-xl py-2 pl-10 pr-4 text-xs focus:ring-2 focus:ring-primary/10 transition-all"
                      placeholder="Filter by name or SSN"
                      type="text"
                    />
                  </div>
                </div>
                <div className="flex-1 p-4 space-y-2 overflow-y-auto" style={{maxHeight: 'calc(100vh - 220px)'}}>
                  {compareMode && (
                    <div className="p-3 mb-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-500 text-base">compare_arrows</span>
                      <p className="text-[11px] font-semibold text-amber-700">Select a second file to compare with <strong>{selectedFile?.filename}</strong></p>
                    </div>
                  )}
                  {displayedFiles.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-400 italic">
                      {enrollFiles.length === 0 ? 'No 834 enrollment files uploaded yet.' : 'No results match your search.'}
                    </div>
                  ) : displayedFiles.map((file) => {
                    const isSelected = selectedFile?.id === file.id;
                    const isCompareTarget = compareFile?.id === file.id;
                    const initials = file.filename.substring(0, 2).toUpperCase();
                    const cardClass = isCompareTarget
                      ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/20'
                      : isSelected
                        ? 'bg-primary text-white shadow-xl shadow-primary/20'
                        : 'bg-white/80 shadow-sm border border-transparent hover:border-primary/20 hover:shadow-md';
                    return (
                      <div
                        key={file.id}
                        onClick={() => handleFileClick(file)}
                        className={`p-4 rounded-2xl cursor-pointer transition-all ${cardClass}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${(isSelected || isCompareTarget) ? 'bg-white/20 text-white' : 'bg-gradient-to-br from-blue-100 to-blue-200 text-primary'}`}>{initials}</div>
                            <div>
                              <p className={`font-bold text-sm ${(isSelected || isCompareTarget) ? 'text-white' : 'text-on-surface'}`}>{file.filename}</p>
                              <p className={`text-[10px] font-mono tracking-tight ${(isSelected || isCompareTarget) ? 'text-white/70' : 'text-slate-500'}`}>{file.error_count} errors &bull; {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isCompareTarget && <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-white/20 text-white tracking-tighter uppercase">Compare</span>}
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-tighter uppercase ${file.is_valid ? ((isSelected || isCompareTarget) ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700') : ((isSelected || isCompareTarget) ? 'bg-red-200/30 text-white' : 'bg-red-100 text-error')}`}>
                              {file.is_valid ? 'Valid' : 'Error'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="flex-1 p-8 relative overflow-y-auto">
            {collapsed && (
              <button onClick={() => setCollapsed(false)} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-r-xl p-2 hover:bg-primary/5 transition-colors" type="button">
                <span className="material-symbols-outlined text-primary text-lg">chevron_right</span>
              </button>
            )}
            {!selectedFile ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400 text-sm">Select a file from the left panel to view details.</p>
              </div>
            ) : (
              <div>
                {/* Action bar */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase ${selectedFile.is_valid ? 'bg-green-100 text-green-700' : 'bg-error/10 text-error'}`}>
                      {selectedFile.is_valid ? 'Valid' : `${selectedFile.error_count} Errors`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleCompare}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${compareMode ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-base">compare_arrows</span>
                      {compareMode ? (compareFile ? 'Exit Compare' : 'Selecting...') : 'Compare'}
                    </button>
                    <button onClick={() => { localStorage.setItem('selectedFileId', selectedFile.id); window.location.href = '/master_parser_sleek'; }} className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-2" type="button">
                      <span className="material-symbols-outlined text-base">open_in_new</span>
                      Open in Parser
                    </button>
                  </div>
                </div>

                {/* Content: single or split view */}
                {compareFile ? (
                  <div className="space-y-6">
                    {/* Side-by-side panels */}
                    <div className="flex gap-4">
                      <div className="flex-1 border-r border-slate-200/50 pr-4">
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200/50">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-primary">A</span>
                          </div>
                          <p className="text-sm font-bold text-on-surface">{selectedFile.filename}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">Original</span>
                        </div>
                        <FileDetailPanel file={selectedFile} />
                      </div>
                      <div className="flex-1 pl-4">
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-amber-200/50">
                          <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-amber-600">B</span>
                          </div>
                          <p className="text-sm font-bold text-on-surface">{compareFile.filename}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 uppercase">Compare</span>
                        </div>
                        <FileDetailPanel file={compareFile} />
                      </div>
                    </div>

                    {/* Comparison diff panel */}
                    <ComparisonDiffPanel fileA={selectedFile} fileB={compareFile} />
                  </div>
                ) : (
                  <FileDetailPanel file={selectedFile} />
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <button className="w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center" type="button">
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>
    </div>
  );
}
