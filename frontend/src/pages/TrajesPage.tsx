import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, apiGet, apiSend, apiUploadFoto } from "../lib/api";
import { formatarNomeTraje } from "../lib/formatarNomeTraje";
import { confirmAsync, showPopup } from "../contexts/PopupContext";
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
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
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

  async function onDeleteTrajeClick(t: Traje): Promise<void> {
    const ok = await confirmAsync({
      type: "warning",
      title: "Excluir traje",
      message: "Tem certeza que deseja excluir este item?",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      danger: true,
      closeOnBackdrop: false,
      closeOnEscape: false,
    });
    if (!ok) return;
    setDeleteBusyId(t.id);
    try {
      await apiSend(`/api/trajes/${t.id}`, "DELETE");
      notifyTrajesCatalogChanged();
      await load();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Não foi possível excluir";
      showPopup({
        type: "error",
        title: "Erro ao excluir",
        message: msg,
        confirmText: "OK",
      });
    } finally {
      setDeleteBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Trajes</h1>
          <p className="text-muted text-sm">Estoque por código e tipo</p>
        </div>
        <Link to="/trajes/novo" className="btn-primary text-sm">
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
          className="rounded-lg border border-line px-3 py-2 text-sm flex-1 min-w-[160px]"
          placeholder="Código ou nome"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded-lg border border-line px-3 py-2 text-sm"
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
        <button type="submit" className="btn-secondary text-sm py-2 px-4">
          Filtrar
        </button>
      </form>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p>Carregando…</p>
        ) : (
          list.map((t) => {
            const cardShell =
              "rounded-xl border border-line bg-surface overflow-hidden flex flex-col";
            const inner = (
              <>
                <div className="aspect-[4/3] bg-hover-gray flex items-center justify-center">
                  {t.fotoUrl ? (
                    <img
                      src={t.fotoUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-muted text-sm">Sem foto</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-medium">{t.nome}</p>
                  <p className="text-xs text-muted">
                    {t.codigo} · {LABEL_TRAJE_TIPO[t.tipo]} · {t.tamanho}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      t.status === "DISPONIVEL"
                        ? "text-success"
                        : "text-warning-fg"
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
                  (admin ? "" : " hover:border-primary/40 transition")
                }
              >
                <Link
                  to={`/trajes/${t.id}`}
                  className="block flex-1 hover:bg-pink-soft transition"
                >
                  {inner}
                </Link>
                {admin ? (
                  <div className="p-2 border-t border-line flex justify-end bg-surface">
                    <button
                      type="button"
                      disabled={deleteBusyId !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      onClick={() => void onDeleteTrajeClick(t)}
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
    const payload = { ...form, nome: formatarNomeTraje(form.nome) };
    setForm(payload);
    try {
      let trajeId = id;
      if (isNew) {
        const created = await apiSend<Traje>("/api/trajes", "POST", payload);
        trajeId = created.id;
      } else {
        await apiSend(`/api/trajes/${id}`, "PUT", payload);
      }
      const hadFoto = Boolean(fotoFile && trajeId);
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
        showPopup({
          type: "success",
          title: "Sucesso",
          message: "Operação realizada com sucesso!",
          confirmText: "OK",
          autoCloseMs: 2800,
        });
        return;
      }
      if (hadFoto) {
        showPopup({
          type: "success",
          title: "Sucesso",
          message: "Operação realizada com sucesso!",
          confirmText: "OK",
          autoCloseMs: 2600,
          onDismiss: () => navigate("/trajes"),
        });
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
      navigate("/trajes");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Não foi possível excluir";
      showPopup({
        type: "error",
        title: "Erro ao excluir",
        message: msg,
        confirmText: "OK",
      });
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
      <form
        onSubmit={onSubmit}
        className="space-y-4 bg-surface p-6 rounded-xl border border-line shadow-sm"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input
            required
            className="w-full rounded-lg border border-line px-3 py-2"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            onBlur={() =>
              setForm((f) => ({ ...f, nome: formatarNomeTraje(f.nome) }))
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tipo</label>
          <select
            className="w-full rounded-lg border border-line px-3 py-2"
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
            className="w-full rounded-lg border border-line px-3 py-2"
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
            className="w-full rounded-lg border border-line px-3 py-2"
            value={form.tamanho}
            onChange={(e) =>
              setForm((f) => ({ ...f, tamanho: e.target.value }))
            }
          />
        </div>
        <div>
          <span className="block text-sm font-medium mb-1">Foto (JPG ou PNG)</span>
          <p className="text-xs text-muted mb-2">
            No celular: use a câmera ou escolha da galeria. Formatos aceitos no
            servidor: JPG e PNG.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-line bg-hover-gray px-4 py-2 text-sm font-medium hover:bg-hover-gray">
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
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-hover-gray">
              <input
                key={`gal-${fotoInputsKey}`}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={onFotoChange}
              />
              Galeria
            </label>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-line px-4 py-2 text-xs text-muted sm:ml-0">
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
          className="btn-primary text-sm"
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
            disabled={deleteBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-surface px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            onClick={() =>
              void (async () => {
                const ok = await confirmAsync({
                  type: "warning",
                  title: "Excluir traje",
                  message: "Tem certeza que deseja excluir este item?",
                  confirmText: "Excluir",
                  cancelText: "Cancelar",
                  danger: true,
                  closeOnBackdrop: false,
                  closeOnEscape: false,
                });
                if (!ok) return;
                await confirmDeleteFromEdit();
              })()
            }
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

    </div>
  );
}
