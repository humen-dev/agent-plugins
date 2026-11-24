import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { loadCatalog } from './catalog/load.ts';

createRoot(document.getElementById('root')!).render(<App load={loadCatalog} />);
