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
      <h1 className="text-2xl font-semibold text-foreground">Movimentações</h1>
      <p className="text-sm text-muted">
        Histórico de saídas por aluguel e entradas por devolução.
      </p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="table-head-row">
              <th>Data</th>
              <th>Traje</th>
              <th>Tipo</th>
              <th>Cliente</th>
              <th>Obs.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr
                key={m.id}
                className="border-b border-line transition-colors hover:bg-pink-soft"
              >
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
                <td className="p-3 text-muted">{m.observacao ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
