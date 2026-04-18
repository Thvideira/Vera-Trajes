import { LABEL_AJUSTE_TIPO } from "../types";

export type AjustePendenteItem = {
  id: string;
  tipo: keyof typeof LABEL_AJUSTE_TIPO;
  status: string;
  descricao?: string | null;
};

type Props = {
  ajustes: AjustePendenteItem[];
  onConcluir: (ajusteId: string) => void | Promise<void>;
  busyId?: string | null;
};

export function AjustesList({ ajustes, onConcluir, busyId }: Props) {
  if (ajustes.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-2">Nenhum ajuste neste grupo.</p>
    );
  }

  return (
    <ul className="divide-y divide-vera-100 border border-vera-100 rounded-xl overflow-hidden bg-vera-50/40">
      {ajustes.map((a) => (
        <li
          key={a.id}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-white"
        >
          <div className="min-w-0">
            <p className="font-medium text-slate-900">
              {LABEL_AJUSTE_TIPO[a.tipo]}
            </p>
            {a.descricao ? (
              <p className="text-xs text-slate-600 mt-0.5">{a.descricao}</p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busyId === a.id}
            onClick={() => void onConcluir(a.id)}
            className="btn-secondary text-xs shrink-0 self-start sm:self-center disabled:opacity-50"
          >
            {busyId === a.id ? "Salvando…" : "Concluir ajuste"}
          </button>
        </li>
      ))}
    </ul>
  );
}
