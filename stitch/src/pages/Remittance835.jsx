﻿import { useEffect, useState } from 'react';

const bodyClassName = 'bg-background font-body text-on-background antialiased selection:bg-primary/10 selection:text-primary page-remittance';

export function Remittance835Page() {
  const [showInsight, setShowInsight] = useState(true);

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
    async function loadRemittanceData() {
      try {
        const files = await fetch('/api/files').then((r) => r.json());
        const remitFiles = Array.isArray(files) ? files.filter((f) => f.transaction_type === '835') : [];

        const tbody = document.getElementById('remittance-tbody');
        const totalEl = document.getElementById('remittance-total');
        const countEl = document.getElementById('remittance-count');

        if (totalEl) totalEl.textContent = remitFiles.length + ' files';
        if (countEl) countEl.textContent = remitFiles.length.toLocaleString();

        const totalPaidEl = document.getElementById('remittance-total-paid');
        const adjustmentsEl = document.getElementById('remittance-adjustments');
        const collectionRateEl = document.getElementById('remittance-collection-rate');
        const periodChangeEl = document.getElementById('remittance-period-change');

        let totalPaid = 0;
        let totalBilled = 0;
        for (const file of remitFiles) {
          try {
            const pr = await fetch('/api/files/' + file.id + '/parse-result').then(r => r.json());
            const claims = pr?.raw_json?.structured_data || pr?.raw_json?.json_export?.claims || [];
            for (const claim of claims) {
              const charge = parseFloat(claim.total_charge || claim.billed_amount || 0);
              totalBilled += charge;
              if (file.is_valid) totalPaid += charge;
            }
          } catch(e) { /* skip */ }
        }
        const adjustments = totalBilled - totalPaid;
        const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;
        if (totalPaidEl) totalPaidEl.textContent = '$' + totalPaid.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        if (adjustmentsEl) adjustmentsEl.textContent = '$' + adjustments.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        if (collectionRateEl) collectionRateEl.textContent = collectionRate + '% Collection Rate';
        if (remitFiles.length > 0 && periodChangeEl) {
          periodChangeEl.textContent = '↑ ' + remitFiles.length + ' file(s) this period';
        }

        if (tbody) {
          if (remitFiles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-sm text-slate-400 italic">No 835 remittance files uploaded yet. Upload files from the Dashboard.</td></tr>';
          } else {
            tbody.innerHTML = '';
            remitFiles.forEach((file) => {
              const tr = document.createElement('tr');
              tr.className = 'hover:bg-primary/5 transition-colors group';
              const statusClass = file.is_valid ? 'bg-[#E6F4EA] text-[#1E7E34]' : 'bg-[#FCE8E8] text-[#D32F2F]';
              const statusText = file.is_valid ? 'Valid' : 'Error';
              tr.innerHTML =
                '<td class="px-6 py-4"><div class="flex flex-col"><span class="text-sm font-bold text-on-surface">' + file.filename + '</span><span class="text-[10px] text-on-surface-variant font-medium tracking-tight">ID: ' + file.id.substring(0, 8) + '...</span></div></td>' +
                '<td class="px-6 py-4"><span class="text-sm font-medium">' + (file.transaction_type || '').toUpperCase() + '</span></td>' +
                '<td class="px-6 py-4 text-right"><span class="text-sm font-medium">' + file.error_count + ' errors</span></td>' +
                '<td class="px-6 py-4 text-right"><span class="text-sm font-bold text-primary">' + (file.warning_count || 0) + ' warnings</span></td>' +
                '<td class="px-6 py-4"><span class="text-sm text-on-surface-variant">' + (file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : '-') + '</span></td>' +
                '<td class="px-6 py-4"><span class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ' + statusClass + '">' + statusText + '</span></td>' +
                '<td class="px-6 py-4 text-right"><button class="opacity-0 group-hover:opacity-100 p-2 hover:bg-primary/10 rounded-lg text-primary transition-all" type="button" onclick="localStorage.setItem(\'selectedFileId\',\'' + file.id + '\');window.location.href=\'/master_parser_sleek\'"><span class="material-symbols-outlined text-sm">chevron_right</span></button></td>';
              tbody.appendChild(tr);
            });
          }
        }
      } catch (err) {
        console.error('Failed to load remittance data:', err);
      }
    }
    loadRemittanceData();
  }, []);
  useEffect(() => {
    const metricCards = Array.from(document.querySelectorAll('.glass-card')).slice(0, 3);
    const tableRows = Array.from(document.querySelectorAll('tbody tr'));

    function activateMetric(card) {
      metricCards.forEach((item) => {
        item.classList.remove('ring-2', 'ring-primary/30', '-translate-y-0.5');
      });
      card.classList.add('ring-2', 'ring-primary/30', '-translate-y-0.5');
    }

    const metricHandlers = metricCards.map((card) => {
      const handleClick = () => activateMetric(card);
      const handleKeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activateMetric(card);
        }
      };
      card.classList.add('cursor-pointer', 'transition-all');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Select remittance metric card');
      card.addEventListener('click', handleClick);
      card.addEventListener('keydown', handleKeydown);
      return { card, handleClick, handleKeydown };
    });

    const rowHandlers = tableRows.map((row) => {
      const handleClick = () => {
        tableRows.forEach((item) => item.classList.remove('bg-primary/10'));
        row.classList.add('bg-primary/10');
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
      metricHandlers.forEach(({ card, handleClick, handleKeydown }) => {
        card.removeEventListener('click', handleClick);
        card.removeEventListener('keydown', handleKeydown);
      });
      rowHandlers.forEach(({ row, handleClick, handleKeydown }) => {
        row.removeEventListener('click', handleClick);
        row.removeEventListener('keydown', handleKeydown);
      });
    };
  }, []);

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-between items-center px-6 py-3 w-full shadow-sm dark:shadow-none transition-all duration-200">
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
          <button className="md:hidden p-2 hover:bg-slate-100/50 rounded-full transition-all active:scale-95" id="nav-toggle" aria-label="Open navigation menu" type="button">
            <span className="material-symbols-outlined text-slate-700">menu</span>
          </button>
        </div>
      </header>

      <div className="fixed inset-0 bg-slate-900/40 z-30 hidden" id="nav-overlay"></div>

      <aside
        className="fixed left-0 top-0 h-full w-64 z-40 bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-2xl border-r border-slate-200/30 dark:border-slate-800/30 shadow-xl dark:shadow-2xl flex flex-col h-full py-6 pt-20 transform -translate-x-full md:translate-x-0 transition-transform duration-300"
        id="side-nav"
      >
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
            className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
            href="/master_parser_sleek"
            data-nav-link="true"
          >
            <span className="material-symbols-outlined">analytics</span> Master Parser
          </a>
          <a
            className="bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg mx-2 flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide scale-100 active:scale-[0.98] transition-transform duration-300"
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
        <header className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">Remittance Overview</h1>
          <p className="text-on-surface-variant max-w-2xl">
            Processed 835 Electronic Remittance Advice (ERA) files. Real-time reconciliation and payment validation.
          </p>
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
              <span className="text-3xl font-bold tracking-tight"><span id="remittance-total">0 files</span></span>
              <span className="text-xs text-primary font-medium mt-1" id="remittance-period-change">-- from last period</span>
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl border border-outline-variant/10 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-on-surface-variant text-sm font-semibold uppercase tracking-wider">Total Paid</span>
              <div className="bg-tertiary/10 p-2 rounded-lg text-tertiary">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold tracking-tight" id="remittance-total-paid">$0.00</span>
              <span className="text-xs text-tertiary font-medium mt-1" id="remittance-collection-rate">--</span>
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
              <span className="text-3xl font-bold tracking-tight" id="remittance-adjustments">$0.00</span>
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
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">Payer / Source</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant text-right">Billed</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant text-right">Paid</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">Processed Date</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">Status</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant"></th>
                </tr>
              </thead>
              <tbody id="remittance-tbody" className="divide-y divide-outline-variant/10">
                <tr className="hover:bg-primary/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-on-surface">835-TRC-94281</span>
                      <span className="text-[10px] text-tertiary font-bold tracking-tight uppercase">AI PARSED</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                        <img
                          alt="BCBS Logo"
                          className="w-full h-full object-cover"
                          data-alt="Blue Cross Blue Shield stylized logo icon"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9GZvEzl_XPzc5Y2GkDexcvKmR9ELCOyTvLd13xEIquXO-BB2nbd4oUFR_FEH7auiOhmUlPk1r9ga3eK67_C9yGmzNwUg4E9CeQ00nCTqHnuXCrHTNUbUzzAfZ-pal3bi-1Olxi2-SYBtyNOxOZ5WThnnQEyMNHTraup8PjBrkT90NCcEJeHews25uLrsWAUjsxa_G_onPiGf01QsFiytLtwRCMMB-z1YEg9GX7hE7AZemAOGnfIK_qZyp6wP2rM4nFE2N2Mb2yGbm"
                        />
                      </div>
                      <span className="text-sm font-medium">BCBS of Massachusetts</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium">$12,450.00</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-primary">$12,450.00</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-on-surface-variant">Oct 24, 2023</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-[#E6F4EA] text-[#1E7E34] uppercase tracking-wide">Paid</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-primary/10 rounded-lg text-primary transition-all" type="button">
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                  </td>
                </tr>
                <tr className="hover:bg-primary/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-on-surface">835-TRC-94290</span>
                      <span className="text-[10px] text-on-surface-variant font-medium tracking-tight">ISA05: ZZ</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                        <img
                          alt="UnitedHealth Logo"
                          className="w-full h-full object-cover"
                          data-alt="UnitedHealth Group circular brand icon"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDLqdqRaTRlHbRxeYebcfvPf2TvmEfGPXsLhns7J4lGXf1gvHHPvwy0aa5MMecy6BJQpwbGUltNWfC4aat1RnGp8JCGm9Ekd0mmQmw2UJkp_ssmm-602XKpH2nale1W7xaNhEI1aEYBAHgdJwB0_1rjWwiYBCkmOe882hQEgqq9i1JCdap4mNsuPQffUo1sdcG-SkEcNiLP-D0yV-rHWE0lLU8zc3XcAbRuQ0rj2qT79y_FmpBeMIlPxLUh3Pn9S0pvd-6-2zeY9Lzl"
                        />
                      </div>
                      <span className="text-sm font-medium">UnitedHealthcare</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium">$4,200.00</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-on-surface">$2,100.00</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-on-surface-variant">Oct 23, 2023</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-[#FFF4E5] text-[#B76E00] uppercase tracking-wide">Partial</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-primary/10 rounded-lg text-primary transition-all" type="button">
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                  </td>
                </tr>
                <tr className="hover:bg-primary/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-on-surface">835-TRC-94301</span>
                      <span className="text-[10px] text-error font-bold tracking-tight uppercase">CRITICAL ERR</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                        <img
                          alt="Medicare Logo"
                          className="w-full h-full object-cover"
                          data-alt="Medicare government program official style icon"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDzuR_CyGx-Mr3f4NrcL2VKdpzcReSMLJu8GmYCPzNL4CqTbi6h1abshgqIXMsVrgJxez4PtYLEC6HHes7AE8g08d2kXMXwpRjA5sQv9RUCgiMkqw5cL8zDnOGMIVbYDM7r3VDyneKpoCjBl4CoS4UJp8Uz7va3gLXa5HviNvqsSJnTahPBgnyVtyBiL1QZsK_3Iwx2JLqPAtWFH_k_cuYCZfGUWUao89x_bpGOpy7I0qM-ZTacAf2OjKnSWFIhURBbfuMpyDwX89z4"
                        />
                      </div>
                      <span className="text-sm font-medium">CMS Medicare Part B</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium">$1,890.00</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-error">$0.00</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-on-surface-variant">Oct 23, 2023</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-[#FCE8E8] text-[#D32F2F] uppercase tracking-wide">Denied</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-primary/10 rounded-lg text-primary transition-all" type="button">
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                  </td>
                </tr>
                <tr className="hover:bg-primary/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-on-surface">835-TRC-94315</span>
                      <span className="text-[10px] text-on-surface-variant font-medium tracking-tight">ISA05: 27</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                        <img
                          alt="Aetna Logo"
                          className="w-full h-full object-cover"
                          data-alt="Aetna health insurance corporate logo icon"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuARejxXih1cQqT3FF0vLM4i66G-2Pc13qfXMTH6scfI-8-Z1-kH37S0QHkHJ396F5CcjMOqm8hJfPjAYp9s18ll9CVXSGku9HjbSTbfRQ4llvz1lcDqEcegqV_n3A7424i1zQCuEt0_fy9BUm5tChPx4ayim3IKNIRYS82MQXOsUZ18J6nPC24XW0KKELTazalZluxT5h75UPwKWPo6-WgMfb4YpHR0mhckbhqjtfWIW7r7n-WpqmgMFeLHRtUo5ZvQzIlNfuclJVAr"
                        />
                      </div>
                      <span className="text-sm font-medium">Aetna Healthcare</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium">$56,700.00</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-primary">$56,700.00</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-on-surface-variant">Oct 22, 2023</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-[#E6F4EA] text-[#1E7E34] uppercase tracking-wide">Paid</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-primary/10 rounded-lg text-primary transition-all" type="button">
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-surface-container-low/20 flex items-center justify-between">
            <span className="text-xs text-on-surface-variant font-medium"><span id="remittance-count">0</span> records loaded</span>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-white border border-outline-variant/10 rounded-lg text-xs font-semibold shadow-sm hover:bg-surface-container-low transition-all" type="button">
                Previous
              </button>
              <button className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 transition-all" type="button">
                Next
              </button>
            </div>
          </div>
        </div>

        {showInsight ? (
          <div className="fixed bottom-8 right-8 w-80 p-6 glass-card rounded-2xl shadow-2xl border border-white/40 z-40">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-tertiary flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
              </div>
              <h3 className="font-bold text-on-surface tracking-tight">Smart Insight</h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
              We've detected a <span className="text-tertiary font-bold">14% increase</span> in medical necessity denials from Medicare. Would you like to
              view the suggested coding adjustments for next batch?
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 py-2 bg-tertiary text-white text-xs font-bold rounded-lg hover:bg-tertiary-container transition-all"
                onClick={() => alert('Loading detailed analysis for Medicare denials...')}
                type="button"
              >
                View Details
              </button>
              <button
                className="px-3 py-2 text-on-surface-variant text-xs font-semibold hover:bg-surface-container-high rounded-lg transition-all"
                onClick={() => setShowInsight(false)}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}


