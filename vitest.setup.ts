import { beforeEach, vi } from "vitest";
import { createLedgerFetch } from "./test-utils/ledger-fetch";

beforeEach(() => {
  vi.stubGlobal("fetch", createLedgerFetch());
});
