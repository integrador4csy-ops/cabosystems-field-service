import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Keep menus inside the viewport, outside the scrolling message list. */
export function ChatPopover({ anchor, onClose, children, width = 360, label }: {
  anchor: HTMLElement; onClose: () => void; children: ReactNode; width?: number; label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12, ready: false });
  useLayoutEffect(() => {
    const popup = ref.current;
    if (!popup) return;
    const previous = document.activeElement as HTMLElement | null;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const height = popup.getBoundingClientRect().height;
      const availableWidth = Math.min(width, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.right - availableWidth, window.innerWidth - availableWidth - 12));
      const top = rect.top >= height + 20 ? rect.top - height - 8 : Math.min(rect.bottom + 8, window.innerHeight - height - 12);
      setPosition({ left, top: Math.max(12, top), ready: true });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(popup);
    const outside = (event: PointerEvent) => {
      if (!popup.contains(event.target as Node) && !anchor.contains(event.target as Node)) onClose();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') {
        const items = Array.from(popup.querySelectorAll<HTMLElement>('button:not(:disabled),input'));
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const focusFrame = requestAnimationFrame(() => (popup.querySelector<HTMLElement>('input') || popup.querySelector<HTMLElement>('button'))?.focus());
    const scroll = (event: Event) => { if (!popup.contains(event.target as Node)) onClose(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', scroll, true);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', scroll, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [anchor, onClose, width]);
  return createPortal(<div ref={ref} role="dialog" aria-label={label} className="chat-popover"
    style={{ left: position.left, top: position.top, width: `min(${width}px, calc(100vw - 24px))`, visibility: position.ready ? 'visible' : 'hidden' }}>{children}</div>, document.body);
}
