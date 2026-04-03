import { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canAny, CLAIMS_ACCESS_PERMISSIONS } from '../auth/permissions';

const bodyClassName = 'bg-background font-body text-on-background antialiased selection:bg-primary/10 selection:text-primary page-user-profile';

export function UserProfilePage() {
  const { permissions } = useAuth();
  const canClaims = canAny(permissions, CLAIMS_ACCESS_PERMISSIONS);
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
            {canClaims ? (
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/837_claims_view">
                Reports
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
              data-alt="Professional headshot of a male EDI administrator with a neutral background and warm studio lighting"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDoOFES7lSJknrshi7NQRdlvrfVxTaE0yCtOcAk82eHpB40fXahqZhFlKdz-NuhBNGhVvUfDhH3JzclHXYlhimGJgo7X73Z_3D3-QlXzlOkRPlApxSj7BFvSl2A40BvNHOVcE8B3nRoVTyfCpLDnGAoMFHvXwzRUWRaNKnZ6F4ABEC2f7E4rih4mYJO4aCoYce4Te75cM6WhzgjrqSkYbXrtSXY_MB0WDkmPbe2blZ2CWs-NekYar3l2ka7nj7_uJWpI1DdaClfA12n"
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

      <main className="ml-0 md:ml-64 pt-20 px-4 md:px-8 pb-8 min-h-screen">
        <div className="max-w-6xl mx-auto space-y-8">
          <section className="relative flex items-end gap-8 pb-4">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white">
                <img
                  className="w-full h-full object-cover"
                  data-alt="Close-up portrait of a male professional in high-end office environment with natural lighting and soft bokeh"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB3-Mck1EtgL198rqGvxMT51ioDGm2ouby4W8oKQ94Pvo1JaEB7jc2rzood-BXgkJq5cpgR270z1dQReQsCLyE62_FTkyQeaPHackvNPmzdEMs86eRmZuzU4ANKZzgk1vP3Nfri-7vSPQqyb0bC90yEJXJ1i9zzADKQ-O_22ufTfPNTdUb62CQyZhTk98Uj0u_TQJS1AICUhuDeEBEsinzv-WOHwqsVC_BqXmefA7maII9yxRntyUu9TYxvHe7tMtv4aE9JjqS9QYK2"
                />
              </div>
              <button className="absolute -bottom-2 -right-2 bg-white p-2 rounded-xl shadow-lg hover:scale-105 transition-transform" type="button">
                <span className="material-symbols-outlined text-primary text-xl">edit</span>
              </button>
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-tight text-on-surface">EDI Admin</h1>
                <span className="px-3 py-1 bg-primary-container/10 text-primary text-xs font-bold uppercase tracking-widest rounded-full">System Administrator</span>
              </div>
              <p className="text-on-surface-variant mt-1 text-lg font-medium opacity-70">
                Overseeing Healthcare Data Integrity &amp; Interoperability
              </p>
            </div>
            <div className="flex gap-3 mb-2">
              <button className="px-6 py-2.5 bg-white text-on-surface font-semibold rounded-xl shadow-sm border border-slate-200/50 hover:bg-slate-50 transition-colors" type="button">
                Export Profile
              </button>
              <button className="px-6 py-2.5 bg-primary text-on-primary font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95" type="button">
                Settings
              </button>
            </div>
          </section>

          <div className="grid grid-cols-12 gap-6 pb-20">
            <div className="col-span-12 md:col-span-4 glass-card p-6 rounded-3xl shadow-sm ring-1 ring-white/20">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-primary">person</span>
                <h3 className="font-bold text-on-surface tracking-tight">Personal Information</h3>
              </div>
              <div className="space-y-5">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase tracking-widest font-black text-slate-400">Full Name</label>
                  <p className="text-on-surface font-semibold text-sm">Marcus Sterling</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase tracking-widest font-black text-slate-400">Job Title</label>
                  <p className="text-on-surface font-semibold text-sm">Senior EDI Infrastructure Lead</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase tracking-widest font-black text-slate-400">Department</label>
                  <p className="text-on-surface font-semibold text-sm">Clinical Data Systems</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase tracking-widest font-black text-slate-400">Email Address</label>
                  <p className="text-primary font-medium text-sm">m.sterling@luminousledger.io</p>
                </div>
              </div>
            </div>

            <div className="col-span-12 md:col-span-8 bg-surface-container-lowest p-6 rounded-3xl shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">hub</span>
                  <h3 className="font-bold text-on-surface tracking-tight">Assigned EDI Feeds</h3>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">3 Active Channels</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">description</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">837 Claims - North Region</h4>
                      <p className="text-xs text-on-surface-variant">Active processing for 14 facilities</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="px-2 py-0.5 bg-tertiary-container/10 text-tertiary text-[10px] font-bold uppercase rounded tracking-tighter">AI Optimized</span>
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-secondary-container/20 rounded-xl flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined">payments</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">835 Remittance - BlueShield</h4>
                      <p className="text-xs text-on-surface-variant">Daily reconciliation cycle</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-error/5 rounded-xl flex items-center justify-center text-error">
                      <span className="material-symbols-outlined">group_add</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">834 Enrollment - Federal</h4>
                      <p className="text-xs text-on-surface-variant">Requires ISA05 Validation</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="px-2 py-0.5 bg-error/10 text-error text-[10px] font-bold uppercase rounded tracking-tighter">Needs Attention</span>
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-12 md:col-span-7 glass-card p-6 rounded-3xl shadow-sm ring-1 ring-white/20">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-primary">history</span>
                <h3 className="font-bold text-on-surface tracking-tight">Recent Activity Log</h3>
              </div>
              <div className="relative space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                <div className="relative pl-8 flex items-start gap-4">
                  <div className="absolute left-0 w-6 h-6 rounded-full bg-white border-2 border-primary flex items-center justify-center z-10">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">837I Batch Upload Successful</p>
                    <p className="text-xs text-on-surface-variant">
                      Last file uploaded: 2 hours ago • <span className="text-primary font-medium">Batch_4492.edi</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">14:22 PM</span>
                </div>
                <div className="relative pl-8 flex items-start gap-4">
                  <div className="absolute left-0 w-6 h-6 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center z-10">
                    <div className="w-2 h-2 bg-slate-200 rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">User Role Modified</p>
                    <p className="text-xs text-on-surface-variant">Elevated permissions for 834 Fed Channel</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">Yesterday</span>
                </div>
                <div className="relative pl-8 flex items-start gap-4">
                  <div className="absolute left-0 w-6 h-6 rounded-full bg-white border-2 border-tertiary flex items-center justify-center z-10">
                    <div className="w-2 h-2 bg-tertiary rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">AI Parsing Logic Updated</p>
                    <p className="text-xs text-on-surface-variant">Auto-repaired 24 segments in ISA loop</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">Oct 24</span>
                </div>
              </div>
            </div>

            <div className="col-span-12 md:col-span-5 bg-on-surface text-white p-6 rounded-3xl shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-primary-container">shield</span>
                <h3 className="font-bold tracking-tight">Security &amp; Access Log</h3>
              </div>
              <div className="space-y-4">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Active Session</span>
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  </div>
                  <p className="text-sm font-mono opacity-90">192.168.1.104</p>
                  <p className="text-[10px] opacity-60">MacOS Sonoma • Safari 17.4</p>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Previous Login</span>
                  </div>
                  <p className="text-sm font-mono opacity-90">74.122.45.19</p>
                  <p className="text-[10px] opacity-60">London, UK • 12 Oct 2023</p>
                </div>
                <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2" type="button">
                  <span className="material-symbols-outlined text-sm">lock_reset</span>
                  Revoke All Sessions
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

