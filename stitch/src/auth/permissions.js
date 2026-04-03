export const ROLE_PERMISSIONS = {
  admin: ['admin.full'],
  auditor: ['claims.view', 'enrollment.view', 'remittance.view'],
  claims_creator: ['claims.view', 'claims.write'],
  claims_submitter: ['claims.view', 'claims.submit'],
  enrollment_manager: ['enrollment.view', 'enrollment.write'],
  payment_processor: ['remittance.view', 'remittance.process']
};

export const ROLE_OPTIONS = Object.keys(ROLE_PERMISSIONS);
export const ADMIN_PERMISSIONS = ['admin.full'];
export const CLAIMS_ACCESS_PERMISSIONS = ['claims.view', 'claims.write', 'claims.submit'];
export const ENROLLMENT_ACCESS_PERMISSIONS = ['enrollment.view', 'enrollment.write'];
export const REMITTANCE_ACCESS_PERMISSIONS = ['remittance.view', 'remittance.process'];
export const ANY_EDI_VIEW_PERMISSIONS = [
  'claims.view',
  'claims.write',
  'claims.submit',
  'enrollment.view',
  'enrollment.write',
  'remittance.view',
  'remittance.process'
];

const ALL_PERMISSIONS = Array.from(
  new Set(Object.values(ROLE_PERMISSIONS).flat().filter((perm) => perm !== 'admin.full'))
);

export function normalizeRole(role) {
  if (!role) {
    return '';
  }
  return String(role).trim().toLowerCase().replace(/\s+/g, '_');
}

export function permissionsForRole(role) {
  const normalized = normalizeRole(role);
  const perms = ROLE_PERMISSIONS[normalized] || [];
  if (perms.includes('admin.full')) {
    return Array.from(new Set([...ALL_PERMISSIONS, 'admin.full']));
  }
  return perms;
}

export function canAny(permissions, required) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return false;
  }
  if (permissions.includes('admin.full')) {
    return true;
  }
  return required.some((perm) => permissions.includes(perm));
}
