export type Permission =
  | 'read:stats'
  | 'read:members' | 'create:members' | 'update:members' | 'delete:members' | 'update:savings'
  | 'read:loans' | 'create:loans' | 'approve:loans' | 'delete:loans' | 'create:payments'
  | 'read:shu'
  | 'read:settings' | 'update:settings'
  | 'manage:users';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  viewer: [
    'read:stats',
    'read:members',
    'read:loans',
    'read:shu',
    'read:settings'
  ],
  admin: [
    'read:stats',
    'read:members', 'create:members', 'update:members', 'update:savings',
    'read:loans', 'create:loans', 'approve:loans', 'create:payments',
    'read:shu',
    'read:settings'
  ],
  superadmin: [
    'read:stats',
    'read:members', 'create:members', 'update:members', 'delete:members', 'update:savings',
    'read:loans', 'create:loans', 'approve:loans', 'delete:loans', 'create:payments',
    'read:shu',
    'read:settings', 'update:settings',
    'manage:users'
  ]
};

export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}
