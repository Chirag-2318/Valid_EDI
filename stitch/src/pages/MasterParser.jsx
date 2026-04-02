import { useEffect } from 'react';

const bodyClassName = 'bg-background font-body text-on-background antialiased selection:bg-primary/10 selection:text-primary page-master-parser';

export function MasterParserPage() {
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

    return () => {
      toggle.removeEventListener('click', handleToggle);
      closeButton.removeEventListener('click', handleClose);
      overlay.removeEventListener('click', handleOverlay);
      navLinks.forEach((link) => {
        link.removeEventListener('click', handleNavLinkClick);
      });
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
          if (ediContent) {
            ediContent.innerHTML = '<p class="text-outline italic">No file selected. Please upload a file from the Dashboard.</p>';
          }
          if (ediFilename) ediFilename.textContent = 'No file loaded';
          return;
        }

        const [fileInfo, errors, parseResult] = await Promise.all([
          fetch('/api/files/' + id).then((r) => r.json()),
          fetch('/api/files/' + id + '/errors').then((r) => r.json()),
          fetch('/api/files/' + id + '/parse-result').then((r) => r.json()),
        ]);

        if (ediFilename) {
          ediFilename.textContent = fileInfo.filename || id;
        }

        if (ediContent) {
          const rawJson = parseResult.raw_json || {};
          const report = rawJson.report || '';
          const lines = report.split('\n');
          ediContent.innerHTML = lines
            .map((line) => '<p>' + (line || '&nbsp;') + '</p>')
            .join('');
        }

        if (validationErrorCount) {
          validationErrorCount.textContent = 'Validation Log (' + errors.length + ' Error' + (errors.length !== 1 ? 's' : '') + ')';
        }

        if (validationLog) {
          if (errors.length === 0) {
            validationLog.innerHTML = '<div class="p-4 bg-white rounded-xl shadow-sm border-l-4 border-green-500 flex items-center gap-4"><span class="material-symbols-outlined text-green-600">check_circle</span><p class="text-sm font-semibold text-green-700">No validation errors found. This file is clean.</p></div>';
          } else {
            validationLog.innerHTML = '';
            errors.forEach((error) => {
              const card = document.createElement('div');
              card.className = 'error-card p-4 bg-white rounded-xl shadow-sm border-l-4 ' + (error.severity === 'error' ? 'border-error' : 'border-amber-400') + ' flex items-start justify-between';
              card.innerHTML =
                '<div class="flex gap-4">' +
                '<div class="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center text-error">' +
                '<span class="material-symbols-outlined">report</span>' +
                '</div>' +
                '<div>' +
                '<h4 class="text-sm font-bold text-on-surface">' + (error.error_code || 'Validation Error') + '</h4>' +
                '<p class="text-xs text-on-surface-variant mt-1">' + (error.error_message || '') + '</p>' +
                '<div class="mt-2 flex items-center gap-2">' +
                (error.loop_id ? '<span class="text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded">LOOP: ' + error.loop_id + '</span>' : '') +
                (error.segment ? '<span class="text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded">SEG: ' + error.segment + '</span>' : '') +
                '<span class="text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded uppercase">' + (error.severity || 'error') + '</span>' +
                '</div>' +
                '</div>' +
                '</div>';
              validationLog.appendChild(card);
            });
          }
        }
      } catch (err) {
        console.error('Failed to load EDI file data:', err);
        const ediContent = document.getElementById('edi-content');
        if (ediContent) {
          ediContent.innerHTML = '<p class="text-error italic">Failed to load file data. Please check the server connection.</p>';
        }
      }
    }

    loadFileData();
  }, []);

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-between items-center px-6 py-3 w-full shadow-sm dark:shadow-none transition-all duration-200">
        <div className="flex items-center gap-8">
          <span
            className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white cursor-pointer"
            onClick={() => window.location.reload()}
          >
            EdiPro
          </span>
          <nav className="hidden md:flex gap-6">
            <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/dashboard_sleek">
              Dashboard
            </a>
            <a className="text-blue-700 dark:text-blue-400 font-semibold border-b-2 border-blue-700 py-1 transition-all" href="/master_parser_sleek">
              Master Parser
            </a>
            <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/837_claims_view">
              Reports
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-full px-3 py-1.5 transition-all">
            <span className="material-symbols-outlined text-[20px] text-slate-500">search</span>
            <input
              className="bg-transparent border-none focus:ring-0 text-sm w-48 placeholder:text-slate-400"
              placeholder="Search files..."
              type="text"
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
            className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
            href="/dashboard_sleek"
            data-nav-link="true"
          >
            <span className="material-symbols-outlined">dashboard</span> Dashboard
          </a>
          <a
            className="bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg mx-2 flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide scale-100 active:scale-[0.98] transition-transform duration-300"
            href="/master_parser_sleek"
            data-nav-link="true"
          >
            <span className="material-symbols-outlined">analytics</span> Master Parser
          </a>
          <a
            className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
            href="/835_remittance_sleek"
            data-nav-link="true"
          >
            <span className="material-symbols-outlined">payments</span> 835 Remittance
          </a>
          <a
            className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
            href="/834_enrollment_sleek"
            data-nav-link="true"
          >
            <span className="material-symbols-outlined">group_add</span> 834 Enrollment
          </a>
          <a
            className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
            href="/837_claims_view"
            data-nav-link="true"
          >
            <span className="material-symbols-outlined">description</span> 837 Claims
          </a>
        </nav>
        <div className="mt-auto px-4 pb-4">
          <button
            className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:brightness-95"
            onClick={() => console.log('Open New Submission Dialog')}
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
        <div className="flex flex-col xl:flex-row gap-6 min-h-[calc(100vh-160px)]">
          <section className="flex-1 flex flex-col min-w-0 min-h-0 bg-surface">
            <div className="flex-[3] border-b border-slate-200/30 flex flex-col min-h-0">
              <div className="px-6 py-3 flex justify-between items-center bg-white/50 border-b border-slate-200/10">
                <div className="flex items-center gap-3">
                  <span id="edi-filename" className="px-2 py-1 bg-surface-container-highest rounded text-[10px] font-mono font-bold text-outline">
                    Loading...
                  </span>
                  <span className="text-xs text-outline italic">ANSI X12 Standard</span>
                </div>
                <div className="flex gap-2">
                  <button className="material-symbols-outlined text-sm p-1.5 hover:bg-slate-100 rounded" type="button">
                    search
                  </button>
                  <button className="material-symbols-outlined text-sm p-1.5 hover:bg-slate-100 rounded" type="button">
                    file_download
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 font-mono text-sm leading-relaxed custom-scrollbar bg-[#fdfdfe]">
                <div id="edi-content" className="flex-1">
                  <p className="text-outline italic">Loading file data...</p>
                </div>
              </div>
            </div>

            <div className="flex-[2] flex flex-col bg-surface-container-low/30 overflow-hidden min-h-0">
              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-200/30">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-error" data-icon="report">
                    report
                  </span>
                  <h3 id="validation-error-count" className="text-sm font-bold tracking-tight">Validation Log</h3>
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 bg-error-container text-on-error-container text-[10px] font-bold rounded-full">
                    CRITICAL
                  </span>
                  <span className="px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold rounded-full">
                    WARNING
                  </span>
                </div>
              </div>
              <div id="validation-log" className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                <p className="text-outline italic text-sm">Loading validation results...</p>
              </div>
            </div>
          </section>

          <aside className="w-full xl:w-[320px] bg-tertiary-container/5 glass-blur border-l border-tertiary/10 flex flex-col z-40 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-white/10 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="p-6 border-b border-tertiary/10 bg-white/40">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-full bg-tertiary flex items-center justify-center text-white">
                    <span className="material-symbols-outlined text-sm" data-weight="fill" style={{ fontVariationSettings: "'FILL' 1" }}>
                      auto_awesome
                    </span>
                  </div>
                  <h2 className="text-lg font-bold tracking-tight text-on-surface">Copilot Summary</h2>
                </div>
                <p className="text-[10px] text-tertiary font-bold tracking-widest uppercase ml-11">Powered by Luminous AI</p>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
                <div>
                  <h3 className="text-xs font-bold text-outline uppercase tracking-widest mb-3">File Analysis</h3>
                  <ul className="space-y-3">
                    <li className="flex gap-3 items-start">
                      <span className="material-symbols-outlined text-tertiary text-lg">check_circle</span>
                      <p className="text-sm leading-snug">Interchange ISA/IEA headers are structurally sound.</p>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="material-symbols-outlined text-tertiary text-lg">psychology</span>
                      <p className="text-sm leading-snug">
                        Detected <span className="font-bold">Institutional Claim (837I)</span> layout with Medicare-specific identifiers.
                      </p>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="material-symbols-outlined text-error text-lg">warning</span>
                      <p className="text-sm leading-snug font-medium text-error">
                        2 syntax violations detected that will cause gateway rejection.
                      </p>
                    </li>
                  </ul>
                </div>
                <div className="bg-tertiary/10 rounded-2xl p-4 border border-tertiary/20 backdrop-blur-md">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-tertiary" data-icon="magic_button">
                      magic_button
                    </span>
                    <h3 className="text-sm font-bold text-tertiary">Fix Assistant</h3>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-4">
                    I can automatically format the BHT05 time and sanitize the Tax ID based on historical provider records.
                  </p>
                  <div className="space-y-2 mb-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 text-[11px] bg-white/60 p-2 rounded-lg border border-white/80 group hover:border-tertiary/40 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-tertiary">history</span>
                          <span>
                            Suggested: <strong className="font-mono">1200</strong>
                          </span>
                        </div>
                        <button
                          className="text-[10px] font-bold text-tertiary hover:underline bg-tertiary/5 px-2 py-1 rounded"
                          onClick={() => alert('Applied BHT05 fix')}
                          type="button"
                        >
                          Apply
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] bg-white/60 p-2 rounded-lg border border-white/80 group hover:border-tertiary/40 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-tertiary">history</span>
                          <span>
                            Suggested: <strong className="font-mono">123456789</strong>
                          </span>
                        </div>
                        <button
                          className="text-[10px] font-bold text-tertiary hover:underline bg-tertiary/5 px-2 py-1 rounded"
                          onClick={() => alert('Applied REF02 fix')}
                          type="button"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    className="w-full py-3 bg-tertiary text-white rounded-xl text-sm font-bold shadow-lg shadow-tertiary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                    onClick={() => alert('Applying all AI suggestions to the document...')}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                    Apply All Fixes
                  </button>
                </div>
                <div className="pt-4">
                  <h3 className="text-xs font-bold text-outline uppercase tracking-widest mb-3">Transaction Health</h3>
                  <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden flex">
                    <div className="h-full bg-primary" style={{ width: '75%' }}></div>
                    <div className="h-full bg-error" style={{ width: '25%' }}></div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[10px] font-bold">75% VALID</span>
                    <span className="text-[10px] font-bold text-error">25% ERROR</span>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-white/40 border-t border-tertiary/10 relative z-10">
                <div className="relative">
                  <input
                    className="w-full bg-white border border-tertiary/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-tertiary/20 pr-10"
                    placeholder="Ask Copilot a question..."
                    type="text"
                  />
                  <button className="absolute right-3 top-3 text-tertiary material-symbols-outlined" type="button">
                    send
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="h-8 bg-white border-t border-slate-200/50 flex items-center px-4 justify-between text-[10px] font-medium text-slate-500 z-50">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> System Online
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">database</span> Connected to Production Gateway
          </span>
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

