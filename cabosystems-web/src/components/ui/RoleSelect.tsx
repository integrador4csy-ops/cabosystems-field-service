import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface RoleItem {
  id: string;
  label: string;
}

export const DETAILED_ROLES: RoleItem[] = [
  { id: 'admin', label: 'Administrador' },
  { id: 'supervisor_instalacion', label: 'Supervisor Instalación' },
  { id: 'instalador', label: 'Técnico Instalador' },
  { id: 'aux_instalacion', label: 'Auxiliar Instalación' },
  { id: 'integrador', label: 'Especialista Integrador' },
  { id: 'aux_integracion', label: 'Auxiliar Integración' },
  { id: 'infraestructura', label: 'Infraestructura' },
  { id: 'aux_infraestructura', label: 'Auxiliar Infraestructura' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'aux_servicios', label: 'Auxiliar Servicios' },
  { id: 'aux_operaciones', label: 'Auxiliar Operaciones' },
];

interface RoleSelectProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export const RoleSelect: React.FC<RoleSelectProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedRole =
    DETAILED_ROLES.find((r) => r.id === value) || DETAILED_ROLES[3];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-10.5 w-full items-center justify-between rounded-xl border bg-white px-3.5 text-left transition-all ${
          isOpen
            ? 'border-[#f78c26] ring-3 ring-orange-500/10 shadow-xs'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className="truncate text-xs font-semibold text-[#343e48]">
          {selectedRole.label}
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#f78c26]' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex flex-col gap-0.5">
            {DETAILED_ROLES.map((role) => {
              const isSelected = role.id === value;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => {
                    onChange(role.id);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-orange-50 text-[#f78c26] font-bold'
                      : 'hover:bg-slate-50 text-[#343e48] font-medium'
                  }`}
                >
                  <span className="text-xs">
                    {role.label}
                  </span>

                  {isSelected && (
                    <Check size={14} className="text-[#f78c26] shrink-0" strokeWidth={2.5} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
