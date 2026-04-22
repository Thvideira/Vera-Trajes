import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { showPopup } from "../contexts/PopupContext";
import {
  coalesceItensDescritivosFromLocacao,
  formatarResumoAcessoriosLocacao,
  isAcessorioIdPersistidoNoServidor,
} from "../lib/acessoriosLocacao";
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

/** Peças sem código na locação (gravata, cinto, etc.). */
export type LocacaoItemDescritivo = {
  id: string;
  descricao: string;
  quantidade: number;
  variacao: string | null;
  observacao: string | null;
  separado: boolean;
};

export type LinhaItemDescritivoForm = {
  id?: string;
  descricao: string;
  quantidade: number;
  variacao: string;
  observacao: string;
  separado: boolean;
};

function linhaItemDescritivoVazia(): LinhaItemDescritivoForm {
  return {
    descricao: "",
    quantidade: 1,
    variacao: "",
    observacao: "",
    separado: false,
  };
}

type LocacaoRow = {
  id: string;
  dataAluguel: string;
  dataEvento: string | null;
  encerrada: boolean;
  valorTotal: string;
  valorPago: string;
  cliente: { nome: string };
  retiradas: Retirada[];
  itensDescritivos?: LocacaoItemDescritivo[];
  resumoAcessorios?: string | null;
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
        className={`shrink-0 rounded-lg border border-line bg-hover-gray overflow-hidden ${sizeClass} flex items-center justify-center ${
          clickable ? "cursor-zoom-in hover:ring-2 hover:ring-primary/35" : "cursor-default"
        }`}
        aria-label={clickable ? `Ampliar foto de ${nome}` : undefined}
      >
        {fotoUrl ? (
          <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] text-muted px-1 text-center">Sem foto</span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">
          {nome}{" "}
          <span className="text-muted font-normal">({codigo})</span>
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5 items-center">
          <span
            className={`inline-flex ${badgeClassTrajeLocadoComContexto(
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
            <span className={`inline-flex ${badgeClassPrecisaAjuste()}`}>
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

const FILTRO_LOCACOES_SITUACAO_KEY = "lojavera.locacoes.filtroSituacao";

/** Primeira visita: "Em aberto"; depois: última escolha salva ("" | abertas | encerradas). */
function readStoredFiltroSituacaoLocacoes(): string {
  try {
    const raw = localStorage.getItem(FILTRO_LOCACOES_SITUACAO_KEY);
    if (raw === null) return "abertas";
    if (raw === "" || raw === "abertas" || raw === "encerradas") return raw;
  } catch {
    /* private mode / indisponível */
  }
  return "abertas";
}

function persistFiltroSituacaoLocacoes(value: string) {
  try {
    localStorage.setItem(FILTRO_LOCACOES_SITUACAO_KEY, value);
  } catch {
    /* ignore */
  }
}

export function LocacoesPage() {
  const [list, setList] = useState<LocacaoRow[]>([]);
  const [filtroEncerrada, setFiltroEncerrada] = useState(() =>
    readStoredFiltroSituacaoLocacoes()
  );
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
        setList(
          rows.map((r) => ({
            ...r,
            itensDescritivos: coalesceItensDescritivosFromLocacao(
              r as unknown as Record<string, unknown>
            ) as LocacaoItemDescritivo[],
          }))
        );
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
        <h1 className="text-2xl font-semibold text-foreground">Locações</h1>
        <p className="text-sm text-muted">Retiradas agrupadas por data</p>
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex gap-2 flex-wrap items-center">
          <label className="text-sm text-muted">Situação:</label>
          <select
            className="input-field w-auto max-w-[200px] py-2 text-sm"
            value={filtroEncerrada}
            onChange={(e) => {
              const v = e.target.value;
              setFiltroEncerrada(v);
              persistFiltroSituacaoLocacoes(v);
            }}
          >
            <option value="">Todas</option>
            <option value="abertas">Em aberto</option>
            <option value="encerradas">Encerradas</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm text-muted whitespace-nowrap">
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
        <p className="text-xs text-muted w-full sm:w-auto sm:max-w-md">
          Exibe locações cujo <strong>evento</strong> está na data escolhida (trajes
          dessas locações). Locações sem data de evento não aparecem com o filtro ativo.
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-md">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="table-head-row">
              <th>Cliente</th>
              <th>Aluguel</th>
              <th className="whitespace-nowrap">Evento</th>
              <th className="min-w-[220px]">Trajes</th>
              <th>Situação</th>
              <th>Total</th>
              <th></th>
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
                  <tr
                    key={l.id}
                    className="border-b border-line align-top transition-colors hover:bg-pink-soft"
                  >
                    <td className="p-3">{l.cliente.nome}</td>
                    <td className="p-3 whitespace-nowrap">
                      {new Date(l.dataAluguel).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-3 whitespace-nowrap text-foreground">
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
                          <span className="text-muted">—</span>
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
                        {(l.resumoAcessorios?.trim() ||
                          formatarResumoAcessoriosLocacao(l.itensDescritivos ?? [])) && (
                          <p className="text-xs text-muted mt-2 pt-2 border-t border-line/80">
                            {l.resumoAcessorios?.trim() ||
                              formatarResumoAcessoriosLocacao(l.itensDescritivos ?? [])}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {l.encerrada ? (
                        <span className="text-muted">Encerrada</span>
                      ) : (
                        <span className="text-success">Em aberto</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      R$ {Number(l.valorTotal).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <Link
                        to={`/locacoes/${l.id}`}
                        className="text-primary font-medium underline underline-offset-2 hover:text-primary-hover"
                      >
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
  const [itensDescritivos, setItensDescritivos] = useState([linhaItemDescritivoVazia()]);

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

  function addLinhaItemDescritivo() {
    setItensDescritivos((rows) => [...rows, linhaItemDescritivoVazia()]);
  }

  function removeLinhaItemDescritivo(index: number) {
    setItensDescritivos((rows) => {
      if (rows.length <= 1) return [linhaItemDescritivoVazia()];
      return rows.filter((_, i) => i !== index);
    });
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

      if (!form.dataEvento.trim()) {
        setErr(
          "Informe a data do evento. Ela é obrigatória e define o intervalo mínimo de 5 dias entre locações do mesmo traje."
        );
        return;
      }

      const trajeIds = [
        ...new Set(
          retiradas.flatMap((r) =>
            r.trajes.map((t) => t.trajeId.trim()).filter(Boolean)
          )
        ),
      ];
      if (trajeIds.length > 0) {
        const dataInicio = new Date(form.dataEvento);
        const intervalo = await apiSend<
          { ok: true } | { ok: false; message: string }
        >("/api/locacoes/validar-intervalo-trajes", "POST", {
          dataInicio: dataInicio.toISOString(),
          trajeIds,
        });
        if (!intervalo.ok) {
          setErr(intervalo.message);
          return;
        }
      }

      const payload = {
        clienteId: form.clienteId,
        observacoes: form.observacoes || undefined,
        dataEvento: form.dataEvento,
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
        itensDescritivos: itensDescritivos
          .filter((r) => r.descricao.trim())
          .map((r) => ({
            descricao: r.descricao.trim(),
            quantidade: Math.min(
              999,
              Math.max(1, Math.floor(Number(r.quantidade)) || 1)
            ),
            variacao: r.variacao.trim() || undefined,
            observacao: r.observacao.trim() || undefined,
            separado: r.separado,
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
      <h1 className="text-2xl font-semibold text-foreground">Nova locação</h1>
      <p className="text-sm text-muted">
        A data do aluguel é registrada automaticamente ao salvar.
      </p>
      <form
        onSubmit={onSubmit}
        className="space-y-4 bg-surface p-6 rounded-xl border border-line shadow-sm"
      >
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
            <label className="block text-sm font-medium mb-1">
              Data do evento <span className="text-red-600">*</span>
            </label>
            <input
              type="datetime-local"
              required
              className="w-full rounded-lg border px-3 py-2"
              value={form.dataEvento}
              onChange={(e) =>
                setForm((f) => ({ ...f, dataEvento: e.target.value }))
              }
            />
            <p className="text-xs text-muted mt-1">
              Obrigatória: sem ela não é possível alugar trajes; usada na regra dos 5 dias entre locações do mesmo traje.
            </p>
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

        <div className="space-y-4 border-t pt-4">
          <div className="rounded-xl border border-line bg-pink-soft/40 p-4 space-y-3">
            <div>
              <h2 className="font-medium text-foreground">
                Acessórios e peças sem código
              </h2>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Itens que <strong>não</strong> têm identificação individual no estoque (gravata,
                cinto, suspensório, etc.). Eles entram só como descrição nesta locação, separados
                dos trajes com código, que você informa nas retiradas abaixo.
              </p>
            </div>
            {itensDescritivos.map((row, idx) => (
              <div
                key={idx}
                className="grid gap-2 sm:grid-cols-12 border rounded-lg p-3 bg-surface items-end"
              >
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-muted mb-1">
                    O que é (tipo)
                  </label>
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Ex.: Gravata, Cinto"
                    value={row.descricao}
                    onChange={(e) => {
                      const v = e.target.value;
                      setItensDescritivos((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, descricao: v } : r))
                      );
                    }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-muted mb-1">
                    Qtd.
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    value={row.quantidade}
                    onChange={(e) => {
                      const n = Math.min(999, Math.max(1, Math.floor(Number(e.target.value)) || 1));
                      setItensDescritivos((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, quantidade: n } : r))
                      );
                    }}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-muted mb-1">
                    Cor / modelo / variante
                  </label>
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Ex.: preto, infantil"
                    value={row.variacao}
                    onChange={(e) => {
                      const v = e.target.value;
                      setItensDescritivos((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, variacao: v } : r))
                      );
                    }}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-muted mb-1">
                    Observação (opcional)
                  </label>
                  <div className="flex gap-2 items-end">
                    <input
                      className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm"
                      placeholder="Notas extras"
                      value={row.observacao}
                      onChange={(e) => {
                        const v = e.target.value;
                        setItensDescritivos((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, observacao: v } : r))
                        );
                      }}
                    />
                    {itensDescritivos.length > 1 && (
                      <button
                        type="button"
                        className="text-xs text-red-700 shrink-0 px-2 py-1.5 border border-red-200 rounded-lg hover:bg-red-50"
                        onClick={() => removeLinhaItemDescritivo(idx)}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-sm underline text-foreground"
              onClick={addLinhaItemDescritivo}
            >
              + Outro acessório
            </button>
          </div>
        </div>

        <div className="space-y-6 border-t pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start">
            <div>
              <span className="font-medium">Retiradas — trajes com código</span>
              {temRetiradaVaziaNoFormulario && (
                <p className="text-xs text-warning-fg mt-1">
                  Retirada sem data ou sem traje será ignorada ao salvar.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={addRetirada}
              className="text-sm text-foreground underline shrink-0"
            >
              + Outra retirada
            </button>
          </div>
          {retiradas.map((ret, ri) => (
            <div key={ri} className="border rounded-xl p-4 space-y-3 bg-hover-gray/70">
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
                <div key={ti} className="border rounded-lg p-3 bg-surface space-y-2">
                  <TrajePicker
                    incluirTrajesEmUso
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
  incluirTrajesEmUso = false,
}: {
  value: string;
  onChange: (id: string) => void;
  /** Lista também ALUGADO (nova locação / traje em locação encerrada). */
  incluirTrajesEmUso?: boolean;
}) {
  const [list, setList] = useState<Traje[]>([]);

  const loadList = useCallback(async () => {
    const path = incluirTrajesEmUso
      ? "/api/trajes"
      : "/api/trajes?status=DISPONIVEL";
    const rows = await apiGet<Traje[]>(path);
    setList(rows);
  }, [incluirTrajesEmUso]);

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
        className="w-full rounded-lg border border-line px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecione…</option>
        {list.map((t) => (
          <option key={t.id} value={t.id}>
            {t.codigo} — {t.nome}
            {t.status === "ALUGADO" ? " (em uso)" : ""}
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
  itensDescritivos: LocacaoItemDescritivo[];
  /** Texto já montado pelo backend (GET/PATCH). */
  resumoAcessorios?: string | null;
  retiradas: Retirada[];
};

export function LocacaoDetailPage({ id: idProp }: { id: string }) {
  const params = useParams<{ id: string }>();
  /** ID da locação na URL — fallback se a prop vier vazia (ex.: hot reload / rota). */
  const locacaoId = (idProp?.trim() || params.id?.trim() || "").trim();

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
  const [itensDescForm, setItensDescForm] = useState<LinhaItemDescritivoForm[]>([
    linhaItemDescritivoVazia(),
  ]);
  const [itensDescErr, setItensDescErr] = useState<string | null>(null);

  async function load() {
    if (!locacaoId) return;
    const row = (await apiGet(`/api/locacoes/${locacaoId}`)) as Record<string, unknown>;
    if (import.meta.env.DEV) {
      console.debug("[Locação] GET /api/locacoes/:id", row);
    }
    setLoc({
      ...(row as unknown as LocacaoDetalhe),
      itensDescritivos: coalesceItensDescritivosFromLocacao(row),
    });
  }

  useEffect(() => {
    if (!locacaoId) {
      setErr("ID da locação ausente na URL — não é possível carregar nem salvar acessórios.");
      return;
    }
    setErr(null);
    void load().catch((e: Error) => setErr(e.message));
  }, [locacaoId]);

  useEffect(() => {
    if (loc) console.log("Dados da locação:", loc);
  }, [loc]);

  useEffect(() => {
    if (!loc) return;
    setObservacoesEdit(loc.observacoes ?? "");
    const dr: Record<string, string> = {};
    for (const r of loc.retiradas) {
      dr[r.id] = toDatetimeLocalValue(r.dataRetirada);
    }
    setDataRetiradaEdits(dr);
    const idsc = loc.itensDescritivos ?? [];
    setItensDescForm(
      idsc.length > 0
        ? idsc.map((i) => ({
            id: i.id,
            descricao: i.descricao,
            quantidade: i.quantidade ?? 1,
            variacao: i.variacao ?? "",
            observacao: i.observacao ?? "",
            separado: i.separado ?? false,
          }))
        : [linhaItemDescritivoVazia()]
    );
    setItensDescErr(null);
  }, [loc]);

  async function salvarItensDescritivos(e: FormEvent) {
    console.log("Botão salvar acessórios clicado");
    e.preventDefault();
    setItensDescErr(null);
    if (!locacaoId) {
      const msg =
        "locacaoId indefinido — verifique a URL (/locacoes/:id) e recarregue a página.";
      console.error("Payload bloqueado:", { locacaoId, idProp, paramsId: params.id });
      setItensDescErr(msg);
      return;
    }
    try {
      const acessorios = itensDescForm
        .filter((r) => r.descricao.trim())
        .map((r) => ({
          nome: r.descricao.trim(),
          quantidade: Math.min(
            999,
            Math.max(1, Math.floor(Number(r.quantidade)) || 1)
          ),
          variacao: r.variacao.trim() ? r.variacao.trim() : null,
          observacao: r.observacao.trim() ? r.observacao.trim() : null,
          separado: r.separado,
        }));
      const payload = { locacaoId, acessorios };
      console.log("Payload:", { locacaoId, acessorios });
      const resposta = await apiSend(`/api/locacoes/${locacaoId}`, "PATCH", payload);
      console.log("Resposta API:", resposta);
      await load();
      showPopup({
        type: "success",
        title: "Acessórios salvos",
        message: "Acessórios salvos com sucesso.",
        confirmText: "OK",
        autoCloseMs: 2400,
      });
    } catch (ex: unknown) {
      setItensDescErr(ex instanceof Error ? ex.message : "Erro ao salvar");
    }
  }

  async function setSeparadoEntregaItem(itemId: string, separado: boolean) {
    setItensDescErr(null);
    try {
      if (import.meta.env.DEV) {
        console.debug("[Locação] PATCH separado", { itemId, separado });
      }
      await apiSend(`/api/locacoes/${locacaoId}/itens-descritivos/${itemId}`, "PATCH", {
        separado,
      });
      await load();
    } catch (ex: unknown) {
      setItensDescErr(ex instanceof Error ? ex.message : "Erro ao atualizar");
    }
  }

  function addLinhaItemDescForm() {
    setItensDescForm((rows) => [...rows, linhaItemDescritivoVazia()]);
  }

  function removeLinhaItemDescForm(index: number) {
    setItensDescForm((rows) => {
      if (rows.length <= 1) return [linhaItemDescritivoVazia()];
      return rows.filter((_, i) => i !== index);
    });
  }

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
    await doAction(`/api/locacoes/${locacaoId}/pagamentos`, "POST", {
      valor: Number(payVal),
      tipo: payTipo,
    });
    setPayVal("");
  }

  async function salvarObservacoes(e: FormEvent) {
    e.preventDefault();
    await apiSend(`/api/locacoes/${locacaoId}`, "PATCH", {
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

  if (err) return <p className="text-red-600">{err}</p>;
  if (!loc) return <p>Carregando…</p>;

  const restante = Number(loc.valorTotal) - Number(loc.valorPago);
  const textoResumoAcessorios =
    (typeof loc.resumoAcessorios === "string" && loc.resumoAcessorios.trim().length > 0
      ? loc.resumoAcessorios.trim()
      : null) ?? formatarResumoAcessoriosLocacao(loc.itensDescritivos ?? []);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Locação</h1>
        <p className="text-muted">{loc.cliente.nome}</p>
        <p className="text-sm text-muted mt-1">
          Aluguel em{" "}
          {new Date(loc.dataAluguel).toLocaleString("pt-BR")}{" "}
          · {loc.encerrada ? "Encerrada" : "Em aberto"}
        </p>
        {textoResumoAcessorios ? (
          <p className="text-sm text-foreground mt-2 font-medium max-w-2xl">
            {textoResumoAcessorios}
          </p>
        ) : (
          <p className="text-sm text-muted mt-2">Sem acessórios.</p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-md">
          <p className="text-muted">Pagamento</p>
          <p className="font-medium">{loc.statusPagamento}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-md">
          <p className="text-muted">Valores</p>
          <p>Total: R$ {Number(loc.valorTotal).toFixed(2)}</p>
          <p>Pago: R$ {Number(loc.valorPago).toFixed(2)}</p>
          <p>Restante: R$ {restante.toFixed(2)}</p>
        </div>
      </div>

      {!loc.encerrada && (
        <form
          onSubmit={salvarObservacoes}
          className="rounded-2xl border border-line bg-surface p-4 shadow-md space-y-2"
        >
          <p className="font-medium text-foreground">Observações da locação</p>
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
          className="rounded-2xl border border-line bg-surface p-4 space-y-2 shadow-md"
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

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-md space-y-3">
        <h2 className="text-lg font-medium text-foreground">Acessórios (sem código)</h2>
        <p className="text-xs text-muted leading-relaxed">
          Estes itens não aparecem no cadastro de trajes e não têm código de barras. São só
          lembretes da locação (ex.: gravata azul). Os trajes identificados ficam na seção seguinte.
        </p>
        {loc.encerrada ? (
          (loc.itensDescritivos ?? []).length === 0 ? (
            <p className="text-sm text-muted">Nenhum acessório descritivo nesta locação.</p>
          ) : (
            <ul className="divide-y divide-line border border-line rounded-lg overflow-hidden">
              {(loc.itensDescritivos ?? []).map((i) => (
                <li key={i.id} className="p-3 text-sm bg-hover-gray/40 flex flex-wrap gap-2 justify-between items-start">
                  <div>
                    <span className="font-medium">
                      {(i.quantidade ?? 1) > 1 ? `${i.quantidade}× ` : ""}
                      {i.descricao}
                    </span>
                    {i.variacao ? (
                      <span className="text-muted"> · {i.variacao}</span>
                    ) : null}
                    {i.observacao ? (
                      <p className="text-xs text-muted mt-1">{i.observacao}</p>
                    ) : null}
                  </div>
                  {i.separado ? (
                    <span className="text-xs shrink-0 px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">
                      Separado p/ entrega
                    </span>
                  ) : (
                    <span className="text-xs shrink-0 text-muted">Não separado</span>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : (
          <form onSubmit={salvarItensDescritivos} className="space-y-3">
            {itensDescForm.map((row, idx) => (
              <div
                key={row.id ?? `new-${idx}`}
                className="grid gap-2 sm:grid-cols-12 border rounded-lg p-3 bg-hover-gray/50 items-end"
              >
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-muted mb-1">
                    Tipo / nome
                  </label>
                  <input
                    className="input-field text-sm"
                    placeholder="Ex.: Gravata"
                    value={row.descricao}
                    onChange={(e) => {
                      const v = e.target.value;
                      setItensDescForm((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, descricao: v } : r))
                      );
                    }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-muted mb-1">Qtd.</label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    className="input-field text-sm"
                    value={row.quantidade}
                    onChange={(e) => {
                      const n = Math.min(
                        999,
                        Math.max(1, Math.floor(Number(e.target.value)) || 1)
                      );
                      setItensDescForm((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, quantidade: n } : r))
                      );
                    }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-muted mb-1">
                    Cor / variante
                  </label>
                  <input
                    className="input-field text-sm"
                    placeholder="Ex.: preto"
                    value={row.variacao}
                    onChange={(e) => {
                      const v = e.target.value;
                      setItensDescForm((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, variacao: v } : r))
                      );
                    }}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-muted mb-1">Observação</label>
                  <input
                    className="input-field text-sm w-full"
                    value={row.observacao}
                    onChange={(e) => {
                      const v = e.target.value;
                      setItensDescForm((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, observacao: v } : r))
                      );
                    }}
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-line"
                      checked={row.separado}
                      title={
                        isAcessorioIdPersistidoNoServidor(row.id)
                          ? "Atualiza na hora no servidor"
                          : "Será gravado ao clicar em Salvar lista de acessórios"
                      }
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (isAcessorioIdPersistidoNoServidor(row.id)) {
                          void setSeparadoEntregaItem(row.id!, checked);
                        } else {
                          setItensDescForm((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, separado: checked } : r))
                          );
                        }
                      }}
                    />
                    <span className={row.separado ? "text-green-700 font-medium" : "text-muted"}>
                      Separado p/ entrega
                    </span>
                  </label>
                  {itensDescForm.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-red-700 px-2 py-1 border border-red-200 rounded-lg self-start"
                      onClick={() => removeLinhaItemDescForm(idx)}
                    >
                      Remover linha
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 items-center">
              <button type="button" className="text-sm underline" onClick={addLinhaItemDescForm}>
                + Linha
              </button>
              <button type="submit" className="btn-secondary text-sm">
                Salvar lista de acessórios
              </button>
            </div>
            {itensDescErr && (
              <p className="text-sm text-red-600">{itensDescErr}</p>
            )}
          </form>
        )}
      </section>

      {textoResumoAcessorios ? (
        <p className="text-sm text-foreground -mt-4 max-w-2xl border-l-4 border-primary/40 pl-3 py-1">
          <span className="text-muted font-normal">Resumo do aluguel — </span>
          {textoResumoAcessorios}
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">Retiradas e trajes (com código)</h2>
        {loc.retiradas.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-line bg-surface overflow-hidden shadow-md"
          >
            <div className="px-4 py-2 bg-gradient-to-r from-pink-soft to-white border-b border-line flex flex-wrap justify-between gap-2">
              <span className="font-medium">
                Retirada: {new Date(r.dataRetirada).toLocaleString("pt-BR")}
              </span>
              <span className="text-sm text-muted">
                {LABEL_RETIRADA_STATUS[r.status]}
              </span>
            </div>
            {!loc.encerrada && (
              <div className="px-4 py-3 bg-pink-soft/50 border-b border-line space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted mb-1">
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
                <div className="pt-2 border-t border-line">
                  <p className="text-xs font-medium text-muted mb-2">
                    Incluir traje nesta retirada
                  </p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <TrajePicker
                        incluirTrajesEmUso
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
            <ul className="divide-y divide-line">
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
                    <p className="text-xs text-muted">
                      Lavagem: {tl.precisaLavagem ? tl.lavagemStatus : "Não aplicável"}{" "}
                      · Precisa lavagem: {tl.precisaLavagem ? "sim" : "não"}
                    </p>
                  </div>
                  <ul className="text-sm text-muted space-y-1">
                    {tl.ajustes.map((a) => (
                      <li key={a.id} className="flex flex-wrap gap-2 items-center">
                        <span>
                          {a.tipo}: {a.status}
                          {a.descricao ? ` — ${a.descricao}` : ""}
                        </span>
                        {a.status === "PENDENTE" && (
                          <button
                            type="button"
                            className="text-xs underline text-foreground"
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
                      {tl.status === "PRONTO" && tl.precisaAjuste && (
                        <button
                          type="button"
                          className="btn-chip"
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
                            className="btn-chip"
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
                            className="btn-chip"
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
                          className="btn-chip"
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
                          className="btn-chip"
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
                          className="btn-chip"
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
