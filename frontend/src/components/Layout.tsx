import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { clearUserRole, getUserRole } from "../lib/auth";
import { MobileGuard } from "./MobileGuard";

const navAdmin = [
  { to: "/", label: "Dashboard" },
  { to: "/clientes", label: "Clientes" },
  { to: "/trajes", label: "Trajes" },
  { to: "/locacoes", label: "Locações" },
  { to: "/ajustes", label: "Ajustes" },
  { to: "/financeiro", label: "Financeiro" },
  { to: "/movimentacoes", label: "Movimentações" },
];

const navMobile = [
  { to: "/trajes/novo", label: "Novo traje" },
  { to: "/trajes", label: "Lista de trajes" },
];

function titleFromPath(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/locacoes/nova") return "Nova locação";
  if (pathname.startsWith("/locacoes/")) return "Locação";
  if (pathname.startsWith("/clientes/novo")) return "Novo cliente";
  if (pathname.startsWith("/clientes/")) return "Cliente";
  if (pathname.startsWith("/trajes/novo")) return "Novo traje";
  if (pathname.startsWith("/trajes/")) return "Traje";
  if (pathname.startsWith("/financeiro/") && pathname !== "/financeiro") {
    return "Detalhe financeiro";
  }
  const seg = pathname.split("/").filter(Boolean)[0];
  const item = navAdmin.find((n) => n.to === `/${seg}`);
  return item?.label ?? "Loja Vera";
}

export function Layout() {
  const { pathname } = useLocation();
  const pageTitle = titleFromPath(pathname);
  const role = getUserRole();
  const isMobile = role === "MOBILE";
  const nav = isMobile ? navMobile : navAdmin;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-vera-50">
      <aside className="flex flex-col md:min-h-screen bg-gradient-to-b from-vera-900 to-vera-700 text-white md:w-56 shrink-0 shadow-xl">
        <div className="p-4 border-b border-white/10">
          <Link
            to={isMobile ? "/trajes/novo" : "/"}
            className="text-lg font-semibold tracking-tight text-white hover:text-vera-100 transition-colors"
          >
            Loja Vera
          </Link>
          <p className="text-xs text-vera-100/90 mt-1">
            {isMobile ? "Cadastro de trajes" : "Aluguel de trajes"}
          </p>
        </div>
        <nav className="flex flex-row flex-wrap md:flex-col gap-1 p-2 md:flex-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-white/15 font-medium text-white shadow-inner"
                    : "text-vera-100 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 mt-auto border-t border-white/10 text-xs text-vera-100/80">
          <Link
            to="/login"
            className="hover:text-white transition-colors"
            onClick={() => {
              localStorage.removeItem("token");
              clearUserRole();
            }}
          >
            Sair / Conta
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 border-b border-vera-100 bg-white/90 backdrop-blur-md shadow-sm">
          <div className="px-4 md:px-8 py-3 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg md:text-xl font-semibold text-slate-900">
                {pageTitle}
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                {isMobile
                  ? "Perfil mobile — cadastro e foto"
                  : "Gestão operacional e financeira"}
              </p>
            </div>
            {!isMobile && (
              <Link
                to="/locacoes/nova"
                className="btn-primary text-xs md:text-sm shrink-0"
              >
                + Nova locação
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
          <MobileGuard>
            <Outlet />
          </MobileGuard>
        </main>
      </div>
    </div>
  );
}
