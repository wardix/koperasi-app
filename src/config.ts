export function apiUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  let resolvedPath = path;
  if (resolvedPath.startsWith('/api/') && !resolvedPath.startsWith('/api/v1/')) {
    resolvedPath = resolvedPath.replace('/api/', '/api/v1/');
  }
  return `${baseUrl}${resolvedPath}`;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  options.credentials = 'include';
  let res = await fetch(apiUrl(path), { ...options, headers });
  
  if (res.status === 401 && path !== '/api/login' && path !== '/api/refresh' && path !== '/api/v1/login' && path !== '/api/v1/refresh') {
    // Try to refresh token
    const refreshRes = await fetch(apiUrl('/api/v1/refresh'), {
      method: 'POST',
      credentials: 'include'
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      if (data.success && data.token) {
        localStorage.setItem('token', data.token);
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${data.token}`;
        res = await fetch(apiUrl(path), { ...options, headers });
      } else {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } else {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  }
  
  return res;
}
