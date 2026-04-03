import { auth, firebaseEnabled } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export function buildApiUrl(input) {
  if (!API_BASE_URL) {
    return input;
  }
  if (typeof input === 'string' && input.startsWith('/')) {
    return `${API_BASE_URL}${input}`;
  }
  return input;
}

export async function getAccessToken() {
  if (!firebaseEnabled || !auth || !auth.currentUser) {
    return '';
  }
  try {
    return await auth.currentUser.getIdToken();
  } catch (error) {
    return '';
  }
}

export async function authFetch(input, init = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(buildApiUrl(input), {
    ...init,
    headers
  });
}
