import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { confirmAsync, showPopup } from "../contexts/PopupContext";
import { apiGet, apiSend } from "../lib/api";
import { subscribeTrajeCatalogLive } from "../lib/trajesCatalog";
import {
  LABEL_RETIRADA_STATUS,
  badgeClassPrecisaAjuste,
  badgeClassTrajeLocadoComContexto,
  exibirSegundoBadgeAjustePendente,
  labelTrajeLocadoComContexto,
  type TrajeLocadoStatus,
} from "../types";
import type { Cliente } from "./ClientesPage";
import type { Traje } from "./TrajesPage";

type TrajeLocado = {
  id: string;
  status: TrajeLocadoStatus;
  precisaAjuste: boolean;
  precisaLavagem: boolean;
  lavagemStatus: string;
  traje: Traje;
  ajustes: { id: string; tipo: string; status: string; descricao?: string | null }[];
};

type Retirada = {
  id: string;
  dataRetirada: string;
  status: keyof typeof LABEL_RETIRADA_STATUS;
  trajesLocados: TrajeLocado[];
};

type LocacaoRow = {
  id: string;
  dataAluguel: string;
  dataEvento: string | null;
  encerrada: boolean;
  valorTotal: string;
  valorPago: string;
  cliente: { nome: string };
  retiradas: Retirada[];
};

function FotoPreviewModal({
  url,
  alt,
  onClose,
}: {
  url: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <button
      type="button"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      aria-label="Fechar preview"
    >
      <img
        src={url}
        alt={alt}
        className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </button>
  );
}

