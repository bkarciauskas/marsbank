import { describe, expect, it } from "vitest";
import { demoResidentBySlug, seedSnapshotForSlug } from "./fixtures";
import { accountId } from "./ids";
import { applyIncomingResidentTransfer, applyPayIdTransfer, sentThisSol } from "./ledger";
import { tokens } from "./money";

const morning = new Date("2026-08-26T10:00:00.000Z");

describe("MARS-26: inbound PayID credits must not count toward the per-sol send limit", () => {
  it("leaves sentThisSol at zero after another resident pays an incoming transfer", () => {
    const cameron = structuredClone(seedSnapshotForSlug("cameron"));
    const afterAaronPays = applyIncomingResidentTransfer(
      cameron,
      {
        amount: tokens(200_000),
        description: "Habitat supply top-up",
        requestId: "req-mars-26",
        senderEmail: "aaron@marsbank.mars",
        senderName: "Aaron Vale",
      },
      morning,
    );

    expect(sentThisSol(afterAaronPays, morning)).toBe(0);
  });

  it("allows a 60,000 token PayID send after receiving 200,000 tokens the same sol", () => {
    const cameron = structuredClone(seedSnapshotForSlug("cameron"));
    const ben = demoResidentBySlug("ben");
    if (!ben) throw new Error("missing ben");

    const afterAaronPays = applyIncomingResidentTransfer(
      cameron,
      {
        amount: tokens(200_000),
        description: "Habitat supply top-up",
        requestId: "req-mars-26",
        senderEmail: "aaron@marsbank.mars",
        senderName: "Aaron Vale",
      },
      morning,
    );

    const sendToBen = applyPayIdTransfer(
      afterAaronPays,
      {
        from: accountId("acc-everyday"),
        amount: tokens(60_000),
        description: "",
        payee: {
          scheme: "payid",
          id: ben.email,
          displayName: ben.givenName,
          institution: "Mars Bank",
        },
        stepUpConfirmed: true,
      },
      morning,
    );

    expect(sendToBen.kind).toBe("ok");
    if (sendToBen.kind === "ok") {
      expect(sentThisSol(sendToBen.snapshot, morning)).toBe(60_000);
    }
  });
});