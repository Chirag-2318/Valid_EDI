import { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canAny, CLAIMS_ACCESS_PERMISSIONS } from '../auth/permissions';

const bodyClassName = 'bg-background text-on-surface min-h-screen page-help-center';

export function HelpCenterPage() {
  const { permissions } = useAuth();
  const canClaims = canAny(permissions, CLAIMS_ACCESS_PERMISSIONS);
  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;

    return () => {
      document.body.className = previous;
    };
  }, []);

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm dark:shadow-none">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <img src="/logo.png" alt="EdiPro logo" className="h-6 w-6 rounded-md object-contain" />
            <span>EdiPro</span>
          </span>
          <nav className="hidden md:flex gap-6 items-center">
            <a
              className="font-sans tracking-tight text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors px-3 py-1.5 rounded-lg"
              href="/dashboard_sleek"
            >
              Dashboard
            </a>
            {canClaims ? (
              <a
                className="font-sans tracking-tight text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors px-3 py-1.5 rounded-lg"
                href="/837_claims_view"
              >
                Reports
              </a>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 mr-2">
            <a className="p-2 rounded-full hover:bg-slate-100/50 transition-colors text-slate-500" href="/notifications" aria-label="Open notifications">
              <span className="material-symbols-outlined" data-icon="notifications">
                notifications
              </span>
            </a>
            <a className="p-2 rounded-full hover:bg-slate-100/50 transition-colors text-slate-500" href="/settings" aria-label="Open settings">
              <span className="material-symbols-outlined" data-icon="settings">
                settings
              </span>
            </a>
            <a className="p-2 rounded-full hover:bg-slate-100/50 transition-colors text-slate-500" href="/user_profile" aria-label="Open user profile">
              <span className="material-symbols-outlined" data-icon="person">
                person
              </span>
            </a>
          </div>
          <a
            className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium shadow-sm active:opacity-80 active:scale-95 transition-all"
            href="/dashboard_sleek#upload-zone"
          >
            Upload File
          </a>
        </div>
      </header>

      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <section className="mb-16 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-on-surface mb-6">How can we help?</h1>
          <div className="max-w-2xl mx-auto relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline" data-icon="search">
                search
              </span>
            </div>
            <input
              className="w-full bg-surface-container-highest border-none rounded-xl py-5 pl-14 pr-6 text-lg focus:ring-4 focus:ring-primary/10 transition-all outline-none"
              placeholder="Search help topics..."
              type="text"
            />
            <div className="absolute right-3 inset-y-2">
              <button className="h-full px-6 bg-primary text-on-primary rounded-lg font-semibold hover:opacity-90 transition-opacity" type="button">
                Search
              </button>
            </div>
          </div>
          <div className="mt-8 flex justify-center gap-4">
            <span className="text-sm text-outline">Popular:</span>
            <a className="text-sm font-medium text-primary hover:underline" href="#">
              837 Claims Setup
            </a>
            <a className="text-sm font-medium text-primary hover:underline" href="#">
              API Integration
            </a>
            <a className="text-sm font-medium text-primary hover:underline" href="#">
              Billing Portal
            </a>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <div className="glass-card p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-white/40 flex flex-col items-start">
            <div className="w-12 h-12 bg-primary-fixed-dim rounded-lg flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-primary" data-icon="rocket_launch">
                rocket_launch
              </span>
            </div>
            <h3 className="text-xl font-bold mb-2">Getting Started</h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
              Everything you need to set up your account, manage file uploads, and initial configurations.
            </p>
            <div className="mt-auto flex flex-col gap-2 w-full">
              <a className="text-primary text-sm font-medium hover:underline flex items-center gap-2" href="#">
                Onboarding Guide
                <span className="material-symbols-outlined text-xs" data-icon="arrow_forward">
                  arrow_forward
                </span>
              </a>
              <a className="text-primary text-sm font-medium hover:underline flex items-center gap-2" href="#">
                File Upload Basics
                <span className="material-symbols-outlined text-xs" data-icon="arrow_forward">
                  arrow_forward
                </span>
              </a>
            </div>
          </div>

          <div className="glass-card p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-white/40 flex flex-col items-start">
            <div className="w-12 h-12 bg-secondary-fixed rounded-lg flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-secondary" data-icon="swap_horiz">
                swap_horiz
              </span>
            </div>
            <h3 className="text-xl font-bold mb-2">EDI Transaction Types</h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
              Deep dives into EDI protocols. Detailed documentation for 837, 835, and 834 transactions.
            </p>
            <div className="mt-auto flex flex-col gap-2 w-full">
              <a className="text-primary text-sm font-medium hover:underline flex items-center gap-2" href="#">
                Understanding 837 Claims
                <span className="material-symbols-outlined text-xs" data-icon="arrow_forward">
                  arrow_forward
                </span>
              </a>
              <a className="text-primary text-sm font-medium hover:underline flex items-center gap-2" href="#">
                835 Remittance Advice
                <span className="material-symbols-outlined text-xs" data-icon="arrow_forward">
                  arrow_forward
                </span>
              </a>
            </div>
          </div>

          <div className="glass-card p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-white/40 flex flex-col items-start md:col-span-1">
            <div className="w-12 h-12 bg-tertiary-fixed rounded-lg flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-tertiary" data-icon="verified_user">
                verified_user
              </span>
            </div>
            <h3 className="text-xl font-bold mb-2">Validation &amp; Errors</h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
              How to decode SNIP validation rules and leverage the AI Copilot for error remediation.
            </p>
            <div className="mt-auto flex flex-col gap-2 w-full">
              <a className="text-primary text-sm font-medium hover:underline flex items-center gap-2" href="#">
                SNIP Rule Documentation
                <span className="material-symbols-outlined text-xs" data-icon="arrow_forward">
                  arrow_forward
                </span>
              </a>
              <a className="text-primary text-sm font-medium hover:underline flex items-center gap-2" href="#">
                AI Copilot Best Practices
                <span className="material-symbols-outlined text-xs" data-icon="arrow_forward">
                  arrow_forward
                </span>
              </a>
            </div>
          </div>

          <div className="glass-card p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-white/40 flex flex-col items-start">
            <div className="w-12 h-12 bg-error-container rounded-lg flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-error" data-icon="build">
                build
              </span>
            </div>
            <h3 className="text-xl font-bold mb-2">Troubleshooting</h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
              Solutions for common parsing issues, SFTP connectivity, and data transmission failures.
            </p>
            <div className="mt-auto flex flex-col gap-2 w-full">
              <a className="text-primary text-sm font-medium hover:underline flex items-center gap-2" href="#">
                Parsing Failure Guide
                <span className="material-symbols-outlined text-xs" data-icon="arrow_forward">
                  arrow_forward
                </span>
              </a>
              <a className="text-primary text-sm font-medium hover:underline flex items-center gap-2" href="#">
                Connectivity Issues
                <span className="material-symbols-outlined text-xs" data-icon="arrow_forward">
                  arrow_forward
                </span>
              </a>
            </div>
          </div>

          <div className="glass-card p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-white/40 flex flex-col items-start">
            <div className="w-12 h-12 bg-surface-container-highest rounded-lg flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-on-surface-variant" data-icon="payments">
                payments
              </span>
            </div>
            <h3 className="text-xl font-bold mb-2">Account &amp; Billing</h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
              Manage your enterprise subscription, user permissions, and usage reporting metrics.
            </p>
            <div className="mt-auto flex flex-col gap-2 w-full">
              <a className="text-primary text-sm font-medium hover:underline flex items-center gap-2" href="#">
                Managing Users
                <span className="material-symbols-outlined text-xs" data-icon="arrow_forward">
                  arrow_forward
                </span>
              </a>
              <a className="text-primary text-sm font-medium hover:underline flex items-center gap-2" href="#">
                Billing Dashboard
                <span className="material-symbols-outlined text-xs" data-icon="arrow_forward">
                  arrow_forward
                </span>
              </a>
            </div>
          </div>

          <div className="bg-primary text-on-primary p-8 rounded-xl shadow-lg flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-4xl mb-4" data-icon="support_agent">
              support_agent
            </span>
            <h3 className="text-xl font-bold mb-2">Still need help?</h3>
            <p className="text-primary-fixed text-sm mb-6 px-4">
              Our dedicated EDI experts are available 24/7 to assist with complex cases.
            </p>
            <button className="bg-white text-primary px-8 py-3 rounded-lg font-bold hover:bg-surface-bright transition-colors" type="button">
              Contact Support
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary" data-icon="quiz">
                quiz
              </span>
              Recent FAQ
            </h2>
            <div className="space-y-4">
              <div className="group surface-container-low p-5 rounded-xl hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-on-surface">How do I reset my API secret key?</h4>
                  <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="expand_more">
                    expand_more
                  </span>
                </div>
              </div>
              <div className="group surface-container-low p-5 rounded-xl hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-on-surface">Can I automate 835 parsing via SFTP?</h4>
                  <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="expand_more">
                    expand_more
                  </span>
                </div>
              </div>
              <div className="group surface-container-low p-5 rounded-xl hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-on-surface">What does rejection code 'E01-ISA06' mean?</h4>
                  <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="expand_more">
                    expand_more
                  </span>
                </div>
              </div>
              <div className="group surface-container-low p-5 rounded-xl hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-on-surface">Managing multi-entity provider taxonomies</h4>
                  <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="expand_more">
                    expand_more
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-tertiary-container text-white p-6 rounded-xl shadow-sm relative overflow-hidden">
              <div className="relative z-10">
                <h4 className="font-bold text-lg mb-2">Developer Docs</h4>
                <p className="text-sm opacity-90 mb-4">
                  Integrate EdiPro directly into your EMR or clearinghouse via our robust REST API.
                </p>
                <a
                  className="inline-flex items-center gap-2 text-sm font-bold bg-white/20 px-4 py-2 rounded-lg hover:bg-white/30 transition-colors"
                  href="#"
                >
                  API Documentation
                  <span className="material-symbols-outlined text-sm" data-icon="open_in_new">
                    open_in_new
                  </span>
                </a>
              </div>
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            </div>
            <div className="surface-container-high p-6 rounded-xl">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm" data-icon="campaign">
                  campaign
                </span>
                Latest Updates
              </h4>
              <ul className="space-y-4">
                <li>
                  <p className="text-xs text-outline font-bold uppercase tracking-wider mb-1">Oct 24, 2023</p>
                  <p className="text-sm font-medium">New AI-driven claim correction tool released.</p>
                </li>
                <li>
                  <p className="text-xs text-outline font-bold uppercase tracking-wider mb-1">Oct 12, 2023</p>
                  <p className="text-sm font-medium">Enhanced support for Medicare 837P files.</p>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-12 py-12 border-t border-outline-variant/20 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-1">
            <span className="text-xl font-bold tracking-tighter text-slate-900 block mb-4">EdiPro</span>
            <p className="text-sm text-on-surface-variant">Elevating healthcare EDI with precision data parsing and intelligent insights.</p>
          </div>
          <div>
            <h5 className="font-bold text-sm mb-4 uppercase tracking-widest text-outline">Product</h5>
            <ul className="text-sm space-y-2 text-on-surface-variant">
              <li>
                <a className="hover:text-primary" href="#">
                  Features
                </a>
              </li>
              <li>
                <a className="hover:text-primary" href="#">
                  Pricing
                </a>
              </li>
              <li>
                <a className="hover:text-primary" href="#">
                  Security
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-sm mb-4 uppercase tracking-widest text-outline">Resources</h5>
            <ul className="text-sm space-y-2 text-on-surface-variant">
              <li>
                <a className="hover:text-primary" href="#">
                  Documentation
                </a>
              </li>
              <li>
                <a className="hover:text-primary" href="#">
                  Help Center
                </a>
              </li>
              <li>
                <a className="hover:text-primary" href="#">
                  API Reference
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-sm mb-4 uppercase tracking-widest text-outline">Legal</h5>
            <ul className="text-sm space-y-2 text-on-surface-variant">
              <li>
                <a className="hover:text-primary" href="#">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a className="hover:text-primary" href="#">
                  Terms of Service
                </a>
              </li>
              <li>
                <a className="hover:text-primary" href="#">
                  HIPAA Compliance
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-outline-variant/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-outline">&copy; 2023 EdiPro Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <a className="text-outline hover:text-primary transition-colors" href="#">
              <span className="material-symbols-outlined" data-icon="language">
                language
              </span>
            </a>
            <a className="text-outline hover:text-primary transition-colors" href="#">
              <span className="material-symbols-outlined" data-icon="share">
                share
              </span>
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}

