import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from '../services/api'

interface AuthContextType {
  isAuthenticated: boolean
  isChecking: boolean
  role: string
  isAdmin: boolean
  isSuperAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: (credential: string) => Promise<void>
  confirmLogin: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [role, setRole] = useState('viewer')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.get('/api/auth/verify')
        .then(() => {
          setIsAuthenticated(true)
          setRole(localStorage.getItem('role') || 'viewer')
        })
        .catch(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('role')
        })
        .finally(() => setIsChecking(false))
    } else {
      setIsChecking(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ token: string; role: string }>('/api/login', { email, password })
    localStorage.setItem('token', data.token)
    localStorage.setItem('role', data.role)
    setRole(data.role)
  }, [])

  const loginWithGoogle = useCallback(async (credential: string) => {
    const data = await api.post<{ token: string; role: string }>('/api/auth/google', { credential })
    localStorage.setItem('token', data.token)
    localStorage.setItem('role', data.role)
    setRole(data.role)
  }, [])

  const confirmLogin = useCallback(() => {
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/api/logout')
    } catch {
      // ignore
    }
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    setIsAuthenticated(false)
    setRole('viewer')
  }, [])

  const isAdmin = role === 'admin' || role === 'superadmin'
  const isSuperAdmin = role === 'superadmin'

  return (
    <AuthContext.Provider value={{ isAuthenticated, isChecking, role, isAdmin, isSuperAdmin, login, loginWithGoogle, confirmLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
