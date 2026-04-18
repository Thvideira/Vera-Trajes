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
        <Link to="/financeiro" className="text-sm text-vera-700 underline">
          ← Voltar ao financeiro
        </Link>
        <p className="text-red-600">{err}</p>
      </div>
    );
  }
  if (!data) {
    return <p className="text-slate-500">Carregando…</p>;
  }

  const { locacao, cliente, retiradas } = data;

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Link to="/financeiro" className="text-sm text-vera-700 underline">
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
        <h1 className="text-2xl font-semibold text-slate-900">
          Detalhe financeiro — {cliente.nome}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Valores, retiradas e trajes desta locação
        </p>
      </div>

      <section className="rounded-2xl border border-vera-100 bg-white p-5 shadow-md space-y-3">
        <h2 className="font-medium text-slate-900">Locação</h2>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Situação</dt>
            <dd>
              {locacao.encerrada ? (
                <span className="text-slate-700">Encerrada</span>
              ) : (
                <span className="text-emerald-700">Em aberto</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Pagamento</dt>
            <dd className="font-medium">{locacao.statusPagamento}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Total</dt>
            <dd>R$ {Number(locacao.valorTotal).toLocaleString("pt-BR")}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Pago</dt>
            <dd>R$ {Number(locacao.valorPago).toLocaleString("pt-BR")}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Restante</dt>
            <dd className="font-semibold text-amber-900">
              R$ {Number(locacao.valorRestante).toLocaleString("pt-BR")}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Data do aluguel</dt>
            <dd>
              {new Date(locacao.dataAluguel).toLocaleString("pt-BR")}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Data do evento</dt>
            <dd>
              {locacao.dataEvento
                ? new Date(locacao.dataEvento).toLocaleString("pt-BR")
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Devolução prevista</dt>
            <dd>
              {locacao.dataDevolucaoPrevista
                ? new Date(locacao.dataDevolucaoPrevista).toLocaleString("pt-BR")
                : "—"}
            </dd>
          </div>
        </dl>
        {locacao.observacoes && (
          <p className="text-sm text-slate-700 pt-2 border-t border-vera-50">
            <span className="text-slate-500">Observações: </span>
            {locacao.observacoes}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-vera-100 bg-white p-5 shadow-md space-y-2">
        <h2 className="font-medium text-slate-900">Cliente</h2>
        <p className="text-sm">
          <span className="text-slate-500">Nome: </span>
          {cliente.nome}
        </p>
        <p className="text-sm">
          <span className="text-slate-500">Telefone: </span>
          {cliente.telefone}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-medium text-slate-900">Retiradas e trajes</h2>
        {retiradas.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-vera-100 bg-white overflow-hidden shadow-sm"
          >
            <div className="px-4 py-2 bg-vera-50/80 border-b border-vera-100 flex flex-wrap justify-between gap-2">
              <span className="font-medium text-sm">
                Retirada:{" "}
                {new Date(r.dataRetirada).toLocaleString("pt-BR")}
              </span>
              <span className="text-sm text-slate-600">
                {LABEL_RETIRADA_STATUS[r.status]}
              </span>
            </div>
            <ul className="divide-y divide-vera-50">
              {r.trajes.map((t) => (
                <li
                  key={t.trajeLocadoId}
                  className="p-4 flex flex-wrap gap-4 items-start"
                >
                  <div className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
                    {t.fotoUrl ? (
                      <img
                        src={t.fotoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 px-1 text-center">
                        Sem foto
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {t.nome}{" "}
                      <span className="text-slate-500 font-normal">
                        ({t.codigo})
                      </span>
                    </p>
                    <span className="mt-1 flex flex-wrap gap-1.5 items-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeClassTrajeLocadoComContexto(
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
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeClassPrecisaAjuste()}`}
                        >
                          Ajuste pendente
                        </span>
                      )}
                    </span>
                    <p className="text-xs text-slate-500 mt-2">
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
