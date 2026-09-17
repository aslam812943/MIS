export function isFranchiseRole(role: unknown): boolean {
  return role === 'franchise_owner' || role === 'franchise_staff';
}
export function isFranchiseApiPathAllowed(url: string): boolean {
  const path = url.split('?')[0] || '';
  return /^\/api\/franchise(?:\/|$)/.test(path) ||
    /^\/api\/auth\/(?:me|profile|change-password)(?:\/|$)/.test(path) ||
    /^\/api\/admin\/notifications(?:\/|$)/.test(path);
}
