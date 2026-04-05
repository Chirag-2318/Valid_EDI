import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { authFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import {
  canAny,
  CLAIMS_ACCESS_PERMISSIONS,
  ENROLLMENT_ACCESS_PERMISSIONS,
  REMITTANCE_ACCESS_PERMISSIONS
} from '../auth/permissions';

const bodyClassName = 'bg-background font-body text-on-background antialiased selection:bg-primary/10 selection:text-primary page-remittance';

const CLAIM_STATUS_LABELS = {
  '1': 'Processed as primary',
  '2': 'Processed as secondary',
  '3': 'Processed as tertiary',
  '4': 'Denied',
  '19': 'Processed as primary, forwarded to additional payer',
  '20': 'Processed as secondary, forwarded to additional payer',
  '21': 'Processed as tertiary, forwarded to additional payer',
  '22': 'Reversal of previous payment',
  '23': 'Not our claim, forwarded to additional payer',
  '25': 'Predetermination pricing only'
};

const ADJUSTMENT_GROUP_LABELS = {
  CO: 'Contractual obligation',
  PR: 'Patient responsibility',
  OA: 'Other adjustment',
  PI: 'Payer initiated adjustment'
};

const ADJUSTMENT_REASON_LABELS = {
  '1': 'Deductible',
  '2': 'Coinsurance',
  '3': 'Co-payment',
  '23': 'Impact of prior payer(s)',
  '45': 'Contractual obligation',
  '96': 'Non-covered charge',
  '97': 'Included in allowance for another service'
};

const PAYMENT_REF_QUALIFIERS = new Set(['EV', 'F8', '1K', 'TJ']);

function toAmount(value) {
  const numeric = parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoney(value) {
  return `$${toAmount(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getClaimId(claim) {
  return String(
    claim?.patient_account
    || claim?.claim_id
    || claim?.patient_control_number
    || claim?.clp_01
    || ''
  ).trim();
}

function adjustmentLabel(groupCode, reasonCode) {
  const group = String(groupCode || '').toUpperCase();
  const reason = String(reasonCode || '').trim();
  const reasonLabel = ADJUSTMENT_REASON_LABELS[reason];
  const groupLabel = ADJUSTMENT_GROUP_LABELS[group] || 'Adjustment';

  if (reasonLabel) {
    return reasonLabel;
  }
  return groupLabel;
}

function aggregateAdjustments(entries) {
  const grouped = new Map();

  (entries || []).forEach((entry) => {
    const group = String(entry?.group || '').toUpperCase();
    const reason = String(entry?.reason || '').trim();
    if (!group || !reason) {
      return;
    }

    const key = `${group}-${reason}`;
    const current = grouped.get(key) || {
      code: key,
      label: adjustmentLabel(group, reason),
      amount: 0
    };
    current.amount += toAmount(entry?.amount);
    grouped.set(key, current);
  });

  return Array.from(grouped.values());
}

function parseAdjustmentText(adjustmentText) {
  if (!adjustmentText || typeof adjustmentText !== 'string') {
    return [];
  }

  return adjustmentText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const matched = part.match(/^([A-Z]{2})-?(\d{1,3})(?::\s*(-?\d+(?:\.\d+)?))?/i);
      if (!matched) {
        return null;
      }
      return {
        group: matched[1].toUpperCase(),
        reason: matched[2],
        amount: toAmount(matched[3])
      };
    })
    .filter(Boolean);
}

function parseCasElements(elements) {
  if (!Array.isArray(elements) || elements.length < 3) {
    return [];
  }

  const group = String(elements[0] || '').toUpperCase();
  const parsed = [];

  for (let idx = 1; idx < elements.length; idx += 3) {
    const reason = String(elements[idx] || '').trim();
    const amount = elements[idx + 1];
    if (!reason) {
      continue;
    }
    parsed.push({ group, reason, amount: toAmount(amount) });
  }

  return parsed;
}

function getClaimStatus(code) {
  const cleanCode = String(code || '').trim();
  return {
    code: cleanCode,
    label: CLAIM_STATUS_LABELS[cleanCode] || 'Status unavailable'
  };
}

function asClaimsArray(rawJson) {
  const structured = rawJson?.structured_data;
  if (Array.isArray(structured)) {
    return structured;
  }
  if (structured && Array.isArray(structured.claims)) {
    return structured.claims;
  }
  const exportedClaims = rawJson?.json_export?.claims;
  if (Array.isArray(exportedClaims)) {
    return exportedClaims;
  }
  return [];
}

function normalizeClaimFromStructured(claim, fallbackPaymentRef = '') {
  const claimId = getClaimId(claim);
  const status = getClaimStatus(claim?.claim_status_code || claim?.status_code || claim?.claim_status);
  const patientName = String(claim?.patient_name || claim?.patient || '').trim();
  const paymentReference = String(claim?.eft_or_check_ref || claim?.payment_reference || fallbackPaymentRef || '').trim();
  const adjustments = Array.isArray(claim?.adjustments)
    ? claim.adjustments
    : parseAdjustmentText(claim?.adjustments);

  return {
    claimId,
    billed: toAmount(claim?.total_charged || claim?.total_charge || claim?.billed_amount || claim?.billed),
    paid: toAmount(claim?.total_paid || claim?.paid_amount || claim?.paid),
    patientResponsibility: toAmount(claim?.patient_responsibility),
    claimStatusCode: status.code,
    claimStatusLabel: status.label,
    patientName: patientName || 'Patient unavailable',
    paymentReference: paymentReference || 'Reference unavailable',
    adjustments: aggregateAdjustments(adjustments)
  };
}

function parseClaimsFromRawEdi(rawEdi, structuredFallback = []) {
  if (!rawEdi || typeof rawEdi !== 'string') {
    return structuredFallback;
  }

  const segmentSeparator = rawEdi.includes('~') ? '~' : '\n';
  const rawSegments = rawEdi
    .replace(/\r/g, '')
    .split(segmentSeparator)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const claims = [];
  const fallbackByClaimId = new Map(
    (structuredFallback || [])
      .filter((row) => row?.claimId)
      .map((row) => [row.claimId, row])
  );

  let currentClaim = null;
  let paymentRef = '';

  const finalizeClaim = () => {
    if (!currentClaim) {
      return;
    }

    const fallback = fallbackByClaimId.get(currentClaim.claimId);
    const status = getClaimStatus(currentClaim.claimStatusCode || fallback?.claimStatusCode);
    claims.push({
      claimId: currentClaim.claimId,
      billed: currentClaim.billed,
      paid: currentClaim.paid,
      patientResponsibility: currentClaim.patientResponsibility,
      claimStatusCode: status.code,
      claimStatusLabel: status.label,
      patientName: currentClaim.patientName || fallback?.patientName || 'Patient unavailable',
      paymentReference: currentClaim.paymentReference || fallback?.paymentReference || 'Reference unavailable',
      adjustments: currentClaim.adjustments.length > 0
        ? aggregateAdjustments(currentClaim.adjustments)
        : (fallback?.adjustments || [])
    });
    currentClaim = null;
  };

  for (const segmentText of rawSegments) {
    const elementSeparator = segmentText.includes('*')
      ? '*'
      : segmentText.includes('|')
        ? '|'
        : '^';
    const parts = segmentText.split(elementSeparator);
    const id = String(parts[0] || '').trim().toUpperCase();
    const elements = parts.slice(1);

    if (id === 'TRN' && elements[1]) {
      paymentRef = String(elements[1]).trim();
      if (currentClaim && !currentClaim.paymentReference) {
        currentClaim.paymentReference = paymentRef;
      }
      continue;
    }

    if (id === 'CLP' && elements.length > 4) {
      finalizeClaim();
      currentClaim = {
        claimId: String(elements[0] || '').trim(),
        claimStatusCode: String(elements[1] || '').trim(),
        billed: toAmount(elements[2]),
        paid: toAmount(elements[3]),
        patientResponsibility: toAmount(elements[4]),
        patientName: '',
        paymentReference: paymentRef,
        adjustments: []
      };
      continue;
    }

    if (id === 'NM1' && currentClaim && String(elements[0] || '').toUpperCase() === 'QC') {
      const lastName = String(elements[2] || '').trim();
      const firstName = String(elements[3] || '').trim();
      const patient = [firstName, lastName].filter(Boolean).join(' ').trim();
      if (patient) {
        currentClaim.patientName = patient;
      }
      continue;
    }

    if (id === 'CAS' && currentClaim) {
      currentClaim.adjustments.push(...parseCasElements(elements));
      continue;
    }

    if (id === 'REF' && elements[1]) {
      const qualifier = String(elements[0] || '').toUpperCase();
      const refValue = String(elements[1]).trim();

      if (PAYMENT_REF_QUALIFIERS.has(qualifier) && !paymentRef) {
        paymentRef = refValue;
      }
      if (currentClaim && PAYMENT_REF_QUALIFIERS.has(qualifier) && !currentClaim.paymentReference) {
        currentClaim.paymentReference = refValue;
      }
    }
  }

  finalizeClaim();
  return claims.length > 0 ? claims : structuredFallback;
}

function buildClaimStories(rawJson) {
  const structuredClaims = asClaimsArray(rawJson);

  let fallbackPaymentRef = '';
  const rawEdi = String(rawJson?.raw_edi || '');
  if (rawEdi.includes('TRN')) {
    const segmentSeparator = rawEdi.includes('~') ? '~' : '\n';
    const trnSegment = rawEdi
      .replace(/\r/g, '')
      .split(segmentSeparator)
      .map((segment) => segment.trim())
      .find((segment) => segment.startsWith('TRN'));
    if (trnSegment) {
      const trnParts = trnSegment.split('*');
      fallbackPaymentRef = String(trnParts[2] || trnParts[1] || '').trim();
    }
  }

  const normalizedStructured = structuredClaims
    .map((claim) => normalizeClaimFromStructured(claim, fallbackPaymentRef))
    .filter((claim) => claim.claimId);

  return parseClaimsFromRawEdi(rawEdi, normalizedStructured);
}

export function Remittance835Page() {
  const { permissions } = useAuth();
  const canClaims = canAny(permissions, CLAIMS_ACCESS_PERMISSIONS);
  const canEnrollment = canAny(permissions, ENROLLMENT_ACCESS_PERMISSIONS);
  const canRemittance = canAny(permissions, REMITTANCE_ACCESS_PERMISSIONS);

  const [allFiles, setAllFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [billedByDate, setBilledByDate] = useState([]);
  const [metrics, setMetrics] = useState({ totalFiles: 0, totalPaid: 0, adjustments: 0, collectionRate: 0 });
  const [expandedRows, setExpandedRows] = useState({});
  const [claimStoriesByFile, setClaimStoriesByFile] = useState({});
  const PAGE_SIZE = 7;

  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;
    return () => { document.body.className = previous; };
  }, []);

  useEffect(() => {
    async function loadRemittanceData() {
      try {
        const files = await authFetch('/api/files?limit=1000').then((r) => r.json());
        const remitFiles = Array.isArray(files) ? files.filter((f) => f.transaction_type === '835') : [];
        const dateMap = {};
        let totalBilled = 0;
        let totalPaid = 0;
        const enriched = await Promise.all(
          remitFiles.map(async (file) => {
            let fileBilled = 0;
            try {
              const pr = await authFetch('/api/files/' + file.id + '/parse-result').then((r) => r.json());
              const sd = pr?.raw_json?.structured_data;
              // 835 structured_data is a dict: { payment_summary, claims: [] }
              const paymentSummary = sd?.payment_summary;
              const claims = sd?.claims || pr?.raw_json?.json_export?.claims || [];
              // Use BPR total_amount from payment_summary if available (most accurate)
              if (paymentSummary?.total_amount) {
                const amt = parseFloat(paymentSummary.total_amount || 0);
                fileBilled += amt;
                totalBilled += amt;
                totalPaid += amt;
              } else {
                for (const claim of claims) {
                  const charge = parseFloat(claim.total_charged || claim.total_charge || claim.billed_amount || 0);
                  const paid = parseFloat(claim.total_paid || claim.paid_amount || 0);
                  fileBilled += charge;
                  totalBilled += charge;
                  totalPaid += paid;
                }
              }
            } catch (e) { /* skip */ }
            const dateKey = file.uploaded_at ? new Date(file.uploaded_at).toISOString().split('T')[0] : 'unknown';
            if (dateKey !== 'unknown') {
              dateMap[dateKey] = (dateMap[dateKey] || 0) + fileBilled;
            }
            return { ...file, fileBilled };
          })
        );
        const adjustments = totalBilled - totalPaid;
        const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;
        const billedArr = Object.entries(dateMap)
          .map(([date, amount]) => ({ date, amount }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setBilledByDate(billedArr);
        setMetrics({ totalFiles: remitFiles.length, totalPaid, adjustments, collectionRate });
        setAllFiles(enriched);
        setFilteredFiles(enriched);
      } catch (err) {
        console.error('Failed to load remittance data:', err);
      }
    }
    loadRemittanceData();
  }, []);

  useEffect(() => {
    setFilteredFiles(
      allFiles.filter((f) =>
        !searchQuery ||
        f.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.sender_id || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
    setCurrentPage(1);
  }, [allFiles, searchQuery]);

  const totalPages = Math.ceil(filteredFiles.length / PAGE_SIZE);
  const pageFiles = filteredFiles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const loadClaimStories = async (fileId) => {
    setClaimStoriesByFile((prev) => ({
      ...prev,
      [fileId]: {
        loading: true,
        error: null,
        claims: []
      }
    }));

    try {
      const response = await authFetch(`/api/files/${fileId}/parse-result`);
      if (!response.ok) {
        throw new Error(`parse-result failed with status ${response.status}`);
      }

      const parseResult = await response.json();
      const rawJson = parseResult?.raw_json || {};
      const claims = buildClaimStories(rawJson);

      setClaimStoriesByFile((prev) => ({
        ...prev,
        [fileId]: {
          loading: false,
          error: null,
          claims
        }
      }));
    } catch (error) {
      console.error('Failed to load claim stories:', error);
      setClaimStoriesByFile((prev) => ({
        ...prev,
        [fileId]: {
          loading: false,
          error: 'Could not load claim-level remittance details for this file.',
          claims: []
        }
      }));
    }
  };

  const toggleRow = (fileId) => {
    const isOpening = !expandedRows[fileId];
    setExpandedRows((prev) => ({ ...prev, [fileId]: isOpening }));

    if (isOpening && !claimStoriesByFile[fileId]) {
      loadClaimStories(fileId);
    }
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-between items-center px-6 py-3 shadow-sm dark:shadow-none transition-all duration-200">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white cursor-pointer flex items-center gap-2" onClick={() => { window.location.href = '/dashboard_sleek'; }}>
            <img src="/logo.png" alt="EdiPro logo" className="h-6 w-6 rounded-md object-contain" />
            <span>EdiPro</span>
          </span>
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
          <button className="md:hidden p-2 hover:bg-slate-100/50 rounded-full transition-all active:scale-95" id="nav-toggle" aria-label="Open navigation menu" type="button">
            <span className="material-symbols-outlined text-slate-700">menu</span>
          </button>
        </div>
      </header>

      <div className="fixed inset-0 bg-slate-900/40 z-30 hidden" id="nav-overlay"></div>

      <aside className="fixed left-0 top-0 h-full w-64 z-40 bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-2xl border-r border-slate-200/30 dark:border-slate-800/30 shadow-xl dark:shadow-2xl flex flex-col py-6 pt-20 transform -translate-x-full md:translate-x-0 transition-transform duration-300" id="side-nav">
        <div className="px-6 mb-8 flex items-center gap-3 cursor-pointer" onClick={() => { window.location.href = '/dashboard_sleek'; }}>
          <img
            src="/logo.png"
            alt="EdiPro logo"
            className="h-10 w-10 rounded-xl object-contain shadow-lg shadow-primary/20"
          />
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-none">EdiPro</h2>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">EDI Gateway</p>
          </div>
          <button className="md:hidden ml-auto p-2 hover:bg-slate-200/50 rounded-full" id="nav-close" aria-label="Close navigation menu" type="button">
            <span className="material-symbols-outlined text-slate-600">close</span>
          </button>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]" href="/dashboard_sleek" data-nav-link="true">
            <span className="material-symbols-outlined">dashboard</span> Dashboard
          </a>
          <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]" href="/master_parser_sleek" data-nav-link="true">
            <span className="material-symbols-outlined">analytics</span> Master Parser
          </a>
          {canRemittance ? (
            <a className="bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg mx-2 flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide scale-100 active:scale-[0.98] transition-transform duration-300" href="/835_remittance_sleek" data-nav-link="true">
              <span className="material-symbols-outlined">payments</span> 835 Remittance
            </a>
          ) : null}
          {canEnrollment ? (
            <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]" href="/834_enrollment_sleek" data-nav-link="true">
              <span className="material-symbols-outlined">group_add</span> 834 Enrollment
            </a>
          ) : null}
          {canClaims ? (
            <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]" href="/837_claims_view" data-nav-link="true">
              <span className="material-symbols-outlined">description</span> 837 Claims
            </a>
          ) : null}
        </nav>
        <div className="mt-auto px-4 pb-4">
          <button className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:brightness-95" onClick={() => console.log('Open New Submission Dialog')} type="button">
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            New Submission
          </button>
        </div>
        <div className="px-2 pt-4 border-t border-slate-200/30 mx-4 space-y-1">
          <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 rounded-lg flex items-center gap-3 px-4 py-2 text-xs font-medium tracking-wide hover:translate-x-1 transition-transform duration-300" href="/help_center" data-nav-link="true">
            <span className="material-symbols-outlined text-[18px]">help</span> Help Center
          </a>
          <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 rounded-lg flex items-center gap-3 px-4 py-2 text-xs font-medium tracking-wide hover:translate-x-1 transition-transform duration-300" href="/documentation" data-nav-link="true">
            <span className="material-symbols-outlined text-[18px]">menu_book</span> Documentation
          </a>
        </div>
      </aside>

      <main className="ml-0 md:ml-64 pt-20 px-4 md:px-8 pb-8 min-h-screen bg-surface">
        <header className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">Remittance Overview</h1>
          <p className="text-on-surface-variant max-w-2xl">Processed 835 Electronic Remittance Advice (ERA) files. Real-time reconciliation and payment validation.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="glass-card p-6 rounded-xl border border-outline-variant/10 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-on-surface-variant text-sm font-semibold uppercase tracking-wider">Total Billed</span>
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <span className="material-symbols-outlined">account_balance_wallet</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold tracking-tight">{metrics.totalFiles} files</span>
              <span className="text-xs text-primary font-medium mt-1">&#8593; {metrics.totalFiles} file(s) this period</span>
            </div>
          </div>
          <div className="glass-card p-6 rounded-xl border border-outline-variant/10 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-on-surface-variant text-sm font-semibold uppercase tracking-wider">Total Paid</span>
              <div className="bg-tertiary/10 p-2 rounded-lg text-tertiary">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold tracking-tight">${metrics.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-xs text-tertiary font-medium mt-1">{metrics.collectionRate}% Collection Rate</span>
            </div>
          </div>
          <div className="glass-card p-6 rounded-xl border border-outline-variant/10 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-on-surface-variant text-sm font-semibold uppercase tracking-wider">Adjustments</span>
              <div className="bg-error/10 p-2 rounded-lg text-error">
                <span className="material-symbols-outlined">analytics</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold tracking-tight">${metrics.adjustments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-xs text-error font-medium mt-1">Rejections optimized (-2.1%)</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.04)] border border-outline-variant/5">
          <div className="px-6 py-5 flex items-center justify-between bg-surface-container-low/50 border-b border-outline-variant/10">
            <div className="flex items-center gap-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 w-64 shadow-sm"
                  placeholder="Search Trace ID or Payer..."
                  type="text"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-sm font-medium border border-outline-variant/10 hover:bg-surface-container-low transition-all" type="button">
                <span className="material-symbols-outlined text-sm">filter_list</span>
                Filter
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-on-surface-variant hover:bg-white rounded-lg transition-all" type="button">
                <span className="material-symbols-outlined">download</span>
              </button>
              <button className="p-2 text-on-surface-variant hover:bg-white rounded-lg transition-all" type="button">
                <span className="material-symbols-outlined">more_horiz</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/30">
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">Trace Number / File ID</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">Type</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant text-right">Errors</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">Processed Date</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">Status</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant"></th>
                </tr>
              </thead>
              <tbody id="remittance-tbody" className="divide-y divide-outline-variant/10">
                {pageFiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400 italic">
                      {allFiles.length === 0 ? 'No 835 remittance files uploaded yet.' : 'No results match your search.'}
                    </td>
                  </tr>
                ) : pageFiles.map((file) => {
                  const isValid = file.is_valid;
                  const statusClass = isValid ? 'bg-[#E6F4EA] text-[#1E7E34]' : 'bg-[#FCE8E8] text-[#D32F2F]';
                  const statusText = isValid ? 'Valid' : 'Error';
                  const isExpanded = !!expandedRows[file.id];
                  const storyState = claimStoriesByFile[file.id] || { loading: false, error: null, claims: [] };

                  return [
                    <tr
                      key={`${file.id}-row`}
                      className="hover:bg-primary/5 transition-colors group cursor-pointer"
                      onClick={() => toggleRow(file.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-on-surface">{file.filename}</span>
                          <span className="text-[10px] text-on-surface-variant font-medium tracking-tight">ID: {file.id.substring(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="text-sm font-medium">{(file.transaction_type || '').toUpperCase()}</span></td>
                      <td className="px-6 py-4 text-right"><span className="text-sm font-medium">{file.error_count || 0} errors</span></td>
                      <td className="px-6 py-4"><span className="text-sm text-on-surface-variant">{file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : '-'}</span></td>
                      <td className="px-6 py-4"><span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusClass}`}>{statusText}</span></td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(file.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-primary hover:bg-primary/10 transition-all"
                            type="button"
                          >
                            {isExpanded ? 'Hide claims' : 'View claims'}
                            <span
                              className="material-symbols-outlined text-sm"
                              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                            >
                              chevron_right
                            </span>
                          </button>
                          <button
                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-primary/10 rounded-lg text-primary transition-all"
                            type="button"
                            title="Open in Master Parser"
                            onClick={(e) => {
                              e.stopPropagation();
                              localStorage.setItem('selectedFileId', file.id);
                              window.location.href = '/master_parser_sleek';
                            }}
                          >
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                          </button>
                        </div>
                      </td>
                    </tr>,
                    isExpanded && (
                      <tr key={`${file.id}-detail`} className="bg-slate-50/60">
                        <td colSpan={6} className="px-6 py-5">
                          <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">835 Remittance Summary</p>
                                <h3 className="text-sm font-extrabold text-slate-900 mt-1">Claim-level Financial Storytelling</h3>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  localStorage.setItem('selectedFileId', file.id);
                                  window.location.href = '/master_parser_sleek';
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-all"
                              >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                Open full parse
                              </button>
                            </div>

                            {storyState.loading ? (
                              <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin inline-block"></span>
                                Building claim summaries from CLP, CAS, NM1/QC, and TRN/REF...
                              </div>
                            ) : storyState.error ? (
                              <p className="text-sm text-red-600">{storyState.error}</p>
                            ) : storyState.claims.length === 0 ? (
                              <p className="text-sm text-slate-500 italic">No claim-level CLP data found in this remittance file.</p>
                            ) : (
                              <div className="space-y-3">
                                {storyState.claims.map((claim, idx) => (
                                  <div key={`${file.id}-claim-${claim.claimId || idx}`} className="rounded-lg border border-slate-200/70 bg-slate-50/60 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Claim ID</p>
                                        <p className="text-sm font-black text-slate-900 mt-1">{claim.claimId || 'Unknown claim'}</p>
                                      </div>
                                      <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 border border-blue-200">
                                        {claim.claimStatusCode ? `${claim.claimStatusCode} - ${claim.claimStatusLabel}` : claim.claimStatusLabel}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                                      <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Billed</p>
                                        <p className="text-sm font-bold text-slate-900 mt-1">{formatMoney(claim.billed)}</p>
                                      </div>
                                      <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Paid</p>
                                        <p className="text-sm font-bold text-emerald-700 mt-1">{formatMoney(claim.paid)}</p>
                                      </div>
                                      <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient Responsibility</p>
                                        <p className="text-sm font-bold text-amber-700 mt-1">{formatMoney(claim.patientResponsibility)}</p>
                                      </div>
                                      <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient</p>
                                        <p className="text-sm font-bold text-slate-900 mt-1">{claim.patientName}</p>
                                      </div>
                                      <div className="rounded-lg border border-slate-200/70 bg-white p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Payment Ref</p>
                                        <p className="text-sm font-bold text-slate-900 mt-1">{claim.paymentReference}</p>
                                      </div>
                                    </div>

                                    <div className="mt-3 rounded-lg border border-slate-200/70 bg-white p-3">
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Adjustments</p>
                                      {claim.adjustments.length === 0 ? (
                                        <p className="text-xs text-slate-500 italic">No CAS adjustments reported for this claim.</p>
                                      ) : (
                                        <ul className="space-y-1.5">
                                          {claim.adjustments.map((adj) => (
                                            <li key={`${claim.claimId}-${adj.code}`} className="text-xs text-slate-700">
                                              <span className="font-black text-slate-900">{adj.code}</span>: {adj.label}
                                              <span className="ml-2 text-slate-500">({formatMoney(adj.amount)})</span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  ];
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-outline-variant/5 bg-surface-container-low/30 flex items-center justify-between">
            <span className="text-xs text-slate-500">Showing <strong>{Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredFiles.length)}&#8211;{Math.min(currentPage * PAGE_SIZE, filteredFiles.length)}</strong> of {filteredFiles.length} results</span>
            <div className="flex gap-1">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-primary transition-all disabled:opacity-30" type="button">
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="w-8 h-8 flex items-center justify-center text-slate-400">...</span>}
                    <button onClick={() => setCurrentPage(p)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${p === currentPage ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:bg-white'}`} type="button">{p}</button>
                  </span>
                ))}
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-primary transition-all disabled:opacity-30" type="button">
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {billedByDate.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl border border-outline-variant/10 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-on-surface">Payment Activity Over Time</h3>
                <p className="text-xs text-slate-400 mt-0.5">835 remittance files processed per date</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-tertiary inline-block"></span>Files Processed</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={billedByDate} margin={{top:10, right:20, left:0, bottom:0}} barSize={28}>
                <defs>
                  <linearGradient id="barGrad835" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'})} tick={{fontSize:11, fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={v => v >= 1000 ? '$'+(v/1000).toFixed(0)+'k' : '$'+v} tick={{fontSize:11, fill:'#94a3b8'}} axisLine={false} tickLine={false} width={50}/>
                <Tooltip formatter={(v) => ['$'+v.toLocaleString('en-US',{minimumFractionDigits:2}), 'Amount']} labelFormatter={d => new Date(d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} contentStyle={{borderRadius:'12px',border:'1px solid #e2e8f0',boxShadow:'0 4px 24px rgba(0,0,0,0.08)',fontSize:'12px'}} cursor={{fill:'rgba(14,165,233,0.05)'}}/>
                <Bar dataKey="amount" fill="url(#barGrad835)" radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-outline-variant/10">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Files</p>
                <p className="text-lg font-black text-on-surface">{metrics.totalFiles}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Paid</p>
                <p className="text-lg font-black text-sky-600">${metrics.totalPaid.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Collection Rate</p>
                <p className="text-lg font-black text-green-600">{metrics.collectionRate}%</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

