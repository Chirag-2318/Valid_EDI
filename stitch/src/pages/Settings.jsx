import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ADMIN_PERMISSIONS, canAny, CLAIMS_ACCESS_PERMISSIONS } from '../auth/permissions';

const bodyClassName = 'bg-background text-on-surface page-settings';

export function SettingsPage() {
  const navigate = useNavigate();
  const { permissions, logout, user } = useAuth();
  const canClaims = canAny(permissions, CLAIMS_ACCESS_PERMISSIONS);
  const isAdmin = canAny(permissions, ADMIN_PERMISSIONS);
  const [showKeyOverlay, setShowKeyOverlay] = useState(false);
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;
    return () => { document.body.className = previous; };
  }, []);

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm dark:shadow-none">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-slate-900 dark:text-slate-50">EdiPro</span>
          <nav className="hidden md:flex gap-6">
            <a className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-sans tracking-tight text-sm font-medium transition-colors" href="/dashboard_sleek">Dashboard</a>
            {canClaims ? (
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-sans tracking-tight text-sm font-medium transition-colors" href="/837_claims_view">Reports</a>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-surface-container-highest px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-outline text-sm">search</span>
            <input
              className="bg-transparent border-none focus:ring-0 text-sm w-48 text-on-surface"
              placeholder="Search settings..."
              type="text"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  localStorage.setItem('globalSearch', e.target.value.trim());
                  window.location.href = '/master_parser_sleek';
                }
              }}
            />
          </div>
          <a className="p-2 text-slate-500 hover:bg-slate-100/50 rounded-full transition-all" href="/notifications" aria-label="Open notifications">
            <span className="material-symbols-outlined">notifications</span>
          </a>
          <a className="p-2 text-blue-600 dark:text-blue-400 hover:bg-slate-100/50 rounded-full transition-all" href="/settings" aria-label="Open settings">
            <span className="material-symbols-outlined">settings</span>
          </a>
          <a className="w-8 h-8 rounded-full overflow-hidden border-2 border-primary/20 bg-primary/10 flex items-center justify-center" href="/user_profile" aria-label="Open user profile">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>person</span>
          </a>
          <button
            className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
            onClick={async () => { await logout(); navigate('/login'); }}
            type="button"
          >
            Sign Out
          </button>
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
              {isAdmin ? (
                <a className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-200 hover:bg-slate-200/30 dark:hover:bg-slate-800/30 rounded-lg font-medium transition-transform duration-200 hover:scale-[1.02]" href="/admin/users">
                  <span className="material-symbols-outlined text-[20px]">group</span>
                  <span className="text-sm">User Management</span>
                </a>
              ) : null}
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
              <div className="col-span-12 space-y-6">
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
                          value={user?.email || ''}
                          placeholder="No email on file"
                        />
                        <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all" type="button">Change</button>
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
                    <div className="p-4 bg-surface-container-low rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-outline mb-2">AI Assistance API Key</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-on-surface">Groq</span>
                          <span className="font-mono text-xs text-outline" id="groq-key-display">&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;</span>
                        </div>
                        <button
                          id="rotate-key-btn"
                          onClick={() => setShowKeyOverlay(true)}
                          className="text-primary text-sm font-bold hover:underline"
                          type="button"
                        >
                          Rotate Key
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-outline-variant/10 flex justify-end gap-4">
              <button className="px-6 py-2.5 text-sm font-bold text-outline hover:text-on-surface transition-colors" type="button">Discard Changes</button>
              <button className="px-8 py-2.5 bg-primary text-white text-sm font-bold rounded-xl shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all" type="button">Save Global Settings</button>
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

      {showKeyOverlay && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-on-surface mb-2">Update AI Assistance API Key</h3>
            <p className="text-sm text-slate-500 mb-6">Enter your new Groq API key. It will be saved and used immediately.</p>
            <input
              autoFocus
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newKey.trim()) {
                  try {
                    await fetch('/api/settings/groq-key', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ api_key: newKey.trim() })
                    });
                    const display = document.getElementById('groq-key-display');
                    if (display) display.textContent = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' + newKey.trim().slice(-4);
                  } catch (err) { console.error(err); }
                  setShowKeyOverlay(false);
                  setNewKey('');
                }
                if (e.key === 'Escape') { setShowKeyOverlay(false); setNewKey(''); }
              }}
              className="w-full border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-primary/30 focus:outline-none mb-4"
              placeholder="gsk_••••••••••••••••••••••••••••••••••"
              type="password"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowKeyOverlay(false); setNewKey(''); }} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-on-surface" type="button">Cancel</button>
              <button
                onClick={async () => {
                  if (!newKey.trim()) return;
                  try {
                    await fetch('/api/settings/groq-key', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ api_key: newKey.trim() })
                    });
                    const display = document.getElementById('groq-key-display');
                    if (display) display.textContent = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' + newKey.trim().slice(-4);
                  } catch (err) { console.error(err); }
                  setShowKeyOverlay(false);
                  setNewKey('');
                }}
                className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90"
                type="button"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
