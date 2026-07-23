export function apiUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  let resolvedPath = path;
  if (resolvedPath.startsWith('/api/') && !resolvedPath.startsWith('/api/v1/')) {
    resolvedPath = resolvedPath.replace('/api/', '/api/v1/');
  }
  return `${baseUrl}${resolvedPath}`;
}

function isPublicApiPath(path: string): boolean {
  const normalized = path.startsWith('/api/') && !path.startsWith('/api/v1/')
    ? path.replace('/api/', '/api/v1/')
    : path;
  return (
    normalized === '/api/v1/settings/branding' ||
    normalized === '/api/v1/auth/login' ||
    normalized === '/api/v1/auth/logout' ||
    normalized === '/api/v1/auth/refresh' ||
    normalized === '/api/v1/auth/google' ||
    normalized.startsWith('/api/v1/member-auth/')
  );
}

function clearSessionAndRedirectToLogin() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  const path = window.location.pathname;
  // Avoid hard-reload loops on the login screen (and member portal)
  if (path === '/login' || path.startsWith('/login/') || path.startsWith('/portal')) {
    return;
  }
  window.location.href = '/login';
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  options.credentials = 'include';
  let res = await fetch(apiUrl(path), { ...options, headers });
  
  const isAuthRefreshPath =
    path === '/api/auth/refresh' ||
    path === '/api/v1/auth/refresh';
  const isAuthLoginPath =
    path === '/api/auth/login' ||
    path === '/api/v1/auth/login';

  // Public endpoints must never trigger refresh/redirect (would flicker login forever)
  if (res.status === 401 && !isAuthRefreshPath && !isAuthLoginPath && !isPublicApiPath(path)) {
    const refreshRes = await fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      // API shape: { success, data: { token } } (also accept legacy top-level token)
      const newToken =
        (data?.data && typeof data.data.token === 'string' && data.data.token) ||
        (typeof data?.token === 'string' && data.token) ||
        null;
      if (data.success && newToken) {
        localStorage.setItem('token', newToken);
        // Retry original request with new token
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        };
        res = await fetch(apiUrl(path), { ...options, headers: retryHeaders });
      } else {
        clearSessionAndRedirectToLogin();
      }
    } else {
      clearSessionAndRedirectToLogin();
    }
  }
  
  return res;
}
