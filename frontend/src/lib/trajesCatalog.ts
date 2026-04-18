const EVENT_NAME = "lojavera:trajes-catalog-changed";
const BROADCAST_NAME = "lojavera-trajes-catalog";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(BROADCAST_NAME);
  return channel;
}

/** Dispara atualização em outras abas/janelas e listeners na mesma página. */
export function notifyTrajesCatalogChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
  try {
    getChannel()?.postMessage({ t: "refresh" });
  } catch {
    /* ignore */
  }
}

export function subscribeTrajesCatalogChanged(onChange: () => void): () => void {
  const handler = (): void => {
    onChange();
  };
  window.addEventListener(EVENT_NAME, handler);
  const ch = getChannel();
  const bcHandler = (): void => {
    onChange();
  };
  ch?.addEventListener("message", bcHandler);

  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    ch?.removeEventListener("message", bcHandler);
  };
}

function catalogStreamUrl(): string {
  const prefix = import.meta.env.VITE_API_URL ?? "";
  const token = localStorage.getItem("token");
  const path =
    token != null && token.length > 0
      ? `/api/trajes/catalog-stream?token=${encodeURIComponent(token)}`
      : "/api/trajes/catalog-stream";
  return `${prefix}${path}`;
}

/**
 * Mantém lista de trajes alinhada ao servidor: SSE + foco + intervalo de segurança.
 */
export function subscribeTrajeCatalogLive(onRefresh: () => void): () => void {
  const offLocal = subscribeTrajesCatalogChanged(onRefresh);

  const onFocus = (): void => {
    onRefresh();
  };
  const onVisibility = (): void => {
    if (document.visibilityState === "visible") onRefresh();
  };
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);

  let es: EventSource | null = null;
  try {
    es = new EventSource(catalogStreamUrl());
    es.addEventListener("trajes", () => {
      onRefresh();
    });
    es.onerror = () => {
      /* reconexão automática do EventSource; backup = intervalo abaixo */
    };
  } catch {
    /* EventSource indisponível */
  }

  const intervalMs = 45_000;
  const interval = window.setInterval(() => {
    onRefresh();
  }, intervalMs);

  return () => {
    offLocal();
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibility);
    es?.close();
    window.clearInterval(interval);
  };
}
