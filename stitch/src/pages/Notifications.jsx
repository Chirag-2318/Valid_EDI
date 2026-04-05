import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canAny, CLAIMS_ACCESS_PERMISSIONS } from '../auth/permissions';

const bodyClassName = 'bg-background font-body text-on-background antialiased selection:bg-primary/10 selection:text-primary min-h-screen page-notifications';

const filterKeys = ['all', 'critical', 'warnings', 'success'];

export function NotificationsPage() {
  const { permissions } = useAuth();
  const canClaims = canAny(permissions, CLAIMS_ACCESS_PERMISSIONS);
  const [activeFilter, setActiveFilter] = useState('all');
  const [hiddenIds, setHiddenIds] = useState(() => new Set());

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

  const notifications = useMemo(
    () => [
      {
        id: 'critical-4490',
        type: 'critical',
        label: 'Critical Alert',
        time: '2 mins ago',
        title: 'Batch #4490 (837P) - 32 Validation Errors Detected',
        description:
          'Parsing stalled at ISA segment. Mandatory fields missing in 12 loops. Immediate re-validation required to meet clearinghouse deadline.',
        icon: 'report',
        iconFill: 'fill',
        tone: 'error',
        borderTone: 'bg-error'
      },
      {
        id: 'success-835',
        type: 'success',
        label: 'Success',
        time: '1 hour ago',
        title: '835 Remittance from BCBS Massachusetts Processed',
        description:
          'Total value of $142,500.00 reconciled across 420 claims. Auto-posting to ledger completed with 99.8% accuracy.',
        icon: 'check_circle',
        iconFill: 'fill',
        tone: 'green',
        borderTone: 'bg-green-500'
      },
      {
        id: 'insight-834',
        type: 'warnings',
        label: 'New Insight',
        time: '3 hours ago',
        title: 'New 834 Enrollment Batch Received',
        description:
          'System detected a 15% increase in enrollment volume for Q3. AI suggests adjusting parser concurrency for optimal throughput.',
        icon: 'auto_awesome',
        iconFill: 'fill',
        tone: 'tertiary',
        borderTone: 'bg-tertiary'
      },
      {
        id: 'system-sync',
        type: 'success',
        label: 'System Update',
        time: 'Yesterday',
        title: 'NPI Registry Sync Complete',
        description: 'Weekly synchronization with the National Provider Identifier database finished successfully. 12,403 records updated.',
        icon: 'sync_alt',
        iconFill: 'fill',
        tone: 'green',
        borderTone: 'bg-green-500'
      }
    ],
    []
  );

  const filteredNotifications = notifications.filter((item) => {
    if (hiddenIds.has(item.id)) {
      return false;
    }
    if (activeFilter === 'all') {
      return true;
    }
    return item.type === activeFilter;
  });

  const markAllRead = () => {
    setHiddenIds(new Set(notifications.map((item) => item.id)));
  };

  const dismissNotification = (id) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const filterLabels = {
    all: 'All',
    critical: 'Critical',
    warnings: 'Warnings',
    success: 'Success'
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-between items-center px-6 py-3 w-full shadow-sm dark:shadow-none transition-all duration-200">
        <div className="flex items-center gap-8">
          <span
            className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white cursor-pointer flex items-center gap-2"
            onClick={() => window.location.reload()}
          >
            <img src="/logo.png" alt="EdiPro logo" className="h-6 w-6 rounded-md object-contain" />
            <span>EdiPro</span>
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
              alt="User Profile"
              className="w-full h-full object-cover"
              data-alt="professional headshot of a male data analyst in a minimalist office setting with soft lighting"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCoYiWc9Oyv7MYAwKG4lHl7rUe49CMb1Oo8nAcWctcSjI-jqqP3h4FkKqb9CAoXxdn0zILWorTA-ozB0RwftrVbOv7_LioQehSXYH6TE_R476LfIunYHc2daKifAaZFFiZtUCu1gk7EW7VNBzBgqnYBdZGxY9kdu3gx-yj8qzDJyJBFBfcOlc0yTwHyM9QTNj66nFBQpOrBQyJI0r_HiI2-07vE5QLFEXUTYtCQZnoO9I-B5jDW7iaWEBsye5I4RDoPcbBIe7tAz8XE"
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
        <div className="max-w-5xl mx-auto mt-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">Notification Center</h1>
              <p className="text-on-surface-variant/70 text-lg">System health and EDI transmission telemetry.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="bg-surface-container-high hover:bg-surface-container-highest px-5 py-2.5 rounded-xl text-sm font-semibold text-on-surface transition-all active:scale-95 flex items-center gap-2"
                type="button"
                onClick={markAllRead}
              >
                <span className="material-symbols-outlined text-[18px]" data-icon="done_all">
                  done_all
                </span>
                Mark all as read
              </button>
            </div>
          </div>

          <div className="glass border border-white/40 p-1.5 rounded-2xl flex items-center gap-1 mb-8 shadow-xl shadow-on-surface/5 w-fit">
            {filterKeys.map((key) => (
              <button
                key={key}
                className={
                  key === activeFilter
                    ? 'px-6 py-2 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/20 transition-all'
                    : 'px-6 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low text-sm font-medium transition-all'
                }
                type="button"
                onClick={() => setActiveFilter(key)}
              >
                {filterLabels[key]}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredNotifications.map((notification) => {
              const isInsight = notification.type === 'warnings';
              const isCritical = notification.type === 'critical';
              const iconTone = notification.tone;
              const cardBorder = isInsight ? 'border-tertiary/20' : 'border-white/50';
              const hoverShadow = isInsight ? 'hover:shadow-tertiary/5' : 'hover:shadow-primary/5';
              const iconBaseClass =
                iconTone === 'error'
                  ? 'bg-error/10 text-error'
                  : iconTone === 'green'
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-tertiary/10 text-tertiary';
              const labelTone =
                iconTone === 'error'
                  ? 'text-error'
                  : iconTone === 'green'
                  ? 'text-green-600'
                  : 'text-tertiary';
              return (
                <div
                  key={notification.id}
                  className={`glass group relative overflow-hidden p-1 rounded-[2rem] border ${cardBorder} transition-all hover:shadow-2xl ${hoverShadow}`}
                >
                  <div className="bg-surface-container-lowest/80 rounded-[1.75rem] p-6 flex items-start gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBaseClass}`}>
                      <span className="material-symbols-outlined text-3xl" data-icon={notification.icon} data-weight={notification.iconFill}>
                        {notification.icon}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold uppercase tracking-widest ${labelTone}`}>{notification.label}</span>
                        <span className="text-xs text-on-surface-variant/50">{notification.time}</span>
                      </div>
                      <h3 className="text-xl font-bold text-on-surface leading-tight mb-2">{notification.title}</h3>
                      <p className="text-on-surface-variant text-sm max-w-2xl mb-4">{notification.description}</p>
                      <div className="flex items-center gap-4">
                        <a className="text-primary font-bold text-sm hover:underline underline-offset-4 flex items-center gap-1" href="#">
                          View Details
                          <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">
                            arrow_forward
                          </span>
                        </a>
                        <button
                          className="text-on-surface-variant/40 hover:text-on-surface text-sm font-medium transition-colors"
                          type="button"
                          onClick={() => dismissNotification(notification.id)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                  {isCritical ? <div className="absolute inset-y-0 right-0 w-1.5 bg-error rounded-full my-8 mr-1"></div> : null}
                </div>
              );
            })}
          </div>

          <div className="mt-12 pt-8 border-t border-outline-variant/10 flex justify-between items-center opacity-40">
            <span className="text-xs font-medium uppercase tracking-widest">EdiPro Notification Engine v2.4.0</span>
            <div className="flex gap-4">
              <span className="text-xs font-medium uppercase tracking-widest">Privacy Policy</span>
              <span className="text-xs font-medium uppercase tracking-widest">System Status</span>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] -z-10 pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-tertiary/5 blur-[100px] -z-10 pointer-events-none"></div>
    </>
  );
}

