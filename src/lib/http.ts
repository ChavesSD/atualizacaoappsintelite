import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const badRequest = (m: string) => new HttpError(400, m);
export const unauthorized = (m = "Não autenticado.") => new HttpError(401, m);
export const forbidden = (m = "Sem permissão para esta ação.") => new HttpError(403, m);
export const notFound = (m = "Não encontrado.") => new HttpError(404, m);
export const conflict = (m: string) => new HttpError(409, m);

type Handler<C> = (req: Request, ctx: C) => Promise<Response | object | null>;

/** Envolve um handler: valida origem em métodos mutáveis, traduz erros em JSON consistente. */
export function route<C = { params: Promise<Record<string, string>> }>(fn: Handler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      const out = await fn(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        return NextResponse.json(
          { error: "Dados inválidos.", details: e.issues.map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`) },
          { status: 400 },
        );
      }
      console.error("[api] erro inesperado", e);
      return NextResponse.json({ error: "Erro interno." }, { status: 500 });
    }
  };
}

/** Defesa adicional contra CSRF (além de SameSite=Lax): Origin, quando presente, deve coincidir com o Host. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let oh: string;
  try {
    oh = new URL(origin).host;
  } catch {
    throw forbidden("Origem inválida.");
  }
  if (oh !== host) throw forbidden("Origem não permitida.");
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest("Corpo JSON inválido.");
  }
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

const buckets = new Map<string, { n: number; reset: number }>();
/** Limitador simples em memória (por instância). Em produção com várias instâncias, trocar por Redis. */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return;
  }
  b.n++;
  if (b.n > max) throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
}
export function resetRateLimit(key: string) {
  buckets.delete(key);
}
