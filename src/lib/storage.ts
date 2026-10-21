import fs from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

/**
 * Abstração de armazenamento de arquivos (fotos e imagens de referência).
 * "local": pasta em disco (desenvolvimento / servidor com disco persistente).
 * "db": tabela no PostgreSQL (recomendado no Render, onde o disco é efêmero).
 * Para volumes maiores, implemente a mesma interface sobre um bucket S3-compatível.
 */
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,200}$/;

function localStorage(): Storage {
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage");
  const resolve = (key: string) => {
    // Chaves são geradas pelo servidor, mas validamos mesmo assim (path traversal).
    if (!KEY_RE.test(key) || key.includes("..")) throw new Error("Chave de armazenamento inválida.");
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Chave de armazenamento inválida.");
    return full;
  };
  return {
    async put(key, data) {
      const f = resolve(key);
      await fs.mkdir(path.dirname(f), { recursive: true });
      await fs.writeFile(f, data);
    },
    async get(key) {
      try {
        return await fs.readFile(resolve(key));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
    async remove(key) {
      await fs.rm(resolve(key), { force: true });
    },
  };
}

/** Guarda os arquivos na tabela FileBlob (PostgreSQL). Adequado ao volume deste projeto (fotos de até 12 MB). */
function dbStorage(): Storage {
  return {
    async put(key, data) {
      const bytes = new Uint8Array(data);
      await db.fileBlob.upsert({ where: { key }, update: { data: bytes }, create: { key, data: bytes } });
    },
    async get(key) {
      const r = await db.fileBlob.findUnique({ where: { key } });
      return r ? Buffer.from(r.data) : null;
    },
    async remove(key) {
      await db.fileBlob.deleteMany({ where: { key } });
    },
  };
}

let instance: Storage | undefined;
export function storage(): Storage {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "db") return (instance = dbStorage());
  if (driver !== "local") throw new Error(`STORAGE_DRIVER "${driver}" inválido. Use "local" ou "db".`);
  return (instance = localStorage());
}
