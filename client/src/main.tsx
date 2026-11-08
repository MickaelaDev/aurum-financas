import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@fontsource/cormorant-garamond/latin-300.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/inter/latin-300.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import './styles.css';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento raiz não encontrado.');

createRoot(container).render(
  <HashRouter>
    <App />
  </HashRouter>,
);
