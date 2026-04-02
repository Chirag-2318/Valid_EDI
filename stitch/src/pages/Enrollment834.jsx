import { useEffect } from 'react';

const bodyClassName = 'bg-background font-body text-on-background antialiased selection:bg-primary/10 selection:text-primary page-enrollment';

export function Enrollment834Page() {
  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;

    return () => {
      document.body.className = previous;
    };
  }, []);

  useEffect(() => {
    async function loadEnrollmentData() {
      try {
        const files = await fetch('/api/files').then((r) => r.json());
        const enrollFiles = Array.isArray(files) ? files.filter((f) => f.transaction_type === '834') : [];

        const memberList = document.getElementById('enrollment-member-list');
        const countEl = document.getElementById('enrollment-count');
        const statusEl = document.getElementById('enrollment-status');

        if (countEl) countEl.textContent = enrollFiles.length;
        if (statusEl) statusEl.textContent = enrollFiles.length > 0 ? 'ACTIVE BATCH' : 'NO FILES';

        if (memberList) {
          if (enrollFiles.length === 0) {
            memberList.innerHTML = '<div class="p-4 text-center text-sm text-slate-400 italic">No 834 enrollment files uploaded yet. Upload files from the Dashboard.</div>';
          } else {
            memberList.innerHTML = '';
            enrollFiles.forEach((file) => {
              const card = document.createElement('div');
              card.className = 'p-4 bg-white/80 rounded-2xl shadow-sm border border-transparent hover:border-primary/20 hover:shadow-md cursor-pointer transition-all group';
              const initials = file.filename.substring(0, 2).toUpperCase();
              const statusBadge = file.is_valid
                ? '<span class="bg-green-100 text-green-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-tighter uppercase">Valid</span>'
                : '<span class="bg-red-100 text-error text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-tighter uppercase">Error</span>';
              card.innerHTML =
                '<div class="flex items-start justify-between">' +
                '<div class="flex items-center gap-3">' +
                '<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-primary font-bold text-sm">' + initials + '</div>' +
                '<div><p class="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">' + file.filename + '</p>' +
                '<p class="text-[10px] text-slate-500 font-mono tracking-tight">' + file.error_count + ' errors • ' + (file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : '') + '</p></div>' +
                '</div>' + statusBadge + '</div>';
              card.addEventListener('click', () => {
                localStorage.setItem('selectedFileId', file.id);
                window.location.href = '/master_parser_sleek';
              });
              memberList.appendChild(card);
            });
          }
        }
      } catch (err) {
        console.error('Failed to load enrollment data:', err);
      }
    }
    loadEnrollmentData();
  }, []);
  useEffect(() => {
    const memberCards = Array.from(document.querySelectorAll('.flex-1.overflow-y-auto.p-4.space-y-2 > div'));
    const planCards = Array.from(document.querySelectorAll('.col-span-12 .flex-1.bg-surface-container-low'));
    const employmentRows = Array.from(document.querySelectorAll('.col-span-6 .space-y-4 > div'));
    const segmentCard = document.querySelector('.col-span-6.bg-slate-900');
    const segmentLines = segmentCard ? Array.from(segmentCard.querySelectorAll('p')) : [];

    function makeSelectable(elements, activeClasses) {
      elements.forEach((element) => {
        element.classList.add('cursor-pointer', 'transition-all');
        element.tabIndex = 0;
        element.setAttribute('role', 'button');
        element.addEventListener('click', () => {
          elements.forEach((item) => item.classList.remove(...activeClasses));
          element.classList.add(...activeClasses);
        });
        element.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            element.click();
          }
        });
      });
    }

    makeSelectable(memberCards, ['ring-2', 'ring-primary/30']);
    makeSelectable(planCards, ['ring-2', 'ring-primary/30', '-translate-y-0.5']);

    employmentRows.forEach((row) => {
      row.classList.add('transition-colors', 'cursor-pointer');
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.addEventListener('click', () => {
        employmentRows.forEach((item) => item.classList.remove('bg-primary/5'));
        row.classList.add('bg-primary/5');
      });
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          row.click();
        }
      });
    });

    segmentLines.forEach((line) => {
      line.classList.add('cursor-pointer', 'transition-colors');
      line.tabIndex = 0;
      line.setAttribute('role', 'button');
      line.setAttribute('aria-label', 'Copy EDI segment line');
      line.addEventListener('click', () => {
        const rawText = line.textContent ? line.textContent.trim() : '';
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && rawText) {
          navigator.clipboard.writeText(rawText).catch(() => {});
        }
        line.classList.add('bg-blue-500/10', 'rounded');
        window.setTimeout(() => line.classList.remove('bg-blue-500/10', 'rounded'), 450);
      });
      line.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          line.click();
        }
      });
    });
  }, []);

  const handleMemberCardPrimary = (event) => {
    const target = event.currentTarget;
    const members = target.parentElement ? target.parentElement.children : [];

    for (const member of members) {
      member.classList.remove('bg-primary', 'text-white', 'shadow-xl', 'shadow-primary/20');
      member.classList.add('bg-white/80', 'shadow-sm');
      const avatar = member.querySelector('.w-10');
      if (avatar) {
        avatar.classList.remove('bg-white/20');
        avatar.classList.add('bg-gradient-to-br', 'from-blue-100', 'to-blue-200');
      }
    }

    target.classList.remove('bg-white/80', 'shadow-sm');
    target.classList.add('bg-primary', 'text-white', 'shadow-xl', 'shadow-primary/20');
    const activeAvatar = target.querySelector('.w-10');
    if (activeAvatar) {
      activeAvatar.classList.add('bg-white/20');
    }
  };

  const handleMemberCardSimple = (event) => {
    const target = event.currentTarget;
    const members = target.parentElement ? target.parentElement.children : [];

    for (const member of members) {
      member.classList.remove('bg-primary', 'text-white', 'shadow-xl', 'shadow-primary/20');
      member.classList.add('bg-white/80', 'shadow-sm');
    }

    target.classList.remove('bg-white/80', 'shadow-sm');
    target.classList.add('bg-primary', 'text-white', 'shadow-xl', 'shadow-primary/20');
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col overflow-y-auto overflow-x-hidden">
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

      <div className="flex flex-1 pt-16">
        <aside className="fixed left-0 top-0 h-full w-64 z-40 bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-2xl border-r border-slate-200/30 dark:border-slate-800/30 shadow-xl dark:shadow-2xl flex flex-col h-full py-6 pt-20">
          <div className="px-6 mb-8 flex items-center gap-3">
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
            >
              <span className="material-symbols-outlined" data-icon="dashboard">
                dashboard
              </span>
              <span className="text-sm font-medium">Dashboard</span>
            </a>
            <a
              className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
              href="/master_parser_sleek"
            >
              <span className="material-symbols-outlined">analytics</span>
              <span className="text-sm font-medium">Master Parser</span>
            </a>
            <a
              className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
              href="/835_remittance_sleek"
            >
              <span className="material-symbols-outlined" data-icon="payments">
                payments
              </span>
              <span className="text-sm font-medium">835 Remittance</span>
            </a>
            <a
              className="bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg mx-2 flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide scale-100 active:scale-[0.98] transition-transform duration-300"
              href="/834_enrollment_sleek"
            >
              <span className="material-symbols-outlined" data-icon="group_add">
                group_add
              </span>
              <span className="text-sm font-bold">834 Enrollment</span>
            </a>
            <a
              className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300 active:scale-[0.98]"
              href="/837_claims_view"
            >
              <span className="material-symbols-outlined" data-icon="description">
                description
              </span>
              <span className="text-sm font-medium">837 Claims</span>
            </a>
          </nav>
          <div className="mt-auto px-4 pb-4">
            <button
              className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all mb-4"
              onClick={() => {
                console.log('Open New Submission Dialog');
              }}
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              New Submission
            </button>
            <a
              className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 rounded-lg flex items-center gap-3 px-4 py-2 text-xs font-medium tracking-wide hover:translate-x-1 transition-transform duration-300"
              href="/help_center"
            >
              <span className="material-symbols-outlined" data-icon="help">
                help
              </span>
              <span className="text-xs font-medium">Help Center</span>
            </a>
            <a
              className="text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 rounded-lg flex items-center gap-3 px-4 py-2 text-xs font-medium tracking-wide hover:translate-x-1 transition-transform duration-300"
              href="/documentation"
            >
              <span className="material-symbols-outlined" data-icon="menu_book">
                menu_book
              </span>
              <span className="text-xs font-medium">Documentation</span>
            </a>
          </div>
        </aside>

        <main className="ml-64 flex-1 flex bg-surface-container-low">
          <div className="w-1/3 min-w-[320px] bg-white/40 glass-panel border-r border-outline-variant/10 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-outline-variant/5">
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-xl font-bold tracking-tight text-on-surface">Members</h1>
                <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full"><span id="enrollment-status">ACTIVE BATCH</span></span>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">filter_list</span>
                <input
                  className="w-full bg-surface-container-lowest border-none rounded-xl py-2 pl-10 pr-4 text-xs focus:ring-2 focus:ring-primary/10 transition-all"
                  placeholder="Filter by name or SSN"
                  type="text"
                />
              </div>
            </div>
            <div id="enrollment-member-list" className="flex-1 p-4 space-y-2">
              <div
                className="p-4 bg-white/80 rounded-2xl shadow-sm border border-transparent hover:border-primary/20 hover:shadow-md cursor-pointer transition-all group"
                onClick={handleMemberCardPrimary}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-primary font-bold text-sm">JS</div>
                    <div>
                      <p className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">Jordan Smith</p>
                      <p className="text-[10px] text-slate-500 font-mono tracking-tight">SSN: XXX-XX-4829</p>
                    </div>
                  </div>
                  <span className="bg-green-100 text-green-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-tighter uppercase">Add</span>
                </div>
              </div>
              <div className="p-4 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20 cursor-pointer transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">AW</div>
                    <div>
                      <p className="font-bold text-sm">Avery Williams</p>
                      <p className="text-[10px] text-white/70 font-mono tracking-tight">SSN: XXX-XX-9102</p>
                    </div>
                  </div>
                  <span className="bg-white/20 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-tighter uppercase">Update</span>
                </div>
              </div>
              <div
                className="p-4 bg-white/80 rounded-2xl shadow-sm border border-transparent hover:border-primary/20 transition-all group"
                onClick={handleMemberCardSimple}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center text-error font-bold text-sm">MK</div>
                    <div>
                      <p className="font-bold text-sm text-on-surface">Morgan Knight</p>
                      <p className="text-[10px] text-slate-500 font-mono tracking-tight">SSN: XXX-XX-1156</p>
                    </div>
                  </div>
                  <span className="bg-red-100 text-error text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-tighter uppercase">Term</span>
                </div>
              </div>
              <div
                className="p-4 bg-white/80 rounded-2xl shadow-sm opacity-60 cursor-pointer"
                onClick={handleMemberCardSimple}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-sm">CH</div>
                  <div>
                    <p className="font-bold text-sm text-on-surface">Casey Harper</p>
                    <p className="text-[10px] text-slate-500 font-mono tracking-tight">SSN: XXX-XX-7723</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 p-8 relative">
            <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/10 blur-[100px] rounded-full -z-10"></div>
            <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-tertiary/10 blur-[120px] rounded-full -z-10"></div>
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">Avery Williams</h2>
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Update</span>
                  </div>
                  <p className="text-slate-500 font-medium">Effective Date: Jan 01, 2024 â€¢ Transaction ID: 834-002931-X</p>
                </div>
                <div className="flex gap-3">
                  <button
                    className="px-4 py-2 bg-surface-container-highest text-on-surface-variant rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-all"
                    onClick={() => {
                      alert('Transaction rejected.');
                    }}
                  >
                    Reject Transaction
                  </button>
                  <button
                    className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                    onClick={() => {
                      alert('Transaction approved and transmitted successfully.');
                    }}
                  >
                    Approve &amp; Transmit
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-8 bg-white/60 glass-panel p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-white/40">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Demographic Data</h3>
                    <span className="material-symbols-outlined text-slate-300">person</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Full Legal Name</p>
                      <p className="font-semibold text-on-surface">Avery J. Williams</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Gender / DOB</p>
                      <p className="font-semibold text-on-surface">Non-Binary â€¢ 05/12/1988</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Primary Address</p>
                      <p className="font-semibold text-on-surface leading-tight">
                        1284 Oakwood Ave, Apt 4C
                        <br />
                        San Francisco, CA 94110
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Communication</p>
                      <p className="font-semibold text-on-surface underline decoration-primary/30">avery.w@provider.com</p>
                      <p className="text-xs text-slate-500">+1 (415) 555-0192</p>
                    </div>
                  </div>
                </div>

                <div className="col-span-4 bg-tertiary/5 glass-panel p-6 rounded-2xl shadow-xl shadow-tertiary/5 border border-tertiary/10 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-tertiary/70 mb-4">AI Insight</h3>
                    <p className="text-sm text-tertiary font-medium leading-relaxed">
                      System detected a mismatch in the Zip+4 code. Recommendation: Auto-update to 94110-2811.
                    </p>
                  </div>
                  <button
                    className="mt-4 text-xs font-bold text-tertiary bg-white/60 py-2 rounded-lg border border-tertiary/20 hover:bg-tertiary hover:text-white transition-all"
                    onClick={() => {
                      alert('AI Correction: Zip code updated to 94110-2811.');
                    }}
                  >
                    Apply Correction
                  </button>
                </div>

                <div className="col-span-12 bg-white/60 glass-panel p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-white/40">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">Health Coverage &amp; Plan Levels</h3>
                  <div className="flex items-stretch gap-4">
                    <div className="flex-1 bg-surface-container-low p-4 rounded-xl flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-inner">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                          medical_services
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Medical Plan</p>
                        <p className="font-bold text-on-surface">BlueChoice PPO High</p>
                        <p className="text-[10px] text-blue-600 font-bold">INS01: Y (Maintain)</p>
                      </div>
                    </div>
                    <div className="flex-1 bg-surface-container-low p-4 rounded-xl flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-teal-500 flex items-center justify-center text-white shadow-inner">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                          dentistry
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Dental Plan</p>
                        <p className="font-bold text-on-surface">Delta Premier Plus</p>
                        <p className="text-[10px] text-teal-600 font-bold">INS01: S (Suspended)</p>
                      </div>
                    </div>
                    <div className="flex-1 bg-surface-container-low p-4 rounded-xl flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white shadow-inner">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                          visibility
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Vision Plan</p>
                        <p className="font-bold text-on-surface">VSP Core Vision</p>
                        <p className="text-[10px] text-purple-600 font-bold">INS01: Y (Active)</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-6 bg-white/60 glass-panel p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-white/40">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">Employment</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-500">Employer Name</span>
                      <span className="text-sm font-bold text-on-surface">Vercel Tech Industries</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-500">Employment Status</span>
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">FULL-TIME ACTIVE</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs font-semibold text-slate-500">Hire Date</span>
                      <span className="text-sm font-bold text-on-surface">October 14, 2019</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-6 bg-slate-900 p-6 rounded-2xl shadow-2xl relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">EDI Segment Stream</h3>
                    <button className="text-[10px] text-slate-400 hover:text-white transition-colors">COPY SEGMENT</button>
                  </div>
                  <div className="font-mono text-[11px] leading-loose text-blue-300">
                    <p>
                      <span className="text-slate-500">INS*</span>Y*18*030*XN*A*E**FT~
                    </p>
                    <p>
                      <span className="text-slate-500">REF*</span>0F*99823001~
                    </p>
                    <p>
                      <span className="text-slate-500">NM1*</span>IL*1*WILLIAMS*AVERY*J***34*122334455~
                    </p>
                    <p>
                      <span className="text-slate-500">N3*</span>1284 OAKWOOD AVE*APT 4C~
                    </p>
                    <p>
                      <span className="text-slate-500">N4*</span>SAN FRANCISCO*CA*94110~
                    </p>
                    <p>
                      <span className="text-slate-500">DMG*</span>D8*19880512*U~
                    </p>
                    <p>
                      <span className="text-slate-500">HD*</span>021**HLT*PPO*IND~
                    </p>
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-blue-500/20 blur-2xl rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <button className="w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center">
          <span className="material-symbols-outlined" data-icon="add">
            add
          </span>
        </button>
      </div>
    </div>
  );
}


