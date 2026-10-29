import { layoutViewport } from '../../lib/layoutViewport';
import { Children, Fragment, isValidElement, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import './AppSelect.css';

interface AppSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'size'> {
  triggerContent?: ReactNode;
}

interface Option { value: string; label: ReactNode; text: string; disabled: boolean }

function textContent(node: ReactNode): string {
  return Children.toArray(node).map((child) => isValidElement<{ children?: ReactNode }>(child) ? textContent(child.props.children) : String(child)).join('');
}

function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child): Option[] => {
    if (!isValidElement<{ children?: ReactNode; value?: string; disabled?: boolean }>(child)) return [];
    if (child.type === Fragment || child.type === 'optgroup') return readOptions(child.props.children);
    if (child.type !== 'option') return [];
    const text = textContent(child.props.children);
    return [{ value: String(child.props.value ?? text), label: child.props.children, text, disabled: !!child.props.disabled }];
  });
}

/** Shared single-choice control; the native select retains form validation and events. */
export function AppSelect({ children, className = '', triggerContent, style, id, title, ...props }: AppSelectProps) {
  const uid = useId();
  const menuId = `${uid}-options`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = readOptions(children);
  const value = String(props.value ?? props.defaultValue ?? options[0]?.value ?? '');
  const selected = options.findIndex((option) => option.value === value);

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled || !selectRef.current) return;
    selectRef.current.value = option.value;
    selectRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };
  const show = (last = false) => {
    setActive(selected >= 0 && !options[selected].disabled ? selected : last ? options.findLastIndex((option) => !option.disabled) : options.findIndex((option) => !option.disabled));
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || props.disabled) return;
    const position = () => {
      const layout = layoutViewport(); const anchor = triggerRef.current ? layout.rect(triggerRef.current) : undefined;
      const menu = menuRef.current;
      if (!anchor || !menu) return;
      const width = Math.min(Math.max(anchor.width, 180), layout.width - 16);
      const below = layout.height - anchor.bottom - 14;
      const above = anchor.top - 14;
      const upwards = below < Math.min(240, menu.scrollHeight) && above > below;
      menu.style.width = `${width}px`;
      menu.style.maxHeight = `${Math.max(40, Math.min(280, upwards ? above : below))}px`;
      menu.style.left = `${Math.max(8, Math.min(anchor.left, layout.width - width - 8))}px`;
      menu.style.top = `${upwards ? Math.max(8, anchor.top - layout.rect(menu).height - 6) : anchor.bottom + 6}px`;
      menu.style.visibility = 'visible';
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setOpen(false); }
    };
    position();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    window.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      window.removeEventListener('keydown', escape, true);
    };
  }, [open, props.disabled]);

  useLayoutEffect(() => {
    if (open) menuRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopPropagation();
      if (open) choose(active); else show();
      return;
    }
    const enabled = options.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (!open) { show(event.key === 'ArrowUp' || event.key === 'End'); return; }
      const current = enabled.indexOf(active);
      setActive(event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled[enabled.length - 1] : enabled[(current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length] ?? active);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = (now - searchRef.current.time < 650 ? searchRef.current.text : '') + event.key.toLocaleLowerCase();
      searchRef.current = { text, time: now };
      const index = options.findIndex((option) => !option.disabled && option.text.toLocaleLowerCase().startsWith(text));
      if (index >= 0) { setActive(index); setOpen(true); }
    }
  };

  return <>
    <select {...props} ref={selectRef} className="app-select-native" hidden tabIndex={-1} aria-hidden="true" onInvalid={(event) => { event.preventDefault(); triggerRef.current?.focus(); }} onFocus={() => triggerRef.current?.focus()}>{children}</select>
    <button ref={triggerRef} id={id} title={title} type="button" role="combobox" aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} aria-required={props.required || undefined} aria-expanded={open && !props.disabled} aria-haspopup="listbox" aria-controls={open ? menuId : undefined} aria-activedescendant={open && active >= 0 ? `${uid}-${active}` : undefined} disabled={props.disabled} className={`${triggerContent ? 'app-select-custom' : 'app-select-trigger'} ${className}`} style={style} onKeyDown={onKeyDown} onBlur={() => setOpen(false)} onClick={(event) => { event.stopPropagation(); if (open) setOpen(false); else show(); }}>
      {triggerContent ?? <><span>{options[selected]?.label ?? options[0]?.label}</span><ChevronDown size={15} aria-hidden="true" /></>}
    </button>
    {open && !props.disabled && createPortal(<div ref={menuRef} id={menuId} role="listbox" aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} className="app-select-menu" style={{ visibility: 'hidden' }} onPointerDown={(event) => event.preventDefault()} onClick={(event) => event.stopPropagation()}>
      {options.map((option, index) => <div key={option.value} id={`${uid}-${index}`} role="option" aria-selected={index === selected} aria-disabled={option.disabled || undefined} data-active={index === active} className="app-select-option" onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={() => choose(index)}><span>{option.label}</span>{index === selected && <Check size={15} aria-hidden="true" />}</div>)}
    </div>, document.body)}
  </>;
}
