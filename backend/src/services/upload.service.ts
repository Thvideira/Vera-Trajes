import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import path from "path";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/jpg"]);
const MAX_BYTES = 5 * 1024 * 1024;

export function assertImageMime(mimetype: string): void {
  if (!ALLOWED.has(mimetype)) {
    throw new AppError(400, "Apenas imagens JPG ou PNG são permitidas");
  }
}

export function assertSize(size: number): void {
  if (size > MAX_BYTES) {
    throw new AppError(400, "Arquivo muito grande (máx. 5MB)");
  }
}

function sanitizeCodigo(codigo: string): string {
  return codigo.replace(/[^a-zA-Z0-9_-]/g, "");
}

export async function saveTrajeImage(
  codigo: string,
  buffer: Buffer,
  mimetype: string
): Promise<string> {
  assertImageMime(mimetype);
  const safe = sanitizeCodigo(codigo);
  const ext = mimetype.includes("png") ? "png" : "jpg";
  const publicId = `${safe}.${ext}`;

  if (env.UPLOAD_MODE === "cloudinary") {
    if (
      !env.CLOUDINARY_CLOUD_NAME ||
      !env.CLOUDINARY_API_KEY ||
      !env.CLOUDINARY_API_SECRET
    ) {
      throw new AppError(500, "Cloudinary não configurado");
    }
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
    const folder = env.CLOUDINARY_FOLDER;
    const dataUri = `data:${mimetype};base64,${buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id: safe,
      overwrite: true,
      resource_type: "image",
    });
    return result.secure_url as string;
  }

  const dir = path.resolve(env.UPLOAD_LOCAL_DIR, "trajes");
  await fs.mkdir(dir, { recursive: true });
  const filename = `${safe}.${ext}`;
  const full = path.join(dir, filename);
  await fs.writeFile(full, buffer);
  return `${env.PUBLIC_BASE_URL}/files/trajes/${filename}`;
}

export async function deleteTrajeImageIfLocal(fotoUrl: string | null): Promise<void> {
  if (!fotoUrl || env.UPLOAD_MODE === "cloudinary") return;
  const base = `${env.PUBLIC_BASE_URL}/files/trajes/`;
  if (!fotoUrl.startsWith(base)) return;
  const name = fotoUrl.slice(base.length);
  const full = path.resolve(env.UPLOAD_LOCAL_DIR, "trajes", name);
  try {
    await fs.unlink(full);
  } catch {
    /* ignore */
  }
}
