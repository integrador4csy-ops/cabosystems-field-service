import type React from 'react';
import { AppSelect } from './AppSelect';
import { useTranslation } from '../../context/LanguageContext';

export interface RoleItem {
  id: string;
  label: string;
}

export const DETAILED_ROLES: RoleItem[] = [
  { id: 'admin', label: 'Administrador' },
  { id: 'supervisor_instalacion', label: 'Supervisor Instalación' },
  { id: 'instalador', label: 'Técnico Instalador' },
  { id: 'aux_instalacion', label: 'Auxiliar Instalación' },
  { id: 'integrador', label: 'Integrador' },
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

export const RoleSelect: React.FC<RoleSelectProps> = ({ value, onChange, className = '' }) => {
  const { t } = useTranslation();
  return <AppSelect value={value} onChange={(event) => onChange(event.target.value)} className={className} aria-label={t('Rol Asignado')}>
    {DETAILED_ROLES.map((role) => <option key={role.id} value={role.id}>{t(role.label)}</option>)}
  </AppSelect>;
};