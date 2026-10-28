import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './lynx-a.css';
import './lynx-b.css';
import './lynx-c.css';
import './lynx-d.css';
import { ThemeProvider } from './theme/ThemeContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
