import { apiFetch } from '../config';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  
  let data;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  }
  
  if (!res.ok) {
    throw new ApiError(res.status, data?.message || res.statusText || 'Failed to fetch', data);
  }
  
  return data as T;
}

export const api = {
  get: <T = any>(path: string, options?: RequestInit) => 
    request<T>(path, { ...options, method: 'GET' }),
    
  post: <T = any>(path: string, body?: any, options?: RequestInit) => 
    request<T>(path, { 
      ...options, 
      method: 'POST', 
      ...(body ? { body: JSON.stringify(body) } : {}),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    }),
    
  put: <T = any>(path: string, body?: any, options?: RequestInit) => 
    request<T>(path, { 
      ...options, 
      method: 'PUT', 
      ...(body ? { body: JSON.stringify(body) } : {}),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    }),
    
  delete: <T = any>(path: string, options?: RequestInit) => 
    request<T>(path, { ...options, method: 'DELETE' })
};
