import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { ROLE_OPTIONS, normalizeRole } from '../auth/permissions';

const bodyClassName = 'bg-background text-on-surface min-h-screen page-admin-users';

const ROLE_LABELS = {
  admin: 'Admin',
  auditor: 'Auditor',
  claims_creator: 'Claims Creator',
  claims_submitter: 'Claims Submitter',
  enrollment_manager: 'Enrollment Manager',
  payment_processor: 'Payment Processor'
};

export function AdminUsersPage() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState('');
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    displayName: '',
    role: ''
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createNotice, setCreateNotice] = useState('');

  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;

    return () => {
      document.body.className = previous;
    };
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    async function loadUsers() {
      setLoading(true);
      setError('');
      try {
        const response = await authFetch('/api/admin/users');
        if (!response.ok) {
          throw new Error('Failed to load users');
        }
        const payload = await response.json();
        setUsers(Array.isArray(payload.users) ? payload.users : []);
      } catch (err) {
        setError('Unable to load users. Check admin permissions.');
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [authLoading, isAuthenticated]);

  const roleOptions = useMemo(() => ROLE_OPTIONS, []);

  const updateUserRole = (uid, role) => {
    setUsers((prev) =>
      prev.map((item) => (item.uid === uid ? { ...item, role } : item))
    );
  };

  const updateCreateField = (field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitCreateUser = async (event) => {
    event.preventDefault();
    const role = normalizeRole(createForm.role);
    if (!createForm.email || !createForm.password || !role) {
      setCreateError('Email, password, and role are required.');
      return;
    }

    setCreating(true);
    setCreateError('');
    setCreateNotice('');

    try {
      const response = await authFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createForm.email,
          password: createForm.password,
          role,
          display_name: createForm.displayName || null
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || 'Failed to create user');
      }

      const payload = await response.json();
      setUsers((prev) => [payload, ...prev]);
      setCreateForm({ email: '', password: '', displayName: '', role: '' });
      setCreateNotice('User created. Ask them to sign in using the password provided.');
    } catch (err) {
      setCreateError(err?.message || 'User creation failed.');
    } finally {
      setCreating(false);
    }
  };

  const saveRole = async (uid, role) => {
    const nextRole = normalizeRole(role);
    if (!nextRole) {
      setError('Pick a role before saving.');
      return;
    }
    setSaving((prev) => ({ ...prev, [uid]: true }));
    setError('');
    try {
      const response = await authFetch(`/api/admin/users/${uid}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole })
      });
      if (!response.ok) {
        throw new Error('Failed to update role');
      }
      const payload = await response.json();
      setUsers((prev) => prev.map((item) => (item.uid === uid ? payload : item)));
    } catch (err) {
      setError('Role update failed.');
    } finally {
      setSaving((prev) => ({ ...prev, [uid]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm dark:shadow-none">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-slate-900 dark:text-slate-50">EdiPro</span>
          <nav className="hidden md:flex gap-6">
            <a className="text-slate-500 hover:text-slate-900 text-sm font-medium" href="/dashboard_sleek">Dashboard</a>
            <a className="text-slate-500 hover:text-slate-900 text-sm font-medium" href="/settings">Settings</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-outline uppercase tracking-widest">Admin</span>
          <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">User Access</span>
        </div>
      </header>

      <main className="pt-24 px-6 pb-12 max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">User Access Control</h1>
            <p className="text-sm text-on-surface-variant mt-2">Assign roles to control 837, 834, and 835 access. Users must sign out/in after changes.</p>
          </div>
        </div>

        {error ? (
          <div className="mb-6 bg-error-container/40 text-error px-4 py-3 rounded-xl text-sm font-medium">{error}</div>
        ) : null}

        <div className="bg-white/70 rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-outline">Create User</h2>
            <span className="text-xs text-outline">Email + password sign-in</span>
          </div>
          <form className="px-6 py-6 grid gap-4" onSubmit={submitCreateUser}>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="text-xs font-semibold text-outline uppercase tracking-widest">
                Email
                <input
                  className="mt-2 w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm"
                  type="email"
                  value={createForm.email}
                  onChange={(event) => updateCreateField('email', event.target.value)}
                  placeholder="user@company.com"
                  autoComplete="off"
                  required
                />
              </label>
              <label className="text-xs font-semibold text-outline uppercase tracking-widest">
                Display Name
                <input
                  className="mt-2 w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm"
                  type="text"
                  value={createForm.displayName}
                  onChange={(event) => updateCreateField('displayName', event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="text-xs font-semibold text-outline uppercase tracking-widest">
                Temporary Password
                <input
                  className="mt-2 w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm"
                  type="password"
                  value={createForm.password}
                  onChange={(event) => updateCreateField('password', event.target.value)}
                  placeholder="Set a temporary password"
                  autoComplete="new-password"
                  required
                />
              </label>
              <label className="text-xs font-semibold text-outline uppercase tracking-widest">
                Role
                <select
                  className="mt-2 w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm"
                  value={createForm.role}
                  onChange={(event) => updateCreateField('role', event.target.value)}
                  required
                >
                  <option value="" disabled>Choose role</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                  ))}
                </select>
              </label>
            </div>
            {createError ? (
              <div className="text-sm text-error font-medium">{createError}</div>
            ) : null}
            {createNotice ? (
              <div className="text-sm text-primary font-medium">{createNotice}</div>
            ) : null}
            <div>
              <button
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50"
                type="submit"
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white/70 rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-outline">Users</h2>
            <span className="text-xs text-outline">{users.length} total</span>
          </div>

          {loading ? (
            <div className="p-8 text-sm text-outline">Loading users...</div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {users.map((user) => (
                <div key={user.uid} className="px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-on-surface">{user.display_name || user.email || user.uid}</p>
                    <p className="text-xs text-outline">{user.email || 'No email on record'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm"
                      value={user.role || ''}
                      onChange={(event) => updateUserRole(user.uid, event.target.value)}
                    >
                      <option value="" disabled>Choose role</option>
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                      ))}
                    </select>
                    <button
                      className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50"
                      disabled={saving[user.uid]}
                      onClick={() => saveRole(user.uid, user.role)}
                      type="button"
                    >
                      {saving[user.uid] ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
