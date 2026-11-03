import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';

interface TaskProgressDialogProps {
  title: string;
  actionLabel: string;
  returnFocusId?: string;
  onClose: () => void;
  onConfirm: (comment: string, photo: File | null) => Promise<void>;
}

export function TaskProgressDialog({ title, actionLabel, returnFocusId, onClose, onConfirm }: TaskProgressDialogProps) {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!photo) { setPreview(''); return; }
    const url = URL.createObjectURL(photo); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled)') || [])].filter(control => !control.hidden);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', keyboard);
    return () => { window.removeEventListener('keydown', keyboard); if (returnFocusId) document.getElementById(returnFocusId)?.focus(); };
  }, [onClose, returnFocusId, saving]);

  const selectPhoto = (files: FileList | null) => {
    const next = files?.[0] || null;
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      setError(t('Usa una fotografía JPEG, PNG o WebP.')); return;
    }
    setError(''); setPhoto(next);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try { await onConfirm(comment, photo); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('No se pudo guardar el avance. Intenta de nuevo.')); }
    finally { setSaving(false); }
  };

  return <div className="task-progress-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <form ref={dialogRef} className="task-progress-dialog" role="dialog" aria-modal="true" aria-labelledby="task-progress-title" onSubmit={submit}>
      <header><h3 id="task-progress-title">{title}</h3><button type="button" onClick={onClose} disabled={saving} aria-label={t('Cerrar')}><X size={18} /></button></header>
      <p className="task-progress-action">{actionLabel}</p>
      <label className="task-progress-comment"><span>{t('Comentario opcional')}</span><textarea autoFocus rows={4} maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} placeholder={t('Describe el trabajo realizado, una observación o el motivo del cambio.')} /><small>{comment.length}/2000</small></label>
      <div className="task-progress-photo">
        <span>{t('Evidencia opcional')}</span>
        {preview ? <div className="task-progress-preview"><img src={preview} alt={t('Vista previa de la evidencia')} /><button type="button" onClick={() => setPhoto(null)} disabled={saving}><Trash2 size={15} /> {t('Quitar foto')}</button></div> : <div className="task-progress-photo-actions"><button type="button" onClick={() => cameraRef.current?.click()}><Camera size={17} /> {t('Tomar foto')}</button><button type="button" onClick={() => galleryRef.current?.click()}><ImagePlus size={17} /> {t('Elegir de galería')}</button></div>}
        <input ref={cameraRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => selectPhoto(event.target.files)} />
        <input ref={galleryRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => selectPhoto(event.target.files)} />
        <small>{t('Una foto · JPEG, PNG o WebP · máximo 10 MB')}</small>
      </div>
      {error ? <p className="task-progress-error" role="alert">{error}</p> : null}
      <footer><button type="button" onClick={onClose} disabled={saving}>{t('Cancelar')}</button><button className="task-progress-submit" type="submit" disabled={saving}>{saving ? <><Loader2 size={16} className="animate-spin" /> {t('Guardando...')}</> : t('Confirmar avance')}</button></footer>
    </form>
  </div>;
}
