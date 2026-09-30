import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('Service Worker registered successfully:', reg.scope);
        // Force an active check for newer service worker versions
        if (reg.update) {
          reg.update();
        }
      })
      .catch((err) => console.error('Service Worker registration failed:', err));
  });

  // Listen for version updates from service worker and reload
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'VERSION_UPDATE') {
      console.log('New version activated. Reloading page...');
      window.location.reload();
    }
  });
}
