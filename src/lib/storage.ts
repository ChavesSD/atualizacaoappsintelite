import fs from "node:fs/promises";
import path from "node:path";

/**
 * Abstração de armazenamento de arquivos (fotos e imagens de referência).
 * Driver "local" para desenvolvimento. Produção: implemente a mesma interface sobre um bucket S3-compatível
 * (ver docs/ARQUITETURA.md) e selecione com STORAGE_DRIVER.
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

let instance: Storage | undefined;
export function storage(): Storage {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver !== "local") throw new Error(`STORAGE_DRIVER "${driver}" não implementado. Veja docs/ARQUITETURA.md.`);
  return (instance = localStorage());
}
