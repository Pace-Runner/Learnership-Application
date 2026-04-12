/**
 * ============================================================================
 * main.jsx - Application Entry Point
 * ============================================================================
 * Renders the React application into the DOM and sets up routing context.
 * This is the first file that runs when the app starts.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

/**
 * ROOT SETUP
 * - StrictMode: Enabled to catch potential issues in development
 * - BrowserRouter: Wraps entire app to enable client-side routing
 * - All child components have access to routing hooks like useNavigate()
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)