function TrajeThumb({
  fotoUrl,
  nome,
  codigo,
  status,
  precisaAjuste,
  precisaLavagem,
  lavagemStatus,
  onOpenPreview,
  sizeClass = "h-20 w-20",
}: {
  fotoUrl?: string | null;
  nome: string;
  codigo: string;
  status: TrajeLocadoStatus;
  precisaAjuste?: boolean;
  precisaLavagem?: boolean;
  lavagemStatus?: string;
  onOpenPreview?: (url: string) => void;
  sizeClass?: string;
}) {
  const clickable = Boolean(fotoUrl && onOpenPreview);
  return (
    <div className="flex gap-3 items-start min-w-0">
      <button
        type="button"
        disabled={!clickable}
        onClick={() => fotoUrl && onOpenPreview?.(fotoUrl)}
        className={`shrink-0 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden ${sizeClass} flex items-center justify-center ${
          clickable ? "cursor-zoom-in hover:ring-2 hover:ring-slate-400" : "cursor-default"
        }`}
        aria-label={clickable ? `Ampliar foto de ${nome}` : undefined}
      >
        {fotoUrl ? (
          <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] text-slate-400 px-1 text-center">Sem foto</span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">
          {nome}{" "}
          <span className="text-slate-500 font-normal">({codigo})</span>
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5 items-center">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeClassTrajeLocadoComContexto(
              status,
              precisaAjuste,
              precisaLavagem,
              lavagemStatus
            )}`}
          >
            {labelTrajeLocadoComContexto(
              status,
              precisaAjuste,
              precisaLavagem,
              lavagemStatus
            )}
          </span>
          {exibirSegundoBadgeAjustePendente(status, precisaAjuste) ? (
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeClassPrecisaAjuste()}`}
            >
              Ajuste pendente
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function parseDataRetiradaInput(v: string): Date | null {
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

type LinhaTraje = {
  trajeId: string;
  precisaLavagem: boolean;
  ajustes: { tipo: string; descricao?: string }[];
};

type LinhaRetirada = { dataRetirada: string; trajes: LinhaTraje[] };

function retiradaLinhaEstaVazia(r: LinhaRetirada): boolean {
  const dataOk = parseDataRetiradaInput(r.dataRetirada);
  const trajesComId = r.trajes.filter((t) => t.trajeId.trim().length > 0);
  return !dataOk || trajesComId.length === 0;
}

/** Valor para input datetime-local a partir de ISO */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LocacoesPage() {
  const [list, setList] = useState<LocacaoRow[]>([]);
  const [filtroEncerrada, setFiltroEncerrada] = useState<string>("");
  /** YYYY-MM-DD — filtra pela data do evento cadastrada na locação */
  const [filtroDataEvento, setFiltroDataEvento] = useState("");
  const [loading, setLoading] = useState(true);
  const [fotoModal, setFotoModal] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const p = new URLSearchParams();
      if (filtroEncerrada === "abertas") p.set("encerrada", "false");
      if (filtroEncerrada === "encerradas") p.set("encerrada", "true");
      if (filtroDataEvento.trim()) p.set("dataEvento", filtroDataEvento.trim());
      const rows = await apiGet<LocacaoRow[]>(`/api/locacoes?${p.toString()}`);
      if (!cancelled) {
        setList(rows);
        setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [filtroEncerrada, filtroDataEvento]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Locações</h1>
        <p className="text-sm text-slate-600">Retiradas agrupadas por data</p>
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex gap-2 flex-wrap items-center">
          <label className="text-sm text-slate-600">Situação:</label>
          <select
            className="input-field w-auto max-w-[200px] py-2 text-sm"
            value={filtroEncerrada}
            onChange={(e) => setFiltroEncerrada(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="abertas">Em aberto</option>
            <option value="encerradas">Encerradas</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm text-slate-600 whitespace-nowrap">
            Data do evento:
          </label>
          <input
            type="date"
            className="input-field w-auto py-2 text-sm"
            value={filtroDataEvento}
            onChange={(e) => setFiltroDataEvento(e.target.value)}
          />
          {filtroDataEvento && (
            <button
              type="button"
              className="btn-secondary text-xs py-1.5 px-2"
              onClick={() => setFiltroDataEvento("")}
            >
              Limpar
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 w-full sm:w-auto sm:max-w-md">
          Exibe locações cujo <strong>evento</strong> está na data escolhida (trajes
          dessas locações). Locações sem data de evento não aparecem com o filtro ativo.
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-vera-100 bg-white shadow-md">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="p-3">Cliente</th>
              <th className="p-3">Aluguel</th>
              <th className="p-3 whitespace-nowrap">Evento</th>
              <th className="p-3 min-w-[220px]">Trajes</th>
              <th className="p-3">Situação</th>
              <th className="p-3">Total</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-4">
                  Carregando…
                </td>
              </tr>
            ) : (
              list.map((l) => {
                const trajesFlat = (l.retiradas ?? []).flatMap((r) => r.trajesLocados);
                return (
                  <tr key={l.id} className="border-b border-slate-100 align-top">
                    <td className="p-3">{l.cliente.nome}</td>
                    <td className="p-3 whitespace-nowrap">
                      {new Date(l.dataAluguel).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-3 whitespace-nowrap text-slate-700">
                      {l.dataEvento
                        ? new Date(l.dataEvento).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="p-3">
                      <div className="space-y-3 max-w-md">
                        {trajesFlat.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          trajesFlat.map((tl) => (
                            <TrajeThumb
                              key={tl.id}
                              fotoUrl={tl.traje.fotoUrl}
                              nome={tl.traje.nome}
                              codigo={tl.traje.codigo}
                              status={tl.status}
                              precisaAjuste={tl.precisaAjuste}
                              precisaLavagem={tl.precisaLavagem}
                              lavagemStatus={tl.lavagemStatus}
                              onOpenPreview={setFotoModal}
                            />
                          ))
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {l.encerrada ? (
                        <span className="text-slate-500">Encerrada</span>
                      ) : (
                        <span className="text-emerald-700">Em aberto</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      R$ {Number(l.valorTotal).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <Link to={`/locacoes/${l.id}`} className="underline">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {fotoModal && (
        <FotoPreviewModal
          url={fotoModal}
          alt=""
          onClose={() => setFotoModal(null)}
        />
      )}
    </div>
  );
}

export function LocacaoNovaPage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    clienteId: "",
    observacoes: "",
    dataEvento: "",
    dataDevolucaoPrevista: "",
    valorTotal: "",
    valorPagoInicial: "0",
  });
  const [retiradas, setRetiradas] = useState<LinhaRetirada[]>([
    { dataRetirada: "", trajes: [{ trajeId: "", precisaLavagem: true, ajustes: [] }] },
  ]);

  useEffect(() => {
    void apiGet<Cliente[]>("/api/clientes").then(setClientes);
  }, []);

  function addRetirada() {
    setRetiradas((r) => [
      ...r,
      {
        dataRetirada: "",
        trajes: [{ trajeId: "", precisaLavagem: true, ajustes: [] }],
      },
    ]);
  }

  function addTraje(ri: number) {
    setRetiradas((rows) =>
      rows.map((row, i) =>
        i === ri
          ? {
              ...row,
              trajes: [
                ...row.trajes,
                { trajeId: "", precisaLavagem: true, ajustes: [] },
              ],
            }
          : row
      )
    );
  }

  function addAjuste(ri: number, ti: number) {
    setRetiradas((rows) =>
      rows.map((row, i) =>
        i === ri
          ? {
              ...row,
              trajes: row.trajes.map((t, j) =>
                j === ti
                  ? { ...t, ajustes: [...t.ajustes, { tipo: "BARRA" }] }
                  : t
              ),
            }
          : row
      )
    );
  }

  function removeRetirada(ri: number) {
    if (retiradas.length <= 1) return;
    setRetiradas((rows) => rows.filter((_, i) => i !== ri));
  }

  function removeTraje(ri: number, ti: number) {
    setRetiradas((rows) =>
      rows.map((row, i) => {
        if (i !== ri) return row;
        if (row.trajes.length <= 1) {
          return {
            ...row,
            trajes: [{ trajeId: "", precisaLavagem: true, ajustes: [] }],
          };
        }
        return { ...row, trajes: row.trajes.filter((_, j) => j !== ti) };
      })
    );
  }

  const temRetiradaVaziaNoFormulario = retiradas.some((r) =>
    retiradaLinhaEstaVazia(r)
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const algumaRetiradaValida = retiradas.some((r) => !retiradaLinhaEstaVazia(r));
      if (!algumaRetiradaValida) {
        setErr(
          "Inclua ao menos uma retirada com data de retirada e ao menos um traje."
        );
        return;
      }

      const payload = {
        clienteId: form.clienteId,
        observacoes: form.observacoes || undefined,
        dataEvento: form.dataEvento || undefined,
        dataDevolucaoPrevista: form.dataDevolucaoPrevista || undefined,
        valorTotal: Number(form.valorTotal),
        valorPagoInicial: Number(form.valorPagoInicial || 0),
        retiradas: retiradas.map((r) => ({
          dataRetirada: r.dataRetirada || undefined,
          trajes: r.trajes.map((t) => ({
            trajeId: t.trajeId.trim() || undefined,
            precisaLavagem: t.precisaLavagem,
            ajustes: t.ajustes.length ? t.ajustes : undefined,
          })),
        })),
      };
      await apiSend("/api/locacoes", "POST", payload);
      showPopup({
        type: "success",
        title: "Sucesso",
        message: "Operação realizada com sucesso!",
        confirmText: "OK",
        autoCloseMs: 2800,
        onDismiss: () => navigate("/locacoes", { replace: true }),
      });
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Erro");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Nova locação</h1>
      <p className="text-sm text-slate-600">
        A data do aluguel é registrada automaticamente ao salvar.
      </p>
      <form onSubmit={onSubmit} className="space-y-4 bg-white p-6 rounded-xl border">
        <div>
          <label className="block text-sm font-medium mb-1">Cliente</label>
          <select
            required
            className="w-full rounded-lg border px-3 py-2"
            value={form.clienteId}
            onChange={(e) =>
              setForm((f) => ({ ...f, clienteId: e.target.value }))
            }
          >
            <option value="">Selecione…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Observações</label>
          <textarea
            className="w-full rounded-lg border px-3 py-2 text-sm"
            rows={2}
            value={form.observacoes}
            onChange={(e) =>
              setForm((f) => ({ ...f, observacoes: e.target.value }))
            }
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Evento (opcional)</label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border px-3 py-2"
              value={form.dataEvento}
              onChange={(e) =>
                setForm((f) => ({ ...f, dataEvento: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Devolução prevista (opcional)
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border px-3 py-2"
              value={form.dataDevolucaoPrevista}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  dataDevolucaoPrevista: e.target.value,
                }))
              }
            />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Valor total</label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-lg border px-3 py-2"
              value={form.valorTotal}
              onChange={(e) =>
                setForm((f) => ({ ...f, valorTotal: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Valor pago (sinal)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-lg border px-3 py-2"
              value={form.valorPagoInicial}
              onChange={(e) =>
                setForm((f) => ({ ...f, valorPagoInicial: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="space-y-6 border-t pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start">
            <div>
              <span className="font-medium">Retiradas</span>
              {temRetiradaVaziaNoFormulario && (
                <p className="text-xs text-amber-700 mt-1">
                  Retirada sem data ou sem traje será ignorada ao salvar.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={addRetirada}
              className="text-sm text-slate-900 underline shrink-0"
            >
              + Outra retirada
            </button>
          </div>
          {retiradas.map((ret, ri) => (
            <div key={ri} className="border rounded-xl p-4 space-y-3 bg-slate-50/50">
              <div className="flex flex-wrap justify-between gap-2 items-start">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium mb-1">
                    Data / hora de retirada
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border px-3 py-2"
                    value={ret.dataRetirada}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRetiradas((rows) =>
                        rows.map((row, i) =>
                          i === ri ? { ...row, dataRetirada: v } : row
                        )
                      );
                    }}
                  />
                </div>
                {retiradas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRetirada(ri)}
                    className="text-sm text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50"
                  >
                    Remover retirada
                  </button>
                )}
              </div>
              {ret.trajes.map((tr, ti) => (
                <div key={ti} className="border rounded-lg p-3 bg-white space-y-2">
                  <TrajePicker
                    value={tr.trajeId}
                    onChange={(id) =>
                      setRetiradas((rows) =>
                        rows.map((row, i) =>
                          i === ri
                            ? {
                                ...row,
                                trajes: row.trajes.map((t, j) =>
                                  j === ti ? { ...t, trajeId: id } : t
                                ),
                              }
                            : row
                        )
                      )
                    }
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={tr.precisaLavagem}
                      onChange={(e) =>
                        setRetiradas((rows) =>
                          rows.map((row, i) =>
                            i === ri
                              ? {
                                  ...row,
                                  trajes: row.trajes.map((t, j) =>
                                    j === ti
                                      ? { ...t, precisaLavagem: e.target.checked }
                                      : t
                                  ),
                                }
                              : row
                          )
                        )
                      }
                    />
                    Precisa lavagem / passador
                  </label>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => addAjuste(ri, ti)}
                  >
                    + Ajuste
                  </button>
                  {tr.ajustes.map((a, ai) => (
                    <div key={ai} className="flex gap-2 flex-wrap items-center">
                      <select
                        className="rounded border px-2 py-1 text-sm"
                        value={a.tipo}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRetiradas((rows) =>
                            rows.map((row, i) =>
                              i === ri
                                ? {
                                    ...row,
                                    trajes: row.trajes.map((t, j) =>
                                      j === ti
                                        ? {
                                            ...t,
                                            ajustes: t.ajustes.map((x, xi) =>
                                              xi === ai ? { ...x, tipo: v } : x
                                            ),
                                          }
                                        : t
                                    ),
                                  }
                                : row
                            )
                          );
                        }}
                      >
                        {["BARRA", "CINTURA", "COMPRIMENTO", "OUTROS"].map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                      <input
                        className="flex-1 min-w-[120px] rounded border px-2 py-1 text-sm"
                        placeholder="Descrição"
                        value={a.descricao ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRetiradas((rows) =>
                            rows.map((row, i) =>
                              i === ri
                                ? {
                                    ...row,
                                    trajes: row.trajes.map((t, j) =>
                                      j === ti
                                        ? {
                                            ...t,
                                            ajustes: t.ajustes.map((x, xi) =>
                                              xi === ai ? { ...x, descricao: v } : x
                                            ),
                                          }
                                        : t
                                    ),
                                  }
                                : row
                            )
                          );
                        }}
                      />
                    </div>
                  ))}
                  {ret.trajes.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-red-700 underline"
                      onClick={() => removeTraje(ri, ti)}
                    >
                      Remover traje
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="text-sm underline"
                onClick={() => addTraje(ri)}
              >
                + Traje nesta retirada
              </button>
            </div>
          ))}
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="submit" className="btn-primary">
          Registrar locação
        </button>
      </form>
    </div>
  );
}

export function TrajePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [list, setList] = useState<Traje[]>([]);

  const loadList = useCallback(async () => {
    const rows = await apiGet<Traje[]>("/api/trajes?status=DISPONIVEL");
    setList(rows);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    return subscribeTrajeCatalogLive(() => {
      void loadList();
    });
  }, [loadList]);

  return (
    <div>
      <label className="block text-sm font-medium mb-1">Traje</label>
      <select
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecione…</option>
        {list.map((t) => (
          <option key={t.id} value={t.id}>
            {t.codigo} — {t.nome}
          </option>
        ))}
      </select>
    </div>
  );
}

type LocacaoDetalhe = {
  id: string;
  dataAluguel: string;
  encerrada: boolean;
  observacoes: string | null;
  valorTotal: string;
  valorPago: string;
  statusPagamento: string;
  cliente: Cliente;
  retiradas: Retirada[];
};

export function LocacaoDetailPage({ id }: { id: string }) {
  const [loc, setLoc] = useState<LocacaoDetalhe | null>(null);
  const [payVal, setPayVal] = useState("");
  const [payTipo, setPayTipo] = useState("PARCIAL");
  const [err, setErr] = useState<string | null>(null);
  const [fotoModal, setFotoModal] = useState<string | null>(null);
  const [observacoesEdit, setObservacoesEdit] = useState("");
  const [dataRetiradaEdits, setDataRetiradaEdits] = useState<Record<string, string>>(
    {}
  );
  const [novoTrajeRetirada, setNovoTrajeRetirada] = useState<Record<string, string>>(
    {}
  );

  async function load() {
    const row = await apiGet<LocacaoDetalhe>(`/api/locacoes/${id}`);
    setLoc(row);
  }

  useEffect(() => {
    void load().catch((e: Error) => setErr(e.message));
  }, [id]);

  useEffect(() => {
    if (!loc) return;
    setObservacoesEdit(loc.observacoes ?? "");
    const dr: Record<string, string> = {};
    for (const r of loc.retiradas) {
      dr[r.id] = toDatetimeLocalValue(r.dataRetirada);
    }
    setDataRetiradaEdits(dr);
  }, [loc]);

  async function doAction(
    path: string,
    method: "POST" | "PATCH" = "POST",
    body?: unknown
  ) {
    await apiSend(path, method, body);
    await load();
  }

  async function concluirAjuste(ajusteId: string) {
    await doAction(`/api/ajustes/${ajusteId}`, "PATCH", { status: "CONCLUIDO" });
  }

  async function pagamento(e: FormEvent) {
    e.preventDefault();
    await doAction(`/api/locacoes/${id}/pagamentos`, "POST", {
      valor: Number(payVal),
      tipo: payTipo,
    });
    setPayVal("");
  }

  async function salvarObservacoes(e: FormEvent) {
    e.preventDefault();
    await apiSend(`/api/locacoes/${id}`, "PATCH", {
      observacoes: observacoesEdit.trim() ? observacoesEdit : null,
    });
    await load();
  }

  async function salvarDataRetirada(retiradaId: string) {
    const raw = dataRetiradaEdits[retiradaId];
    if (!raw?.trim()) return;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return;
    await apiSend(`/api/retiradas/${retiradaId}`, "PATCH", {
      dataRetirada: d.toISOString(),
    });
    await load();
  }

  async function adicionarTrajeNaRetirada(retiradaId: string) {
    const tid = (novoTrajeRetirada[retiradaId] ?? "").trim();
    if (!tid) return;
    await apiSend(`/api/retiradas/${retiradaId}/trajes`, "POST", {
      trajeId: tid,
      precisaLavagem: true,
    });
    setNovoTrajeRetirada((o) => ({ ...o, [retiradaId]: "" }));
    await load();
  }

  async function removerTrajeLocadoClick(trajeLocadoId: string) {
    const ok = await confirmAsync({
      type: "warning",
      title: "Remover traje",
      message:
        "Remover este traje desta retirada? O traje volta a ficar disponível.",
      confirmText: "Remover",
      cancelText: "Cancelar",
      danger: true,
      closeOnBackdrop: false,
      closeOnEscape: false,
    });
    if (!ok) return;
    await apiSend(`/api/trajes-locados/${trajeLocadoId}`, "DELETE");
    await load();
  }

  if (err) return <p className="text-red-600">{err}</p>;
  if (!loc) return <p>Carregando…</p>;

  const restante = Number(loc.valorTotal) - Number(loc.valorPago);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Locação</h1>
        <p className="text-slate-600">{loc.cliente.nome}</p>
        <p className="text-sm text-slate-500 mt-1">
          Aluguel em{" "}
          {new Date(loc.dataAluguel).toLocaleString("pt-BR")}{" "}
          · {loc.encerrada ? "Encerrada" : "Em aberto"}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <div className="rounded-2xl border border-vera-100 bg-white p-4 shadow-md">
          <p className="text-slate-500">Pagamento</p>
          <p className="font-medium">{loc.statusPagamento}</p>
        </div>
        <div className="rounded-2xl border border-vera-100 bg-white p-4 shadow-md">
          <p className="text-slate-500">Valores</p>
          <p>Total: R$ {Number(loc.valorTotal).toFixed(2)}</p>
          <p>Pago: R$ {Number(loc.valorPago).toFixed(2)}</p>
          <p>Restante: R$ {restante.toFixed(2)}</p>
        </div>
      </div>

      {!loc.encerrada && (
        <form
          onSubmit={salvarObservacoes}
          className="rounded-2xl border border-vera-100 bg-white p-4 shadow-md space-y-2"
        >
          <p className="font-medium text-slate-900">Observações da locação</p>
          <textarea
            className="input-field"
            rows={3}
            value={observacoesEdit}
            onChange={(e) => setObservacoesEdit(e.target.value)}
            placeholder="Notas internas…"
          />
          <button type="submit" className="btn-secondary text-sm">
            Salvar observações
          </button>
        </form>
      )}

      {!loc.encerrada && (
        <form
          onSubmit={pagamento}
          className="rounded-2xl border border-vera-100 bg-white p-4 space-y-2 shadow-md"
        >
          <p className="font-medium">Registrar pagamento</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              className="input-field max-w-[140px]"
              placeholder="Valor"
              value={payVal}
              onChange={(e) => setPayVal(e.target.value)}
            />
            <select
              className="input-field max-w-[140px]"
              value={payTipo}
              onChange={(e) => setPayTipo(e.target.value)}
            >
              <option value="SINAL">Sinal (ex.: 50%)</option>
              <option value="PARCIAL">Parcial</option>
              <option value="FINAL">Final</option>
            </select>
            <button type="submit" className="btn-primary text-sm">
              Registrar
            </button>
          </div>
        </form>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-slate-900">Retiradas e trajes</h2>
        {loc.retiradas.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-vera-100 bg-white overflow-hidden shadow-md"
          >
            <div className="px-4 py-2 bg-gradient-to-r from-vera-50 to-white border-b border-vera-100 flex flex-wrap justify-between gap-2">
              <span className="font-medium">
                Retirada: {new Date(r.dataRetirada).toLocaleString("pt-BR")}
              </span>
              <span className="text-sm text-slate-600">
                {LABEL_RETIRADA_STATUS[r.status]}
              </span>
            </div>
            {!loc.encerrada && (
              <div className="px-4 py-3 bg-vera-50/40 border-b border-vera-100 space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">
                    Alterar data / hora da retirada
                  </p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <input
                      type="datetime-local"
                      className="input-field max-w-[220px]"
                      value={dataRetiradaEdits[r.id] ?? ""}
                      onChange={(e) =>
                        setDataRetiradaEdits((prev) => ({
                          ...prev,
                          [r.id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => void salvarDataRetirada(r.id)}
                    >
                      Salvar data
                    </button>
                  </div>
                </div>
                <div className="pt-2 border-t border-vera-100">
                  <p className="text-xs font-medium text-slate-600 mb-2">
                    Incluir traje nesta retirada
                  </p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <TrajePicker
                        value={novoTrajeRetirada[r.id] ?? ""}
                        onChange={(trajeId) =>
                          setNovoTrajeRetirada((prev) => ({
                            ...prev,
                            [r.id]: trajeId,
                          }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      onClick={() => void adicionarTrajeNaRetirada(r.id)}
                    >
                      Adicionar traje
                    </button>
                  </div>
                </div>
              </div>
            )}
            <ul className="divide-y divide-vera-50">
              {r.trajesLocados.map((tl) => (
                <li key={tl.id} className="p-4 space-y-3">
                  <div className="space-y-2">
                    <TrajeThumb
                      fotoUrl={tl.traje.fotoUrl}
                      nome={tl.traje.nome}
                      codigo={tl.traje.codigo}
                      status={tl.status}
                      precisaAjuste={tl.precisaAjuste}
                      precisaLavagem={tl.precisaLavagem}
                      lavagemStatus={tl.lavagemStatus}
                      onOpenPreview={setFotoModal}
                    />
                    <p className="text-xs text-slate-500">
                      Lavagem: {tl.precisaLavagem ? tl.lavagemStatus : "Não aplicável"}{" "}
                      · Precisa lavagem: {tl.precisaLavagem ? "sim" : "não"}
                    </p>
                  </div>
                  <ul className="text-sm text-slate-600 space-y-1">
                    {tl.ajustes.map((a) => (
                      <li key={a.id} className="flex flex-wrap gap-2 items-center">
                        <span>
                          {a.tipo}: {a.status}
                          {a.descricao ? ` — ${a.descricao}` : ""}
                        </span>
                        {a.status === "PENDENTE" && (
                          <button
                            type="button"
                            className="text-xs underline text-slate-900"
                            onClick={() => void concluirAjuste(a.id)}
                          >
                            Concluir ajuste
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!loc.encerrada && (
                    <div className="flex flex-wrap gap-2">
                      {(tl.status === "PRONTO" || tl.status === "COSTUREIRA") && (
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => void removerTrajeLocadoClick(tl.id)}
                        >
                          Remover traje
                        </button>
                      )}
                      {tl.status === "PRONTO" && tl.precisaAjuste && (
                        <button
                          type="button"
                          className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-900"
                          onClick={() =>
                            void doAction(
                              `/api/trajes-locados/${tl.id}/costureira/encaminhar`,
                              "POST"
                            )
                          }
                        >
                          Enviar à costureira
                        </button>
                      )}
                      {tl.status === "LAVANDO" &&
                        tl.lavagemStatus === "PENDENTE" && (
                          <button
                            type="button"
                            className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1 text-xs"
                            onClick={() =>
                              void doAction(
                                `/api/trajes-locados/${tl.id}/lavagem/iniciar`,
                                "POST"
                              )
                            }
                          >
                            Iniciar lavagem
                          </button>
                        )}
                      {tl.status === "LAVANDO" &&
                        tl.lavagemStatus === "EM_ANDAMENTO" && (
                          <button
                            type="button"
                            className="rounded-lg border px-3 py-1 text-xs"
                            onClick={() =>
                              void doAction(
                                `/api/trajes-locados/${tl.id}/lavagem/concluir`,
                                "POST"
                              )
                            }
                          >
                            Lavagem feita
                          </button>
                        )}
                      {tl.status === "FALTA_PASSAR" && (
                        <button
                          type="button"
                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium"
                          onClick={() =>
                            void doAction(
                              `/api/trajes-locados/${tl.id}/marcar-pronto`,
                              "POST"
                            )
                          }
                        >
                          Passador OK — pronto para retirada
                        </button>
                      )}
                      {tl.status === "PRONTO" && !tl.precisaAjuste && (
                        <button
                          type="button"
                          className="rounded-lg border px-3 py-1 text-xs"
                          onClick={() =>
                            void doAction(`/api/trajes-locados/${tl.id}/retirado`, "POST")
                          }
                        >
                          Retirado
                        </button>
                      )}
                      {tl.status === "RETIRADO" && (
                        <button
                          type="button"
                          className="rounded-lg border px-3 py-1 text-xs"
                          onClick={() =>
                            void doAction(
                              `/api/trajes-locados/${tl.id}/finalizado`,
                              "POST"
                            )
                          }
                        >
                          Finalizar devolução
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {fotoModal && (
        <FotoPreviewModal
          url={fotoModal}
          alt=""
          onClose={() => setFotoModal(null)}
        />
      )}
    </div>
  );
}
