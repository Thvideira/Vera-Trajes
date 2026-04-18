const API_PREFIX = import.meta.env.VITE_API_URL ?? "";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<never> {
  let body: { error?: string; details?: unknown } = {};
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  throw new ApiError(body.error ?? res.statusText, res.status, body.details);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  path: string,
  method: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiUploadFoto(trajeId: string, file: File): Promise<unknown> {
  const token = localStorage.getItem("token");
  const fd = new FormData();
  fd.append("foto", file);
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_PREFIX}/api/trajes/${trajeId}/foto`, {
    method: "POST",
    headers,
    body: fd,
  });
  if (!res.ok) await parseError(res);
  return res.json();
}
