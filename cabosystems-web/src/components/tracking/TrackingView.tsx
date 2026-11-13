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
    <nav className="inline-flex max-w-full shrink-0 items-center gap-[3px] self-start overflow-x-auto rounded-[9px] border border-slate-200 bg-slate-100 p-[3px]" aria-label={t('Vistas de seguimiento')} role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={section === 'map'}
        aria-pressed={section === 'map'}
        onClick={() => onSectionChange('map')}
        className={`inline-flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3.5 text-[13px] transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
          section === 'map'
            ? 'bg-brand-500 font-semibold text-white shadow-xs'
            : 'font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900'
        }`}
      >
        <MapPinned size={15} />
        <span>{t('Mapa en vivo')}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={section === 'checks'}
        aria-pressed={section === 'checks'}
        onClick={() => onSectionChange('checks')}
        className={`inline-flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3.5 text-[13px] transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
          section === 'checks'
            ? 'bg-brand-500 font-semibold text-white shadow-xs'
            : 'font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900'
        }`}
      >
        <ClipboardCheck size={15} />
        <span>{t('Historial de checks')}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={section === 'history'}
        aria-pressed={section === 'history'}
        onClick={() => onSectionChange('history')}
        className={`inline-flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3.5 text-[13px] transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
          section === 'history'
            ? 'bg-brand-500 font-semibold text-white shadow-xs'
            : 'font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900'
        }`}
      >
        <Route size={15} />
        <span>{t('Historial de rutas')}</span>
      </button>
    </nav>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      {section === 'map' ? map : section === 'checks' ? (checks ?? <CheckHistoryView />) : history}
    </div>
  </div>;
}
