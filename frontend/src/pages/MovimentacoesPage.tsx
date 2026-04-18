import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

type Mov = {
  id: string;
  tipo: string;
  observacao?: string | null;
  createdAt: string;
  traje: { codigo: string; nome: string };
  locacao: { cliente: { nome: string } } | null;
};

export function MovimentacoesPage() {
  const [rows, setRows] = useState<Mov[]>([]);

  useEffect(() => {
    void apiGet<Mov[]>("/api/movimentacoes").then(setRows);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Movimentações</h1>
      <p className="text-sm text-slate-600">
        Histórico de saídas por aluguel e entradas por devolução.
      </p>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="p-3">Data</th>
              <th className="p-3">Traje</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Obs.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-slate-100">
                <td className="p-3 whitespace-nowrap">
                  {new Date(m.createdAt).toLocaleString("pt-BR")}
                </td>
                <td className="p-3">
                  {m.traje.codigo} — {m.traje.nome}
                </td>
                <td className="p-3">
                  {m.tipo === "SAIDA_ALUGUEL" ? "Saída (aluguel)" : "Entrada (devolução)"}
                </td>
                <td className="p-3">{m.locacao?.cliente.nome ?? "—"}</td>
                <td className="p-3 text-slate-600">{m.observacao ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
