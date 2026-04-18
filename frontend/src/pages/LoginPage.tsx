import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiSend } from "../lib/api";
import { setUserRole, type UserRole } from "../lib/auth";

type LoginRes = {
  token: string;
  user: { id: string; email: string; nome: string | null; role: UserRole };
};

export function LoginPage({ mobileEntry }: { mobileEntry?: boolean }) {
  const nav = useNavigate();
  const [email, setEmail] = useState(
    mobileEntry ? "mobile@loja.vera" : "admin@loja.vera"
  );
  const [password, setPassword] = useState(
    mobileEntry ? "mobile123" : "admin123"
  );
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await apiSend<LoginRes>("/api/auth/login", "POST", {
        email,
        password,
      });
      localStorage.setItem("token", res.token);
      setUserRole(res.user.role);
      const welcomeUserName =
        res.user.nome?.trim() || res.user.email;
      if (res.user.role === "MOBILE") {
        nav("/trajes/novo", {
          replace: true,
          state: { welcomeUserName },
        });
      } else {
        nav("/", { replace: true, state: { welcomeUserName } });
      }
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-surface rounded-2xl shadow-sm border border-line">
      <h1 className="text-xl font-semibold mb-1">Entrar</h1>
      {mobileEntry && (
        <p className="text-sm text-muted mb-4">
          Acesso cadastro mobile — após o login você vai para o cadastro de trajes.
        </p>
      )}
      {!mobileEntry && (
        <p className="text-sm text-muted mb-6">
          <Link to="/mobile" className="text-primary underline">
            Entrada mobile (cadastro de trajes)
          </Link>
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            E-mail
          </label>
          <input
            className="w-full rounded-lg border border-line px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Senha
          </label>
          <input
            className="w-full rounded-lg border border-line px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5 disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
