export function useAdminAuth() {
  const rol = new URLSearchParams(location.search).get('role') || 'admin';
  return { user: { id: 'preview' }, adminProfile: { id: 'preview', rol, activo: true }, isAdmin: rol === 'admin' };
}
