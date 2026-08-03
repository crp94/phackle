import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { ScreenRouter } from './ui/ScreenRouter';
import { LocaleProvider } from './i18n/LocaleProvider';
import { puzzleNumber, localIsoDate } from './game/daily';
import './ui/theme/tokens.css';
// Vendored fonts (DESIGN.md R2.1): latin + latin-ext (Italian/Spanish accents),
// weights 400/500 serif + 400 mono only — no italics, no other weights, no
// external font request survives the build (self-hosted via Fontsource).
import '@fontsource/stix-two-text/latin-400.css';
import '@fontsource/stix-two-text/latin-500.css';
import '@fontsource/stix-two-text/latin-ext-400.css';
import '@fontsource/stix-two-text/latin-ext-500.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-ext-400.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

// Pre-boot fallback for the header (see AppProps doc in ./ui/App.tsx) —
// App itself boots the real engine on mount and prefers the store's own
// puzzleNumber the instant that resolves.
const todaysPuzzleNumber = puzzleNumber(localIsoDate());

createRoot(rootElement).render(
  <StrictMode>
    <LocaleProvider>
      <App puzzleNumber={todaysPuzzleNumber}>
        <ScreenRouter />
      </App>
    </LocaleProvider>
  </StrictMode>,
);
