import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import './index.css'
import Shell from './components/Shell'
import Login from './pages/Login'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
