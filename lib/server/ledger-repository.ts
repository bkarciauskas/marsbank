import postgres from "postgres";
import type {
  BankSnapshot,
  CardStatus,
  HostedTransferCommand,
  TransferResult,
} from "../domain";
import {
  demoResidentBySlug,
  demoResidents,
  seedSnapshotForSlug,
} from "../fixtures";
import type { CardId } from "../ids";
import { setCardStatus } from "../ledger";
import { applySharedTransfer } from "../shared-ledger";

export type TransferOptions = {
  holdReserve?: boolean;
};

export type LedgerRepository = {
  getRegister: (slug: string) => Promise<BankSnapshot>;
  transfer: (
    slug: string,
    requestId: string,
    command: HostedTransferCommand,
    options?: TransferOptions,
  ) => Promise<TransferResult>;
  updateCardStatus: (
    slug: string,
    cardId: CardId,
    status: CardStatus,
  ) => Promise<BankSnapshot>;
  resetAll: (slug: string) => Promise<BankSnapshot>;
};

type RegisterRow = {
  resident_slug: string;
  snapshot: BankSnapshot;
};

type ProcessedRow = {
  resident_slug: string;
  result: TransferResult | null;
};

function recipientSlug(
  senderSlug: string,
  command: HostedTransferCommand,
): string | undefined {
  if (command.kind !== "payid") return undefined;
  const payeeId = command.command.payee.id.trim().toLowerCase();
  return demoResidents.find(
    (resident) =>
      resident.slug !== senderSlug && resident.email.toLowerCase() === payeeId,
  )?.slug;
}

class MemoryLedgerRepository implements LedgerRepository {
  private registers = new Map(
    demoResidents.map((resident) => [
      resident.slug,
      seedSnapshotForSlug(resident.slug),
    ]),
  );
  private processed = new Map<
    string,
    { residentSlug: string; result: TransferResult }
  >();
  private queue: Promise<void> = Promise.resolve();

  private exclusive<T>(operation: () => T | Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async getRegister(slug: string): Promise<BankSnapshot> {
    const snapshot = this.registers.get(slug) ?? seedSnapshotForSlug(slug);
    return structuredClone(snapshot);
  }

  transfer(
    slug: string,
    requestId: string,
    command: HostedTransferCommand,
    options?: TransferOptions,
  ): Promise<TransferResult> {
    return this.exclusive(() => {
      const prior = this.processed.get(requestId);
      if (prior) {
        return prior.residentSlug === slug
          ? structuredClone(prior.result)
          : { kind: "invalid-payid" };
      }

      const sender = this.registers.get(slug) ?? seedSnapshotForSlug(slug);
      const targetSlug = recipientSlug(slug, command);
      const targetResident = targetSlug
        ? demoResidentBySlug(targetSlug)
        : undefined;
      const target = targetSlug ? this.registers.get(targetSlug) : undefined;
      const result = applySharedTransfer({
        command,
        holdReserve: options?.holdReserve,
        now: new Date(),
        recipient: target,
        recipientResident: targetResident,
        requestId,
        sender,
      });
      const response: TransferResult =
        result.kind === "ok"
          ? { kind: "ok", snapshot: result.sender }
          : result;

      if (result.kind === "ok") {
        this.registers.set(slug, result.sender);
        if (targetSlug && result.recipient) {
          this.registers.set(targetSlug, result.recipient);
        }
      }
      this.processed.set(requestId, { residentSlug: slug, result: response });
      return structuredClone(response);
    });
  }

  updateCardStatus(
    slug: string,
    cardId: CardId,
    status: CardStatus,
  ): Promise<BankSnapshot> {
    return this.exclusive(() => {
      const current = this.registers.get(slug) ?? seedSnapshotForSlug(slug);
      const next = setCardStatus(current, cardId, status);
      this.registers.set(slug, next);
      return structuredClone(next);
    });
  }

  resetAll(slug: string): Promise<BankSnapshot> {
    return this.exclusive(() => {
      this.registers = new Map(
        demoResidents.map((resident) => [
          resident.slug,
          seedSnapshotForSlug(resident.slug),
        ]),
      );
      this.processed.clear();
      return structuredClone(seedSnapshotForSlug(slug));
    });
  }
}

class PostgresLedgerRepository implements LedgerRepository {
  constructor(private readonly sql: postgres.Sql) {}

  private async ensureSeeded(): Promise<void> {
    for (const resident of demoResidents) {
      const snapshot = seedSnapshotForSlug(resident.slug);
      await this.sql`
        INSERT INTO marsbank_registers (resident_slug, snapshot)
        VALUES (${resident.slug}, ${this.sql.json(snapshot)})
        ON CONFLICT (resident_slug) DO NOTHING
      `;
    }
  }

  async getRegister(slug: string): Promise<BankSnapshot> {
    await this.ensureSeeded();
    const [row] = await this.sql<RegisterRow[]>`
      SELECT resident_slug, snapshot
      FROM marsbank_registers
      WHERE resident_slug = ${slug}
    `;
    return structuredClone(row?.snapshot ?? seedSnapshotForSlug(slug));
  }

