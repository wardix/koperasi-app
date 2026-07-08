import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import './index.css'
import Shell from './components/Shell'
import Login from './pages/Login'
import {api} from './services/api'

function Root() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/api/auth/verify')
        .then(() => {
          setIsAuthenticated(true);
        })
        .catch((err) => {
          console.error(err);
          localStorage.removeItem('token');
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
    api.post('/api/logout').catch(console.error);
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
