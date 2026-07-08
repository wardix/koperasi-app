import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import './index.css'
import Shell from './components/Shell'
import Login from './pages/Login'
import {apiFetch} from './config'

function Root() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      apiFetch('/api/auth/verify')
        .then((res) => {
          if (res.ok) {
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('token');
          }
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => {
          setIsChecking(false);
        });
    } else {
      setIsChecking(false);
    }
  }, []);
  
  if (isChecking) {
    return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }
  
  return <Shell onLogout={() => {
    localStorage.removeItem('token');
    apiFetch('/api/logout', { method: 'POST' }).catch(console.error);
    setIsAuthenticated(false);
  }} />;
}

import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
