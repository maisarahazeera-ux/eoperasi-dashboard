import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { PreferencesProvider } from './context/PreferencesContext'
import './index.css'
import { applyTheme, getInitialTheme } from './lib/theme'

// Set light/dark before the first paint so the page doesn't flash.
applyTheme(getInitialTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      </AuthProvider>
    </LanguageProvider>
  </React.StrictMode>,
)