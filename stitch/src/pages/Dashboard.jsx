﻿import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { authFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import {
  ADMIN_PERMISSIONS,
  canAny,
  CLAIMS_ACCESS_PERMISSIONS,
  ENROLLMENT_ACCESS_PERMISSIONS,
  REMITTANCE_ACCESS_PERMISSIONS
} from '../auth/permissions';

const bodyClassName = 'bg-background font-body text-on-background antialiased selection:bg-primary/10 selection:text-primary page-dashboard';

export function DashboardPage() {
  const { permissions } = useAuth();
  const canClaims = canAny(permissions, CLAIMS_ACCESS_PERMISSIONS);
  const canEnrollment = canAny(permissions, ENROLLMENT_ACCESS_PERMISSIONS);
  const canRemittance = canAny(permissions, REMITTANCE_ACCESS_PERMISSIONS);
  const isAdmin = canAny(permissions, ADMIN_PERMISSIONS);
  const [uploadTrend, setUploadTrend] = useState([]);

  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;

    return () => {
      document.body.className = previous;
    };
  }, []);

  useEffect(() => {
    const nav = document.getElementById('side-nav');
    const overlay = document.getElementById('nav-overlay');
    const toggle = document.getElementById('nav-toggle');
    const closeButton = document.getElementById('nav-close');
    const navLinks = Array.from(document.querySelectorAll('[data-nav-link="true"]'));
    const uploadTrigger = document.getElementById('upload-trigger');
    const uploadInput = document.getElementById('file-upload');
    const uploadZone = document.getElementById('upload-zone');
    const uploadStatus = document.getElementById('upload-status');
    const recentAudits = document.getElementById('recent-audits');
    const processedCount = document.getElementById('processed-count');
    const accuracyRate = document.getElementById('accuracy-rate');
    const storageUsed = document.getElementById('storage-used');
    const parseLatency = document.getElementById('parse-latency');
    const securityStatus = document.getElementById('security-status');
    const aiSavings = document.getElementById('ai-savings');
    const clearAudits = document.getElementById('clear-audits');
    const storageKey = 'ediSubmissions';
    let totalProcessed = 0;
    let totalValid = 0;

    if (!nav || !overlay || !toggle || !closeButton) {
      return undefined;
    }

    function openNav() {
      nav.classList.remove('-translate-x-full');
      overlay.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }

    function closeNav() {
      nav.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }

    const handleToggle = () => openNav();
    const handleClose = () => closeNav();
    const handleOverlay = () => closeNav();

    toggle.addEventListener('click', handleToggle);
    closeButton.addEventListener('click', handleClose);
    overlay.addEventListener('click', handleOverlay);

    const handleNavLinkClick = () => {
      if (window.innerWidth < 768) {
        closeNav();
      }
    };

    navLinks.forEach((link) => {
      link.addEventListener('click', handleNavLinkClick);
    });

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        overlay.classList.add('hidden');
        nav.classList.remove('-translate-x-full');
        document.body.classList.remove('overflow-hidden');
      } else {
        nav.classList.add('-translate-x-full');
      }
    };

    window.addEventListener('resize', handleResize);

    function readSubmissions() {
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }

    function writeSubmissions(items) {
      localStorage.setItem(storageKey, JSON.stringify(items));
    }

    function updateSummary() {
      if (processedCount) {
        processedCount.textContent = String(totalProcessed);
      }
      if (accuracyRate) {
        accuracyRate.textContent = totalProcessed > 0 ? ((totalValid / totalProcessed) * 100).toFixed(1) + '%' : '--';
      }
      if (storageUsed) {
        storageUsed.textContent = totalProcessed + ' files';
      }
      if (parseLatency) {
        parseLatency.textContent = totalProcessed > 0 ? 'Live' : '--';
      }
      if (securityStatus) {
        securityStatus.textContent = totalProcessed > 0 ? 'Monitoring' : 'No submissions';
      }
      if (aiSavings) {
        aiSavings.textContent = totalProcessed > 0 ? 'Active' : '--';
      }
    }

    function renderEmptyAudits() {
      if (!recentAudits) {
        return;
      }
      recentAudits.innerHTML =
        '<div class="glass-panel p-8 rounded-[20px] border border-outline-variant/10 text-center"><p class="text-sm font-semibold text-on-surface">No files processed yet.</p><p class="text-xs text-outline mt-2">Upload a 837, 835, or 834 file to start seeing audits.</p></div>';
    }

    function iconForType(type) {
      if (type === '835') return 'payments';
      if (type === '834') return 'group_add';
      return 'description';
    }

    function cardTone(errorCount) {
      if (errorCount > 0) {
        return 'bg-error-container text-on-error-container';
      }
      return 'bg-green-100 text-green-700';
    }

    function renderAudits(items) {
      if (!recentAudits) {
        return;
      }
      if (!items.length) {
        renderEmptyAudits();
        return;
      }
      recentAudits.innerHTML = '';
      items
        .slice()
        .reverse()
        .forEach((item) => {
          const card = document.createElement('div');
          card.className = 'glass-panel p-5 rounded-[20px] border border-outline-variant/10 shadow-sm transition-all duration-300';
          card.innerHTML =
            '<div class="flex justify-between items-start mb-4"><div class="flex items-center gap-4"><div class="w-10 h-10 bg-surface-container-highest rounded-xl flex items-center justify-center"><span class="material-symbols-outlined text-primary text-[20px]">' +
            iconForType(item.type) +
            '</span></div><div><h4 class="text-sm font-bold text-on-surface truncate w-40">' +
            item.filename +
            '</h4><p class="text-[10px] text-outline font-medium">Uploaded from dashboard</p></div></div><span class="bg-secondary-container text-on-secondary-container text-[10px] font-black px-2.5 py-1 rounded-lg">' +
            item.type +
            '</span></div><div class="flex justify-between items-center"><div class="flex gap-2"><span class="' +
            cardTone(item.errorCount) +
            ' text-[10px] font-bold px-2 py-1 rounded-full">' +
            item.errorCount +
            ' Errors</span></div><span class="text-[11px] text-outline font-medium italic">' +
            item.timeLabel +
            '</span></div>';
          if (item.id) {
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => {
              localStorage.setItem('selectedFileId', item.id);
              window.location.href = '/master_parser_sleek';
            });
          }
          recentAudits.appendChild(card);
        });
    }

    async function hydrateFromAPI() {
      try {
        const files = await authFetch('/api/files').then((r) => r.json());
        if (!Array.isArray(files)) return;
        totalProcessed = files.length;
        totalValid = files.filter(f => f.is_valid).length;
        const items = files.map(f => ({
          id: f.id,
          filename: f.filename || f.original_filename,
          type: (f.transaction_type || 'unknown').toUpperCase(),
          errorCount: f.error_count || 0,
          isValid: f.is_valid || false,
          timeLabel: f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : 'Unknown'
        }));
        writeSubmissions(items);
        updateSummary();
        renderAudits(items);
        // Build upload trend
        const byDate = {};
        items.forEach(f => {
          const d = f.timeLabel || 'Unknown';
          if (!byDate[d]) byDate[d] = {date:d, count:0, errors:0};
          byDate[d].count++;
          if (f.errorCount > 0) byDate[d].errors++;
        });
        setUploadTrend(Object.values(byDate).slice(-7));
      } catch(e) {
        hydrateFromAPI();
      }
    }

    function hydrateFromStorage() {
      const items = readSubmissions();
      totalProcessed = items.length;
      totalValid = items.filter((item) => item.errorCount === 0).length;
      updateSummary();
      renderAudits(items);
    }

    async function processFiles(fileList) {
      const files = Array.from(fileList || []);
      if (!files.length) {
        return;
      }
      if (uploadStatus) {
        uploadStatus.textContent = 'Uploading ' + files.length + ' file(s)...';
      }

      const saved = readSubmissions();
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const response = await authFetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          if (!response.ok) {
            throw new Error('Upload failed');
          }
          const payload = await response.json();
          const type = String(payload.transaction_type || 'unknown').toUpperCase();

          const item = {
            id: payload.id,
            filename: payload.filename || file.name,
            type: type,
            errorCount: payload.error_count || 0,
            isValid: payload.is_valid || false,
            s3_url: payload.s3_url || '',
            timeLabel: 'Just now'
          };
          saved.push(item);
          totalProcessed += 1;
          if (item.errorCount === 0) {
            totalValid += 1;
          }
        } catch (error) {
          if (uploadStatus) {
            uploadStatus.textContent = 'Upload failed for ' + file.name + '. Please try again.';
          }
        }
      }

      writeSubmissions(saved);
      updateSummary();
      renderAudits(saved);
      if (uploadStatus) {
        uploadStatus.textContent = 'Upload complete. ' + totalProcessed + ' file(s) processed.';
      }
    }

    const handleUploadTrigger = () => {
      if (uploadInput) {
        uploadInput.click();
      }
    };
    const handleUploadChange = (event) => {
      processFiles(event.target.files);
    };
    const handleDragOver = (event) => {
      event.preventDefault();
    };
    const handleDrop = (event) => {
      event.preventDefault();
      processFiles(event.dataTransfer.files);
    };
    const handleClearAudits = () => {
      totalProcessed = 0;
      totalValid = 0;
      writeSubmissions([]);
      updateSummary();
      renderEmptyAudits();
      if (uploadStatus) {
        uploadStatus.textContent = 'No files uploaded yet.';
      }
    };

    if (uploadTrigger && uploadInput) {
      uploadTrigger.addEventListener('click', handleUploadTrigger);
      uploadInput.addEventListener('change', handleUploadChange);
    }

    if (uploadZone) {
      uploadZone.addEventListener('dragover', handleDragOver);
      uploadZone.addEventListener('drop', handleDrop);
    }

    if (clearAudits) {
      clearAudits.addEventListener('click', handleClearAudits);
    }

    hydrateFromAPI();

    return () => {
      toggle.removeEventListener('click', handleToggle);
      closeButton.removeEventListener('click', handleClose);
      overlay.removeEventListener('click', handleOverlay);
      window.removeEventListener('resize', handleResize);
      navLinks.forEach((link) => {
        link.removeEventListener('click', handleNavLinkClick);
      });
      if (uploadTrigger && uploadInput) {
        uploadTrigger.removeEventListener('click', handleUploadTrigger);
        uploadInput.removeEventListener('change', handleUploadChange);
      }
      if (uploadZone) {
        uploadZone.removeEventListener('dragover', handleDragOver);
        uploadZone.removeEventListener('drop', handleDrop);
      }
      if (clearAudits) {
        clearAudits.removeEventListener('click', handleClearAudits);
      }
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  return (
    <div className={bodyClassName}>
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-between items-center px-6 py-3 w-full shadow-sm dark:shadow-none transition-all duration-200">
        <div className="flex items-center gap-8">
          <span
            className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white cursor-pointer"
            onClick={() => window.location.reload()}
          >
            EdiPro
          </span>
          <nav className="hidden md:flex gap-6">
            <a className="text-blue-700 dark:text-blue-400 font-semibold border-b-2 border-blue-700 py-1 transition-all" href="/dashboard_sleek">
              Dashboard
            </a>
            {canClaims ? (
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/837_claims_view">
                Reports
              </a>
            ) : null}
            {isAdmin ? (
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/admin/users">
                Admin
              </a>
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
            <img
              className="w-full h-full object-cover"
              data-alt="User Profile Avatar"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCgEW3dXZf1xhBDmpkybJnr21bF6HNiuHphHXF5ZMfTdghbWasho84cnLb8S8iQpaeSBw-fhCGaMQOMakuyIgNossftgFDuvXrrfI8AS1HQ8aXsiiN5jRf5UzMPR3aYhNr7MVZQn2pGVvp51bgB4LzOmkYlr8r84vKcVrNDmd6f9yQ467G7lXlyPhygUgNeyILrY9rjqiqU5HuLzz86Snbq7D27lzvqCYzPfDWO80nIxy6mb85n7yl0OJhP3SQqzcbgwDSKCUiG7ach"
              alt="User Profile Avatar"
            />
          </a>
          <button
            className="md:hidden p-2 hover:bg-slate-100/50 rounded-full transition-all active:scale-95"
            id="nav-toggle"
            aria-label="Open navigation menu"
            type="button"
          >
            <span className="material-symbols-outlined text-slate-700">menu</span>
          </button>
        </div>
      </header>

      <div className="fixed inset-0 bg-slate-900/40 z-30 hidden" id="nav-overlay"></div>

      <aside
        className="fixed left-0 top-0 h-full w-64 z-40 bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-2xl border-r border-slate-200/30 dark:border-slate-800/30 shadow-xl dark:shadow-2xl flex flex-col h-full py-6 pt-20 transform -translate-x-full md:translate-x-0 transition-transform duration-300"
        id="side-nav"
      >
        <div className="px-6 mb-8 flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
              hub
            </span>
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
          <a
            className="bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg mx-2 flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide scale-100 active:scale-[0.98] transition-transform duration-300"
            href="/dashboard_sleek"
            data-nav-link="true"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              dashboard
            </span>{' '}
            Dashboard
          </a>
          <a
            className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
            href="/master_parser_sleek"
            data-nav-link="true"
          >
            <span className="material-symbols-outlined">analytics</span> Master Parser
          </a>
          {canRemittance ? (
            <a
              className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
              href="/835_remittance_sleek"
              data-nav-link="true"
            >
              <span className="material-symbols-outlined">payments</span> 835 Remittance
            </a>
          ) : null}
          {canEnrollment ? (
            <a
              className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
              href="/834_enrollment_sleek"
              data-nav-link="true"
            >
              <span className="material-symbols-outlined">group_add</span> 834 Enrollment
            </a>
          ) : null}
          {canClaims ? (
            <a
              className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
              href="/837_claims_view"
              data-nav-link="true"
            >
              <span className="material-symbols-outlined">description</span> 837 Claims
            </a>
          ) : null}
          {isAdmin ? (
            <a
              className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
              href="/admin/users"
              data-nav-link="true"
            >
              <span className="material-symbols-outlined">group</span> User Management
            </a>
          ) : null}
        </nav>
        <div className="mt-auto px-4 pb-4">
          <button
            className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:brightness-95"
            onClick={() => window.location.href = '/dashboard_sleek'}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            New Submission
          </button>
        </div>
        <div className="px-2 pt-4 border-t border-slate-200/30 mx-4 space-y-1">
          <a
            className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 rounded-lg flex items-center gap-3 px-4 py-2 text-xs font-medium tracking-wide hover:translate-x-1 transition-transform duration-300"
            href="/help_center"
            data-nav-link="true"
          >
            <span className="material-symbols-outlined text-[18px]">help</span> Help Center
          </a>
          <a
            className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 rounded-lg flex items-center gap-3 px-4 py-2 text-xs font-medium tracking-wide hover:translate-x-1 transition-transform duration-300"
            href="/documentation"
            data-nav-link="true"
          >
            <span className="material-symbols-outlined text-[18px]">menu_book</span> Documentation
          </a>
        </div>
      </aside>

      <main className="ml-0 md:ml-64 pt-20 px-4 md:px-8 pb-8 min-h-screen bg-surface">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-[2rem] font-black tracking-tight text-on-surface">Data Integration Hub</h1>
            <p className="text-on-surface-variant/70 text-sm mt-1">Seamlessly ingest and validate healthcare EDI standard files.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-surface-container-high rounded-xl p-4 flex items-center gap-4">
              <div className="text-right border-r border-outline-variant/30 pr-4">
                <span className="text-[10px] uppercase font-bold text-outline">Processed 24h</span>
                <p className="text-xl font-black text-primary" id="processed-count">
                  0
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-outline">Accuracy</span>
                <p className="text-xl font-black text-tertiary" id="accuracy-rate">
                  --
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-10 gap-8 items-start">
          <section className="col-span-6 h-[600px]">
            <div
              className="glass-panel w-full h-full rounded-[24px] border border-white/50 ring-1 ring-slate-200/30 shadow-2xl flex flex-col items-center justify-center p-12 text-center group cursor-pointer relative overflow-hidden transition-all duration-500 hover:shadow-primary/5"
              id="upload-zone"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-tertiary/5 opacity-50"></div>
              <div className="relative z-10 w-full max-w-md">
                <div className="w-32 h-32 bg-white rounded-[32px] mx-auto flex items-center justify-center shadow-2xl drag-zone-glow mb-8 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3">
                  <span className="material-symbols-outlined text-[64px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    upload_file
                  </span>
                </div>
                <h2 className="text-2xl font-black text-on-surface mb-3">Drop 837, 835, or 834 files here</h2>
                <p className="text-on-surface-variant font-medium mb-10 max-w-[280px] mx-auto">
                  Upload HIPAA-compliant transactions for real-time validation and parsing.
                </p>
                <div className="flex flex-col gap-4 items-center w-full">
                  <button
                    className="bg-primary text-white rounded-xl px-8 py-4 font-bold w-full max-w-xs shadow-xl shadow-primary/30 hover:shadow-primary/40 active:scale-95 transition-all hover:brightness-95"
                    id="upload-trigger"
                    type="button"
                  >
                    Select Files from Cloud
                  </button>
                  <input className="hidden" id="file-upload" type="file" accept=".edi,.txt,.dat,.x12" multiple />
                  <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Max file size 256MB</span>
                  <p className="text-xs font-medium text-outline" id="upload-status">
                    No files uploaded yet.
                  </p>
                </div>
              </div>
              <div className="absolute bottom-6 right-6 glass-panel rounded-xl py-2 px-4 flex items-center gap-3 border border-outline-variant/20 shadow-lg group-hover:translate-y-[-4px] transition-transform duration-500">
                <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></div>
                <span className="text-[11px] font-bold text-tertiary uppercase tracking-tighter">AI Parsing Enabled</span>
              </div>
            </div>
          </section>

          <section className="col-span-4 h-[600px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-on-surface flex items-center gap-2">
                Recent Audits
                <span className="bg-primary-fixed text-on-primary-fixed text-[10px] px-2 py-0.5 rounded-full">LIVE</span>
              </h3>
              <button className="text-primary text-xs font-bold hover:underline" type="button" id="clear-audits">
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2" id="recent-audits">
              <div className="glass-panel p-8 rounded-[20px] border border-outline-variant/10 text-center">
                <p className="text-sm font-semibold text-on-surface">No files processed yet.</p>
                <p className="text-xs text-outline mt-2">Upload a 837, 835, or 834 file to start seeing audits.</p>
              </div>
            </div>
          </section>
        </div>

        {uploadTrend.length > 0 && (
          <div className="mt-10 bg-white rounded-2xl border border-outline-variant/10 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-on-surface">Upload Activity</h3>
                <p className="text-xs text-slate-400 mt-0.5">Files processed per day - last 7 days</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400"><span className="w-3 h-3 rounded-full bg-primary inline-block"></span>Total</span>
                <span className="flex items-center gap-1.5 text-slate-400"><span className="w-3 h-3 rounded-full bg-error inline-block"></span>Errors</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={uploadTrend} margin={{top:5,right:20,left:0,bottom:0}} barGap={4} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="date" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                <YAxis allowDecimals={false} tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} width={30}/>
                <Tooltip contentStyle={{borderRadius:'12px',border:'1px solid #e2e8f0',boxShadow:'0 4px 24px rgba(0,0,0,0.08)',fontSize:'12px'}} cursor={{fill:'rgba(79,70,229,0.04)'}}/>
                <Bar dataKey="count" name="Total Files" fill="#4f46e5" radius={[4,4,0,0]} opacity={0.85}/>
                <Bar dataKey="errors" name="Errors" fill="#ef4444" radius={[4,4,0,0]} opacity={0.7}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </main>
    </div>
  );
}



