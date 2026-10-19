import React from 'react'
import { createRoot } from 'react-dom/client'
import '@salutejs/plasma-themes/css/plasma_b2c__light.css'
import './app.css'
import './theme/fonts.css'
import './index.css'
import './theme/netology.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
