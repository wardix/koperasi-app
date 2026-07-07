import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import './index.css'
import Shell from './Shell.tsx'
import Login from './Login.tsx'
import {apiFetch} from './config.ts'

function Root() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  
  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }
  return <Shell onLogout={() => {
    localStorage.removeItem('token');
    apiFetch('/api/logout', { method: 'POST' }).catch(console.error);
    setIsAuthenticated(false);
  }} />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
