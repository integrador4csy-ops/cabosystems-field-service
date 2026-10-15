import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '../../src/context/LanguageContext';
import { ProjectDirectoryView } from '../../src/components/projects/ProjectDirectoryView';
import '../../src/index.css';

createRoot(document.getElementById('root')!).render(<LanguageProvider><div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#f9fafb', padding: 16, gap: 12, fontFamily: 'Outfit,sans-serif' }}><header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><h1 style={{ fontSize: 18, fontWeight: 600 }}>Proyectos</h1><p style={{ fontSize: 12, color: '#343e48' }}>Vista de prueba · datos ficticios · sin conexión a Supabase</p></header><ProjectDirectoryView /></div></LanguageProvider>);
