import postgres from "postgres";
import type {
  BankSnapshot,
  CardStatus,
  ContactResult,
  HostedContactCommand,
  HostedPaymentRequestCommand,
  HostedTransferCommand,
  PaymentRequestResult,
  TransferResult,
} from "../domain";
import {
  demoResidentBySlug,
  demoResidents,
  type DemoResident,
  seedSnapshotForSlug,
} from "../fixtures";
import {
  contactId,
  paymentRequestId,
  type CardId,
  type ContactId,
} from "../ids";
import { setCardStatus } from "../ledger";
import { applyContactCommand, lookupResidentPayId } from "../payid";
import {
  applyApprovePaymentRequest,
  applyCancelPaymentRequest,
  applyCreatePaymentRequest,
  applyDeclinePaymentRequest,
  applySharedTransfer,
  type SharedPaymentRequestResult,
} from "../shared-ledger";

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
  paymentRequest: (
    slug: string,
    command: HostedPaymentRequestCommand,
    options?: TransferOptions,
  ) => Promise<PaymentRequestResult>;
  updateCardStatus: (
    slug: string,
    cardId: CardId,
    status: CardStatus,
  ) => Promise<BankSnapshot>;
  contact: (
    slug: string,
    command: HostedContactCommand,
  ) => Promise<ContactResult>;
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

function normalizeSnapshot(snapshot: BankSnapshot): BankSnapshot {
  if (
    Array.isArray(snapshot.paymentRequests) &&
    Array.isArray(snapshot.contacts)
  ) {
    return snapshot;
  }
  return {
    ...snapshot,
    paymentRequests: Array.isArray(snapshot.paymentRequests)
      ? snapshot.paymentRequests
      : [],
    contacts: Array.isArray(snapshot.contacts) ? snapshot.contacts : [],
  };
}

function issueContact(): { id: ContactId; savedAt: string } {
  return {
    id: contactId(`ct-${crypto.randomUUID()}`),
    savedAt: new Date().toISOString(),
  };
}

function counterpartySlugForAction(
  actorSnapshot: BankSnapshot,
  slug: string,
  command: Exclude<HostedPaymentRequestCommand, { action: "create" }>,
): string | undefined {
  const existing = (actorSnapshot.paymentRequests ?? []).find(
    (entry) => entry.id === command.command.paymentRequestId,
  );
  if (!existing) return undefined;
  if (command.action === "cancel") {
    return existing.requesterSlug === slug ? existing.payerSlug : undefined;
  }
  return existing.payerSlug === slug ? existing.requesterSlug : undefined;
}

