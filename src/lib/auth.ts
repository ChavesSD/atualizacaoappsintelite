import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { AdminRole } from "@prisma/client";
import { db } from "./db";
import { forbidden, unauthorized } from "./http";

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET ausente ou curto (mínimo 32 caracteres).");
  return s;
};

export { hashPassword, verifyPassword, hashAccessCode, generateAccessCode } from "./crypto";

// ── cookie assinado ──
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
function sign(payload: object, ttlSec: number): string {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const sig = b64(crypto.createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}
function verify<T>(token: string | undefined): (T & { exp: number }) | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    return p.exp > Date.now() / 1000 ? p : null;
  } catch {
    return null;
  }
}

const CLIENT_COOKIE = "ci_client";
const ADMIN_COOKIE = "ci_admin";
const opts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export async function setClientSession(campaignUnitId: string) {
  (await cookies()).set(CLIENT_COOKIE, sign({ cu: campaignUnitId }, 60 * 60 * 24 * 30), opts(60 * 60 * 24 * 30));
}
export async function setAdminSession(adminId: string) {
  (await cookies()).set(ADMIN_COOKIE, sign({ a: adminId }, 60 * 60 * 8), opts(60 * 60 * 8));
}
export async function clearSessions() {
  const c = await cookies();
  c.delete(CLIENT_COOKIE);
  c.delete(ADMIN_COOKIE);
}

export async function getClientContext() {
  const p = verify<{ cu: string }>((await cookies()).get(CLIENT_COOKIE)?.value);
  if (!p) return null;
  return db.campaignUnit.findUnique({ where: { id: p.cu }, include: { unit: true, campaign: true } });
}
export async function requireClient() {
  const cu = await getClientContext();
  if (!cu) throw unauthorized("Acesso não identificado. Informe o código da sua unidade.");
  return cu;
}

export async function getAdmin() {
  const p = verify<{ a: string }>((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!p) return null;
  const a = await db.adminUser.findUnique({ where: { id: p.a } });
  return a?.active ? a : null;
}
export async function requireAdmin(...roles: AdminRole[]) {
  const a = await getAdmin();
  if (!a) throw unauthorized();
  if (roles.length && !roles.includes(a.role)) throw forbidden();
  return a;
}
