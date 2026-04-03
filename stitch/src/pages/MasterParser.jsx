import { useEffect, useState } from 'react';
import { authFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import {
  canAny,
  CLAIMS_ACCESS_PERMISSIONS,
  ENROLLMENT_ACCESS_PERMISSIONS,
  REMITTANCE_ACCESS_PERMISSIONS
} from '../auth/permissions';

const bodyClassName = 'bg-background font-body text-on-background antialiased selection:bg-primary/10 selection:text-primary page-master-parser';

export function MasterParserPage() {
  const { permissions } = useAuth();
  const canClaims = canAny(permissions, CLAIMS_ACCESS_PERMISSIONS);
  const canEnrollment = canAny(permissions, ENROLLMENT_ACCESS_PERMISSIONS);
  const canRemittance = canAny(permissions, REMITTANCE_ACCESS_PERMISSIONS);
  const [copilotData, setCopilotData] = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);
  const [currentFileId, setCurrentFileId] = useState(null);

  async function triggerCopilotAnalysis(fileId) {
    if (!fileId) return;
    setCopilotLoading(true);
    try {
      const res = await authFetch('/api/copilot/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
      });
      const data = await res.json();
      setCopilotData(data);
    } catch (e) {
      setCopilotData({ bullets: ['Analysis unavailable — check server connection.'], critical_issues: [], health_score: 0 });
    } finally {
      setCopilotLoading(false);
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || !currentFileId) return;
    const userMsg = { role: 'user', content: chatInput };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await authFetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: currentFileId, question: chatInput, history: chatMessages }),
      });
      const data = await res.json();
      setChatMessages([...newHistory, { role: 'assistant', content: data.answer }]);
    } catch (e) {
      setChatMessages([...newHistory, { role: 'assistant', content: 'Error getting response.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function applyFix(fixType, suggestedValue = '') {
    if (!currentFileId) return;
    setFixLoading(true);
    try {
      const res = await authFetch('/api/copilot/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: currentFileId, fix_type: fixType, suggested_value: suggestedValue }),
      });
      const data = await res.json();
      if (data.success) {
        const parseResult = await authFetch('/api/files/' + currentFileId + '/parse-result').then((r) => r.json());
        const contentEl = document.getElementById('edi-content');
        if (contentEl && parseResult.raw_json && parseResult.raw_json.report) {
          const lines = parseResult.raw_json.report.split('\n');
          contentEl.innerHTML = lines.map((line) => '<p>' + (line || '&nbsp;') + '</p>').join('');
        }
        const errorsRes = await authFetch('/api/files/' + currentFileId + '/errors').then((r) => r.json());
        const countEl = document.getElementById('validation-error-count');
        const logEl = document.getElementById('validation-log');
        if (countEl) countEl.textContent = 'Validation Log (' + errorsRes.length + ' Error' + (errorsRes.length !== 1 ? 's' : '') + ')';
        if (logEl) {
          if (errorsRes.length === 0) {
            logEl.innerHTML = '<div class="p-4 bg-white rounded-xl shadow-sm border-l-4 border-green-500 flex items-center gap-4"><span class="material-symbols-outlined text-green-600">check_circle</span><p class="text-sm font-semibold text-green-700">All fixes applied. File is now clean.</p></div>';
          }
        }
        triggerCopilotAnalysis(currentFileId);
      }
    } catch (e) {
      alert('Error applying fix: ' + e.message);
    } finally {
      setFixLoading(false);
    }
  }

  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;
    return () => { document.body.className = previous; };
  }, []);

  useEffect(() => {
    const nav = document.getElementById('side-nav');
    const overlay = document.getElementById('nav-overlay');
    const toggle = document.getElementById('nav-toggle');
    const closeButton = document.getElementById('nav-close');
    const navLinks = Array.from(document.querySelectorAll('[data-nav-link="true"]'));
    if (!nav || !overlay || !toggle || !closeButton) return undefined;
    function openNav() { nav.classList.remove('-translate-x-full'); overlay.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); }
    function closeNav() { nav.classList.add('-translate-x-full'); overlay.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }
    const handleToggle = () => openNav();
    const handleClose = () => closeNav();
    const handleOverlay = () => closeNav();
    toggle.addEventListener('click', handleToggle);
    closeButton.addEventListener('click', handleClose);
    overlay.addEventListener('click', handleOverlay);
    const handleNavLinkClick = () => { if (window.innerWidth < 768) closeNav(); };
    navLinks.forEach((link) => link.addEventListener('click', handleNavLinkClick));
    const handleResize = () => {
      if (window.innerWidth >= 768) { overlay.classList.add('hidden'); nav.classList.remove('-translate-x-full'); document.body.classList.remove('overflow-hidden'); }
      else nav.classList.add('-translate-x-full');
    };
    window.addEventListener('resize', handleResize);
    return () => {
      toggle.removeEventListener('click', handleToggle);
      closeButton.removeEventListener('click', handleClose);
      overlay.removeEventListener('click', handleOverlay);
      navLinks.forEach((link) => link.removeEventListener('click', handleNavLinkClick));
      window.removeEventListener('resize', handleResize);
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  useEffect(() => {
    async function loadFileData() {
      const ediFilename = document.getElementById('edi-filename');
      const ediContent = document.getElementById('edi-content');
      const validationErrorCount = document.getElementById('validation-error-count');
      const validationLog = document.getElementById('validation-log');
      try {
        const selectedFileId = localStorage.getItem('selectedFileId');
        const submissions = JSON.parse(localStorage.getItem('ediSubmissions') || '[]');
        const latest = submissions.length > 0 ? submissions[submissions.length - 1] : null;
        const id = selectedFileId || (latest ? latest.id : null);
        if (!id) {
          if (ediContent) ediContent.innerHTML = '<p class="text-outline italic">No file selected. Please upload a file from the Dashboard.</p>';
          if (ediFilename) ediFilename.textContent = 'No file loaded';
          return;
        }
        const [fileInfo, errors, parseResult] = await Promise.all([
          authFetch('/api/files/' + id).then((r) => r.json()),
          authFetch('/api/files/' + id + '/errors').then((r) => r.json()),
          authFetch('/api/files/' + id + '/parse-result').then((r) => r.json())
        ]);
        if (ediFilename) ediFilename.textContent = fileInfo.filename || id;
        if (ediContent) {
          const rawJson = parseResult.raw_json || {};
          const report = rawJson.report || '';
          const lines = report.split('\n');
          ediContent.innerHTML = lines.map((line) => '<p>' + (line || '&nbsp;') + '</p>').join('');
        }
        if (validationErrorCount) validationErrorCount.textContent = 'Validation Log (' + errors.length + ' Error' + (errors.length !== 1 ? 's' : '') + ')';
        if (validationLog) {
          if (errors.length === 0) {
            validationLog.innerHTML = '<div class="p-4 bg-white rounded-xl shadow-sm border-l-4 border-green-500 flex items-center gap-4"><span class="material-symbols-outlined text-green-600">check_circle</span><p class="text-sm font-semibold text-green-700">No validation errors found. This file is clean.</p></div>';
          } else {
            validationLog.innerHTML = '';
            errors.forEach((error) => {
              const card = document.createElement('div');
              card.className = 'error-card p-4 bg-white rounded-xl shadow-sm border-l-4 ' + (error.severity === 'error' ? 'border-error' : 'border-amber-400') + ' flex items-start justify-between';
              card.innerHTML = '<div class="flex gap-4"><div class="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center text-error"><span class="material-symbols-outlined">report</span></div><div><h4 class="text-sm font-bold text-on-surface">' + (error.error_code || 'Validation Error') + '</h4><p class="text-xs text-on-surface-variant mt-1">' + (error.error_message || '') + '</p><div class="mt-2 flex items-center gap-2">' + (error.loop_id ? '<span class="text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded">LOOP: ' + error.loop_id + '</span>' : '') + (error.segment ? '<span class="text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded">SEG: ' + error.segment + '</span>' : '') + '<span class="text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded uppercase">' + (error.severity || 'error') + '</span></div></div></div>';
              validationLog.appendChild(card);
            });
          }
        }
        setCurrentFileId(id);
        triggerCopilotAnalysis(id);
      } catch (err) {
        console.error('Failed to load EDI file data:', err);
        const el = document.getElementById('edi-content');
        if (el) el.innerHTML = '<p class="text-error italic">Failed to load file data. Please check the server connection.</p>';
      }
    }
    loadFileData();
  }, []);

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-between items-center px-6 py-3 w-full shadow-sm dark:shadow-none transition-all duration-200">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white cursor-pointer" onClick={() => window.location.reload()}>EdiPro</span>
          <nav className="hidden md:flex gap-6">
            <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/dashboard_sleek">Dashboard</a>
            <a className="text-blue-700 dark:text-blue-400 font-semibold border-b-2 border-blue-700 py-1 transition-all" href="/master_parser_sleek">Master Parser</a>
            {canClaims ? (
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/837_claims_view">Reports</a>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center bg-slate-100/50 rounded-full px-3 py-1.5">
            <span className="material-symbols-outlined text-[20px] text-slate-500">search</span>
            <input className="bg-transparent border-none focus:ring-0 text-sm w-48 placeholder:text-slate-400" placeholder="Search files..." type="text" />
          </div>
          <a className="p-2 hover:bg-slate-100/50 rounded-full transition-all active:scale-95" href="/notifications" aria-label="Open notifications"><span className="material-symbols-outlined text-slate-600">notifications</span></a>
          <a className="p-2 hover:bg-slate-100/50 rounded-full transition-all active:scale-95" href="/settings" aria-label="Open settings"><span className="material-symbols-outlined text-slate-600">settings</span></a>
          <a className="h-8 w-8 rounded-full overflow-hidden bg-primary/10 ring-2 ring-white shadow-sm" href="/user_profile" aria-label="Open user profile">
            <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCgEW3dXZf1xhBDmpkybJnr21bF6HNiuHphHXF5ZMfTdghbWasho84cnLb8S8iQpaeSBw-fhCGaMQOMakuyIgNossftgFDuvXrrfI8AS1HQ8aXsiiN5jRf5UzMPR3aYhNr7MVZQn2pGVvp51bgB4LzOmkYlr8r84vKcVrNDmd6f9yQ467G7lXlyPhygUgNeyILrY9rjqiqU5HuLzz86Snbq7D27lzvqCYzPfDWO80nIxy6mb85n7yl0OJhP3SQqzcbgwDSKCUiG7ach" alt="User Profile Avatar" />
          </a>
          <button className="md:hidden p-2 hover:bg-slate-100/50 rounded-full transition-all active:scale-95" id="nav-toggle" aria-label="Open navigation menu" type="button">
            <span className="material-symbols-outlined text-slate-700">menu</span>
          </button>
        </div>
      </header>

      <div className="fixed inset-0 bg-slate-900/40 z-30 hidden" id="nav-overlay"></div>

      <aside className="fixed left-0 top-0 h-full w-64 z-40 bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-2xl border-r border-slate-200/30 shadow-xl flex flex-col py-6 pt-20 transform -translate-x-full md:translate-x-0 transition-transform duration-300" id="side-nav">
        <div className="px-6 mb-8 flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-none">HealthConnect</h2>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">EDI Gateway</p>
          </div>
          <button className="md:hidden ml-auto p-2 hover:bg-slate-200/50 rounded-full" id="nav-close" aria-label="Close navigation menu" type="button">
            <span className="material-symbols-outlined text-slate-600">close</span>
          </button>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          <a className="text-slate-600 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium hover:translate-x-1 transition-transform duration-300" href="/dashboard_sleek" data-nav-link="true"><span className="material-symbols-outlined">dashboard</span> Dashboard</a>
          <a className="bg-blue-50/50 text-blue-700 rounded-lg mx-2 flex items-center gap-3 px-4 py-3 text-sm font-medium" href="/master_parser_sleek" data-nav-link="true"><span className="material-symbols-outlined">analytics</span> Master Parser</a>
          {canRemittance ? (
            <a className="text-slate-600 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium hover:translate-x-1 transition-transform duration-300" href="/835_remittance_sleek" data-nav-link="true"><span className="material-symbols-outlined">payments</span> 835 Remittance</a>
          ) : null}
          {canEnrollment ? (
            <a className="text-slate-600 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium hover:translate-x-1 transition-transform duration-300" href="/834_enrollment_sleek" data-nav-link="true"><span className="material-symbols-outlined">group_add</span> 834 Enrollment</a>
          ) : null}
          {canClaims ? (
            <a className="text-slate-600 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium hover:translate-x-1 transition-transform duration-300" href="/837_claims_view" data-nav-link="true"><span className="material-symbols-outlined">description</span> 837 Claims</a>
          ) : null}
        </nav>
        <div className="mt-auto px-4 pb-4">
          <button className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2" onClick={() => console.log('New Submission')} type="button">
            <span className="material-symbols-outlined text-[20px]">add_circle</span> New Submission
          </button>
        </div>
        <div className="px-2 pt-4 border-t border-slate-200/30 mx-4 space-y-1">
          <a className="text-slate-600 hover:bg-slate-200/30 rounded-lg flex items-center gap-3 px-4 py-2 text-xs font-medium hover:translate-x-1 transition-transform duration-300" href="/help_center" data-nav-link="true"><span className="material-symbols-outlined text-[18px]">help</span> Help Center</a>
          <a className="text-slate-600 hover:bg-slate-200/30 rounded-lg flex items-center gap-3 px-4 py-2 text-xs font-medium hover:translate-x-1 transition-transform duration-300" href="/documentation" data-nav-link="true"><span className="material-symbols-outlined text-[18px]">menu_book</span> Documentation</a>
        </div>
      </aside>

      <main className="ml-0 md:ml-64 pt-20 px-4 md:px-8 pb-8 min-h-screen bg-surface">
        <div className="flex flex-col xl:flex-row gap-6 min-h-[calc(100vh-160px)]">

          {/* EDI Viewer + Validation Log */}
          <section className="flex-1 flex flex-col min-w-0 min-h-0 bg-surface">
            <div className="flex-[3] border-b border-slate-200/30 flex flex-col min-h-0">
              <div className="px-6 py-3 flex justify-between items-center bg-white/50 border-b border-slate-200/10">
                <div className="flex items-center gap-3">
                  <span id="edi-filename" className="px-2 py-1 bg-surface-container-highest rounded text-[10px] font-mono font-bold text-outline">Loading...</span>
                  <span className="text-xs text-outline italic">ANSI X12 Standard</span>
                </div>
                <div className="flex gap-2">
                  <button className="material-symbols-outlined text-sm p-1.5 hover:bg-slate-100 rounded" type="button">search</button>
                  <button className="material-symbols-outlined text-sm p-1.5 hover:bg-slate-100 rounded" type="button">file_download</button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 font-mono text-sm leading-relaxed custom-scrollbar bg-[#fdfdfe]">
                <div id="edi-content" className="flex-1"><p className="text-outline italic">Loading file data...</p></div>
              </div>
            </div>
            <div className="flex-[2] flex flex-col bg-surface-container-low/30 overflow-hidden min-h-0">
              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-200/30">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-error">report</span>
                  <h3 id="validation-error-count" className="text-sm font-bold tracking-tight">Validation Log</h3>
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 bg-error-container text-on-error-container text-[10px] font-bold rounded-full">CRITICAL</span>
                  <span className="px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold rounded-full">WARNING</span>
                </div>
              </div>
              <div id="validation-log" className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                <p className="text-outline italic text-sm">Loading validation results...</p>
              </div>
            </div>
          </section>

          {/* Copilot Sidebar */}
          <aside className="w-full xl:w-[340px] bg-tertiary-container/5 glass-blur border-l border-tertiary/10 flex flex-col z-40 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-white/10 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col h-full">

              {/* Header */}
              <div className="p-5 border-b border-tertiary/10 bg-white/40">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-full bg-tertiary flex items-center justify-center text-white">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  </div>
                  <h2 className="text-base font-bold tracking-tight text-on-surface">Copilot Summary</h2>
                </div>
                <p className="text-[10px] text-tertiary font-bold tracking-widest uppercase ml-11">Powered by Luminous AI</p>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">

                {/* File Analysis */}
                <div>
                  <h3 className="text-xs font-bold text-outline uppercase tracking-widest mb-3">File Analysis</h3>
                  {copilotLoading ? (
                    <div className="space-y-2">
                      <div className="h-3 bg-outline-variant/20 rounded animate-pulse w-3/4"></div>
                      <div className="h-3 bg-outline-variant/20 rounded animate-pulse w-full"></div>
                      <div className="h-3 bg-outline-variant/20 rounded animate-pulse w-2/3"></div>
                    </div>
                  ) : copilotData ? (
                    <ul className="space-y-2">
                      {(copilotData.bullets || []).map((b, i) => (
                        <li key={i} className="flex gap-2 items-start">
                          <span className="material-symbols-outlined text-tertiary text-base mt-0.5">check_circle</span>
                          <p className="text-sm leading-snug text-on-surface">{b}</p>
                        </li>
                      ))}
                      {(copilotData.critical_issues || []).map((issue, i) => (
                        <li key={'err-' + i} className="flex gap-2 items-start">
                          <span className="material-symbols-outlined text-error text-base mt-0.5">warning</span>
                          <p className="text-sm leading-snug font-medium text-error">{issue}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-on-surface-variant italic">Load a file to see analysis.</p>
                  )}
                </div>

                {/* Fix Assistant */}
                <div className="bg-tertiary/10 rounded-2xl p-4 border border-tertiary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-tertiary">magic_button</span>
                    <h3 className="text-sm font-bold text-tertiary">Fix Assistant</h3>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-3">Automatically correct detected issues and save to database.</p>
                  <div className="space-y-2 mb-3">
                    <button onClick={() => applyFix('BHT05_TIME', '1200')} disabled={fixLoading || !currentFileId}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/60 border border-white/80 hover:border-tertiary/40 transition-colors text-[11px] disabled:opacity-40">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-tertiary">history</span>
                        <span>Suggested: <strong className="font-mono">1200</strong></span>
                      </div>
                      <span className="text-[10px] font-bold text-tertiary bg-tertiary/5 px-2 py-1 rounded">{fixLoading ? '...' : 'Apply'}</span>
                    </button>
                    <button onClick={() => applyFix('TAX_ID', '123456789')} disabled={fixLoading || !currentFileId}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/60 border border-white/80 hover:border-tertiary/40 transition-colors text-[11px] disabled:opacity-40">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-tertiary">history</span>
                        <span>Suggested: <strong className="font-mono">123456789</strong></span>
                      </div>
                      <span className="text-[10px] font-bold text-tertiary bg-tertiary/5 px-2 py-1 rounded">{fixLoading ? '...' : 'Apply'}</span>
                    </button>
                  </div>
                  <button onClick={() => applyFix('AUTO')} disabled={fixLoading || !currentFileId}
                    className="w-full py-2.5 bg-tertiary text-white rounded-xl text-sm font-bold shadow-lg shadow-tertiary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                    <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                    <span>{fixLoading ? 'Applying...' : 'Apply All Fixes'}</span>
                  </button>
                </div>

                {/* Transaction Health */}
                {copilotData && (
                  <div>
                    <h3 className="text-xs font-bold text-outline uppercase tracking-widest mb-2">Transaction Health</h3>
                    <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden flex">
                      <div className="h-full bg-primary transition-all" style={{ width: (copilotData.health_score || 0) + '%' }}></div>
                      <div className="h-full bg-error transition-all" style={{ width: (100 - (copilotData.health_score || 0)) + '%' }}></div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] font-bold text-primary">{copilotData.health_score || 0}% VALID</span>
                      <span className="text-[10px] font-bold text-error">{100 - (copilotData.health_score || 0)}% ERROR</span>
                    </div>
                  </div>
                )}

                {/* Chat Messages */}
                {chatMessages.length > 0 && (
                  <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={'text-xs p-2.5 rounded-xl ' + (msg.role === 'user' ? 'bg-primary/10 text-on-surface ml-4' : 'bg-white border border-outline-variant/20 text-on-surface mr-4')}>
                        <span className="font-bold text-primary">{msg.role === 'user' ? 'You' : 'Copilot'}:</span>{' '}{msg.content}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="text-xs p-2.5 rounded-xl bg-white border border-outline-variant/20 text-on-surface-variant mr-4 animate-pulse">
                        Copilot is thinking...
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 bg-white/40 border-t border-tertiary/10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder={currentFileId ? 'Ask Copilot a question...' : 'Load a file first...'}
                    disabled={chatLoading || !currentFileId}
                    className="flex-1 px-3 py-2 rounded-xl bg-white border border-tertiary/20 text-sm focus:ring-2 focus:ring-tertiary/20 focus:outline-none placeholder:text-on-surface-variant/50 disabled:opacity-50"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={chatLoading || !currentFileId || !chatInput.trim()}
                    className="w-9 h-9 rounded-xl bg-tertiary text-white flex items-center justify-center hover:bg-tertiary/90 transition-colors disabled:opacity-40"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-sm">send</span>
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="h-8 bg-white border-t border-slate-200/50 flex items-center px-4 justify-between text-[10px] font-medium text-slate-500 z-50">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> System Online</span>
          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">database</span> Connected to Production Gateway</span>
        </div>
        <div className="flex items-center gap-4 uppercase tracking-tighter">
          <span>Encoding: UTF-8</span>
          <span>Standard: HIPAA 5010</span>
          <span className="text-primary font-bold">Parser v2.4.0-Pro</span>
        </div>
      </footer>
    </>
  );
}
