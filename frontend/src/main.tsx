import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { configureBackendApi } from './services/api'

async function bootstrap() {
  try {
    await configureBackendApi()
  } catch (error) {
    console.error('Core engine initialization notice:', error)
  }
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

void bootstrap()
