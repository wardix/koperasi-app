import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import './index.css'
const Shell = React.lazy(() => import('./components/Shell'))
const Login = React.lazy(() => import('./pages/Login'))
import { AuthProvider, useAuth } from './contexts/AuthContext'

function Root() {
  const { isAuthenticated, isChecking } = useAuth();

  if (isChecking) {
    return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <Shell />;
}

import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import React, { Suspense } from 'react'
import { ThemeProvider, useThemeMode } from './contexts/ThemeContext'
import { Theme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral'

function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();
  return (
    <Theme theme={neutralTheme} mode={mode}>
      {children}
    </Theme>
  );
}

import { Routes, Route } from 'react-router-dom';
const MemberPortal = React.lazy(() => import('./pages/MemberPortal'));

function LazyRoot() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading App...</div>}>
      <Routes>
        <Route path="/portal/*" element={<MemberPortal />} />
        <Route path="*" element={<Root />} />
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
  </StrictMode>,
)
