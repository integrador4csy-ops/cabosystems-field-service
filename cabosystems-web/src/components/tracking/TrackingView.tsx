import type { ReactNode } from 'react';
import { ClipboardCheck, MapPinned, Route } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { CheckHistoryView } from './CheckHistoryView';

export type TrackingSection = 'map' | 'checks' | 'history';

interface TrackingViewProps {
  section: TrackingSection;
  onSectionChange: (section: TrackingSection) => void;
  map: ReactNode;
  history: ReactNode;
  checks?: ReactNode;
}

export function TrackingView({ section, onSectionChange, map, history, checks }: TrackingViewProps) {
  const { t } = useTranslation();
  return <div className="flex h-full min-h-0 flex-col gap-3">
    <nav className="flex max-w-full shrink-0 items-center gap-1 self-start overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xs" aria-label={t('Vistas de seguimiento')}>
      <button type="button" onClick={() => onSectionChange('map')} aria-pressed={section === 'map'} className={`flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors ${section === 'map' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><MapPinned size={17} />{t('Mapa en vivo')}</button>
      <button type="button" onClick={() => onSectionChange('checks')} aria-pressed={section === 'checks'} className={`flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors ${section === 'checks' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><ClipboardCheck size={17} />{t('Historial de checks')}</button>
      <button type="button" onClick={() => onSectionChange('history')} aria-pressed={section === 'history'} className={`flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors ${section === 'history' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Route size={17} />{t('Historial de rutas')}</button>
    </nav>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      {section === 'map' ? map : section === 'checks' ? (checks ?? <CheckHistoryView />) : history}
    </div>
  </div>;
}
