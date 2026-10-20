/** fetch para a nossa API: devolve JSON ou lança Error com a mensagem do servidor. */
export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown; form?: FormData }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body || init?.form ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.form ?? (init?.body ? JSON.stringify(init.body) : undefined),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = Array.isArray((data as { details?: string[] }).details) ? ` (${(data as { details: string[] }).details.join("; ")})` : "";
    throw new Error(((data as { error?: string }).error ?? "Falha na requisição.") + details);
  }
  return data as T;
}
