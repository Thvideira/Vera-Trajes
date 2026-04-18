import { Navigate, useLocation } from "react-router-dom";
import { getUserRole } from "../lib/auth";

/** MOBILE: apenas login, /mobile, /trajes e /trajes/novo. Demais rotas → /trajes/novo */
export function MobileGuard({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const role = getUserRole();

  if (role !== "MOBILE") {
    return <>{children}</>;
  }

  if (
    pathname === "/login" ||
    pathname === "/mobile" ||
    pathname === "/trajes" ||
    pathname === "/trajes/novo"
  ) {
    return <>{children}</>;
  }

  return <Navigate to="/trajes/novo" replace />;
}
