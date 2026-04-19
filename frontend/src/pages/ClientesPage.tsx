import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiSend } from "../lib/api";
import { formatarCPF, limparCPF } from "../lib/cpf";
import { formatarNome } from "../lib/formatarNome";
import { formatarTelefone, normalizarTelefoneDigitos } from "../lib/telefone";

export type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  cpf: string;
  cep: string;
  logradouro: string;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
};

export function ClientesPage() {
  const [list, setList] = useState<Cliente[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      const rows = await apiGet<Cliente[]>(`/api/clientes${params}`);
      setList(rows);
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Clientes</h1>
          <p className="text-muted text-sm">Cadastro e busca por nome ou CPF</p>
        </div>
        <Link to="/clientes/novo" className="btn-primary text-sm">
          Novo cliente
        </Link>
      </div>
      <form
        className="flex gap-2 flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input
          className="rounded-lg border border-line px-3 py-2 text-sm flex-1 min-w-[200px]"
          placeholder="Buscar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="btn-secondary text-sm py-2 px-4">
          Filtrar
        </button>
      </form>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="table-head-row">
              <th className="p-3">Nome</th>
              <th className="p-3">Telefone</th>
              <th className="p-3">CPF</th>
              <th className="p-3">Cidade</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-4">
                  Carregando…
                </td>
              </tr>
            ) : (
              list.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-line transition-colors hover:bg-pink-soft"
                >
                  <td className="p-3 font-medium">{c.nome}</td>
                  <td className="p-3 tabular-nums whitespace-nowrap">
                    {formatarTelefone(c.telefone)}
                  </td>
                  <td className="p-3 tabular-nums">{formatarCPF(c.cpf)}</td>
                  <td className="p-3">{c.cidade ?? "—"}</td>
                  <td className="p-3">
                    <Link
                      to={`/clientes/${c.id}`}
                      className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ClienteFormPage({ id }: { id?: string }) {
  const isNew = !id;
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    cpf: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
  });

  useEffect(() => {
    if (!id) return;
    apiGet<Cliente>(`/api/clientes/${id}`)
      .then((c) => {
        setForm({
          nome: c.nome,
          telefone: normalizarTelefoneDigitos(c.telefone),
          cpf: limparCPF(c.cpf),
          cep: c.cep,
          logradouro: c.logradouro,
          numero: c.numero ?? "",
          complemento: c.complemento ?? "",
          bairro: c.bairro ?? "",
          cidade: c.cidade ?? "",
          uf: c.uf ?? "",
        });
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function buscarCep() {
    const raw = form.cep.replace(/\D/g, "");
    if (raw.length !== 8) return;
    try {
      const data = (await apiGet<Record<string, string>>(
        `/api/cep/${raw}`
      )) as {
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      setForm((f) => ({
        ...f,
        logradouro: data.logradouro ?? f.logradouro,
        bairro: data.bairro ?? f.bairro,
        cidade: data.localidade ?? f.cidade,
        uf: data.uf ?? f.uf,
      }));
    } catch {
      setErr("CEP não encontrado");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const payload = {
        ...form,
        nome: formatarNome(form.nome),
        telefone: normalizarTelefoneDigitos(form.telefone),
        cpf: limparCPF(form.cpf),
      };
      if (isNew) {
        await apiSend("/api/clientes", "POST", payload);
      } else {
        await apiSend(`/api/clientes/${id}`, "PUT", payload);
      }
      window.location.href = "/clientes";
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Erro ao salvar");
    }
  }

  if (loading) return <p>Carregando…</p>;

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">
        {isNew ? "Novo cliente" : "Editar cliente"}
      </h1>
      <form onSubmit={onSubmit} className="space-y-4 bg-surface p-6 rounded-xl border border-line">
        {(
          [
            ["nome", "Nome completo"],
            ["telefone", "Telefone (WhatsApp)"],
            ["cpf", "CPF"],
          ] as const
        ).map(([k, label]) => (
          <div key={k}>
            <label className="block text-sm font-medium text-foreground mb-1">
              {label}
            </label>
            <input
              required
              className="w-full rounded-lg border border-line px-3 py-2"
              placeholder={
                k === "cpf"
                  ? "000.000.000-00"
                  : k === "telefone"
                    ? "(00) 00000-0000"
                    : undefined
              }
              inputMode={
                k === "cpf" || k === "telefone" ? "numeric" : undefined
              }
              value={
                k === "cpf"
                  ? formatarCPF(form.cpf)
                  : k === "telefone"
                    ? formatarTelefone(form.telefone)
                    : (form[k] as string)
              }
              onChange={(e) =>
                k === "cpf"
                  ? setForm((f) => ({
                      ...f,
                      cpf: limparCPF(e.target.value).slice(0, 11),
                    }))
                  : k === "telefone"
                    ? setForm((f) => ({
                        ...f,
                        telefone: normalizarTelefoneDigitos(e.target.value),
                      }))
                    : setForm((f) => ({ ...f, [k]: e.target.value }))
              }
            />
          </div>
        ))}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground mb-1">
              CEP
            </label>
            <input
              className="w-full rounded-lg border border-line px-3 py-2"
              value={form.cep}
              onChange={(e) => setForm((f) => ({ ...f, cep: e.target.value }))}
              onBlur={() => void buscarCep()}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Endereço
          </label>
          <input
            required
            className="w-full rounded-lg border border-line px-3 py-2"
            value={form.logradouro}
            onChange={(e) =>
              setForm((f) => ({ ...f, logradouro: e.target.value }))
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Número
            </label>
            <input
              className="w-full rounded-lg border border-line px-3 py-2"
              value={form.numero}
              onChange={(e) =>
                setForm((f) => ({ ...f, numero: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Complemento
            </label>
            <input
              className="w-full rounded-lg border border-line px-3 py-2"
              value={form.complemento}
              onChange={(e) =>
                setForm((f) => ({ ...f, complemento: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Bairro
            </label>
            <input
              className="w-full rounded-lg border border-line px-3 py-2"
              value={form.bairro}
              onChange={(e) =>
                setForm((f) => ({ ...f, bairro: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Cidade
            </label>
            <input
              className="w-full rounded-lg border border-line px-3 py-2"
              value={form.cidade}
              onChange={(e) =>
                setForm((f) => ({ ...f, cidade: e.target.value }))
              }
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            UF
          </label>
          <input
            maxLength={2}
            className="w-full max-w-[120px] rounded-lg border border-line px-3 py-2"
            value={form.uf}
            onChange={(e) =>
              setForm((f) => ({ ...f, uf: e.target.value.toUpperCase() }))
            }
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="submit" className="btn-primary text-sm">
          Salvar
        </button>
      </form>
    </div>
  );
}
