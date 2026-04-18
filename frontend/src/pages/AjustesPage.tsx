import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AjustesList, type AjustePendenteItem } from "../components/AjustesList";
import { apiGet, apiSend } from "../lib/api";
import { LABEL_AJUSTE_TIPO, LABEL_TRAJE_LOCADO_STATUS } from "../types";

type Row = {
  id: string;
  tipo: keyof typeof LABEL_AJUSTE_TIPO;
  status: string;
  descricao?: string | null;
  trajeLocado: {
    id: string;
    status: string;
    traje: { codigo: string; nome: string };
    retirada: {
      id: string;
      dataRetirada: string;
      locacao: {
        id: string;
        cliente: { nome: string };
      };
    };
  };
};

function groupRowsByTrajeLocado(rows: Row[]): [string, Row[]][] {
  const m = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.trajeLocado.id;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return [...m.entries()].sort((a, b) => {
    const ca = a[1][0].trajeLocado.retirada.locacao.cliente.nome;
    const cb = b[1][0].trajeLocado.retirada.locacao.cliente.nome;
    const c = ca.localeCompare(cb, "pt-BR");
    if (c !== 0) return c;
    const ta = a[1][0].trajeLocado.traje.codigo;
    const tb = b[1][0].trajeLocado.traje.codigo;
    return ta.localeCompare(tb, "pt-BR");
  });
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${
        expanded ? "rotate-180" : ""
      }`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function AjustesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [expandedTrajeLocadoId, setExpandedTrajeLocadoId] = useState<
    string | null
  >(null);
  const [busyAjusteId, setBusyAjusteId] = useState<string | null>(null);

  const grupos = useMemo(() => groupRowsByTrajeLocado(rows), [rows]);

  const load = useCallback(async () => {
    const data = await apiGet<Row[]>("/api/ajustes/pendentes");
    setRows(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!expandedTrajeLocadoId) return;
    const ids = new Set(grupos.map(([id]) => id));
    if (!ids.has(expandedTrajeLocadoId)) {
      setExpandedTrajeLocadoId(null);
    }
  }, [grupos, expandedTrajeLocadoId]);

  async function concluir(ajusteId: string) {
    setBusyAjusteId(ajusteId);
    try {
      await apiSend(`/api/ajustes/${ajusteId}`, "PATCH", { status: "CONCLUIDO" });
      await load();
    } finally {
      setBusyAjusteId(null);
    }
  }

  function toggleExpand(trajeLocadoId: string) {
    setExpandedTrajeLocadoId((cur) =>
      cur === trajeLocadoId ? null : trajeLocadoId
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ajustes pendentes</h1>
        <p className="text-sm text-slate-600 mt-1">
          Uma linha por traje na locação. Expanda para ver e concluir cada ajuste.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-vera-100 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="p-3 w-10" aria-hidden />
              <th className="p-3">Cliente</th>
              <th className="p-3">Traje</th>
              <th className="p-3">Retirada</th>
              <th className="p-3">Status traje</th>
              <th className="p-3 text-center">Ajustes</th>
              <th className="p-3 w-[1%]" />
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-slate-500">
                  Nenhum ajuste pendente.
                </td>
              </tr>
            )}
            {grupos.map(([trajeLocadoId, lista]) => {
              const first = lista[0];
              const expanded = expandedTrajeLocadoId === trajeLocadoId;
              const ajustesItems: AjustePendenteItem[] = lista.map((r) => ({
                id: r.id,
                tipo: r.tipo,
                status: r.status,
                descricao: r.descricao,
              }));
              return (
                <Fragment key={trajeLocadoId}>
                  <tr
                    className={`border-b border-slate-100 transition-colors ${
                      expanded ? "bg-vera-50/60" : "hover:bg-vera-50/40"
                    }`}
                  >
                    <td className="p-2 align-middle">
                      <button
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-vera-100 transition-colors"
                        aria-expanded={expanded}
                        aria-label={
                          expanded ? "Recolher ajustes" : "Expandir ajustes"
                        }
                        onClick={() => toggleExpand(trajeLocadoId)}
                      >
                        <ChevronIcon expanded={expanded} />
                      </button>
                    </td>
                    <td className="p-3 align-middle font-medium text-slate-900">
                      {first.trajeLocado.retirada.locacao.cliente.nome}
                    </td>
                    <td className="p-3 align-middle">
                      <span className="text-slate-800">
                        {first.trajeLocado.traje.codigo}
                      </span>
                      <span className="text-slate-500"> — </span>
                      <span>{first.trajeLocado.traje.nome}</span>
                    </td>
                    <td className="p-3 align-middle whitespace-nowrap text-slate-700">
                      {new Date(
                        first.trajeLocado.retirada.dataRetirada
                      ).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 align-middle text-xs">
                      {LABEL_TRAJE_LOCADO_STATUS[
                        first.trajeLocado
                          .status as keyof typeof LABEL_TRAJE_LOCADO_STATUS
                      ] ?? first.trajeLocado.status}
                    </td>
                    <td className="p-3 align-middle text-center">
                      <span className="inline-flex min-w-[2rem] justify-center rounded-full bg-amber-100 text-amber-950 px-2 py-0.5 text-xs font-semibold tabular-nums">
                        {lista.length}
                      </span>
                    </td>
                    <td className="p-3 align-middle">
                      <button
                        type="button"
                        className="text-sm font-medium text-vera-700 hover:text-vera-900 underline-offset-2 hover:underline"
                        aria-expanded={expanded}
                        onClick={() => toggleExpand(trajeLocadoId)}
                      >
                        {expanded ? "Ocultar" : "Ver ajustes"}
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-vera-100 bg-vera-50/30">
                      <td colSpan={7} className="p-4 pt-2">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                          Ajustes deste traje
                        </p>
                        <AjustesList
                          ajustes={ajustesItems}
                          onConcluir={(id) => void concluir(id)}
                          busyId={busyAjusteId}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
