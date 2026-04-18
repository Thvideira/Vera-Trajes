const ROLE_KEY = "userRole";

export type UserRole = "ADMIN" | "MOBILE";

export function getUserRole(): UserRole | null {
  const r = localStorage.getItem(ROLE_KEY);
  if (r === "MOBILE" || r === "ADMIN") return r;
  return null;
}

export function setUserRole(role: UserRole): void {
  localStorage.setItem(ROLE_KEY, role);
}

export function clearUserRole(): void {
  localStorage.removeItem(ROLE_KEY);
}

export function isMobileUser(): boolean {
  return getUserRole() === "MOBILE";
}
