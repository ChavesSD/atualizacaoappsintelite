import type { Prisma } from "@prisma/client";
import { db } from "./db";

type Client = Pick<typeof db, "auditLog">;

export interface AuditEntry {
  actorType: "CLIENTE" | "ADMIN" | "SISTEMA";
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
}

/** Trilha somente-inserção. Passe o `tx` da transação para que a ação e seu registro sejam atômicos. */
export async function audit(entry: AuditEntry, client: Client = db) {
  await client.auditLog.create({
    data: {
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: entry.before ?? undefined,
      after: entry.after ?? undefined,
    },
  });
}
