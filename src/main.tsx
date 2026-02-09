import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
console.log('[FA] Build v2 - 2026-02-09');
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
