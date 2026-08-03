import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
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

// Placeholder until T12's store is merged — App itself stays store-agnostic
// and just accepts the number as a prop (see AppProps doc in ./ui/App.tsx).
const todaysPuzzleNumber = puzzleNumber(localIsoDate());

createRoot(rootElement).render(
  <StrictMode>
    <LocaleProvider>
      <App puzzleNumber={todaysPuzzleNumber} />
    </LocaleProvider>
  </StrictMode>,
);
