export function apiUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  return `${baseUrl}${path}`;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  options.credentials = 'include';
  let res = await fetch(apiUrl(path), { ...options, headers });
  
  if (res.status === 401 && path !== '/api/login' && path !== '/api/refresh') {
    // Try to refresh token
    const refreshRes = await fetch(apiUrl('/api/refresh'), {
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
