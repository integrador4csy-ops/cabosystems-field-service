import { layoutViewport } from '../../lib/layoutViewport';
import { useTranslation } from '../../context/LanguageContext';
import { useLayoutEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';

interface TaskActionsMenuProps {
  title: string;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function TaskActionsMenu({ title, deleting, onEdit, onDelete }: TaskActionsMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = (restoreFocus = false) => {
    if (restoreFocus) triggerRef.current?.focus();
    setOpen(false);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const positionMenu = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const layout = layoutViewport(); const anchor = layout.rect(trigger);
      const { width, height } = layout.rect(menu);
      const left = Math.max(8, Math.min(anchor.right - width, layout.width - width - 8));
      const top = Math.max(8, Math.min(anchor.bottom + 6, layout.height - height - 8));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.style.visibility = 'visible';
    };
    positionMenu();
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const handleOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    window.addEventListener('resize', positionMenu);
    document.addEventListener('scroll', positionMenu, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('resize', positionMenu);
      document.removeEventListener('scroll', positionMenu, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="task-actions-menu" onBlur={(event) => { const target = event.relatedTarget as Node | null; if (!event.currentTarget.contains(target) && !menuRef.current?.contains(target)) setOpen(false); }}>
      <button ref={triggerRef} type="button" className="task-board-icon-button" title={t("Más opciones")} aria-label={t("Más opciones de {value0}", { value0: title })} aria-expanded={open} aria-haspopup="menu" aria-controls={open ? menuId : undefined} disabled={deleting} onClick={() => setOpen((previous) => !previous)}>
        {deleting ? <Loader2 size={15} className="animate-spin" /> : <MoreHorizontal size={18} />}
      </button>
      {open && createPortal(<div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label={t("Opciones de {value0}", { value0: title })}
        className="task-actions-popover"
        style={{ visibility: 'hidden' }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
          if (event.key === 'Tab') { close(true); return; }
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
          const current = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'ArrowDown' ? (current + 1) % items.length : event.key === 'ArrowUp' ? (current - 1 + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1;
          if (next >= 0) { event.preventDefault(); items[next]?.focus(); }
        }}
      >
        <button type="button" role="menuitem" onClick={() => { close(true); onEdit(); }}><Edit2 size={14} aria-hidden="true" />{t("Editar")}</button>
        <button type="button" role="menuitem" className="task-menu-danger" onClick={() => { close(true); onDelete(); }}><Trash2 size={14} aria-hidden="true" />{t("Eliminar")}</button>
      </div>, document.body)}
    </div>
  );
}
