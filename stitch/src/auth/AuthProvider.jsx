import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onIdTokenChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { authFetch } from './api';
import { auth, firebaseEnabled, googleProvider } from './firebase';
import { permissionsForRole } from './permissions';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    role: null,
    permissions: [],
    loading: true
  });

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setState((prev) => ({ ...prev, loading: false }));
      return undefined;
    }

    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, role: null, permissions: [], loading: false });
        return;
      }

      try {
        const response = await authFetch('/api/auth/me');

        if (response.ok) {
          const payload = await response.json();
          setState({
            user,
            role: payload.role || null,
            permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
            loading: false
          });
          return;
        }

        const tokenResult = await user.getIdTokenResult();
        const role = tokenResult.claims.role || (Array.isArray(tokenResult.claims.roles) ? tokenResult.claims.roles[0] : null);
        const permissions = permissionsForRole(role);
        setState({ user, role, permissions, loading: false });
      } catch (error) {
        setState({ user, role: null, permissions: [], loading: false });
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email, password) => {
    if (!firebaseEnabled || !auth) {
      throw new Error('Firebase is not configured.');
    }
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await credential.user.getIdTokenResult(true);
    return credential.user;
  };

  const loginWithGoogle = async () => {
    if (!firebaseEnabled || !auth || !googleProvider) {
      throw new Error('Firebase is not configured.');
    }
    const credential = await signInWithPopup(auth, googleProvider);
    await credential.user.getIdTokenResult(true);
    return credential.user;
  };

  const logout = async () => {
    if (!firebaseEnabled || !auth) {
      return;
    }
    await signOut(auth);
  };

  const value = useMemo(
    () => ({
      user: state.user,
      role: state.role,
      permissions: state.permissions,
      loading: state.loading,
      isAuthenticated: Boolean(state.user),
      loginWithEmail,
      loginWithGoogle,
      logout
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
