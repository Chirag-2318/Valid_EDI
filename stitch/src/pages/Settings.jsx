import { useEffect } from 'react';

const bodyClassName = 'bg-background text-on-surface page-settings';

export function SettingsPage() {
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
          <span className="text-xl font-bold tracking-tighter text-slate-900 dark:text-slate-50">EdiPro</span>
          <nav className="hidden md:flex gap-6">
            <a
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-sans tracking-tight text-sm font-medium transition-colors"
              href="/dashboard_sleek"
            >
              Dashboard
            </a>
            <a
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-sans tracking-tight text-sm font-medium transition-colors"
              href="/837_claims_view"
            >
              Reports
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-surface-container-highest px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-outline text-sm">search</span>
            <input className="bg-transparent border-none focus:ring-0 text-sm w-48 text-on-surface" placeholder="Search settings..." type="text" />
          </div>
          <a className="p-2 text-slate-500 hover:bg-slate-100/50 rounded-full transition-all" href="/notifications" aria-label="Open notifications">
            <span className="material-symbols-outlined">notifications</span>
          </a>
          <a
            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-slate-100/50 rounded-full transition-all"
            href="/settings"
            aria-label="Open settings"
          >
            <span className="material-symbols-outlined">settings</span>
          </a>
          <a className="w-8 h-8 rounded-full overflow-hidden border-2 border-primary/20" href="/user_profile" aria-label="Open user profile">
            <img
              alt="User Profile"
              className="w-full h-full object-cover"
              data-alt="close-up portrait of a professional male avatar with a minimalist clean background"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxTlDu_54CZiSUYBInk-l2uNP22WfFO9hfxJDhJf9V97Vv-bVMt13cECZX9tiurQ4tg6QO-WfBCbLk4WJiRi7JM20REP1s8nWXkyvtNX3wIeS-DP1rmr6Ugix8FOM4U5_sMTNr-IQHJ9jgOnXvbihrXzwOfGpohIsm1n7WXFMT85IAGzK2sSFBkrRCqtkoL3sw4XqkGNVHuFJfFH5sH9WotL0qDOkwxrZGkSL9_oVp9V_PFGWmFTlGLz6WV2lJgFoEfgvlEOUqVh9w"
            />
          </a>
        </div>
      </header>

      <main className="pt-20 flex min-h-screen">
        <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-2xl flex flex-col p-4 z-40 border-r border-slate-200/20">
          <div className="mb-8 px-2">
            <h2 className="font-sans text-xs uppercase tracking-widest font-bold text-slate-500 mb-4">Settings</h2>
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 bg-white/50 dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 rounded-lg shadow-sm font-medium transition-transform duration-200 hover:scale-[1.02]" type="button">
                <span className="material-symbols-outlined text-[20px]">person</span>
                <span className="text-sm">Account</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-200/30 dark:hover:bg-slate-800/30 rounded-lg font-medium transition-transform duration-200 hover:scale-[1.02]" type="button">
                <span className="material-symbols-outlined text-[20px]">hub</span>
                <span className="text-sm">EDI Gateway</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-200/30 dark:hover:bg-slate-800/30 rounded-lg font-medium transition-transform duration-200 hover:scale-[1.02]" type="button">
                <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                <span className="text-sm">Notifications</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-200/30 dark:hover:bg-slate-800/30 rounded-lg font-medium transition-transform duration-200 hover:scale-[1.02]" type="button">
                <span className="material-symbols-outlined text-[20px]">palette</span>
                <span className="text-sm">Appearance</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-200/30 dark:hover:bg-slate-800/30 rounded-lg font-medium transition-transform duration-200 hover:scale-[1.02]" type="button">
                <span className="material-symbols-outlined text-[20px]">group</span>
                <span className="text-sm">User Management</span>
              </button>
            </div>
          </div>
          <div className="mt-auto space-y-1">
            <a className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-slate-600 transition-colors" href="/help_center">
              <span className="material-symbols-outlined text-[18px]">help</span>
              <span className="text-xs uppercase tracking-widest font-bold">Help Center</span>
            </a>
            <a className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-slate-600 transition-colors" href="/documentation">
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              <span className="text-xs uppercase tracking-widest font-bold">Documentation</span>
            </a>
          </div>
        </aside>

        <section className="ml-64 flex-1 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="mb-10">
              <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Account Settings</h1>
              <p className="text-on-surface-variant mt-2">Manage your clinical EDI credentials and profile security.</p>
            </div>

            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 md:col-span-8 space-y-6">
                <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">security</span>
                    Security Credentials
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-outline mb-1.5">Email Address</label>
                      <div className="flex gap-3">
                        <input
                          className="flex-1 bg-surface-container-low border-none rounded-lg text-sm px-4 py-2.5 focus:ring-2 focus:ring-primary/20 transition-all"
                          readOnly
                          type="email"
                          value="alex.vance@luminous-health.org"
                        />
                        <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all" type="button">
                          Change
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <button className="flex items-center justify-between px-4 py-3 bg-surface-container-high rounded-xl hover:bg-secondary-container transition-colors group" type="button">
                        <div className="text-left">
                          <p className="text-sm font-semibold">Password</p>
                          <p className="text-xs text-outline">Last changed 4 months ago</p>
                        </div>
                        <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">chevron_right</span>
                      </button>
                      <button className="flex items-center justify-between px-4 py-3 bg-surface-container-high rounded-xl hover:bg-secondary-container transition-colors group border-2 border-primary/20" type="button">
                        <div className="text-left">
                          <p className="text-sm font-semibold">2FA Recovery</p>
                          <p className="text-xs text-primary font-medium">Enabled via Authenticator</p>
                        </div>
                        <span className="material-symbols-outlined text-primary">verified_user</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-tertiary">lan</span>
                      EDI Gateway Configuration
                    </h3>
                    <span className="px-3 py-1 bg-tertiary/10 text-tertiary text-[10px] font-bold uppercase tracking-widest rounded-full">Active Connection</span>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-surface-container-low rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <span className="material-symbols-outlined text-outline">dns</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold">SFTP Production Endpoint</p>
                          <code className="text-xs text-tertiary">sftp.luminous-ledger.com:2222</code>
                        </div>
                      </div>
                      <button className="text-primary text-sm font-bold hover:underline" type="button">
                        Rotate Key
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-surface-container-low rounded-xl">
                        <p className="text-[10px] font-bold uppercase text-outline mb-1">API Key (Claims)</p>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs">•••••••••••••492A</span>
                          <span className="material-symbols-outlined text-sm cursor-pointer hover:text-primary">content_copy</span>
                        </div>
                      </div>
                      <div className="p-4 bg-surface-container-low rounded-xl">
                        <p className="text-[10px] font-bold uppercase text-outline mb-1">Last Sync</p>
                        <p className="text-xs font-medium">Today, 04:22 PM EST</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-12 md:col-span-4 space-y-6">
                <div className="bg-white/60 glass-effect p-6 rounded-xl shadow-sm border border-outline-variant/10">
                  <h3 className="text-sm font-bold text-outline uppercase tracking-widest mb-4">System Appearance</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <button className="flex flex-col items-center gap-2 p-3 bg-white border-2 border-primary rounded-xl shadow-sm" type="button">
                      <span className="material-symbols-outlined text-primary">light_mode</span>
                      <span className="text-[11px] font-bold">Light</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 p-3 bg-slate-900 text-white rounded-xl hover:scale-105 transition-transform" type="button">
                      <span className="material-symbols-outlined">dark_mode</span>
                      <span className="text-[11px] font-bold">Dark</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 p-3 bg-gradient-to-br from-slate-100 to-slate-400 rounded-xl hover:scale-105 transition-transform" type="button">
                      <span className="material-symbols-outlined">settings_brightness</span>
                      <span className="text-[11px] font-bold">Auto</span>
                    </button>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10">
                  <h3 className="text-sm font-bold text-outline uppercase tracking-widest mb-4">Notifications</h3>
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Validation Errors</p>
                        <p className="text-[11px] text-outline">Instant alert on claim failure</p>
                      </div>
                      <div className="w-10 h-5 bg-primary rounded-full relative flex items-center px-1">
                        <div className="w-3 h-3 bg-white rounded-full translate-x-5"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Batch Complete</p>
                        <p className="text-[11px] text-outline">Email summary for 837/835</p>
                      </div>
                      <div className="w-10 h-5 bg-surface-container-highest rounded-full relative flex items-center px-1">
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">In-App Alerts</p>
                        <p className="text-[11px] text-outline">Dashboard notifications</p>
                      </div>
                      <div className="w-10 h-5 bg-primary rounded-full relative flex items-center px-1">
                        <div className="w-3 h-3 bg-white rounded-full translate-x-5"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-tertiary text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="text-sm font-bold uppercase tracking-widest mb-1">Team Access</h3>
                    <p className="text-2xl font-black mb-4">4 Members</p>
                    <div className="flex -space-x-2 mb-6">
                      <img
                        alt="Team member"
                        className="w-8 h-8 rounded-full border-2 border-tertiary"
                        data-alt="professional avatar of a woman with glasses and confident expression"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuAOREoZW6nsQlOB15ifnK2oILbixEtFVRLX2lc44e9vA_d1tNNzZ8eBurqaOqBgE1k2SCIN45EY3QHPsWlsEdbIXtON7dVwlAlQN3LE65ScXCWZM3GmXTQCnVby0ER02MnDB75rgMLrxRv95R0e-vpXx8nhmdq1AnyUoZvAWGoXK75IN4c3v8F9lR73UAUMlVK1SHAs3omyfBdpVhwVl1OSNv3ccXXW8JIPoKFgRn8IB6e_rOxmWBFaLLrxELn7aQIigcULe_7NPGr4"
                      />
                      <img
                        alt="Team member"
                        className="w-8 h-8 rounded-full border-2 border-tertiary"
                        data-alt="professional avatar of a man with a beard and friendly smile"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDXpHlTMuhSQcl0PevGwo-ylSOOpZ2ROD3xLNncPY5lgRAjYRQXhzwmrF4zyg_QEwqy6vjMJtpf42ZJ-pQciCXKEHTLh6dRGipiydolvsZWVM2skVJu9JGd5yc4akPd5K3qXgNaC68lGQthhNaJWBYZF9GS6-TdMHVbQ_OXCpV6rSZjxW8kNRxYNCoxHz_JMDP0q47KcxhHf3KeZcAiO-sZKcJrXt8HoIv_65sACU3WPzQIlFLChG41RoS-h68cyPjUVcTXpQZPcKYo"
                      />
                      <img
                        alt="Team member"
                        className="w-8 h-8 rounded-full border-2 border-tertiary"
                        data-alt="professional avatar of a person with short hair and neutral background"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuC_HvdnrCnHdRQuctuNoPnzmFG0ov5R1p64iL3kKmvYnrT8N7dfpVYtxXs2P9WPwE2xyTkKhfHDDg_V7Fvv_Ugn1BF8MkKey6JtfbxHWb90nT6jOxPKYCInK4Po452LcwuNQKgV5jrFM0dZvohU_v2TlGVjgIbW-O0mPByj33HTLsh54p16A21CIdSK6nVP5_G1v3v_DIHlOYeJIsuSBQQWsvD_soRpKVr04OGCu96kT1yeEuRni3DjC_gPZHnYx2QHNcRYt8Z8mxZX"
                      />
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">+1</div>
                    </div>
                    <button className="w-full bg-white text-tertiary py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all" type="button">
                      Manage Permissions
                    </button>
                  </div>
                  <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-outline-variant/10 flex justify-end gap-4">
              <button className="px-6 py-2.5 text-sm font-bold text-outline hover:text-on-surface transition-colors" type="button">
                Discard Changes
              </button>
              <button className="px-8 py-2.5 bg-primary text-white text-sm font-bold rounded-xl shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all" type="button">
                Save Global Settings
              </button>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-8 right-8 bg-surface-container-lowest glass-effect px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-primary/10 translate-y-24 transition-transform duration-500">
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-lg">check</span>
        </div>
        <div>
          <p className="text-sm font-bold">Settings Updated</p>
          <p className="text-xs text-outline">EDI Gateway re-validated successfully.</p>
        </div>
      </div>
    </>
  );
}

