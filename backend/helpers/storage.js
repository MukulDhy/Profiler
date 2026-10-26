/**
 * Storage abstraction: local disk (desktop / portable builds) or Cloudinary
 * (hosted deployments).
 *
 * Local files live under `<data home>/data/uploads` and are served by the
 * backend from `/uploads`. Cloudinary keeps the original hosted behaviour.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { UPLOADS_DIR, ensureDirs } from "../config/runtimeConfig.js";
import logger from "../utils/logger.js";

export const PUBLIC_PREFIX = "/uploads";

/**
 * Absolute base for locally stored files.
 *
 * Uploaded URLs must work from both the bundled SPA (same origin) and the Vite
 * dev server (`localhost:8080` talking to `localhost:5001`), so store absolute
 * URLs instead of bare `/uploads/...` paths. Hosted deployments can override
 * this with PUBLIC_BASE_URL.
 */
export const publicBaseUrl = () => {
  const explicit = (process.env.PUBLIC_BASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return `http://127.0.0.1:${process.env.PORT || 5001}`;
};

export const storageMode = () =>
  (process.env.STORAGE || "local").toLowerCase();

export const isLocalStorage = () => storageMode() !== "cloudinary";

const randomSuffix = () => crypto.randomBytes(4).toString("hex");

/** Make sure the uploads tree exists and return the folder for a subpath. */
const folderFor = (folder = "") => {
  ensureDirs();
  const dir = path.join(UPLOADS_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/**
 * Resolve a `/uploads/...` URL back to its absolute local path.
 * Returns `null` for anything that is not a local upload (e.g. Cloudinary).
 */
export const localPathForUrl = (url) => {
  if (typeof url !== "string") return null;

  let pathname = url;
  if (/^https?:\/\//i.test(url)) {
    try {
      pathname = new URL(url).pathname;
    } catch {
      return null;
    }
  }

  if (!pathname.startsWith(`${PUBLIC_PREFIX}/`)) return null;

  const relative = pathname.slice(PUBLIC_PREFIX.length + 1).split("?")[0];
  const resolved = path.resolve(UPLOADS_DIR, relative);

  // Never allow `..` traversal out of the uploads folder.
  if (!resolved.startsWith(path.resolve(UPLOADS_DIR))) return null;
  return resolved;
};

/**
 * Move (or copy) a file into the local uploads tree.
 *
 * @param {string} sourcePath absolute path of the incoming file
 * @param {{folder?: string, baseName?: string, ext?: string, copy?: boolean}} options
 * @returns {Promise<{url: string, public_id: string, original_filename: string, storage: string, size: number}>}
 */
export const saveLocalFile = async (
  sourcePath,
  { folder = "", baseName = "", ext = "", copy = false } = {}
) => {
  const dir = folderFor(folder);
  const extension = (ext || path.extname(sourcePath) || "").toLowerCase();
  const name = `${baseName || `file_${Date.now()}_${randomSuffix()}`}${
    extension.startsWith(".") || extension === "" ? extension : `.${extension}`
  }`;
  const destination = path.join(dir, name);

  if (copy) {
    await fs.promises.copyFile(sourcePath, destination);
  } else {
    try {
      await fs.promises.rename(sourcePath, destination);
    } catch {
      // Cross-device move or a file still held open by another process.
      await fs.promises.copyFile(sourcePath, destination);
      await fs.promises.unlink(sourcePath).catch(() => {});
    }
  }

  const relative = path.posix.join(folder, name);
  const { size } = await fs.promises.stat(destination);

  logger.debug?.(`Stored local file ${relative} (${size} bytes)`);

  return {
    url: `${publicBaseUrl()}${PUBLIC_PREFIX}/${relative}`,
    public_id: relative,
    original_filename: name,
    storage: "local",
    size,
  };
};

/** Delete a previously stored local file. Best effort. */
export const deleteLocalFile = async (publicId) => {
  if (!publicId) return;
  const target = path.resolve(UPLOADS_DIR, String(publicId));
  if (!target.startsWith(path.resolve(UPLOADS_DIR))) return;
  await fs.promises.unlink(target).catch(() => {});
};

export default {
  PUBLIC_PREFIX,
  publicBaseUrl,
  storageMode,
  isLocalStorage,
  localPathForUrl,
  saveLocalFile,
  deleteLocalFile,
};
