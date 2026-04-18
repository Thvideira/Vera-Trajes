import { useEffect, useState } from "react";
import { apiGet, apiSend } from "../lib/api";
import { LABEL_AJUSTE_TIPO, LABEL_TRAJE_LOCADO_STATUS } from "../types";

type Row = {
  id: string;
  tipo: keyof typeof LABEL_AJUSTE_TIPO;
  status: string;
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

export function AjustesPage() {
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const data = await apiGet<Row[]>("/api/ajustes/pendentes");
    setRows(data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function concluir(id: string) {
    await apiSend(`/api/ajustes/${id}`, "PATCH", { status: "CONCLUIDO" });
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Ajustes pendentes</h1>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="p-3">Cliente</th>
              <th className="p-3">Traje</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Retirada</th>
              <th className="p-3">Status traje</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-slate-500">
                  Nenhum ajuste pendente.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="p-3">
                  {r.trajeLocado.retirada.locacao.cliente.nome}
                </td>
                <td className="p-3">
                  {r.trajeLocado.traje.codigo} — {r.trajeLocado.traje.nome}
                </td>
                <td className="p-3">{LABEL_AJUSTE_TIPO[r.tipo]}</td>
                <td className="p-3 whitespace-nowrap">
                  {new Date(
                    r.trajeLocado.retirada.dataRetirada
                  ).toLocaleString("pt-BR")}
                </td>
                <td className="p-3 text-xs">
                  {LABEL_TRAJE_LOCADO_STATUS[
                    r.trajeLocado.status as keyof typeof LABEL_TRAJE_LOCADO_STATUS
                  ] ?? r.trajeLocado.status}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => void concluir(r.id)}
                    className="text-sm underline"
                  >
                    Concluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
