import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { DeleteTrajeConfirmModal } from "../components/DeleteTrajeConfirmModal";
import { ApiError, apiGet, apiSend, apiUploadFoto } from "../lib/api";
import { isAdminUser, isMobileUser } from "../lib/auth";
import {
  notifyTrajesCatalogChanged,
  subscribeTrajeCatalogLive,
} from "../lib/trajesCatalog";
import { LABEL_TRAJE_TIPO, type TrajeTipo } from "../types";

export type Traje = {
  id: string;
  nome: string;
  tipo: TrajeTipo;
  codigo: string;
  tamanho: string;
  status: "DISPONIVEL" | "ALUGADO";
  fotoUrl?: string | null;
};

export function TrajesPage() {
  const mobile = isMobileUser();
  const admin = isAdminUser();
  const [list, setList] = useState<Traje[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Traje | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const filterRef = useRef({ q: "", tipo: "" });
  filterRef.current = { q, tipo };

  const load = useCallback(async () => {
    setLoading(true);
    const { q: qv, tipo: tv } = filterRef.current;
    const params = new URLSearchParams();
    if (qv) params.set("q", qv);
    if (tv) params.set("tipo", tv);
    const rows = await apiGet<Traje[]>(`/api/trajes?${params.toString()}`);
    setList(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return subscribeTrajeCatalogLive(() => {
      void load();
    });
  }, [load]);

  async function confirmDeleteTraje(): Promise<void> {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await apiSend(`/api/trajes/${deleteTarget.id}`, "DELETE");
      notifyTrajesCatalogChanged();
      setDeleteTarget(null);
      await load();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Não foi possível excluir";
      window.alert(msg);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Trajes</h1>
          <p className="text-slate-600 text-sm">Estoque por código e tipo</p>
        </div>
        <Link
          to="/trajes/novo"
          className="inline-flex justify-center rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium"
        >
          Novo traje
        </Link>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm flex-1 min-w-[160px]"
          placeholder="Código ou nome"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {(Object.keys(LABEL_TRAJE_TIPO) as TrajeTipo[]).map((t) => (
            <option key={t} value={t}>
              {LABEL_TRAJE_TIPO[t]}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border px-4 py-2 text-sm">
          Filtrar
        </button>
      </form>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p>Carregando…</p>
        ) : (
          list.map((t) => {
            const cardShell =
              "rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col";
            const inner = (
              <>
                <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center">
                  {t.fotoUrl ? (
                    <img
                      src={t.fotoUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-slate-400 text-sm">Sem foto</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-medium">{t.nome}</p>
                  <p className="text-xs text-slate-500">
                    {t.codigo} · {LABEL_TRAJE_TIPO[t.tipo]} · {t.tamanho}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      t.status === "DISPONIVEL"
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {t.status === "DISPONIVEL" ? "Disponível" : "Alugado"}
                  </p>
                </div>
              </>
            );
            if (mobile) {
              return (
                <div key={t.id} className={cardShell}>
                  {inner}
                </div>
              );
            }
            return (
              <div
                key={t.id}
                className={
                  cardShell +
                  (admin ? "" : " hover:border-slate-400 transition")
                }
              >
                <Link
                  to={`/trajes/${t.id}`}
                  className="block flex-1 hover:bg-slate-50/50 transition"
                >
                  {inner}
                </Link>
                {admin ? (
                  <div className="p-2 border-t border-slate-100 flex justify-end bg-white">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                      Excluir
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <DeleteTrajeConfirmModal
        open={deleteTarget !== null}
        trajeLabel={
          deleteTarget
            ? `${deleteTarget.codigo} — ${deleteTarget.nome}`
            : ""
        }
        busy={deleteBusy}
        onCancel={() => !deleteBusy && setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteTraje()}
      />
    </div>
  );
}

export function TrajeFormPage({ id }: { id?: string }) {
  const navigate = useNavigate();
  const isNew = !id;
  const [loading, setLoading] = useState(!isNew);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoInputsKey, setFotoInputsKey] = useState(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    tipo: "VESTIDO" as TrajeTipo,
    codigo: "",
    tamanho: "",
  });

  function onFotoChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFotoFile(f);
      setPreview(URL.createObjectURL(f));
    }
  }

  useEffect(() => {
    if (!id) return;
    apiGet<Traje>(`/api/trajes/${id}`)
      .then((t) => {
        setForm({
          nome: t.nome,
          tipo: t.tipo,
          codigo: t.codigo,
          tamanho: t.tamanho,
        });
        if (t.fotoUrl) setPreview(t.fotoUrl);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccessMsg(null);
    try {
      let trajeId = id;
      if (isNew) {
        const created = await apiSend<Traje>("/api/trajes", "POST", form);
        trajeId = created.id;
      } else {
        await apiSend(`/api/trajes/${id}`, "PUT", form);
      }
      if (fotoFile && trajeId) {
        await apiUploadFoto(trajeId, fotoFile);
      }
      notifyTrajesCatalogChanged();
      if (isMobileUser() && isNew) {
        setForm({
          nome: "",
          tipo: "VESTIDO",
          codigo: "",
          tamanho: "",
        });
        setPreview(null);
        setFotoFile(null);
        setFotoInputsKey((k) => k + 1);
        setSuccessMsg("Traje cadastrado com sucesso! Você pode cadastrar outro.");
        return;
      }
      navigate("/trajes");
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Erro");
    }
  }

  async function removerFoto() {
    if (!id) return;
    await apiSend(`/api/trajes/${id}/foto`, "DELETE");
    setPreview(null);
  }

  async function confirmDeleteFromEdit(): Promise<void> {
    if (!id) return;
    setDeleteBusy(true);
    try {
      await apiSend(`/api/trajes/${id}`, "DELETE");
      notifyTrajesCatalogChanged();
      setDeleteModalOpen(false);
      navigate("/trajes");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Não foi possível excluir";
      window.alert(msg);
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading) return <p>Carregando…</p>;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">
        {isNew ? "Novo traje" : "Editar traje"}
      </h1>
      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>{successMsg}</span>
          <button
            type="button"
            className="text-emerald-800 underline shrink-0"
            onClick={() => setSuccessMsg(null)}
          >
            Fechar
          </button>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4 bg-white p-6 rounded-xl border">
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input
            required
            className="w-full rounded-lg border px-3 py-2"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tipo</label>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={form.tipo}
            onChange={(e) =>
              setForm((f) => ({ ...f, tipo: e.target.value as TrajeTipo }))
            }
          >
            {(Object.keys(LABEL_TRAJE_TIPO) as TrajeTipo[]).map((t) => (
              <option key={t} value={t}>
                {LABEL_TRAJE_TIPO[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Código único (ex: vestido01)
          </label>
          <input
            required
            className="w-full rounded-lg border px-3 py-2"
            value={form.codigo}
            onChange={(e) =>
              setForm((f) => ({ ...f, codigo: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tamanho</label>
          <input
            required
            className="w-full rounded-lg border px-3 py-2"
            value={form.tamanho}
            onChange={(e) =>
              setForm((f) => ({ ...f, tamanho: e.target.value }))
            }
          />
        </div>
        <div>
          <span className="block text-sm font-medium mb-1">Foto (JPG ou PNG)</span>
          <p className="text-xs text-slate-500 mb-2">
            No celular: use a câmera ou escolha da galeria. Formatos aceitos no
            servidor: JPG e PNG.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium hover:bg-slate-100">
              <input
                key={`cam-${fotoInputsKey}`}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={onFotoChange}
              />
              Tirar foto
            </label>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
              <input
                key={`gal-${fotoInputsKey}`}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={onFotoChange}
              />
              Galeria
            </label>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 px-4 py-2 text-xs text-slate-600 sm:ml-0">
              <input
                key={`desk-${fotoInputsKey}`}
                type="file"
                accept="image/jpeg,image/png"
                className="sr-only"
                onChange={onFotoChange}
              />
              Arquivo (desktop)
            </label>
          </div>
          {preview && (
            <div className="mt-2 space-y-2">
              <img
                src={preview}
                alt=""
                className="max-h-48 rounded-lg border object-contain"
              />
              {!isNew && (
                <button
                  type="button"
                  onClick={() => void removerFoto()}
                  className="text-sm text-red-600 underline"
                >
                  Remover imagem
                </button>
              )}
            </div>
          )}
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          type="submit"
          className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm"
        >
          Salvar
        </button>
      </form>

      {!isNew && isAdminUser() ? (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 space-y-3">
          <p className="text-sm font-medium text-red-900">Excluir traje</p>
          <p className="text-xs text-red-800/90">
            Remove o traje do estoque. Não é possível se houver vínculo com
            locações.
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            onClick={() => setDeleteModalOpen(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            Excluir
          </button>
        </div>
      ) : null}

      <DeleteTrajeConfirmModal
        open={deleteModalOpen}
        trajeLabel={`${form.codigo} — ${form.nome}`}
        busy={deleteBusy}
        onCancel={() => !deleteBusy && setDeleteModalOpen(false)}
        onConfirm={() => void confirmDeleteFromEdit()}
      />
    </div>
  );
}
