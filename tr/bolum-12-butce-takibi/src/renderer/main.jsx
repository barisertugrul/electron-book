// main.jsx — React'in başlangıç noktası. index.html'deki <div id="root">
// içine <App /> bileşenini çizer.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
