import { auth, firebaseEnabled } from './firebase';

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

  return fetch(input, {
    ...init,
    headers
  });
}
