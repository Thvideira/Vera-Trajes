import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, apiGet, apiSend } from "../lib/api";
import { confirmAsync, showPopup } from "../contexts/PopupContext";

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
  /** Enviado pelo backend; fallback = total − pago */
  valorRestante?: string;
  cliente: { nome: string };
  retiradas: { dataRetirada: string }[];
};

function restantePendente(p: Pend): number {
  if (p.valorRestante != null && p.valorRestante !== "") {
    const n = Number(p.valorRestante);
    if (Number.isFinite(n)) return n;
  }
  return Number(p.valorTotal) - Number(p.valorPago);
}

type HistRow = {
  pagamentoId: string;
  dividaId: string;
  clienteNome: string;
  valorPago: string;
  dataPagamento: string;
  tipoRegistro: string;
  situacaoDividaAposPagamento: string;
};

function labelPagamentoLocacao(s: string): string {
  switch (s) {
    case "PAGO":
      return "Pago";
    case "PARCIAL":
      return "Parcial";
    case "PENDENTE":
      return "Pendente";
    default:
      return s;
  }
}

function badgePagamentoLocacao(s: string): string {
  switch (s) {
    case "PAGO":
      return "inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-900 border border-emerald-200";
    case "PARCIAL":
      return "inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-950 border border-amber-200";
    default:
      return "inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200";
  }
}

function labelTipoRegistro(t: string): string {
  switch (t) {
    case "SINAL":
      return "Sinal";
    case "PARCIAL":
      return "Parcial";
    case "FINAL":
      return "Quitação";
    default:
      return t;
  }
}

