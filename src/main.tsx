import { createRoot, type Root } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {
  initializeSafeClientHmr,
  runWhenDocumentReady,
} from './utils/clientRuntimeGuard.ts';

let appRoot: Root | null = null;
let stopSafeHmr: (() => void) | null = null;

function mountApplication() {
  if (typeof document === 'undefined') return;

  const container = document.getElementById('root');
  if (!container) return;

  if (!appRoot) {
    appRoot = createRoot(container);
  }
  appRoot.render(<App />);

  if (!stopSafeHmr) {
    const hmrGuard = initializeSafeClientHmr({
      isProduction: import.meta.env.PROD,
      doc: document,
      win: typeof window !== 'undefined' ? window : null,
      hot: import.meta.hot ?? null,
    });
    stopSafeHmr = hmrGuard.cleanup;
  }
}

runWhenDocumentReady(() => {
  mountApplication();
  return () => {
    if (stopSafeHmr) {
      stopSafeHmr();
      stopSafeHmr = null;
    }
  };
});

if (!import.meta.env.PROD && import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (stopSafeHmr) {
      stopSafeHmr();
      stopSafeHmr = null;
    }
  });
}
