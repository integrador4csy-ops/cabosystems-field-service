import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Check, ChevronDown, Search, X } from 'lucide-react';
import { layoutViewport } from '../../lib/layoutViewport';
import type { WarrantyProject } from '../../lib/warrantyApi';

interface WarrantyProjectSelectProps {
  projects: WarrantyProject[];
  value: string;
  onChange: (projectId: string, project?: WarrantyProject) => void;
  locale?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function WarrantyProjectSelect({
  projects,
  value,
  onChange,
  locale = 'es',
  placeholder,
  required = false,
  disabled = false,
  className = '',
}: WarrantyProjectSelectProps) {
  const isEn = locale.startsWith('en');
  const uid = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDesarrollo, setSelectedDesarrollo] = useState<string>('all');

  // Currently selected project
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === value);
  }, [projects, value]);

  // Unique desarrollos with villa count
  const desarrollosWithCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects) {
      const name = p.desarrollo?.trim() || (isEn ? 'Other' : 'Otro');
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    const list = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return list;
  }, [projects, isEn]);

  // Filtered projects based on search and selected desarrollo chip
  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      // Desarrollo chip filter
      if (selectedDesarrollo !== 'all') {
        const dName = p.desarrollo?.trim() || (isEn ? 'Other' : 'Otro');
        if (dName !== selectedDesarrollo) return false;
      }
      // Text search
      if (!q) return true;
      const haystack = `${p.desarrollo || ''} ${p.villa || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [projects, search, selectedDesarrollo, isEn]);

  // Group filtered projects by desarrollo for categorized display
  const groupedProjects = useMemo(() => {
    const groups: { desarrollo: string; items: WarrantyProject[] }[] = [];
    const map = new Map<string, WarrantyProject[]>();

    for (const p of filteredProjects) {
      const dName = p.desarrollo?.trim() || (isEn ? 'Other' : 'Otro');
      let arr = map.get(dName);
      if (!arr) {
        arr = [];
        map.set(dName, arr);
        groups.push({ desarrollo: dName, items: arr });
      }
      arr.push(p);
    }

    // Sort items within each group alphabetically / numerically by villa
    for (const g of groups) {
      g.items.sort((a, b) =>
        a.villa.localeCompare(b.villa, locale, { numeric: true, sensitivity: 'base' })
      );
    }

    return groups;
  }, [filteredProjects, isEn, locale]);

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearch('');
      setSelectedDesarrollo('all');
    }
  }, [open]);

  // Position popover
  useLayoutEffect(() => {
    if (!open || disabled) return;

    const position = () => {
      const layout = layoutViewport();
      const anchor = triggerRef.current ? layout.rect(triggerRef.current) : null;
      const panel = panelRef.current;
      if (!anchor || !panel) return;

      const width = Math.min(Math.max(anchor.width, 360), layout.width - 20);
      const maxHeight = 390;

      // Check space
      const spaceBelow = layout.height - anchor.bottom - 12;
      const spaceAbove = anchor.top - 12;
      const upwards = spaceBelow < 280 && spaceAbove > spaceBelow;

      const left = Math.max(10, Math.min(anchor.left, layout.width - width - 10));
      const top = upwards
        ? Math.max(8, anchor.top - Math.min(maxHeight, panel.scrollHeight) - 4)
        : anchor.bottom + 4;

      panel.style.width = `${width}px`;
      panel.style.maxHeight = `${Math.min(maxHeight, upwards ? spaceAbove : spaceBelow)}px`;
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.visibility = 'visible';
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    position();
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, disabled, groupedProjects]);

  const handleSelect = (project: WarrantyProject) => {
    onChange(project.id, project);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    triggerRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Hidden input for HTML form validation */}
      <input
        type="text"
        required={required}
        value={value}
        onChange={() => {}}
        tabIndex={-1}
        className="sr-only"
        aria-hidden="true"
        onInvalid={(e) => {
          e.preventDefault();
          triggerRef.current?.focus();
        }}
      />

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? uid : undefined}
        className={`flex h-11 w-full items-center justify-between rounded-lg border bg-white px-3 text-left text-sm transition-colors outline-none ${
          open
            ? 'border-brand-500 ring-2 ring-brand-500/15'
            : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'cursor-not-allowed opacity-50 bg-slate-50' : 'cursor-pointer'}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Building2 size={16} className={selectedProject ? 'text-brand-500 shrink-0' : 'text-slate-400 shrink-0'} />
          {selectedProject ? (
            <div className="flex min-w-0 items-center gap-1.5 truncate">
              <span className="shrink-0 rounded bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 border border-orange-200/70">
                {selectedProject.desarrollo}
              </span>
              <span className="truncate font-semibold text-slate-800">
                {selectedProject.villa}
              </span>
            </div>
          ) : (
            <span className="truncate text-slate-400">
              {placeholder || (isEn ? 'Search and select villa...' : 'Buscar o seleccionar villa...')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-slate-400 ml-2 shrink-0">
          {selectedProject && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onChange('');
                }
              }}
              title={isEn ? 'Clear selection' : 'Quitar selección'}
              className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`transition-transform duration-150 ${open ? 'rotate-180 text-brand-500' : 'text-slate-400'}`}
          />
        </div>
      </button>

      {/* Popover */}
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={panelRef}
            id={uid}
            role="dialog"
            aria-modal="true"
            aria-label={isEn ? 'Select project or villa' : 'Seleccionar proyecto o villa'}
            className="fixed z-[1300] flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-2xl transition-all overflow-hidden"
            style={{ visibility: 'hidden' }}
          >
            {/* Search Input */}
            <div className="border-b border-slate-100 p-2.5 bg-slate-50/50">
              <div className="relative flex items-center">
                <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    isEn
                      ? 'Search by villa or development (e.g. 104, Kalish)...'
                      : 'Buscar por villa o desarrollo (ej. 104, Kalish)...'
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Desarrollo Filter Chips (Tabs) */}
              {desarrollosWithCounts.length > 1 && (
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedDesarrollo('all')}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      selectedDesarrollo === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isEn ? 'All' : 'Todos'} ({projects.length})
                  </button>
                  {desarrollosWithCounts.map((d) => (
                    <button
                      key={d.name}
                      type="button"
                      onClick={() => setSelectedDesarrollo(d.name)}
                      className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        selectedDesarrollo === d.name
                          ? 'bg-brand-500 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {d.name} <span className="opacity-70 font-normal">({d.count})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* List of projects grouped by desarrollo */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {groupedProjects.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <Building2 size={28} className="mx-auto text-slate-300" />
                  <p className="mt-2 text-xs font-semibold text-slate-700">
                    {isEn ? 'No villas found' : 'No se encontraron villas'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {isEn
                      ? 'Try another search term or clear the filter.'
                      : 'Intenta con otro término o limpia el filtro.'}
                  </p>
                  {(search || selectedDesarrollo !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setSelectedDesarrollo('all');
                      }}
                      className="mt-3 text-xs font-semibold text-brand-600 hover:underline"
                    >
                      {isEn ? 'Reset filters' : 'Restablecer filtros'}
                    </button>
                  )}
                </div>
              ) : (
                groupedProjects.map((group) => (
                  <div key={group.desarrollo} className="border-b border-slate-100 last:border-b-0">
                    {/* Sticky group header: completamente pegado al borde superior sin espacio */}
                    <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between shadow-xs">
                      <span>{group.desarrollo}</span>
                      <span className="font-semibold text-[10px] text-slate-400 lowercase">
                        {group.items.length} {group.items.length === 1 ? (isEn ? 'villa' : 'villa') : (isEn ? 'villas' : 'villas')}
                      </span>
                    </div>

                    {/* Group items */}
                    <div className="p-1.5 space-y-0.5">
                      {group.items.map((item) => {
                        const isSelected = item.id === value;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelect(item)}
                            className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                              isSelected
                                ? 'bg-orange-50 text-brand-900 font-semibold border border-orange-200'
                                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <span className="truncate">{item.villa}</span>
                            {isSelected && (
                              <Check size={14} className="text-brand-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer summary */}
            <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-400 flex items-center justify-between">
              <span>
                {filteredProjects.length}{' '}
                {isEn
                  ? filteredProjects.length === 1 ? 'villa available' : 'villas available'
                  : filteredProjects.length === 1 ? 'villa disponible' : 'villas disponibles'}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
              >
                {isEn ? 'Close' : 'Cerrar'}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
