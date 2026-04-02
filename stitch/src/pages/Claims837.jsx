import { useEffect } from 'react';

const bodyClassName = 'bg-background text-on-surface font-body selection:bg-primary-fixed selection:text-on-primary-fixed page-claims';

export function Claims837Page() {
  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;

    return () => {
      document.body.className = previous;
    };
  }, []);

  useEffect(() => {
    async function loadClaimsData() {
      try {
        const files = await fetch('/api/files').then((r) => r.json());
        const claimFiles = Array.isArray(files) ? files.filter((f) => f.transaction_type === '837p' || f.transaction_type === '837i') : [];

        const tbody = document.getElementById('claims-tbody');
        const totalEl = document.getElementById('claims-total');
        const errorsEl = document.getElementById('claims-errors');

        if (totalEl) totalEl.textContent = claimFiles.length.toLocaleString();
        if (errorsEl) errorsEl.textContent = claimFiles.filter((f) => !f.is_valid).length.toLocaleString();

        if (tbody) {
          if (claimFiles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-sm text-slate-400 italic">No 837 claim files uploaded yet. Upload files from the Dashboard.</td></tr>';
          } else {
            tbody.innerHTML = '';
            claimFiles.forEach((file) => {
              const tr = document.createElement('tr');
              tr.className = 'hover:bg-primary/5 transition-colors group';
              const statusClass = file.is_valid ? 'bg-green-100 text-green-700 border-green-200/50' : 'bg-error-container/30 text-error border-error/10';
              const statusText = file.is_valid ? 'Clean' : 'Error';
              const statusDot = file.is_valid ? 'bg-green-500' : 'bg-error';
              tr.innerHTML =
                '<td class="px-4 py-2 text-xs font-bold text-slate-900">' + file.filename + '</td>' +
                '<td class="px-4 py-2"><div class="flex flex-col"><span class="text-xs font-semibold text-slate-700">' + (file.transaction_type || '').toUpperCase() + '</span></div></td>' +
                '<td class="px-4 py-2 text-xs text-slate-600">' + (file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : '-') + '</td>' +
                '<td class="px-4 py-2 text-xs font-bold text-slate-900 text-right">' + file.error_count + ' errors</td>' +
                '<td class="px-4 py-2 text-center"><span class="text-[10px] font-bold bg-surface-container-highest px-2 py-0.5 rounded text-slate-600">' + (file.warning_count || 0) + ' warn</span></td>' +
                '<td class="px-4 py-2"><span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ' + statusClass + ' border"><span class="w-1.5 h-1.5 rounded-full ' + statusDot + '"></span> ' + statusText + '</span></td>' +
                '<td class="px-4 py-2 text-right"><button class="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-primary" type="button" onclick="localStorage.setItem(\'selectedFileId\',\'' + file.id + '\');window.location.href=\'/master_parser_sleek\'"><span class="material-symbols-outlined text-lg">open_in_new</span></button></td>';
              tbody.appendChild(tr);
            });
          }
        }
      } catch (err) {
        console.error('Failed to load claims data:', err);
      }
    }
    loadClaimsData();
  }, []);
  useEffect(() => {
    const summaryCards = Array.from(
      document.querySelectorAll('section.grid.grid-cols-1.md\\:grid-cols-3.gap-6.mb-8 > div')
    );
    const statusButtons = Array.from(document.querySelectorAll('aside.w-full.lg\\:w-64 .space-y-1 button'));
    const claimRows = Array.from(document.querySelectorAll('tbody tr'));
    const claimTypeInputs = Array.from(document.querySelectorAll('input[type="checkbox"]'));

    function activateSingle(elements, target, activeClasses) {
      elements.forEach((element) => element.classList.remove(...activeClasses));
      target.classList.add(...activeClasses);
    }

    const summaryHandlers = summaryCards.map((card) => {
      const handleClick = () => {
        activateSingle(summaryCards, card, ['ring-2', 'ring-primary/30', '-translate-y-0.5']);
      };
      const handleKeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      };
      card.classList.add('cursor-pointer', 'transition-all');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.addEventListener('click', handleClick);
      card.addEventListener('keydown', handleKeydown);
      return { card, handleClick, handleKeydown };
    });

    const statusHandlers = statusButtons.map((button) => {
      const handleClick = () => {
        activateSingle(statusButtons, button, ['bg-primary/10', 'rounded-xl', 'text-primary']);
      };
      button.classList.add('transition-all');
      button.addEventListener('click', handleClick);
      return { button, handleClick };
    });

    const inputHandlers = claimTypeInputs
      .map((input) => {
        const label = input.closest('label');
        if (!label) {
          return null;
        }
        const sync = () => {
          label.classList.toggle('ring-2', input.checked);
          label.classList.toggle('ring-primary/20', input.checked);
        };
        sync();
        input.addEventListener('change', sync);
        return { input, sync };
      })
      .filter(Boolean);

    const rowHandlers = claimRows.map((row) => {
      const handleClick = () => {
        row.classList.toggle('bg-blue-50/50');
        const firstCell = row.cells && row.cells[0];
        if (firstCell) {
          console.log('Row clicked:', firstCell.innerText);
        }
      };
      const handleKeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      };
      row.classList.add('cursor-pointer');
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.addEventListener('click', handleClick);
      row.addEventListener('keydown', handleKeydown);
      return { row, handleClick, handleKeydown };
    });

    return () => {
      summaryHandlers.forEach(({ card, handleClick, handleKeydown }) => {
        card.removeEventListener('click', handleClick);
        card.removeEventListener('keydown', handleKeydown);
      });
      statusHandlers.forEach(({ button, handleClick }) => {
        button.removeEventListener('click', handleClick);
      });
      inputHandlers.forEach(({ input, sync }) => {
        input.removeEventListener('change', sync);
      });
      rowHandlers.forEach(({ row, handleClick, handleKeydown }) => {
        row.removeEventListener('click', handleClick);
        row.removeEventListener('keydown', handleKeydown);
      });
    };
  }, []);

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-between items-center px-6 py-3 shadow-sm dark:shadow-none transition-all duration-200">
        <div className="flex items-center gap-8">
          <span
            className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white cursor-pointer"
            onClick={() => {
              window.location.href = '/dashboard_sleek';
            }}
          >
            EdiPro
          </span>
          <nav className="hidden md:flex gap-6">
            <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/dashboard_sleek">
              Dashboard
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
        </div>
      </header>

      <aside className="fixed left-0 top-0 h-full w-64 z-40 bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-2xl border-r border-slate-200/30 dark:border-slate-800/30 shadow-xl dark:shadow-2xl flex flex-col h-full py-6 pt-20">
        <div
          className="px-6 mb-8 flex items-center gap-3 cursor-pointer"
          onClick={() => {
            window.location.href = '/dashboard_sleek';
          }}
        >
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
              hub
            </span>
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-none">HealthConnect</h2>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">EDI Gateway</p>
          </div>
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
            className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
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
            className="bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg mx-2 flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide scale-100 active:scale-[0.98] transition-transform duration-300"
            href="/837_claims_view"
            data-nav-link="true"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              description
            </span>{' '}
            837 Claims
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
                <button className="px-4 py-2 bg-white shadow-sm rounded-lg text-sm font-bold text-primary" type="button">
                  837P <span className="text-[10px] text-slate-400 font-normal ml-1">Professional</span>
                </button>
                <button className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700" type="button">
                  837I <span className="text-[10px] text-slate-400 font-normal ml-1">Institutional</span>
                </button>
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
              <h3 className="text-3xl font-black mt-1"><span id="claims-total">0</span></h3>
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
              <h3 className="text-3xl font-black mt-1">$4.2M</h3>
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
              <h3 className="text-3xl font-black mt-1"><span id="claims-errors">0</span></h3>
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <span className="material-symbols-outlined text-9xl">bug_report</span>
              </div>
            </div>
          </section>

          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="w-full lg:w-64 space-y-8">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Claim Types</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 glass-panel rounded-xl cursor-pointer hover:bg-white transition-colors border border-outline-variant/10">
                    <input defaultChecked className="rounded border-slate-300 text-primary focus:ring-primary" type="checkbox" />
                    <span className="text-sm font-semibold text-slate-700">837P Professional</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 glass-panel rounded-xl cursor-pointer hover:bg-white transition-colors border border-outline-variant/10">
                    <input className="rounded border-slate-300 text-primary focus:ring-primary" type="checkbox" />
                    <span className="text-sm font-semibold text-slate-700">837I Institutional</span>
                  </label>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Validation Status</h4>
                <div className="space-y-1">
                  <button className="w-full flex justify-between items-center p-2 text-sm font-medium text-slate-600 hover:text-primary group" type="button">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span> Clean Claims
                    </span>
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded group-hover:bg-primary-fixed">38k</span>
                  </button>
                  <button className="w-full flex justify-between items-center p-2 text-sm font-medium text-slate-600 hover:text-primary group" type="button">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-error"></span> Missing Fields
                    </span>
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">412</span>
                  </button>
                  <button className="w-full flex justify-between items-center p-2 text-sm font-medium text-slate-600 hover:text-primary group" type="button">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span> NPI Mismatch
                    </span>
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">128</span>
                  </button>
                </div>
              </div>
              <div className="pt-4">
                <img
                  alt="Abstract Healthcare Data Visualization"
                  className="w-full h-32 rounded-2xl object-cover opacity-60 mix-blend-multiply"
                  data-alt="Abstract soft blue medical data pattern"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGUXPfvfASWfUidRvyAHmPb8uIquQXJU8QUkZPZC7kqpl93zpM_bqEP_Wgjjz4eCGI3K_MO4Bqxz2UddM6FIUfnSeNzlSGVQhqS8_SYpEj81VmDWgshch8uFx82MjVC_P9f7hYfrYN9of7iyLVIIBuEC4a6ujevZJBqnIROauOwJZ55VehXqk0O7gi_VjFcrNSRwdKhiaTyc-mdiyzYKSzZMo5KsyJClh_Rrm0EEdKPtBfKhvmClwJL5z4prC4wSJ60IZhFqnfjhca"
                />
              </div>
            </aside>

            <div className="flex-1 overflow-hidden">
              <div className="glass-panel rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 flex items-center justify-between gap-4 border-b border-outline-variant/5">
                  <div className="relative flex-1 max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input
                      className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400"
                      placeholder="Search by Claim ID, Provider, or Subscriber..."
                      type="text"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all" type="button">
                      <span className="material-symbols-outlined">filter_list</span>
                    </button>
                    <button
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all"
                      onClick={() => alert('Preparing report for download...')}
                      type="button"
                    >
                      <span className="material-symbols-outlined">download</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low/50">
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-outline-variant/10">Claim ID</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-outline-variant/10">Provider (NPI)</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-outline-variant/10">Subscriber</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-outline-variant/10 text-right">Billed Amt</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-outline-variant/10 text-center">ICD-10</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-outline-variant/10">Validation Status</th>
                        <th className="px-4 py-3 border-b border-outline-variant/10"></th>
                      </tr>
                    </thead>
                    <tbody id="claims-tbody" className="divide-y divide-outline-variant/5">
                      <tr className="hover:bg-primary/5 transition-colors group">
                        <td className="px-4 py-2 text-xs font-bold text-slate-900">#CLM-29384-01</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-700">Northside Clinic</span>
                            <span className="text-[10px] text-slate-400">1294857204</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">Johnathan Miller (A9342)</td>
                        <td className="px-4 py-2 text-xs font-bold text-slate-900 text-right">$1,245.00</td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-[10px] font-bold bg-surface-container-highest px-2 py-0.5 rounded text-slate-600">Z00.00</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-green-100 text-green-700 border border-green-200/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Clean
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-primary" type="button">
                            <span className="material-symbols-outlined text-lg">more_vert</span>
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-primary/5 transition-colors group">
                        <td className="px-4 py-2 text-xs font-bold text-slate-900">#CLM-30192-44</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-700">General Imaging</span>
                            <span className="text-[10px] text-slate-400">1049285741</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">Sarah West (W2201)</td>
                        <td className="px-4 py-2 text-xs font-bold text-slate-900 text-right">$4,820.50</td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-[10px] font-bold bg-surface-container-highest px-2 py-0.5 rounded text-slate-600">M54.5</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-error-container/30 text-error border border-error/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-error"></span> Error
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-primary" type="button">
                            <span className="material-symbols-outlined text-lg">more_vert</span>
                          </button>
                        </td>
                      </tr>
                      <tr className="bg-tertiary-fixed/10 hover:bg-tertiary-fixed/20 transition-colors group">
                        <td className="px-4 py-2 text-xs font-bold text-tertiary">#CLM-44910-AI</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-700">St. Mary's Ortho</span>
                            <span className="text-[10px] text-slate-400">1992038475</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">Robert Chen (C0012)</td>
                        <td className="px-4 py-2 text-xs font-bold text-slate-900 text-right">$312.00</td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-[10px] font-bold bg-tertiary-fixed px-2 py-0.5 rounded text-on-tertiary-fixed-variant">S82.1</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-tertiary-fixed-dim text-on-tertiary-fixed-variant border border-tertiary/20">
                            <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                              auto_awesome
                            </span>{' '}
                            Smart Parsed
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-primary" type="button">
                            <span className="material-symbols-outlined text-lg">more_vert</span>
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-primary/5 transition-colors group">
                        <td className="px-4 py-2 text-xs font-bold text-slate-900">#CLM-99201-88</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-700">CVS Health</span>
                            <span className="text-[10px] text-slate-400">1938475620</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">Linda Harris (H8892)</td>
                        <td className="px-4 py-2 text-xs font-bold text-slate-900 text-right">$89.12</td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-[10px] font-bold bg-surface-container-highest px-2 py-0.5 rounded text-slate-600">E11.9</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-green-100 text-green-700 tracking-tighter">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Clean
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-primary" type="button">
                            <span className="material-symbols-outlined text-lg">more_vert</span>
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-primary/5 transition-colors group">
                        <td className="px-4 py-2 text-xs font-bold text-slate-900">#CLM-12093-02</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-700">Urgent Care P.C.</span>
                            <span className="text-[10px] text-slate-400">1002938475</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">Kevin Durant (D3302)</td>
                        <td className="px-4 py-2 text-xs font-bold text-slate-900 text-right">$225.00</td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-[10px] font-bold bg-surface-container-highest px-2 py-0.5 rounded text-slate-600">J01.9</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-green-100 text-green-700 tracking-tighter">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Clean
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-primary" type="button">
                            <span className="material-symbols-outlined text-lg">more_vert</span>
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-primary/5 transition-colors group">
                        <td className="px-4 py-2 text-xs font-bold text-slate-900">#CLM-00912-33</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-700">City Radiology</span>
                            <span className="text-[10px] text-slate-400">1102938482</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">Amy Santiago (S0023)</td>
                        <td className="px-4 py-2 text-xs font-bold text-slate-900 text-right">$1,150.00</td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-[10px] font-bold bg-surface-container-highest px-2 py-0.5 rounded text-slate-600">R05.1</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-error-container/30 text-error border border-error/10 tracking-tighter">
                            <span className="w-1.5 h-1.5 rounded-full bg-error"></span> Error
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-primary" type="button">
                            <span className="material-symbols-outlined text-lg">more_vert</span>
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-primary/5 transition-colors group">
                        <td className="px-4 py-2 text-xs font-bold text-slate-900">#CLM-55012-91</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-700">Metro Heart</span>
                            <span className="text-[10px] text-slate-400">1882736450</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">Marcus Wright (W4401)</td>
                        <td className="px-4 py-2 text-xs font-bold text-slate-900 text-right">$5,200.00</td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-[10px] font-bold bg-surface-container-highest px-2 py-0.5 rounded text-slate-600">I10.0</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-green-100 text-green-700 tracking-tighter">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Clean
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-primary" type="button">
                            <span className="material-symbols-outlined text-lg">more_vert</span>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-4 border-t border-outline-variant/5 bg-surface-container-low/30 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Showing <strong>1 - 8</strong> of 42,891 results
                  </span>
                  <div className="flex gap-1">
                    <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-primary transition-all" type="button">
                      <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <button className="w-8 h-8 rounded-lg flex items-center justify-center bg-white text-primary font-bold shadow-sm text-xs" type="button">
                      1
                    </button>
                    <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white transition-all text-xs" type="button">
                      2
                    </button>
                    <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white transition-all text-xs" type="button">
                      3
                    </button>
                    <span className="w-8 h-8 flex items-center justify-center text-slate-400">...</span>
                    <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-primary transition-all" type="button">
                      <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}


