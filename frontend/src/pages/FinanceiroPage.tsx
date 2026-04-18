import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";

type Rel = {
  quantidade: number;
  totalContratado: string;
  totalRecebido: string;
  totalAReceber: string;
};

type Pend = {
  id: string;
  encerrada: boolean;
  statusPagamento: string;
  valorTotal: string;
  valorPago: string;
  cliente: { nome: string };
  retiradas: { dataRetirada: string }[];
};

export function FinanceiroPage() {
  const navigate = useNavigate();
  const [rel, setRel] = useState<Rel | null>(null);
  const [pend, setPend] = useState<Pend[]>([]);
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");

  async function loadRel(e?: FormEvent) {
    e?.preventDefault();
    const p = new URLSearchParams();
    if (ini) p.set("inicio", new Date(ini).toISOString());
    if (fim) p.set("fim", new Date(fim).toISOString());
    const r = await apiGet<Rel>(`/api/locacoes/relatorio?${p.toString()}`);
    setRel(r);
  }

  async function loadPend() {
    const rows = await apiGet<Pend[]>("/api/locacoes/pagamentos-pendentes");
    setPend(rows);
  }

  useEffect(() => {
    void loadRel();
    void loadPend();
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Financeiro</h1>
      <section className="space-y-3">
        <h2 className="font-medium">Relatório</h2>
        <form onSubmit={loadRel} className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Início</label>
            <input
              type="date"
              className="rounded-lg border px-3 py-2 text-sm"
              value={ini}
              onChange={(e) => setIni(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Fim</label>
            <input
              type="date"
              className="rounded-lg border px-3 py-2 text-sm"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary text-sm">
            Atualizar
          </button>
        </form>
        {rel && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card label="Locações" value={String(rel.quantidade)} />
            <Card label="Contratado" value={`R$ ${rel.totalContratado}`} />
            <Card label="Recebido" value={`R$ ${rel.totalRecebido}`} />
            <Card label="A receber" value={`R$ ${rel.totalAReceber}`} />
          </div>
        )}
      </section>
      <section>
        <h2 className="font-medium mb-1">Pagamentos pendentes</h2>
        <p className="text-sm text-slate-600 mb-3">
          Inclui locações <strong>encerradas</strong> que ainda têm saldo a receber (destacadas
          abaixo). <span className="text-slate-500">Clique na linha para ver o detalhe.</span>
        </p>
        <button
          type="button"
          onClick={() => void loadPend()}
          className="mb-2 text-sm underline"
        >
          Recarregar lista
        </button>
        <div className="overflow-x-auto rounded-xl border border-vera-100 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="p-3">Locação</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Retirada</th>
                <th className="p-3">Total</th>
                <th className="p-3">Pago</th>
                <th className="p-3">Restante</th>
              </tr>
            </thead>
            <tbody>
              {pend.map((p) => {
                const rest =
                  Number(p.valorTotal) - Number(p.valorPago);
                const datas = (p.retiradas ?? [])
                  .map((r) => new Date(r.dataRetirada).getTime())
                  .filter((n) => !Number.isNaN(n));
                const prox =
                  datas.length > 0
                    ? new Date(Math.min(...datas)).toLocaleDateString("pt-BR")
                    : "—";
                const encerradaComSaldo = p.encerrada && rest > 0;
                return (
                  <tr
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/financeiro/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        navigate(`/financeiro/${p.id}`);
                    }}
                    className={`border-b border-slate-100 cursor-pointer hover:bg-vera-50/80 transition-colors ${
                      encerradaComSaldo
                        ? "bg-amber-50/90 border-l-4 border-l-amber-500"
                        : ""
                    }`}
                  >
                    <td className="p-3 whitespace-nowrap">
                      {encerradaComSaldo ? (
                        <span className="inline-flex items-center rounded-full bg-amber-200/80 text-amber-950 px-2 py-0.5 text-xs font-medium">
                          Encerrada · a receber
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">Em aberto</span>
                      )}
                      <span className="block text-xs text-slate-500 mt-1">
                        {p.statusPagamento}
                      </span>
                    </td>
                    <td className="p-3">{p.cliente.nome}</td>
                    <td className="p-3">{prox}</td>
                    <td className="p-3">{p.valorTotal}</td>
                    <td className="p-3">{p.valorPago}</td>
                    <td className="p-3 font-medium tabular-nums">
                      R$ {rest.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );
}