  async transfer(
    slug: string,
    requestId: string,
    command: HostedTransferCommand,
    options?: TransferOptions,
  ): Promise<TransferResult> {
    await this.ensureSeeded();
    return this.sql.begin(async (transaction) => {
      const claimed = await transaction<{ request_id: string }[]>`
        INSERT INTO marsbank_transfer_requests
          (request_id, resident_slug, result)
        VALUES (${requestId}, ${slug}, NULL)
        ON CONFLICT (request_id) DO NOTHING
        RETURNING request_id
      `;
      if (claimed.length === 0) {
        const [processed] = await transaction<ProcessedRow[]>`
          SELECT resident_slug, result
          FROM marsbank_transfer_requests
          WHERE request_id = ${requestId}
        `;
        if (processed?.resident_slug === slug && processed.result) {
          return processed.result;
        }
        return { kind: "invalid-payid" };
      }

      const targetSlug = recipientSlug(slug, command);
      const lockSlugs = targetSlug ? [slug, targetSlug].sort() : [slug];
      const rows: RegisterRow[] = [];
      for (const lockSlug of lockSlugs) {
        const [row] = await transaction<RegisterRow[]>`
          SELECT resident_slug, snapshot
          FROM marsbank_registers
          WHERE resident_slug = ${lockSlug}
          FOR UPDATE
        `;
        if (row) rows.push(row);
      }

      const sender =
        rows.find((row) => row.resident_slug === slug)?.snapshot ??
        seedSnapshotForSlug(slug);
      const target = targetSlug
        ? rows.find((row) => row.resident_slug === targetSlug)?.snapshot
        : undefined;
      const result = applySharedTransfer({
        command,
        holdReserve: options?.holdReserve,
        now: new Date(),
        recipient: target,
        recipientResident: targetSlug
          ? demoResidentBySlug(targetSlug)
          : undefined,
        requestId,
        sender,
      });
      const response: TransferResult =
        result.kind === "ok"
          ? { kind: "ok", snapshot: result.sender }
          : result;

      if (result.kind === "ok") {
        await transaction`
          UPDATE marsbank_registers
          SET snapshot = ${transaction.json(result.sender)}, updated_at = now()
          WHERE resident_slug = ${slug}
        `;
        if (targetSlug && result.recipient) {
          await transaction`
            UPDATE marsbank_registers
            SET
              snapshot = ${transaction.json(result.recipient)},
              updated_at = now()
            WHERE resident_slug = ${targetSlug}
          `;
        }
      }

      await transaction`
        UPDATE marsbank_transfer_requests
        SET result = ${transaction.json(response)}
        WHERE request_id = ${requestId}
      `;
      return response;
    });
  }

  async updateCardStatus(
    slug: string,
    cardId: CardId,
    status: CardStatus,
  ): Promise<BankSnapshot> {
    await this.ensureSeeded();
    return this.sql.begin(async (transaction) => {
      const [row] = await transaction<RegisterRow[]>`
        SELECT resident_slug, snapshot
        FROM marsbank_registers
        WHERE resident_slug = ${slug}
        FOR UPDATE
      `;
      const next = setCardStatus(
        row?.snapshot ?? seedSnapshotForSlug(slug),
        cardId,
        status,
      );
      await transaction`
        UPDATE marsbank_registers
        SET snapshot = ${transaction.json(next)}, updated_at = now()
        WHERE resident_slug = ${slug}
      `;
      return next;
    });
  }

  async resetAll(slug: string): Promise<BankSnapshot> {
    await this.ensureSeeded();
    return this.sql.begin(async (transaction) => {
      await transaction`
        LOCK TABLE marsbank_transfer_requests IN ACCESS EXCLUSIVE MODE
      `;
      await transaction`LOCK TABLE marsbank_registers IN EXCLUSIVE MODE`;
      for (const resident of demoResidents) {
        const snapshot = seedSnapshotForSlug(resident.slug);
        await transaction`
          UPDATE marsbank_registers
          SET snapshot = ${transaction.json(snapshot)}, updated_at = now()
          WHERE resident_slug = ${resident.slug}
        `;
      }
      await transaction`TRUNCATE TABLE marsbank_transfer_requests`;
      return seedSnapshotForSlug(slug);
    });
  }
}

const globalLedger = globalThis as typeof globalThis & {
  marsbankDatabase?: postgres.Sql;
  marsbankMemoryLedger?: LedgerRepository;
};

export function getLedgerRepository(): LedgerRepository {
  const databaseUrl = process.env.DB_POSTGRES_URL;
  if (databaseUrl) {
    globalLedger.marsbankDatabase ??= postgres(databaseUrl, { max: 5 });
    return new PostgresLedgerRepository(globalLedger.marsbankDatabase);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DB_POSTGRES_URL is required for the production shared ledger.",
    );
  }

  globalLedger.marsbankMemoryLedger ??= new MemoryLedgerRepository();
  return globalLedger.marsbankMemoryLedger;
}

export function createMemoryLedgerRepository(): LedgerRepository {
  return new MemoryLedgerRepository();
}
