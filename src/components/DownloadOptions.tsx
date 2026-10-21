"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { Alert, Icon, Skeleton } from "./ui";

interface Info { app: "totem" | "painel"; label: string; version: string; links: string[]; direct: string | null; sizeBytes: number | null }

let cache: Promise<Info[]> | null = null;
const load = () => (cache ??= api<Info[]>("/api/downloads").catch((e) => { cache = null; throw e; }));

const mb = (b: number) => `${(b / 1048576).toFixed(1).replace(".", ",")} MB`;
const show = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

/** Opções para baixar o app: links alternativos (se um falhar, use outro) e download direto desta página. */
export function DownloadOptions({ app }: { app: "totem" | "painel" }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ok"; info: Info }>({ status: "loading" });
  const fetchInfo = useCallback(() => {
    setState({ status: "loading" });
    load().then((l) => {
      const info = l.find((x) => x.app === app);
      setState(info ? { status: "ok", info } : { status: "error" });
    }).catch(() => setState({ status: "error" }));
  }, [app]);
  useEffect(fetchInfo, [fetchInfo]);

  if (state.status === "loading") {
    return <div className="dl stack" aria-busy="true" aria-label="Carregando as opções de download"><Skeleton h={20} w="60%" /><Skeleton h={48} /><Skeleton h={48} /></div>;
  }
  if (state.status === "error") {
    return (
      <Alert tone="warn" role="alert">
        Não foi possível carregar as opções de download.{" "}
        <button type="button" className="btn sm" onClick={() => { cache = null; fetchInfo(); }}>Tentar de novo</button>
      </Alert>
    );
  }
  const { info } = state;
  let n = 0;
  return (
    <div className="dl" role="group" aria-label={`Opções de download: ${info.label}`}>
      <p style={{ margin: 0 }}><strong>Baixar o aplicativo: {info.label} (versão {info.version})</strong></p>
      <p className="muted small" style={{ margin: "4px 0 8px" }}>Se uma opção não funcionar, tente a próxima.</p>
      <div className="stack" style={{ gap: 8 }}>
        {info.links.map((l) => (
          <a key={l} className="opt-link" href={l} target="_blank" rel="noopener noreferrer">
            <span className="tag">Opção {++n}</span><span className="grow">{show(l)}</span>
            <Icon name="external" size={18} /><span className="visually-hidden">(abre em nova aba)</span>
          </a>
        ))}
        {info.direct && (
          <a className="opt-link direct" href={info.direct} download>
            <span className="tag">Opção {++n}</span>
            <span className="grow">Baixar direto desta página{info.sizeBytes ? ` (${mb(info.sizeBytes)})` : ""}</span>
            <Icon name="download" size={18} />
          </a>
        )}
        {info.direct && (
          <p className="muted small" style={{ margin: 0 }}>
            <strong>Atenção:</strong> com o download direto, o arquivo (APK) fica no computador em que você baixou. Para instalar no Mini PC, copie o APK para um pendrive e conecte o pendrive ao Mini PC.
          </p>
        )}
      </div>
    </div>
  );
}
