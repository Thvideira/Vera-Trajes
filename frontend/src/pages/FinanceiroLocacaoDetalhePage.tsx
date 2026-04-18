import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../lib/api";
import {
  LABEL_RETIRADA_STATUS,
  badgeClassPrecisaAjuste,
  badgeClassTrajeLocadoComContexto,
  exibirSegundoBadgeAjustePendente,
  labelTrajeLocadoComContexto,
  type TrajeLocadoStatus,
} from "../types";

type Detalhe = {
  locacao: {
    id: string;
    encerrada: boolean;
    statusPagamento: string;
    valorTotal: string;
    valorPago: string;
    valorRestante: string;
    dataEvento: string | null;
    dataAluguel: string;
    dataDevolucaoPrevista: string | null;
    observacoes: string | null;
  };
  cliente: { nome: string; telefone: string };
  retiradas: {
    id: string;
    dataRetirada: string;
    status: keyof typeof LABEL_RETIRADA_STATUS;
    trajes: {
      trajeLocadoId: string;
      nome: string;
      codigo: string;
      fotoUrl: string | null;
      status: TrajeLocadoStatus;
      precisaAjuste: boolean;
      precisaLavagem: boolean;
      lavagemStatus: string;
    }[];
  }[];
};

export function FinanceiroLocacaoDetalhePage() {
  const { locacaoId } = useParams();
  const [data, setData] = useState<Detalhe | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!locacaoId) return;
    setErr(null);
    apiGet<Detalhe>(`/api/financeiro/${locacaoId}`)
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, [locacaoId]);

  if (err) {
    return (
      <div className="space-y-4">
        <Link to="/financeiro" className="text-sm text-primary underline">
          ← Voltar ao financeiro
        </Link>
        <p className="text-red-600">{err}</p>
      </div>
    );
  }
  if (!data) {
    return <p className="text-muted">Carregando…</p>;
  }

  const { locacao, cliente, retiradas } = data;

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Link to="/financeiro" className="text-sm text-primary underline">
          ← Voltar aos pagamentos pendentes
        </Link>
        <Link
          to={`/locacoes/${locacao.id}`}
          className="btn-secondary text-sm"
        >
          Abrir locação (operacional)
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Detalhe financeiro — {cliente.nome}
        </h1>
        <p className="text-sm text-muted mt-1">
          Valores, retiradas e trajes desta locação
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-md space-y-3">
        <h2 className="font-medium text-foreground">Locação</h2>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted">Situação</dt>
            <dd>
              {locacao.encerrada ? (
                <span className="text-foreground">Encerrada</span>
              ) : (
                <span className="text-success">Em aberto</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Pagamento</dt>
            <dd className="font-medium">{locacao.statusPagamento}</dd>
          </div>
          <div>
            <dt className="text-muted">Total</dt>
            <dd>R$ {Number(locacao.valorTotal).toLocaleString("pt-BR")}</dd>
          </div>
          <div>
            <dt className="text-muted">Pago</dt>
            <dd>R$ {Number(locacao.valorPago).toLocaleString("pt-BR")}</dd>
          </div>
          <div>
            <dt className="text-muted">Restante</dt>
            <dd className="font-semibold text-warning-fg">
              R$ {Number(locacao.valorRestante).toLocaleString("pt-BR")}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Data do aluguel</dt>
            <dd>
              {new Date(locacao.dataAluguel).toLocaleString("pt-BR")}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Data do evento</dt>
            <dd>
              {locacao.dataEvento
                ? new Date(locacao.dataEvento).toLocaleString("pt-BR")
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Devolução prevista</dt>
            <dd>
              {locacao.dataDevolucaoPrevista
                ? new Date(locacao.dataDevolucaoPrevista).toLocaleString("pt-BR")
                : "—"}
            </dd>
          </div>
        </dl>
        {locacao.observacoes && (
          <p className="text-sm text-foreground pt-2 border-t border-line">
            <span className="text-muted">Observações: </span>
            {locacao.observacoes}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-md space-y-2">
        <h2 className="font-medium text-foreground">Cliente</h2>
        <p className="text-sm">
          <span className="text-muted">Nome: </span>
          {cliente.nome}
        </p>
        <p className="text-sm">
          <span className="text-muted">Telefone: </span>
          {cliente.telefone}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-medium text-foreground">Retiradas e trajes</h2>
        {retiradas.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-line bg-surface overflow-hidden shadow-sm"
          >
            <div className="px-4 py-2 bg-pink-soft/60 border-b border-line flex flex-wrap justify-between gap-2">
              <span className="font-medium text-sm">
                Retirada:{" "}
                {new Date(r.dataRetirada).toLocaleString("pt-BR")}
              </span>
              <span className="text-sm text-muted">
                {LABEL_RETIRADA_STATUS[r.status]}
              </span>
            </div>
            <ul className="divide-y divide-line">
              {r.trajes.map((t) => (
                <li
                  key={t.trajeLocadoId}
                  className="p-4 flex flex-wrap gap-4 items-start"
                >
                  <div className="h-20 w-20 shrink-0 rounded-lg border border-line bg-hover-gray overflow-hidden flex items-center justify-center">
                    {t.fotoUrl ? (
                      <img
                        src={t.fotoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-muted px-1 text-center">
                        Sem foto
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {t.nome}{" "}
                      <span className="text-muted font-normal">
                        ({t.codigo})
                      </span>
                    </p>
                    <span className="mt-1 flex flex-wrap gap-1.5 items-center">
                      <span
                        className={`inline-flex ${badgeClassTrajeLocadoComContexto(
                          t.status,
                          t.precisaAjuste,
                          t.precisaLavagem,
                          t.lavagemStatus
                        )}`}
                      >
                        {labelTrajeLocadoComContexto(
                          t.status,
                          t.precisaAjuste,
                          t.precisaLavagem,
                          t.lavagemStatus
                        )}
                      </span>
                      {exibirSegundoBadgeAjustePendente(
                        t.status,
                        t.precisaAjuste
                      ) && (
                        <span className={`inline-flex ${badgeClassPrecisaAjuste()}`}>
                          Ajuste pendente
                        </span>
                      )}
                    </span>
                    <p className="text-xs text-muted mt-2">
                      Lavagem:{" "}
                      {t.precisaLavagem ? t.lavagemStatus : "Não aplicável"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
