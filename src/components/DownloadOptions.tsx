"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

interface Info { app: "totem" | "painel"; label: string; version: string; links: string[]; direct: string | null; sizeBytes: number | null }

let cache: Promise<Info[]> | null = null;
const load = () => (cache ??= api<Info[]>("/api/downloads").catch((e) => { cache = null; throw e; }));

const mb = (b: number) => `${(b / 1048576).toFixed(1).replace(".", ",")} MB`;
const show = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

/** Opções para baixar o app: links alternativos (se um falhar, use outro) e download direto desta página. */
export function DownloadOptions({ app }: { app: "totem" | "painel" }) {
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  useEffect(() => { load().then((l) => setInfo(l.find((x) => x.app === app) ?? null)).catch(() => setInfo(null)); }, [app]);
  if (info === undefined) return <p className="muted small">Carregando opções de download…</p>;
  if (!info) return <div className="alert warn small">Não foi possível carregar as opções de download. Recarregue a página ou use “Preciso de ajuda”.</div>;

  let n = 0;
  return (
    <div className="dl" role="group" aria-label={`Opções de download: ${info.label}`}>
      <strong>Baixar o aplicativo: {info.label} (versão {info.version})</strong>
      <p className="muted small" style={{ margin: "4px 0 8px" }}>Se uma opção não funcionar, tente a próxima.</p>
      <div className="stack" style={{ gap: 8 }}>
        {info.links.map((l) => (
          <a key={l} className="opt" href={l} target="_blank" rel="noopener noreferrer">
            <span className="tag">Opção {++n}</span><span className="grow">{show(l)}</span><span aria-hidden>↗</span>
          </a>
        ))}
        {info.direct && (
          <a className="opt direct" href={info.direct} download>
            <span className="tag">Opção {++n}</span>
            <span className="grow">Baixar direto desta página{info.sizeBytes ? ` (${mb(info.sizeBytes)})` : ""}</span><span aria-hidden>⬇</span>
          </a>
        )}
      </div>
    </div>
  );
}
