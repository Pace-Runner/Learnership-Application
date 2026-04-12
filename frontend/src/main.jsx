// Entry point - renders React app and wraps with BrowserRouter for routing

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// StrictMode helps catch potential issues during development
// BrowserRouter enables client-side routing so useNavigate() and friends work
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)