function executePaymentRequestStep({
  actor,
  actorResident,
  command,
  counterparty,
  counterpartyResident,
  holdReserve,
  now,
}: {
  actor: BankSnapshot;
  actorResident: DemoResident;
  command: HostedPaymentRequestCommand;
  counterparty: BankSnapshot;
  counterpartyResident: DemoResident;
  holdReserve?: boolean;
  now: Date;
}): SharedPaymentRequestResult {
  switch (command.action) {
    case "create":
      return applyCreatePaymentRequest({
        amount: command.command.amount,
        description: command.command.description,
        id: paymentRequestId(`pr-${crypto.randomUUID()}`),
        now,
        payer: counterparty,
        payerResident: counterpartyResident,
        requester: actor,
        requesterResident: actorResident,
      });
    case "approve":
      return applyApprovePaymentRequest({
        command: command.command,
        holdReserve,
        now,
        payer: actor,
        payerSlug: actorResident.slug,
        requester: counterparty,
        requesterResident: counterpartyResident,
      });
    case "decline":
      return applyDeclinePaymentRequest({
        command: command.command,
        now,
        payer: actor,
        payerSlug: actorResident.slug,
        requester: counterparty,
      });
    case "cancel":
      return applyCancelPaymentRequest({
        command: command.command,
        now,
        payer: counterparty,
        requester: actor,
        requesterSlug: actorResident.slug,
      });
  }
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
    return structuredClone(normalizeSnapshot(snapshot));
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

  paymentRequest(
    slug: string,
    command: HostedPaymentRequestCommand,
    options?: TransferOptions,
  ): Promise<PaymentRequestResult> {
    return this.exclusive(() => {
      const actorResident = demoResidentBySlug(slug);
      if (!actorResident) {
        return { kind: "unknown-resident" };
      }

      let targetResident: DemoResident | undefined;
      const actor = normalizeSnapshot(
        this.registers.get(slug) ?? seedSnapshotForSlug(slug),
      );

      if (command.action === "create") {
        const lookup = lookupResidentPayId(
          command.command.target,
          actorResident.email,
        );
        if (lookup.kind === "invalid") return { kind: "invalid-payid" };
        if (lookup.kind === "own") return { kind: "own-payid" };
        if (lookup.kind === "unknown-resident") {
          return { kind: "unknown-resident" };
        }
        if (command.command.amount <= 0) {
          return { kind: "amount-not-positive" };
        }
        targetResident = lookup.resident;
      } else {
        const targetSlug = counterpartySlugForAction(actor, slug, command);
        if (!targetSlug || targetSlug === slug) {
          return { kind: "unknown-request" };
        }
        targetResident = demoResidentBySlug(targetSlug);
        if (!targetResident) {
          return { kind: "unknown-resident" };
        }
      }

      const counterparty = normalizeSnapshot(
        this.registers.get(targetResident.slug) ??
          seedSnapshotForSlug(targetResident.slug),
      );
      const result = executePaymentRequestStep({
        actor,
        actorResident,
        command,
        counterparty,
        counterpartyResident: targetResident,
        holdReserve: options?.holdReserve,
        now: new Date(),
      });

      if (result.kind !== "ok") {
        return structuredClone(result);
      }

      this.registers.set(slug, result.actor);
      this.registers.set(result.counterpartySlug, result.counterparty);
      return structuredClone({
        kind: "ok",
        snapshot: result.actor,
        request: result.request,
      });
    });
  }

  contact(slug: string, command: HostedContactCommand): Promise<ContactResult> {
    return this.exclusive(() => {
      const resident = demoResidentBySlug(slug);
      if (!resident) return { kind: "invalid-payid" };
      const current = normalizeSnapshot(
        this.registers.get(slug) ?? seedSnapshotForSlug(slug),
      );
      const applied = applyContactCommand(
        current,
        resident.email,
        command,
        issueContact(),
      );
      if (applied.kind === "ok") {
        this.registers.set(slug, applied.snapshot);
      }
      return structuredClone(applied);
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
    return structuredClone(
      normalizeSnapshot(row?.snapshot ?? seedSnapshotForSlug(slug)),
    );
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
        normalizeSnapshot(row?.snapshot ?? seedSnapshotForSlug(slug)),
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

  async contact(
    slug: string,
    command: HostedContactCommand,
  ): Promise<ContactResult> {
    const resident = demoResidentBySlug(slug);
    if (!resident) return { kind: "invalid-payid" };

    await this.ensureSeeded();
    return this.sql.begin(async (transaction) => {
      const [row] = await transaction<RegisterRow[]>`
        SELECT resident_slug, snapshot
        FROM marsbank_registers
        WHERE resident_slug = ${slug}
        FOR UPDATE
      `;
      const current = normalizeSnapshot(
        row?.snapshot ?? seedSnapshotForSlug(slug),
      );
      const applied = applyContactCommand(
        current,
        resident.email,
        command,
        issueContact(),
      );
      if (applied.kind !== "ok") return applied;

      await transaction`
        UPDATE marsbank_registers
        SET snapshot = ${transaction.json(applied.snapshot)}, updated_at = now()
        WHERE resident_slug = ${slug}
      `;
      return applied;
    });
  }

  async paymentRequest(
    slug: string,
    command: HostedPaymentRequestCommand,
    options?: TransferOptions,
  ): Promise<PaymentRequestResult> {
    const actorResident = demoResidentBySlug(slug);
    if (!actorResident) {
      return { kind: "unknown-resident" };
    }

    let createTargetResident: DemoResident | undefined;
    if (command.action === "create") {
      const lookup = lookupResidentPayId(
        command.command.target,
        actorResident.email,
      );
      if (lookup.kind === "invalid") return { kind: "invalid-payid" };
      if (lookup.kind === "own") return { kind: "own-payid" };
      if (lookup.kind === "unknown-resident") {
        return { kind: "unknown-resident" };
      }
      if (command.command.amount <= 0) {
        return { kind: "amount-not-positive" };
      }
      createTargetResident = lookup.resident;
    }

    await this.ensureSeeded();
    return this.sql.begin(async (transaction) => {
      let targetResident = createTargetResident;
      if (command.action !== "create") {
        const [peek] = await transaction<RegisterRow[]>`
          SELECT resident_slug, snapshot
          FROM marsbank_registers
          WHERE resident_slug = ${slug}
        `;
        const peekSnapshot = normalizeSnapshot(
          peek?.snapshot ?? seedSnapshotForSlug(slug),
        );
        const targetSlug = counterpartySlugForAction(
          peekSnapshot,
          slug,
          command,
        );
        if (!targetSlug || targetSlug === slug) {
          return { kind: "unknown-request" };
        }
        targetResident = demoResidentBySlug(targetSlug);
        if (!targetResident) {
          return { kind: "unknown-resident" };
        }
      }

      if (!targetResident) {
        return { kind: "unknown-resident" };
      }

      const lockSlugs = [slug, targetResident.slug].sort();
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

      const actor = normalizeSnapshot(
        rows.find((row) => row.resident_slug === slug)?.snapshot ??
          seedSnapshotForSlug(slug),
      );
      const counterparty = normalizeSnapshot(
        rows.find((row) => row.resident_slug === targetResident.slug)
          ?.snapshot ?? seedSnapshotForSlug(targetResident.slug),
      );

      const result = executePaymentRequestStep({
        actor,
        actorResident,
        command,
        counterparty,
        counterpartyResident: targetResident,
        holdReserve: options?.holdReserve,
        now: new Date(),
      });

      if (result.kind !== "ok") {
        return result;
      }

      await transaction`
        UPDATE marsbank_registers
        SET snapshot = ${transaction.json(result.actor)}, updated_at = now()
        WHERE resident_slug = ${slug}
      `;
      await transaction`
        UPDATE marsbank_registers
        SET
          snapshot = ${transaction.json(result.counterparty)},
          updated_at = now()
        WHERE resident_slug = ${result.counterpartySlug}
      `;

      return {
        kind: "ok",
        snapshot: result.actor,
        request: result.request,
      };
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

export function createPostgresLedgerRepository(
  sql: postgres.Sql,
): LedgerRepository {
  return new PostgresLedgerRepository(sql);
}
