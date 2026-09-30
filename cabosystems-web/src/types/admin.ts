export interface Invitacion {
  id: string;
  email: string;
  rol: string;
  token: string;
  estado: string;
  created_at: string;
}

export const ROLES_LIST = [
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
