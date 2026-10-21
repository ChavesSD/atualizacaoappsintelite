/** Falha de rede (sem internet, servidor fora do ar): distinta de uma resposta de erro da API. */
export class NetworkError extends Error {}

/** fetch para a nossa API: devolve JSON ou lança Error com a mensagem do servidor, em português. */
export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown; form?: FormData }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? (init?.body || init?.form ? "POST" : "GET"),
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.form ?? (init?.body ? JSON.stringify(init.body) : undefined),
      cache: "no-store",
    });
  } catch {
    throw new NetworkError("Sem conexão com a internet. Confira sua rede e tente novamente.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = Array.isArray((data as { details?: string[] }).details) ? ` (${(data as { details: string[] }).details.join("; ")})` : "";
    const fallback = res.status >= 500 ? "O servidor não conseguiu responder agora. Tente novamente em instantes." : "Não foi possível concluir a ação.";
    throw new Error(((data as { error?: string }).error ?? fallback) + details);
  }
  return data as T;
}
