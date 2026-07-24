import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import './index.css'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider, useThemeMode } from './contexts/ThemeContext'
import { Theme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral'

const Shell = lazy(() => import('./components/Shell'))
const Login = lazy(() => import('./pages/Login'))
const MemberPortal = lazy(() => import('./pages/MemberPortal'))

function LoadingScreen({ label = 'Loading...' }: { label?: string }) {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {label}
    </div>
  )
}

function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode()
  return (
    <Theme theme={neutralTheme} mode={mode}>
      {children}
    </Theme>
  )
}

/**
 * Admin login page at /login.
 * If already authenticated as admin, send to dashboard (or previous admin path).
 */
function AdminLoginRoute() {
  const { isAuthenticated, isChecking } = useAuth()
  const location = useLocation()

  if (isChecking) {
    return <LoadingScreen />
  }

  if (isAuthenticated) {
    const from =
      (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/'
    // Never bounce authenticated admin back into portal via "from"
    const target = from.startsWith('/portal') || from === '/login' ? '/' : from
    return <Navigate to={target} replace />
  }

  return <Login />
}

/**
 * Admin app shell (dashboard, members, loans, …).
 * - Unauthenticated on `/` → member portal (majority audience)
 * - Unauthenticated on other paths → /login (admin)
 */
function AdminAppRoute() {
  const { isAuthenticated, isChecking } = useAuth()
  const location = useLocation()

  if (isChecking) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    const path = location.pathname
    if (path === '/' || path === '') {
      return <Navigate to="/portal" replace />
    }
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Shell />
}

function LazyRoot() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading App..." />}>
      <Routes>
        <Route path="/portal/*" element={<MemberPortal />} />
        <Route path="/login" element={<AdminLoginRoute />} />
        <Route path="/*" element={<AdminAppRoute />} />
      </Routes>
    </Suspense>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AppThemeProvider>
            <AuthProvider>
              <LazyRoot />
            </AuthProvider>
          </AppThemeProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)
