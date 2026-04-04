import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { authFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import {
  canAny,
  CLAIMS_ACCESS_PERMISSIONS,
  ENROLLMENT_ACCESS_PERMISSIONS,
  REMITTANCE_ACCESS_PERMISSIONS
} from '../auth/permissions';

const bodyClassName = 'bg-background font-body text-on-background antialiased selection:bg-primary/10 selection:text-primary page-enrollment';

function parseEDISegments(report) {
  const lines = (report || '').split('\n');
  const data = { members: [], employer: '', sponsor: '', purpose: '', coveragePlans: [] };
  let currentMember = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('BGN')) {
      if (trimmed.includes('00') || trimmed.includes('RX')) data.purpose = 'Original';
      else if (trimmed.includes('15')) data.purpose = 'Change';
      else if (trimmed.includes('22')) data.purpose = 'Information Copy';
      else data.purpose = 'Enrollment';
    }
    if (trimmed.includes('NM1') && trimmed.includes('36')) {
      const parts = trimmed.split(/[*~]/);
      if (parts[3]) data.employer = parts[3].replace(/\*/g, ' ').trim();
    }
    if (trimmed.includes('NM1') && trimmed.includes('P5')) {
      const parts = trimmed.split(/[*~]/);
      if (parts[3]) data.sponsor = parts[3].replace(/\*/g, ' ').trim();
    }
    if (trimmed.includes('NM1') && trimmed.includes('IL')) {
      const parts = trimmed.split(/[*~]/);
      currentMember = {
        lastName: parts[3] || '', firstName: parts[4] || '', middleName: parts[5] || '',
        ssn: '', dob: '', gender: '', address: '', city: '', state: '', zip: '',
        relationship: '', maintenanceType: '', plans: [],
      };
      data.members.push(currentMember);
    }
    if (trimmed.startsWith('INS') && currentMember) {
      const parts = trimmed.split(/[*~]/);
      const rel = parts[2] || '', maint = parts[3] || '';
      currentMember.relationship = rel === '18' ? 'Self' : rel === '01' ? 'Spouse' : rel === '19' ? 'Child' : rel;
      currentMember.maintenanceType = maint === '030' ? 'Cancellation' : maint === '001' ? 'Addition' : maint === '025' ? 'Change' : maint === '021' ? 'Disability' : maint;
    }
    if (trimmed.startsWith('DMG') && currentMember) {
      const parts = trimmed.split(/[*~]/);
      const dob = parts[2] || '', gender = parts[3] || '';
      if (dob.length === 8) currentMember.dob = dob.substring(4, 6) + '/' + dob.substring(6, 8) + '/' + dob.substring(0, 4);
      currentMember.gender = gender === 'M' ? 'Male' : gender === 'F' ? 'Female' : gender === 'U' ? 'Unknown/Non-Binary' : gender;
    }
    if (trimmed.startsWith('N3') && currentMember) {
      const parts = trimmed.split(/[*~]/);
      currentMember.address = parts[1] || '';
    }
    if (trimmed.startsWith('N4') && currentMember) {
      const parts = trimmed.split(/[*~]/);
      currentMember.city = parts[1] || ''; currentMember.state = parts[2] || ''; currentMember.zip = parts[3] || '';
    }
    if (trimmed.startsWith('REF') && currentMember) {
      const parts = trimmed.split(/[*~]/);
      if (parts[1] === '0F' || parts[1] === 'SY' || parts[1] === '23') {
        currentMember.ssn = 'XXX-XX-' + (parts[2] || '').slice(-4);
      }
    }
    if (trimmed.startsWith('HD') && currentMember) {
      const parts = trimmed.split(/[*~]/);
      const planType = parts[3] || '', planName = parts[4] || '';
      const coverageType = planType === 'HLT' ? 'Medical' : planType === 'DEN' ? 'Dental' : planType === 'VIS' ? 'Vision' : planType === 'FAC' ? 'Facility' : planType;
      currentMember.plans.push({ type: coverageType, name: planName, code: planType });
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

function SelectedFileView({ file, aiInsight, aiLoading }) {
  const [parseResult, setParseResult] = useState(null);
  useEffect(() => {
    if (!file?.id) return;
    authFetch('/api/files/' + file.id + '/parse-result')
      .then((r) => r.json())
      .then((data) => setParseResult(data))
      .catch(() => setParseResult(null));
  }, [file?.id]);

  const report = parseResult?.raw_json?.report || '';
  const envelope = parseResult?.raw_json?.json_export?.envelope || {};
  const senderId = envelope.sender_id || parseResult?.sender_id || parseResult?.raw_json?.sender_id || 'N/A';
  const receiverId = envelope.receiver_id || parseResult?.receiver_id || parseResult?.raw_json?.receiver_id || 'N/A';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-on-surface">{file.filename}</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Transaction: 834 &bull; Sender: {senderId} &bull; Receiver: {receiverId} &bull; Date: {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : 'N/A'}
          </p>
        </div>
        <div className="flex gap-3">
          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase ${file.is_valid ? 'bg-green-100 text-green-700' : 'bg-error/10 text-error'}`}>
            {file.is_valid ? 'Valid' : `${file.error_count} Errors`}
          </span>
          <button onClick={() => { localStorage.setItem('selectedFileId', file.id); window.location.href = '/master_parser_sleek'; }} className="px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all" type="button">
            Open in Parser
          </button>
        </div>
      </div>

      <div className="bg-tertiary/5 border border-tertiary/10 p-5 rounded-2xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-tertiary text-lg">auto_awesome</span>
          <h3 className="text-sm font-bold text-tertiary uppercase tracking-widest">AI Insight</h3>
        </div>
        <div className="text-sm text-tertiary font-medium leading-relaxed"><ReactMarkdown components={{ h3: ({children}) => <span className="block font-bold text-sm mt-1">{children}</span>, strong: ({children}) => <strong className="font-bold">{children}</strong>, ul: ({children}) => <ul className="list-disc list-inside space-y-0.5 mt-0.5">{children}</ul>, li: ({children}) => <li className="text-sm">{children}</li>, p: ({children}) => <span className="block mt-0.5">{children}</span> }}>{aiLoading ? "Analyzing file..." : (aiInsight || "No insight available.")}</ReactMarkdown></div>
        {!aiLoading && aiInsight && (
          <button onClick={() => { localStorage.setItem('selectedFileId', file.id); window.location.href = '/master_parser_sleek'; }} className="mt-3 text-xs font-bold text-tertiary bg-white/60 py-2 px-4 rounded-lg border border-tertiary/20 hover:bg-tertiary hover:text-white transition-all" type="button">
            Apply Correction in Parser
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Segments', value: parseResult?.segment_count || 'ï¿½', color: 'text-on-surface' },
          { label: 'Errors', value: file.error_count || 0, color: 'text-error' },
          { label: 'Warnings', value: file.warning_count || 0, color: 'text-amber-500' },
          { label: 'Status', value: file.is_valid ? 'Valid' : 'Invalid', color: file.is_valid ? 'text-green-600' : 'text-error' },
        ].map((s) => (
          <div key={s.label} className="bg-surface-container-low p-4 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{s.label}</p>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <EnrollmentDataView report={report} parseResult={parseResult} />
      {report && <RawEDISection report={report} />}
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
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

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
          selectFile(ef[0]);
        }
      } catch (e) { console.error(e); }
    }
    load();
  }, []);

  async function selectFile(file) {
    setSelectedFile(file);
    setAiInsight('');
    setAiLoading(true);
    try {
      const res = await authFetch('/api/copilot/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: file.id })
      });
      const data = await res.json();
      const insight = data.critical_issues?.length > 0
        ? data.critical_issues[0]
        : (data.bullets?.[0] || 'File appears structurally sound.');
      setAiInsight(insight);
    } catch (e) {
      setAiInsight('Unable to load AI insight.');
    } finally {
      setAiLoading(false);
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
                  {displayedFiles.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-400 italic">
                      {enrollFiles.length === 0 ? 'No 834 enrollment files uploaded yet.' : 'No results match your search.'}
                    </div>
                  ) : displayedFiles.map((file) => {
                    const isSelected = selectedFile?.id === file.id;
                    const initials = file.filename.substring(0, 2).toUpperCase();
                    return (
                      <div
                        key={file.id}
                        onClick={() => selectFile(file)}
                        className={`p-4 rounded-2xl cursor-pointer transition-all ${isSelected ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'bg-white/80 shadow-sm border border-transparent hover:border-primary/20 hover:shadow-md'}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isSelected ? 'bg-white/20 text-white' : 'bg-gradient-to-br from-blue-100 to-blue-200 text-primary'}`}>{initials}</div>
                            <div>
                              <p className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-on-surface'}`}>{file.filename}</p>
                              <p className={`text-[10px] font-mono tracking-tight ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>{file.error_count} errors &bull; {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : ''}</p>
                            </div>
                          </div>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-tighter uppercase ${file.is_valid ? (isSelected ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700') : (isSelected ? 'bg-red-200/30 text-white' : 'bg-red-100 text-error')}`}>
                            {file.is_valid ? 'Valid' : 'Error'}
                          </span>
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
              <SelectedFileView file={selectedFile} aiInsight={aiInsight} aiLoading={aiLoading} />
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
