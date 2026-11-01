// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import PwaUpdatePrompt from './PwaUpdatePrompt.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <PwaUpdatePrompt />
  </React.StrictMode>
)
