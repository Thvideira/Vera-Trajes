const ROLE_KEY = "userRole";

export type UserRole = "ADMIN" | "MOBILE";

/** Decodifica payload do JWT (apenas leitura; a API continua validando a assinatura). */
function parseJwtPayload(token: string): { role?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    return JSON.parse(atob(base64)) as { role?: string };
  } catch {
    return null;
  }
}

/**
 * Perfil do usuário: primeiro `localStorage` (login), senão `role` dentro do JWT.
 * Evita botões de admin sumindo quando `userRole` não foi gravado (sessão antiga).
 */
export function getUserRole(): UserRole | null {
  const stored = localStorage.getItem(ROLE_KEY);
  if (stored === "MOBILE" || stored === "ADMIN") return stored;
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = parseJwtPayload(token);
  if (!payload) return null;
  const role = payload.role ?? "ADMIN";
  if (role === "MOBILE") return "MOBILE";
  return "ADMIN";
}

export function isAdminUser(): boolean {
  return getUserRole() === "ADMIN";
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
