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

const bodyClassName = 'bg-background text-on-surface font-body selection:bg-primary-fixed selection:text-on-primary-fixed page-claims';

export function Claims837Page() {
  const { permissions } = useAuth();
  const canClaims = canAny(permissions, CLAIMS_ACCESS_PERMISSIONS);
  const canEnrollment = canAny(permissions, ENROLLMENT_ACCESS_PERMISSIONS);
  const canRemittance = canAny(permissions, REMITTANCE_ACCESS_PERMISSIONS);

  const [allFiles, setAllFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [claimType, setClaimType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [billedByDate, setBilledByDate] = useState([]);
  const [remittanceMap, setRemittanceMap] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [npiCache, setNpiCache] = useState({});
  const PAGE_SIZE = 7;

  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;
    return () => { document.body.className = previous; };
  }, []);

  useEffect(() => {
    async function loadRemittanceStatus() {
      try {
        const data = await authFetch('/api/claims/remittance-status').then((r) => r.json());
        if (Array.isArray(data)) {
          const map = {};
          data.forEach((item) => { map[item.file_id] = item; });
          setRemittanceMap(map);
        }
      } catch (err) {
        console.error('Failed to load remittance status:', err);
      }
    }
    async function loadClaimsData() {
      try {
        const files = await authFetch('/api/files?limit=1000').then((r) => r.json());
        const claimFiles = Array.isArray(files)
          ? files.filter((f) => f.transaction_type === '837p' || f.transaction_type === '837i')
          : [];
        const dateMap = {};
        const enriched = await Promise.all(
          claimFiles.map(async (file) => {
            let totalBilled = 0;
            try {
              const pr = await authFetch('/api/files/' + file.id + '/parse-result').then((r) => r.json());
              const claims = pr?.raw_json?.structured_data || [];
              for (const claim of claims) {
                totalBilled += parseFloat(claim.total_charge || 0);
              }
            } catch (e) { /* skip */ }
            const dateKey = file.uploaded_at ? new Date(file.uploaded_at).toISOString().split('T')[0] : 'unknown';
            if (dateKey !== 'unknown') {
              dateMap[dateKey] = (dateMap[dateKey] || 0) + totalBilled;
            }
            return { ...file, totalBilled };
          })
        );
        const billedArr = Object.entries(dateMap)
          .map(([date, amount]) => ({ date, amount }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setBilledByDate(billedArr);
        setAllFiles(enriched);
        setFilteredFiles(enriched);
      } catch (err) {
        console.error('Failed to load claims data:', err);
      }
    }
    loadClaimsData();
    loadRemittanceStatus();
  }, []);

  useEffect(() => {
    const result = allFiles
      .filter((f) => claimType === 'all' || f.transaction_type === claimType)
      .filter((f) =>
        !searchQuery ||
        f.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.transaction_type || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    setFilteredFiles(result);
    setCurrentPage(1);
  }, [allFiles, claimType, searchQuery]);

  const totalPages = Math.ceil(filteredFiles.length / PAGE_SIZE);

  function toggleRow(id) {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    // Lazy-load NPI status on first expand
    if (!npiCache[id]) {
      setNpiCache((prev) => ({ ...prev, [id]: { loading: true } }));
      authFetch('/api/files/' + id + '/npi-status')
        .then((r) => r.json())
        .then((data) => setNpiCache((prev) => ({ ...prev, [id]: { loading: false, data } })))
        .catch(() => setNpiCache((prev) => ({ ...prev, [id]: { loading: false, error: true } })));
    }
  }
  const pageFiles = filteredFiles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-between items-center px-6 py-3 shadow-sm dark:shadow-none transition-all duration-200">
        <div className="flex items-center gap-8">
          <span
            className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white cursor-pointer"
            onClick={() => { window.location.href = '/dashboard_sleek'; }}
          >
            EdiPro
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
        </div>
      </header>

      <aside className="fixed left-0 top-0 h-full w-64 z-40 bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-2xl border-r border-slate-200/30 dark:border-slate-800/30 shadow-xl dark:shadow-2xl flex flex-col py-6 pt-20">
        <div className="px-6 mb-8 flex items-center gap-3 cursor-pointer" onClick={() => { window.location.href = '/dashboard_sleek'; }}>
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-none">HealthConnect</h2>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">EDI Gateway</p>
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]" href="/dashboard_sleek" data-nav-link="true">
            <span className="material-symbols-outlined">dashboard</span> Dashboard
          </a>
          <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]" href="/master_parser_sleek" data-nav-link="true">
            <span className="material-symbols-outlined">analytics</span> Master Parser
          </a>
          {canRemittance ? (
            <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]" href="/835_remittance_sleek" data-nav-link="true">
              <span className="material-symbols-outlined">payments</span> 835 Remittance
            </a>
          ) : null}
          {canEnrollment ? (
            <a className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]" href="/834_enrollment_sleek" data-nav-link="true">
              <span className="material-symbols-outlined">group_add</span> 834 Enrollment
            </a>
          ) : null}
          {canClaims ? (
            <a className="bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg mx-2 flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide scale-100 active:scale-[0.98] transition-transform duration-300" href="/837_claims_view" data-nav-link="true">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>{' '}837 Claims
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

      <main className="lg:pl-64 pt-16 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2 uppercase tracking-tighter">
                <span>EDI Gateway</span>
                <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                <span className="text-primary">837 Claims Audit</span>
              </nav>
              <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">Auditing Claims</h1>
            </div>
            <div className="flex gap-2">
              <div className="bg-surface-container-high p-1 rounded-xl flex">
                <button onClick={() => setClaimType('all')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${claimType === 'all' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`} type="button">All</button>
                <button onClick={() => setClaimType('837p')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${claimType === '837p' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`} type="button">837P <span className="text-[10px] font-normal ml-1">Professional</span></button>
                <button onClick={() => setClaimType('837i')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${claimType === '837i' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`} type="button">837I <span className="text-[10px] font-normal ml-1">Institutional</span></button>
              </div>
            </div>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="glass-panel p-6 rounded-2xl shadow-sm border border-outline-variant/10 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">database</span>
                </div>
                <span className="text-xs font-bold text-success-green flex items-center bg-green-50 px-2 py-1 rounded-full text-green-600">
                  <span className="material-symbols-outlined text-xs mr-1">trending_up</span> +12%
                </span>
              </div>
              <p className="text-slate-500 text-sm font-medium">Total Claims Audited</p>
              <h3 className="text-3xl font-black mt-1">{allFiles.length}</h3>
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <span className="material-symbols-outlined text-9xl">receipt_long</span>
              </div>
            </div>
            <div className="glass-panel p-6 rounded-2xl shadow-sm border border-outline-variant/10 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-tertiary/10 rounded-xl flex items-center justify-center text-tertiary">
                  <span className="material-symbols-outlined">payments</span>
                </div>
                <span className="text-xs font-bold text-slate-400 px-2 py-1">Last 24h</span>
              </div>
              <p className="text-slate-500 text-sm font-medium">Total Billed Amount</p>
              <h3 className="text-3xl font-black mt-1">
                ${allFiles.reduce((s, f) => s + (f.totalBilled || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <span className="material-symbols-outlined text-9xl">monetization_on</span>
              </div>
            </div>
            <div className="glass-panel p-6 rounded-2xl shadow-sm border border-outline-variant/10 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-error-container/30 rounded-xl flex items-center justify-center text-error">
                  <span className="material-symbols-outlined">error</span>
                </div>
                <span className="text-xs font-bold text-error flex items-center bg-error-container/20 px-2 py-1 rounded-full">
                  <span className="material-symbols-outlined text-xs mr-1">warning</span> 2.4% rate
                </span>
              </div>
              <p className="text-slate-500 text-sm font-medium">Validation Errors</p>
              <h3 className="text-3xl font-black mt-1">{allFiles.filter((f) => !f.is_valid).length}</h3>
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <span className="material-symbols-outlined text-9xl">bug_report</span>
              </div>
            </div>
          </section>

          <div className="flex flex-col lg:flex-row gap-8">
            <aside className={`transition-all duration-300 ease-in-out overflow-hidden ${sidebarCollapsed ? 'w-0 lg:w-10' : 'w-full lg:w-64'}`} style={{ flexShrink: 0 }}>
              <div className="relative" style={{ minWidth: sidebarCollapsed ? '40px' : '256px' }}>
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="absolute -right-0 top-0 z-10 w-8 h-8 bg-white border border-slate-200/60 rounded-lg shadow-sm flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary/30 transition-all active:scale-90"
                  type="button"
                  title={sidebarCollapsed ? 'Expand filters' : 'Collapse filters'}
                >
                  <span className="material-symbols-outlined text-base" style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>chevron_left</span>
                </button>
                <div className={`space-y-8 transition-opacity duration-200 ${sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Claim Types</h4>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 glass-panel rounded-xl cursor-pointer hover:bg-white transition-colors border border-outline-variant/10">
                        <input readOnly checked={claimType === 'all' || claimType === '837p'} className="rounded border-slate-300 text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-sm font-semibold text-slate-700">837P Professional</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 glass-panel rounded-xl cursor-pointer hover:bg-white transition-colors border border-outline-variant/10">
                        <input readOnly checked={claimType === 'all' || claimType === '837i'} className="rounded border-slate-300 text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-sm font-semibold text-slate-700">837I Institutional</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Validation Status</h4>
                    <div className="space-y-1">
                      <button className="w-full flex justify-between items-center p-2 text-sm font-medium text-slate-600 hover:text-primary group" type="button">
                        <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> Clean Claims</span>
                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded group-hover:bg-primary-fixed">{allFiles.filter((f) => f.is_valid).length}</span>
                      </button>
                      <button className="w-full flex justify-between items-center p-2 text-sm font-medium text-slate-600 hover:text-primary group" type="button">
                        <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-error"></span> Missing Fields</span>
                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{allFiles.filter((f) => !f.is_valid).length}</span>
                      </button>
                      <button className="w-full flex justify-between items-center p-2 text-sm font-medium text-slate-600 hover:text-primary group" type="button">
                        <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span> NPI Mismatch</span>
                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">0</span>
                      </button>
                    </div>
                  </div>
                  {allFiles.length > 0 && (() => {
                    const cleanCount = allFiles.filter(f=>f.is_valid).length;
                    const errCount = allFiles.filter(f=>!f.is_valid).length;
                    const donutData = [{name:'Clean', value:cleanCount, color:'#22c55e'},{name:'Errors', value:errCount, color:'#ef4444'}].filter(d=>d.value>0);
                    return (
                      <div className="mt-6 pt-4 border-t border-outline-variant/10">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Validation Breakdown</h4>
                        <ResponsiveContainer width="100%" height={140}>
                          <PieChart>
                            <Pie data={donutData} cx="50%" cy="50%" innerRadius={38} outerRadius={55} paddingAngle={3} dataKey="value">
                              {donutData.map((entry,i) => <Cell key={i} fill={entry.color}/>)}
                            </Pie>
                            <Tooltip formatter={(v,n)=>[v+' files', n]} contentStyle={{borderRadius:'10px',border:'1px solid #e2e8f0',fontSize:'11px'}}/>
                            <Legend iconType="circle" iconSize={8} formatter={(v,e) => <span style={{fontSize:'11px',color:'#64748b'}}>{v}: {e.payload.value}</span>}/>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </aside>

            <div className="flex-1 overflow-hidden">
              <div className="glass-panel rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 flex items-center justify-between gap-4 border-b border-outline-variant/5">
                  <div className="relative flex-1 max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400"
                      placeholder="Search by Claim ID, Provider, or Subscriber..."
                      type="text"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all" type="button">
                      <span className="material-symbols-outlined">filter_list</span>
                    </button>
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all" onClick={() => alert('Preparing report for download...')} type="button">
                      <span className="material-symbols-outlined">download</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low/50">
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-outline-variant/10">Claim ID</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-outline-variant/10">Type</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-outline-variant/10">Date</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-outline-variant/10 text-right">Billed Amt</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-outline-variant/10 text-center">Errors</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-outline-variant/10">Validation Status</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-outline-variant/10">Remittance Status</th>
                        <th className="px-4 py-3 border-b border-outline-variant/10 w-8"></th>
                      </tr>
                    </thead>
                    <tbody id="claims-tbody" className="divide-y divide-outline-variant/5">
                      {pageFiles.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400 italic">
                            {allFiles.length === 0 ? 'No 837 claim files uploaded yet.' : 'No results match your search.'}
                          </td>
                        </tr>
                      ) : pageFiles.map((file, fileIdx) => {
                        const isValid = file.is_valid;
                        const statusClass = isValid ? 'bg-green-100 text-green-700 border-green-200/50' : 'bg-error-container/30 text-error border-error/10';
                        const statusText = isValid ? 'Clean' : 'Error';
                        const statusDot = isValid ? 'bg-green-500' : 'bg-error';
                        const remitInfo = remittanceMap[file.id];
                        const isRemitted = remitInfo ? remitInfo.is_remitted : false;
                        const linked835 = remitInfo ? (remitInfo.linked_835 || []) : [];
                        const isExpanded = !!expandedRows[file.id];
                        return [
                            <tr key={file.id} className="hover:bg-primary/5 transition-colors group cursor-pointer" onClick={() => toggleRow(file.id)}>
                              <td className="px-4 py-3 text-xs font-bold text-slate-900">{file.filename}</td>
                              <td className="px-4 py-3"><span className="text-xs font-semibold text-slate-700">{(file.transaction_type || '').toUpperCase()}</span></td>
                              <td className="px-4 py-3 text-xs text-slate-600">{file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : '-'}</td>
                              <td className="px-4 py-3 text-xs font-bold text-slate-900 text-right">${(file.totalBilled || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="px-4 py-3 text-center"><span className="text-[10px] font-bold bg-surface-container-highest px-2 py-0.5 rounded text-slate-600">{file.error_count || 0} err</span></td>
                              <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${statusClass}`}><span className={`w-1.5 h-1.5 rounded-full ${statusDot}`}></span> {statusText}</span></td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); if (linked835.length > 0) toggleRow(file.id); }}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border transition-all ${isRemitted ? 'bg-blue-50 text-blue-700 border-blue-200/50 hover:bg-blue-100' : 'bg-red-50 text-red-600 border-red-200/50'} ${linked835.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                                  title={linked835.length > 0 ? (isExpanded ? 'Collapse' : 'Show linked 835 files') : undefined}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${isRemitted ? 'bg-blue-500' : 'bg-red-500'}`}></span>
                                  {isRemitted ? 'Remitted' : 'Not Remitted'}
                                  {linked835.length > 0 && (
                                    <span className="material-symbols-outlined text-[12px]" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}>chevron_right</span>
                                  )}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); localStorage.setItem('selectedFileId', file.id); window.location.href = '/master_parser_sleek'; }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-all"
                                  title="Open in Master Parser"
                                >
                                  <span className="material-symbols-outlined text-lg">open_in_new</span>
                                </button>
                              </td>
                            </tr>,
                                                        isExpanded && <tr key={file.id + '-expanded'} className="bg-slate-50/60">
                                <td colSpan={8} className="px-6 py-4">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px] text-blue-500">receipt_long</span>
                                        835 Remittance Link
                                      </p>
                                      {linked835.length === 0 ? (
                                        <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                                          <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
                                          No matching 835 found for this claim
                                        </div>
                                      ) : linked835.map((r, i) => (
                                        <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-800 truncate">{r.filename || r.file_id}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">Claim ID: <span className="font-semibold text-slate-600">{r.claim_id || '--'}</span></p>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <p className="text-xs font-bold text-green-700">${(r.paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                            <p className="text-[10px] text-slate-400">Paid</p>
                                          </div>
                                          <button type="button" onClick={(e) => { e.stopPropagation(); localStorage.setItem('selectedFileId', r.file_id); window.location.href = '/master_parser_sleek'; }} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all shrink-0" title="Open 835 file">
                                            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px] text-purple-500">verified_user</span>
                                        NPI Validation (NPPES)
                                      </p>
                                      {(() => {
                                        const npiState = npiCache[file.id];
                                        if (!npiState || npiState.loading) {
                                          return (
                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                              <span className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin inline-block"></span>
                                              Checking NPPES registry...
                                            </div>
                                          );
                                        }
                                        if (npiState.error) return <p className="text-xs text-slate-400 italic">Could not reach NPPES API</p>;
                                        const npis = npiState.data?.npis || [];
                                        if (npis.length === 0) return <p className="text-xs text-slate-400 italic">No NPI found in this file</p>;
                                        return npis.map((n, i) => (
                                          <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-bold text-slate-800 font-mono">{n.npi}</span>
                                                {n.found ? (
                                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${n.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${n.active ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                                                    {n.active ? 'NPI Active' : 'NPI Inactive'}
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-50 text-red-600 border-red-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                    Not Found
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-[10px] text-slate-500 mt-0.5">EDI: <span className="font-medium text-slate-700">{n.edi_name || '--'}</span>{n.nppes_name && n.nppes_name !== n.edi_name ? <span className="ml-2 text-slate-400">NPPES: <span className="font-medium text-slate-600">{n.nppes_name}</span></span> : null}</p>
                                              {n.primary_taxonomy && <p className="text-[10px] text-purple-500 mt-0.5">{n.primary_taxonomy}</p>}
                                            </div>
                                          </div>
                                        ));
                                      })()}
                                    </div>
                                  </div>
                                </td>
                              </tr>
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

            </div>
          </div>

          {billedByDate.length > 0 && (
            <div className="mt-8 bg-white rounded-2xl border border-outline-variant/10 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-on-surface">Billed Amount Over Time</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Total billed per upload date across all 837 files</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>Billed ($)
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={billedByDate} margin={{top:10, right:20, left:0, bottom:0}}>
                  <defs>
                    <linearGradient id="billedGrad837" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'})} tick={{fontSize:11, fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v => v >= 1000 ? '$'+(v/1000).toFixed(0)+'k' : '$'+v} tick={{fontSize:11, fill:'#94a3b8'}} axisLine={false} tickLine={false} width={50}/>
                  <Tooltip formatter={(v) => ['$'+v.toLocaleString('en-US',{minimumFractionDigits:2}), 'Billed']} labelFormatter={d => new Date(d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} contentStyle={{borderRadius:'12px',border:'1px solid #e2e8f0',boxShadow:'0 4px 24px rgba(0,0,0,0.08)',fontSize:'12px'}}/>
                  <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2.5} fill="url(#billedGrad837)" dot={{fill:'#4f46e5',strokeWidth:0,r:3}} activeDot={{r:5}}/>
                </AreaChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-outline-variant/10">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Files</p>
                  <p className="text-lg font-black text-on-surface">{filteredFiles.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Billed</p>
                  <p className="text-lg font-black text-primary">${filteredFiles.reduce((s,f)=>s+(f.totalBilled||0),0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Paid</p>
                  <p className="text-lg font-black text-green-600">${Object.values(remittanceMap).reduce((s,r)=>s+(r.total_paid||0),0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Clean Rate</p>
                  <p className="text-lg font-black text-green-600">{filteredFiles.length > 0 ? Math.round((filteredFiles.filter(f=>f.is_valid).length/filteredFiles.length)*100) : 0}%</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}