export function FinanceiroPage() {
  const navigate = useNavigate();
  const [rel, setRel] = useState<Rel | null>(null);
  const [pend, setPend] = useState<Pend[]>([]);
  const [hist, setHist] = useState<HistRow[]>([]);
  const [aba, setAba] = useState<"pendentes" | "historico">("pendentes");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [registrarPara, setRegistrarPara] = useState<Pend | null>(null);
  const [valorPagamento, setValorPagamento] = useState("");
  const [enviandoPagamento, setEnviandoPagamento] = useState(false);

  async function loadRel(e?: FormEvent) {
    e?.preventDefault();
    const p = new URLSearchParams();
    if (ini) p.set("inicio", new Date(ini).toISOString());
    if (fim) p.set("fim", new Date(fim).toISOString());
    const r = await apiGet<Rel>(`/api/locacoes/relatorio?${p.toString()}`);
    setRel(r);
  }

  const loadPend = useCallback(async () => {
    const rows = await apiGet<Pend[]>("/api/locacoes/pagamentos-pendentes");
    setPend(rows);
  }, []);

  const loadHistorico = useCallback(async () => {
    const rows = await apiGet<HistRow[]>("/api/pagamentos/historico");
    setHist(rows);
  }, []);

  useEffect(() => {
    void loadRel();
    void loadPend();
  }, [loadPend]);

  useEffect(() => {
    if (aba === "historico") void loadHistorico();
  }, [aba, loadHistorico]);

  async function recarregarTudo() {
    await Promise.all([loadRel(), loadPend(), loadHistorico()]);
  }

  function abrirRegistrar(p: Pend) {
    setRegistrarPara(p);
    setValorPagamento("");
  }

  function fecharRegistrar(force = false) {
    if (!force && enviandoPagamento) return;
    setRegistrarPara(null);
    setValorPagamento("");
  }

  async function confirmarRegistrarPagamento() {
    if (!registrarPara) return;
    const rest = restantePendente(registrarPara);
    const raw = valorPagamento.replace(",", ".").trim();
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) {
      showPopup({
        type: "warning",
        title: "Valor inválido",
        message: "Informe um valor maior que zero.",
        confirmText: "OK",
      });
      return;
    }
    const arred = Math.round(v * 100) / 100;
    if (arred > rest + 1e-6) {
      showPopup({
        type: "warning",
        title: "Valor acima do permitido",
        message: `O valor não pode ser maior que o restante (R$ ${rest.toFixed(2)}).`,
        confirmText: "OK",
      });
      return;
    }

    const ok = await confirmAsync({
      type: "info",
      title: "Confirmar pagamento",
      message: `Registrar pagamento de R$ ${arred.toFixed(2)} para ${registrarPara.cliente.nome}?`,
      confirmText: "Registrar",
      cancelText: "Cancelar",
      danger: false,
      closeOnBackdrop: false,
      closeOnEscape: false,
    });
    if (!ok) return;

    setEnviandoPagamento(true);
    try {
      await apiSend(`/api/pagamentos/${registrarPara.id}/registrar`, "POST", {
        valor_pago: arred,
      });
      showPopup({
        type: "success",
        title: "Sucesso",
        message: "Pagamento registrado com sucesso!",
        confirmText: "OK",
        autoCloseMs: 3200,
      });
      fecharRegistrar(true);
      await recarregarTudo();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Erro ao registrar pagamento";
      showPopup({
        type: "error",
        title: "Erro",
        message: msg,
        confirmText: "OK",
      });
    } finally {
      setEnviandoPagamento(false);
    }
  }

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

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2 border-b border-vera-100 pb-2">
          <button
            type="button"
            onClick={() => setAba("pendentes")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              aba === "pendentes"
                ? "bg-vera-500 text-white shadow-md"
                : "bg-white text-slate-700 border border-vera-100 hover:bg-vera-50"
            }`}
          >
            Pagamentos pendentes
          </button>
          <button
            type="button"
            onClick={() => setAba("historico")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              aba === "historico"
                ? "bg-vera-500 text-white shadow-md"
                : "bg-white text-slate-700 border border-vera-100 hover:bg-vera-50"
            }`}
          >
            Histórico de pagamentos
          </button>
        </div>

        {aba === "pendentes" ? (
          <>
            <h2 className="font-medium mb-1">Pagamentos pendentes</h2>
            <p className="text-sm text-slate-600 mb-3">
              Inclui locações <strong>encerradas</strong> que ainda têm saldo a receber (destacadas
              abaixo). Use <strong>Registrar pagamento</strong> para quitações parciais ou totais.{" "}
              <span className="text-slate-500">Clique na linha (exceto no botão) para o detalhe.</span>
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
                    <th className="p-3 w-[1%]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pend.map((p) => {
                    const rest = restantePendente(p);
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
                          <span className="block text-xs mt-1">
                            <span className={badgePagamentoLocacao(p.statusPagamento)}>
                              {labelPagamentoLocacao(p.statusPagamento)}
                            </span>
                          </span>
                        </td>
                        <td className="p-3">{p.cliente.nome}</td>
                        <td className="p-3">{prox}</td>
                        <td className="p-3 tabular-nums">
                          R$ {Number(p.valorTotal).toFixed(2)}
                        </td>
                        <td className="p-3 tabular-nums">
                          R$ {Number(p.valorPago).toFixed(2)}
                        </td>
                        <td className="p-3 font-medium tabular-nums">
                          R$ {rest.toFixed(2)}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            className="btn-primary text-xs whitespace-nowrap"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirRegistrar(p);
                            }}
                          >
                            Registrar pagamento
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-medium mb-1">Histórico de pagamentos</h2>
            <p className="text-sm text-slate-600 mb-3">
              Registros de valores recebidos por locação, com a situação do pagamento após cada
              lançamento.
            </p>
            <button
              type="button"
              onClick={() => void loadHistorico()}
              className="mb-2 text-sm underline"
            >
              Recarregar histórico
            </button>
            <div className="overflow-x-auto rounded-xl border border-vera-100 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="p-3">Data</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Valor pago</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Situação da dívida (após)</th>
                  </tr>
                </thead>
                <tbody>
                  {hist.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">
                        Nenhum pagamento registrado ainda.
                      </td>
                    </tr>
                  ) : (
                    hist.map((h) => (
                      <tr key={h.pagamentoId} className="border-b border-slate-100">
                        <td className="p-3 whitespace-nowrap">
                          {new Date(h.dataPagamento).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3">{h.clienteNome}</td>
                        <td className="p-3 font-medium tabular-nums">
                          R$ {Number(h.valorPago).toFixed(2)}
                        </td>
                        <td className="p-3 text-slate-600">
                          {labelTipoRegistro(h.tipoRegistro)}
                        </td>
                        <td className="p-3">
                          <span
                            className={badgePagamentoLocacao(
                              h.situacaoDividaAposPagamento
                            )}
                          >
                            {labelPagamentoLocacao(h.situacaoDividaAposPagamento)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {registrarPara && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) fecharRegistrar();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reg-pag-title"
            className="w-full max-w-md rounded-2xl border border-vera-100 bg-white p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="reg-pag-title" className="text-lg font-semibold text-slate-900">
              Registrar pagamento
            </h2>
            <p className="text-sm text-slate-600 mt-1">{registrarPara.cliente.nome}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Valor total</dt>
                <dd className="font-medium tabular-nums">
                  R$ {Number(registrarPara.valorTotal).toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Já pago</dt>
                <dd className="font-medium tabular-nums">
                  R$ {Number(registrarPara.valorPago).toFixed(2)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Restante</dt>
                <dd className="font-semibold text-amber-900 tabular-nums">
                  R$ {restantePendente(registrarPara).toFixed(2)}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <label htmlFor="valor-pagamento" className="block text-sm font-medium text-slate-700 mb-1">
                Valor deste pagamento (R$)
              </label>
              <input
                id="valor-pagamento"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="input-field"
                placeholder="0,00"
                value={valorPagamento}
                onChange={(e) => setValorPagamento(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">
                Máximo: R$ {restantePendente(registrarPara).toFixed(2)} — use ponto ou vírgula
                como decimal.
              </p>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-secondary"
                disabled={enviandoPagamento}
                onClick={() => fecharRegistrar()}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={enviandoPagamento}
                onClick={() => void confirmarRegistrarPagamento()}
              >
                {enviandoPagamento ? "Registrando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
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
