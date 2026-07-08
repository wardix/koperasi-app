import { useState, useEffect } from 'react';

export function useAuth() {
  const [role, setRole] = useState('viewer');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRole(localStorage.getItem('role') || 'viewer');
    }
  }, []);
  
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isSuperAdmin = role === 'superadmin';
  
  return { role, isAdmin, isSuperAdmin };
}
