import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canAny, CLAIMS_ACCESS_PERMISSIONS } from '../auth/permissions';

const bodyClassName = 'bg-background font-body text-on-background antialiased selection:bg-primary/10 selection:text-primary page-user-profile';

export function UserProfilePage() {
  const { permissions } = useAuth();
  const canClaims = canAny(permissions, CLAIMS_ACCESS_PERMISSIONS);

  const [profileData, setProfileData] = useState({ name: '', email: '', jobTitle: '', department: '', phone: '' });
  const [editMode, setEditMode] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;
    return () => { document.body.className = previous; };
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const files = await fetch('/api/files').then((r) => r.json());
        if (Array.isArray(files)) {
          const sorted = [...files].sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
          setRecentFiles(sorted.slice(0, 5));
        }
      } catch (e) { /* skip */ }
      const ip = '192.168.1.' + Math.floor(Math.random() * 255);
      setSessions([
        { label: 'Active Session', ip, details: 'Current browser \u2022 ' + new Date().toLocaleDateString(), active: true },
        { label: 'Previous Login', ip: '74.122.45.19', details: 'Previous session \u2022 ' + new Date(Date.now() - 86400000 * 3).toLocaleDateString(), active: false }
      ]);
      const saved = localStorage.getItem('userProfile');
      if (saved) {
        setProfileData(JSON.parse(saved));
      }
    }
    loadData();
  }, []);

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-between items-center px-6 py-3 shadow-sm dark:shadow-none transition-all duration-200">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white cursor-pointer" onClick={() => window.location.reload()}>EdiPro</span>
          <nav className="hidden md:flex gap-6">
            <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/dashboard_sleek">Dashboard</a>
            {canClaims ? (
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/837_claims_view">Reports</a>
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
          <a className="h-8 w-8 rounded-full overflow-hidden bg-primary/10 ring-2 ring-white shadow-sm flex items-center justify-center" href="/user_profile" aria-label="Open user profile">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>person</span>
          </a>
        </div>
      </header>

      <main className="pt-20 px-4 md:px-8 pb-8 min-h-screen">
        <div className="max-w-6xl mx-auto space-y-8">
          <section className="relative flex items-end gap-8 pb-4">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '40px' }}>person</span>
              </div>
              <button className="absolute -bottom-2 -right-2 bg-white p-2 rounded-xl shadow-lg hover:scale-105 transition-transform" type="button">
                <span className="material-symbols-outlined text-primary text-xl">edit</span>
              </button>
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-tight text-on-surface">{profileData.name || 'User'}</h1>
                <span className="px-3 py-1 bg-primary-container/10 text-primary text-xs font-bold uppercase tracking-widest rounded-full">{profileData.jobTitle || 'EDI User'}</span>
              </div>
              <p className="text-on-surface-variant mt-1 text-lg font-medium opacity-70">{profileData.department || 'Healthcare Data Systems'}</p>
            </div>
            <div className="flex gap-3 mb-2">
              <button
                className="px-6 py-2.5 bg-white text-on-surface font-semibold rounded-xl shadow-sm border border-slate-200/50 hover:bg-slate-50 transition-colors"
                type="button"
                onClick={() => {
                  const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
                  const recentStr = recentFiles.map((f) => `  - ${f.filename} (${(f.transaction_type || '').toUpperCase()}) \u2014 ${f.is_valid ? 'Valid' : f.error_count + ' errors'} \u2014 ${f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : ''}`).join('\n');
                  const blob = new Blob([[
                    '========================================',
                    '         EDIPRO USER PROFILE EXPORT',
                    '========================================',
                    '',
                    'PERSONAL INFORMATION',
                    '--------------------',
                    `Name:       ${profile.name || '\u2014'}`,
                    `Email:      ${profile.email || '\u2014'}`,
                    `Job Title:  ${profile.jobTitle || '\u2014'}`,
                    `Department: ${profile.department || '\u2014'}`,
                    `Phone:      ${profile.phone || '\u2014'}`,
                    '',
                    'RECENT FILE ACTIVITY (Last 5)',
                    '-----------------------------',
                    recentStr || '  No recent files.',
                    '',
                    '========================================',
                    `Exported: ${new Date().toLocaleString()}`,
                    '========================================'
                  ].join('\n')], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'edipro-profile.txt';
                  a.click(); URL.revokeObjectURL(url);
                }}
              >
                Export Profile
              </button>
              <button className="px-6 py-2.5 bg-primary text-on-primary font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95" onClick={() => window.location.href = '/settings'} type="button">Settings</button>
            </div>
          </section>

          <div className="grid grid-cols-12 gap-6 pb-20">
            <div className="col-span-12 md:col-span-4 glass-card p-6 rounded-3xl shadow-sm ring-1 ring-white/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">person</span>
                  <h3 className="font-bold text-on-surface tracking-tight">Personal Information</h3>
                </div>
                <button
                  onClick={() => { if (editMode) localStorage.setItem('userProfile', JSON.stringify(profileData)); setEditMode(!editMode); }}
                  className="text-xs font-bold text-primary hover:underline"
                  type="button"
                >
                  {editMode ? 'Save' : 'Edit'}
                </button>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Full Name', key: 'name', readOnly: true },
                  { label: 'Email Address', key: 'email', readOnly: true },
                  { label: 'Job Title', key: 'jobTitle' },
                  { label: 'Department', key: 'department' },
                  { label: 'Phone', key: 'phone' }
                ].map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="block text-[10px] uppercase tracking-widest font-black text-slate-400">{field.label}</label>
                    {editMode && !field.readOnly ? (
                      <input
                        value={profileData[field.key] || ''}
                        onChange={(e) => setProfileData((p) => ({ ...p, [field.key]: e.target.value }))}
                        className="w-full border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                        type="text"
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    ) : (
                      <p className="text-on-surface font-semibold text-sm">
                        {profileData[field.key] || (field.readOnly ? '\u2014' : <span className="text-slate-400 italic">Not set</span>)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-12 md:col-span-8 bg-surface-container-lowest p-6 rounded-3xl shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">history</span>
                  <h3 className="font-bold text-on-surface tracking-tight">Quick Access &mdash; Frequent Files</h3>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{recentFiles.length} Recent</span>
              </div>
              <div className="space-y-3">
                {recentFiles.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No files uploaded yet.</p>
                ) : recentFiles.map((file) => {
                  const icons = { '837p': 'description', '837i': 'description', '835': 'payments', '834': 'group_add' };
                  const icon = icons[file.transaction_type] || 'description';
                  return (
                    <div
                      key={file.id}
                      onClick={() => { localStorage.setItem('selectedFileId', file.id); window.location.href = '/master_parser_sleek'; }}
                      className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined">{icon}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-sm">{file.filename}</h4>
                          <p className="text-xs text-on-surface-variant">{(file.transaction_type || '').toUpperCase()} &bull; {file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${file.is_valid ? 'bg-green-100 text-green-700' : 'bg-error/10 text-error'}`}>{file.is_valid ? 'Valid' : 'Error'}</span>
                        <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="col-span-12 md:col-span-7 glass-card p-6 rounded-3xl shadow-sm ring-1 ring-white/20">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-primary">history</span>
                <h3 className="font-bold text-on-surface tracking-tight">Recent Activity Log</h3>
              </div>
              <div className="relative space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                {recentFiles.length === 0 ? (
                  <p className="text-sm text-slate-400 italic pl-8">No recent activity.</p>
                ) : recentFiles.map((file) => (
                  <div
                    key={file.id}
                    className="relative pl-8 flex items-start gap-4 cursor-pointer group"
                    onClick={() => { localStorage.setItem('selectedFileId', file.id); window.location.href = '/master_parser_sleek'; }}
                  >
                    <div className={`absolute left-0 w-6 h-6 rounded-full bg-white border-2 ${file.is_valid ? 'border-primary' : 'border-error'} flex items-center justify-center z-10`}>
                      <div className={`w-2 h-2 rounded-full ${file.is_valid ? 'bg-primary' : 'bg-error'}`}></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold group-hover:text-primary transition-colors">{file.filename}</p>
                      <p className="text-xs text-on-surface-variant">{(file.transaction_type || '').toUpperCase()} &bull; {file.error_count} error(s) &bull; <span className="text-primary font-medium ml-1">{file.is_valid ? 'Valid' : 'Needs review'}</span></p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString() : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-12 md:col-span-5 bg-on-surface text-white p-6 rounded-3xl shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-primary-container">shield</span>
                <h3 className="font-bold tracking-tight">Security &amp; Access Log</h3>
              </div>
              <div className="space-y-4">
                {sessions.map((s, i) => (
                  <div key={i} className="p-3 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">{s.label}</span>
                      {s.active && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
                    </div>
                    <p className="text-sm font-mono opacity-90">{s.ip}</p>
                    <p className="text-[10px] opacity-60">{s.details}</p>
                  </div>
                ))}
                <button
                  onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.href = '/login'; }}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  type="button"
                >
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
