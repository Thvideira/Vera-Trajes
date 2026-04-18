import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import {
  badgeClassPrecisaAjuste,
  badgeClassTrajeLocadoComContexto,
  exibirSegundoBadgeAjustePendente,
  labelTrajeLocadoComContexto,
  type TrajeLocadoStatus,
} from "../types";

type Alerta = {
  id: string;
  status: TrajeLocadoStatus;
  precisaAjuste: boolean;
  clienteNome: string;
  trajeNome: string;
  trajeCodigo: string;
  trajeFotoUrl?: string | null;
  dataRetirada: string;
  precisaLavagem: boolean;
  lavagemStatus: string;
};

type LocProx = {
  id: string;
  cliente: { nome: string };
  retiradas: { id: string; dataRetirada: string }[];
};

type Dash = {
  trajesDisponiveis: number;
  trajesAlugados: number;
  ajustesPendentes: number;
  valoresAReceber: number;
  locacoesProximas: LocProx[];
  alertasInteligentes: Alerta[];
};

export function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Dash>("/api/dashboard")
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) {
    return (
      <p className="text-red-600">
        {err}{" "}
        <Link to="/login" className="underline text-primary">
          Fazer login
        </Link>
      </p>
    );
  }
  if (!data) {
    return <p className="text-muted">Carregando…</p>;
  }

  const cards = [
    { label: "Trajes disponíveis", value: data.trajesDisponiveis },
    { label: "Trajes alugados", value: data.trajesAlugados },
    { label: "Ajustes pendentes", value: data.ajustesPendentes },
    {
      label: "A receber (R$)",
      value: data.valoresAReceber.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
      }),
    },
  ];

  const linhasProximas = data.locacoesProximas.flatMap((loc) =>
    (loc.retiradas ?? []).map((r) => ({
      key: `${loc.id}-${r.id}`,
      cliente: loc.cliente.nome,
      dataRetirada: r.dataRetirada,
    }))
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-muted mt-1 text-sm">
          Resumo da operação, alertas e retiradas previstas
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card-dashboard">
            <p className="text-sm text-muted">{c.label}</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums text-foreground">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Alertas — retirada em até 2 dias
        </h2>
        <p className="text-sm text-muted mb-3">
          Trajes com retirada próxima que ainda precisam de preparação (ajuste
          pendente, lavagem ou etapas antes de “Pronto”).
        </p>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-md">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="table-head-row">
                <th className="w-16"></th>
                <th>Cliente</th>
                <th>Traje</th>
                <th>Retirada</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.alertasInteligentes.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-muted">
                    Nenhum alerta no período.
                  </td>
                </tr>
              )}
              {data.alertasInteligentes.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-line transition-colors hover:bg-pink-soft"
                >
                  <td className="p-2 pl-3">
                    <div className="h-12 w-12 rounded-lg border border-line bg-hover-gray overflow-hidden flex items-center justify-center shrink-0">
                      {a.trajeFotoUrl ? (
                        <img
                          src={a.trajeFotoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[9px] text-muted px-0.5 text-center leading-tight">
                          Sem foto
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">{a.clienteNome}</td>
                  <td className="p-3">
                    <span className="font-medium">{a.trajeNome}</span>
                    <span className="text-muted"> ({a.trajeCodigo})</span>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {new Date(a.dataRetirada).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3">
                    <span className="flex flex-wrap gap-1.5 items-center">
                      <span
                        className={`inline-flex ${badgeClassTrajeLocadoComContexto(
                          a.status,
                          a.precisaAjuste,
                          a.precisaLavagem,
                          a.lavagemStatus
                        )}`}
                      >
                        {labelTrajeLocadoComContexto(
                          a.status,
                          a.precisaAjuste,
                          a.precisaLavagem,
                          a.lavagemStatus
                        )}
                      </span>
                      {exibirSegundoBadgeAjustePendente(
                        a.status,
                        a.precisaAjuste
                      ) && (
                        <span className={`inline-flex ${badgeClassPrecisaAjuste()}`}>
                          Ajuste pendente
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Locações com retirada (7 dias)
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-md">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="table-head-row">
                <th>Cliente</th>
                <th>Retirada</th>
              </tr>
            </thead>
            <tbody>
              {linhasProximas.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-4 text-muted">
                    Nenhuma locação neste período.
                  </td>
                </tr>
              )}
              {linhasProximas.map((l) => (
                <tr
                  key={l.key}
                  className="border-b border-line transition-colors hover:bg-pink-soft"
                >
                  <td className="p-3">{l.cliente}</td>
                  <td className="p-3">
                    {new Date(l.dataRetirada).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
