import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

async function start() {
  // Bildschirmvorschau im Browser ohne Rust-Backend – nur im Entwicklungsserver, nie im gebauten Programm.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('preview')) {
    (await import('./preview-mock.js')).installPreviewMock();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
void start();
