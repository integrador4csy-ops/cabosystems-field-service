import { Component, type ReactNode, type ErrorInfo } from 'react';
import { useTranslation } from '../../context/LanguageContext';

export class ViewErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('View failed:', error, info.componentStack); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function ViewErrorFallback() {
  const { t } = useTranslation();
  return <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-600">
    <p>{t('No se pudo abrir esta sección. Recarga la página para intentarlo de nuevo.')}</p>
    <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-800 hover:bg-slate-100" onClick={() => window.location.reload()}>
      {t('Recargar página')}
    </button>
  </div>;
}
