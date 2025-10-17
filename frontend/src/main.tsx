import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-center"
        toastOptions={{
          style: { background: '#0b0b0b', color: '#ffffff', borderRadius: '16px' }
        }}
      />
    </BrowserRouter>
  </StrictMode>,
)
