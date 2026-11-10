--------------------------- MODULE TransferLedger ---------------------------
(***************************************************************************)
(* Mars Bank transfers, from "Send tokens" in the browser to the register. *)
(*                                                                         *)
(* Real code each part stands for:                                         *)
(*   ClientPost / ClientRetry / ClientGivesUp / Respond                    *)
(*       lib/store.tsx postTransfer (requestId: crypto.randomUUID())       *)
(*       components/banking/transfer-form.tsx post() and the "network"     *)
(*       message "Try sending again."                                      *)
(*   Redeliver   the same POST /api/transfers body arriving twice          *)
(*       (app/api/transfers/route.ts passes requestId through unchanged)   *)
(*   MemServe    lib/server/ledger-repository.ts                           *)
(*       MemoryLedgerRepository.transfer inside exclusive()                *)
(*   PgClaim .. PgCommit, PgAbort   lib/server/ledger-repository.ts        *)
(*       PostgresLedgerRepository.transfer inside sql.begin()              *)
(*   Apply       lib/shared-ledger.ts applySharedTransfer, which calls     *)
(*       lib/ledger.ts applyTransfer / applyPayIdTransfer (debit, credit,  *)
(*       solSendRemaining) and applyIncomingResidentTransfer               *)
(*   Reset       MemoryLedgerRepository.resetAll /                         *)
(*       PostgresLedgerRepository.resetAll                                 *)
(*                                                                         *)
(* A register holds only what the properties need: acc-everyday (the Sol   *)
(* offset account, available = current), acc-credit (owed, limit) and the  *)
(* tokens sent by PayID this sol (sentThisSol).                            *)
(***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS
    Backend,               \* "memory" | "postgres": getLedgerRepository()
    Residents,             \* demoResidents slugs in the model
    ResidentOrder,         \* Residents as [slug, targetSlug].sort() orders them
    Seed,                  \* [r |-> [everyday, owed]]: seedSnapshotForSlug
    CreditLimit,           \* DEMO_CREDIT_LIMIT, scaled
    SolLimit,              \* SOL_SEND_LIMIT, scaled
    Intents,               \* sends a resident reviews and confirms once each
    MaxDeliveries,         \* bound on POST /api/transfers bodies
    MaxAborts,             \* bound on rolled-back Postgres transactions
    MaxResets,             \* bound on resetAll
    ClientRetries,         \* resident presses "Send tokens" again after "network"
    ClientReusesRequestId, \* FALSE: postTransfer mints a fresh randomUUID per call
    DuplicateDelivery,     \* a body can reach the route twice
    \* Broken-variant switches. TRUE is the code as written.
    CheckFunds,            \* debit(): available < amount / owed + amount > limit
    CheckSolLimit,         \* applyPayIdTransfer: amount > solSendRemaining
    CreditRecipient,       \* repository writes result.recipient
    ClaimRequest,          \* INSERT INTO marsbank_transfer_requests ON CONFLICT
    LockRows,              \* SELECT ... FROM marsbank_registers FOR UPDATE
    MemoryChecksProcessed  \* this.processed.get(requestId)

ASSUME Backend \in {"memory", "postgres"}

Accounts == {"acc-everyday", "acc-credit"}
External == "external"           \* a PayID that is no demo resident's email
IntentIds == {i.id : i \in Intents}
Rids == 1..MaxDeliveries         \* request IDs; one fresh ID per postTransfer call
NoRow == [slug |-> "none", result |-> "none"]
Fail(kind) == [result |-> kind]

Max(a, b) == IF a > b THEN a ELSE b

RECURSIVE SumOver(_, _)
SumOver(f, S) == IF S = {} THEN 0
                 ELSE LET x == CHOOSE y \in S : TRUE IN f[x] + SumOver(f, S \ {x})

SeedRegister == [r \in Residents |-> [everyday |-> Seed[r].everyday,
                                      owed     |-> Seed[r].owed,
                                      sent     |-> 0]]

(* recipientSlug(): a PayID to another resident's email credits that resident. *)
Target(i) == IF i.kind = "payid" /\ i.dst \in Residents /\ i.dst # i.from
             THEN i.dst ELSE "none"

(* lockSlugs = targetSlug ? [slug, targetSlug].sort() : [slug] *)
LockList(i) == SelectSeq(ResidentOrder,
                         LAMBDA r : r = i.from \/ r = Target(i))

(***************************************************************************)
(* Apply: applySharedTransfer on the sender (s) and recipient (t) snapshots *)
(* the transaction read.  Returns the result kind, the new snapshots, and  *)
(* tokens that left the bank (PayID to a non-resident).                    *)
(***************************************************************************)
Ok(s, t, out) == [result |-> "ok", sender |-> s, recipient |-> t, outflow |-> out]

Apply(i, s, t) ==
    LET a == i.amt IN
    IF i.kind = "own" THEN
        IF i.src = "acc-everyday" THEN
            \* debit(offset): available < amount -> null -> insufficient-funds
            IF CheckFunds /\ s.everyday < a THEN Fail("insufficient-funds")
            \* credit(credit): owed = max(0, owed - amount)
            ELSE Ok([s EXCEPT !.everyday = @ - a, !.owed = Max(0, @ - a)], t, 0)
        ELSE
            \* debit(credit): owed + amount > limit -> null -> credit-limit
            IF CheckFunds /\ s.owed + a > CreditLimit THEN Fail("credit-limit")
            ELSE Ok([s EXCEPT !.owed = @ + a, !.everyday = @ + a], t, 0)
    ELSE
        \* applyPayIdTransfer from acc-everyday
        IF CheckSolLimit /\ a > Max(0, SolLimit - s.sent) THEN Fail("sol-limit")
        ELSE IF CheckFunds /\ s.everyday < a THEN Fail("insufficient-funds")
        ELSE LET s2 == [s EXCEPT !.everyday = @ - a, !.sent = @ + a] IN
             IF Target(i) = "none" THEN Ok(s2, t, a)
             \* applyIncomingResidentTransfer credits acc-everyday
             ELSE IF CreditRecipient THEN Ok(s2, [t EXCEPT !.everyday = @ + a], 0)
             ELSE Ok(s2, t, 0)

VARIABLES
    reg,           \* committed registers (marsbank_registers / this.registers)
    outflow,       \* tokens sent to non-resident PayIDs
    reqTable,      \* committed marsbank_transfer_requests rows / this.processed
    keyLock,       \* request_id inserted by a transaction not yet committed
    rowLock,       \* FOR UPDATE row locks
    dl,            \* POST /api/transfers bodies and their server progress
    nextRid,
    client,        \* the transfer form per intent
    aborts, resets,
    applied,       \* ghost: committed ok results per request ID since reset
    intentApplied, \* ghost: committed ok results per intent since reset
    paidOut        \* ghost: PayID tokens that actually left each resident

vars == <<reg, outflow, reqTable, keyLock, rowLock, dl, nextRid, client,
          aborts, resets, applied, intentApplied, paidOut>>

Unused == [rid |-> 0, intent |-> "none", origin |-> FALSE, pc |-> "unused",
           nlocked |-> 0, snap |-> SeedRegister, out |-> Fail("none")]

IntentById(id) == CHOOSE i \in Intents : i.id = id
Slots == {d \in 1..MaxDeliveries : dl[d].pc = "unused"}
StartPc == IF Backend = "memory" THEN "serve" ELSE "claim"

Init ==
    /\ reg = SeedRegister
    /\ outflow = 0
    /\ reqTable = [k \in Rids |-> NoRow]
    /\ keyLock = [k \in Rids |-> 0]
    /\ rowLock = [r \in Residents |-> 0]
    /\ dl = [d \in 1..MaxDeliveries |-> Unused]
    /\ nextRid = 0
    /\ client = [i \in IntentIds |-> [st |-> "review", rid |-> 0]]
    /\ aborts = 0
    /\ resets = 0
    /\ applied = [k \in Rids |-> 0]
    /\ intentApplied = [i \in IntentIds |-> 0]
    /\ paidOut = [r \in Residents |-> 0]

NewDelivery(d, rid, id, origin) ==
    dl' = [dl EXCEPT ![d] = [Unused EXCEPT !.rid = rid, !.intent = id,
                                           !.origin = origin, !.pc = StartPc]]

(* transfer-form post(): "Send tokens" -> postTransfer -> fetch *)
ClientPost(id) ==
    /\ client[id].st = "review"
    /\ nextRid < MaxDeliveries
    /\ \E d \in Slots :
        /\ NewDelivery(d, nextRid + 1, id, TRUE)
        /\ nextRid' = nextRid + 1
        /\ client' = [client EXCEPT ![id] = [st |-> "posting", rid |-> nextRid + 1]]
    /\ UNCHANGED <<reg, outflow, reqTable, keyLock, rowLock, aborts, resets,
                   applied, intentApplied, paidOut>>

(* "network": the form returns to collect with "Try sending again."; the  *)
(* resident reviews and presses "Send tokens", and postTransfer runs anew. *)
ClientRetry(id) ==
    /\ ClientRetries
    /\ client[id].st = "network"
    /\ \E d \in Slots :
        IF ClientReusesRequestId
        THEN /\ NewDelivery(d, client[id].rid, id, TRUE)
             /\ client' = [client EXCEPT ![id].st = "posting"]
             /\ UNCHANGED nextRid
        ELSE /\ nextRid < MaxDeliveries
             /\ NewDelivery(d, nextRid + 1, id, TRUE)
             /\ nextRid' = nextRid + 1
             /\ client' = [client EXCEPT ![id] = [st |-> "posting", rid |-> nextRid + 1]]
    /\ UNCHANGED <<reg, outflow, reqTable, keyLock, rowLock, aborts, resets,
                   applied, intentApplied, paidOut>>

(* fetch rejects (dropped connection, timeout) while the server may still *)
(* be working: postTransfer's catch returns { kind: "network" }.          *)
ClientGivesUp(d) ==
    /\ ClientRetries       \* without a retry, giving up changes nothing the properties read
    /\ dl[d].origin
    /\ dl[d].pc \notin {"unused", "done"}
    /\ client[dl[d].intent].st = "posting"
    /\ dl' = [dl EXCEPT ![d].origin = FALSE]
    /\ client' = [client EXCEPT ![dl[d].intent].st = "network"]
    /\ UNCHANGED <<reg, outflow, reqTable, keyLock, rowLock, nextRid, aborts,
                   resets, applied, intentApplied, paidOut>>

Redeliver(d) ==
    /\ DuplicateDelivery
    /\ dl[d].origin
    /\ dl[d].pc # "unused"
    /\ \E e \in Slots : NewDelivery(e, dl[d].rid, dl[d].intent, FALSE)
    /\ UNCHANGED <<reg, outflow, reqTable, keyLock, rowLock, nextRid, client,
                   aborts, resets, applied, intentApplied, paidOut>>

(* The route answers.  ok -> "posted"; a TransferFailure -> the form's    *)
(* error; a thrown transaction (500) -> transferFromPayload fails ->       *)
(* "network".                                                              *)
Respond(d) ==
    /\ dl[d].pc = "respond"
    /\ dl' = [dl EXCEPT ![d] = [Unused EXCEPT !.rid = dl[d].rid,
                                              !.intent = dl[d].intent,
                                              !.pc = "done"]]
    /\ IF dl[d].origin
       THEN client' = [client EXCEPT ![dl[d].intent].st =
                CASE dl[d].out.result = "ok"    -> "posted"
                  [] dl[d].out.result = "error" -> "network"
                  [] OTHER                      -> "rejected"]
       ELSE UNCHANGED client
    /\ UNCHANGED <<reg, outflow, reqTable, keyLock, rowLock, nextRid, aborts,
                   resets, applied, intentApplied, paidOut>>

Replayed(d) ==
    LET row == reqTable[dl[d].rid] IN
    IF row.slug = IntentById(dl[d].intent).from /\ row.result # "none"
    THEN Fail(row.result) ELSE Fail("invalid-payid")

(* Install an Apply result: registers, request row, ghosts. *)
Install(d, res) ==
    LET i == IntentById(dl[d].intent)
        k == dl[d].rid
        ok == res.result = "ok"
    IN
    /\ reg' = IF ~ok THEN reg
              ELSE IF Target(i) = "none" THEN [reg EXCEPT ![i.from] = res.sender]
              ELSE [reg EXCEPT ![i.from] = res.sender, ![Target(i)] = res.recipient]
    /\ outflow' = IF ok THEN outflow + res.outflow ELSE outflow
    /\ reqTable' = [reqTable EXCEPT ![k] = [slug |-> i.from, result |-> res.result]]
    /\ applied' = IF ok THEN [applied EXCEPT ![k] = @ + 1] ELSE applied
    /\ intentApplied' = IF ok THEN [intentApplied EXCEPT ![i.id] = @ + 1]
                        ELSE intentApplied
    /\ paidOut' = IF ok /\ i.kind = "payid"
                  THEN [paidOut EXCEPT ![i.from] = @ + i.amt] ELSE paidOut

(* MemoryLedgerRepository.transfer: the whole body runs inside exclusive() *)
(* with no await, so it is one step.                                       *)
MemServe(d) ==
    /\ dl[d].pc = "serve"
    /\ LET i == IntentById(dl[d].intent) IN
       IF MemoryChecksProcessed /\ reqTable[dl[d].rid] # NoRow
       THEN /\ dl' = [dl EXCEPT ![d].pc = "respond", ![d].out = Replayed(d)]
            /\ UNCHANGED <<reg, outflow, reqTable, applied, intentApplied, paidOut>>
       ELSE LET t == IF Target(i) = "none" THEN reg[i.from] ELSE reg[Target(i)]
                res == Apply(i, reg[i.from], t)
            IN /\ Install(d, res)
               /\ dl' = [dl EXCEPT ![d].pc = "respond", ![d].out = Fail(res.result)]
    /\ UNCHANGED <<keyLock, rowLock, nextRid, client, aborts, resets>>

(* INSERT INTO marsbank_transfer_requests ... ON CONFLICT DO NOTHING       *)
(* RETURNING.  Postgres makes a second insert of an uncommitted key wait;  *)
(* after commit it conflicts, and the SELECT that follows (same            *)
(* transaction, nothing in between can change a committed row) replays.   *)
PgClaim(d) ==
    /\ dl[d].pc = "claim"
    /\ LET k == dl[d].rid IN
       IF ~ClaimRequest
       THEN /\ dl' = [dl EXCEPT ![d].pc = "lock"]
            /\ UNCHANGED keyLock
       ELSE /\ keyLock[k] = 0
            /\ IF reqTable[k] # NoRow
               THEN /\ dl' = [dl EXCEPT ![d].pc = "respond", ![d].out = Replayed(d)]
                    /\ UNCHANGED keyLock
               ELSE /\ keyLock' = [keyLock EXCEPT ![k] = d]
                    /\ dl' = [dl EXCEPT ![d].pc = "lock"]
    /\ UNCHANGED <<reg, outflow, reqTable, rowLock, nextRid, client, aborts,
                   resets, applied, intentApplied, paidOut>>

(* One SELECT ... FOR UPDATE per slug in lockSlugs order.  Under READ     *)
(* COMMITTED the locked read sees the latest committed snapshot.          *)
PgLock(d) ==
    /\ dl[d].pc = "lock"
    /\ LET L == LockList(IntentById(dl[d].intent)) IN
       IF dl[d].nlocked = Len(L)
       THEN /\ dl' = [dl EXCEPT ![d].pc = "apply"]
            /\ UNCHANGED rowLock
       ELSE LET r == L[dl[d].nlocked + 1] IN
            /\ IF LockRows
               THEN /\ rowLock[r] = 0
                    /\ rowLock' = [rowLock EXCEPT ![r] = d]
               ELSE UNCHANGED rowLock
            /\ dl' = [dl EXCEPT ![d].snap[r] = reg[r], ![d].nlocked = @ + 1]
    /\ UNCHANGED <<reg, outflow, reqTable, keyLock, nextRid, client, aborts,
                   resets, applied, intentApplied, paidOut>>

(* applySharedTransfer and the UPDATEs.  Writes stay private to the       *)
(* transaction until COMMIT, so one step covers them.                     *)
PgApply(d) ==
    /\ dl[d].pc = "apply"
    /\ LET i == IntentById(dl[d].intent)
           t == IF Target(i) = "none" THEN dl[d].snap[i.from] ELSE dl[d].snap[Target(i)]
       IN dl' = [dl EXCEPT ![d].pc = "commit",
                           ![d].out = Apply(i, dl[d].snap[i.from], t)]
    /\ UNCHANGED <<reg, outflow, reqTable, keyLock, rowLock, nextRid, client,
                   aborts, resets, applied, intentApplied, paidOut>>

Release(d) ==
    /\ rowLock' = [r \in Residents |-> IF rowLock[r] = d THEN 0 ELSE rowLock[r]]
    /\ keyLock' = [k \in Rids |-> IF keyLock[k] = d THEN 0 ELSE keyLock[k]]

(* COMMIT: registers and the request row become visible together. *)
PgCommit(d) ==
    /\ dl[d].pc = "commit"
    /\ Install(d, dl[d].out)
    /\ Release(d)
    /\ dl' = [dl EXCEPT ![d].pc = "respond", ![d].snap = SeedRegister,
                        ![d].nlocked = 0, ![d].out = Fail(dl[d].out.result)]
    /\ UNCHANGED <<nextRid, client, aborts, resets>>

(* The transaction throws (connection drop, statement timeout, deadlock   *)
(* victim) before COMMIT: everything rolls back and the route answers 500. *)
PgAbort(d) ==
    /\ dl[d].pc \in {"claim", "lock", "apply", "commit"}
    /\ aborts < MaxAborts
    /\ aborts' = aborts + 1
    /\ Release(d)
    /\ dl' = [dl EXCEPT ![d].pc = "respond", ![d].out = Fail("error"),
                        ![d].snap = SeedRegister, ![d].nlocked = 0]
    /\ UNCHANGED <<reg, outflow, reqTable, nextRid, client, resets, applied,
                   intentApplied, paidOut>>

(* resetAll.  Postgres: LOCK TABLE marsbank_transfer_requests IN ACCESS    *)
(* EXCLUSIVE MODE waits for every transfer transaction that has touched    *)
(* the table, and blocks new ones until the reset commits.                 *)
Reset ==
    /\ resets < MaxResets
    /\ Backend = "postgres" =>
         \A d \in 1..MaxDeliveries : dl[d].pc \notin {"lock", "apply", "commit"}
    /\ resets' = resets + 1
    /\ reg' = SeedRegister
    /\ outflow' = 0
    /\ reqTable' = [k \in Rids |-> NoRow]
    /\ applied' = [k \in Rids |-> 0]
    /\ intentApplied' = [i \in IntentIds |-> 0]
    /\ paidOut' = [r \in Residents |-> 0]
    /\ UNCHANGED <<keyLock, rowLock, dl, nextRid, client, aborts>>

Quiet == \A d \in 1..MaxDeliveries : dl[d].pc \in {"unused", "done"}

Next ==
    \/ \E id \in IntentIds : ClientPost(id) \/ ClientRetry(id)
    \/ \E d \in 1..MaxDeliveries :
         \/ ClientGivesUp(d) \/ Redeliver(d) \/ Respond(d)
         \/ MemServe(d)
         \/ PgClaim(d) \/ PgLock(d) \/ PgApply(d) \/ PgCommit(d) \/ PgAbort(d)
    \/ Reset
    \/ (Quiet /\ UNCHANGED vars)

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
(* Properties.  Each one is a promise to a resident. *)

(* No balance goes below zero and no card goes past its limit. *)
NoOverdraw ==
    \A r \in Residents :
        /\ reg[r].everyday >= 0
        /\ reg[r].owed >= 0
        /\ reg[r].owed <= CreditLimit

(* A transfer moves tokens; it never creates or destroys them.  The sum of *)
(* registerPosition().net over residents, plus tokens sent to non-resident *)
(* PayIDs, stays what resetAll seeded.                                     *)
Net == [r \in Residents |-> reg[r].everyday - reg[r].owed]
SeedNet == SumOver([r \in Residents |-> Seed[r].everyday - Seed[r].owed], Residents)
TokensConserved == SumOver(Net, Residents) + outflow = SeedNet

(* A request ID moves tokens at most once ("applies a request ID only once"). *)
RequestAppliedOnce == \A k \in Rids : applied[k] <= 1

(* PayID tokens that actually left a resident this sol stay within SOL_SEND_LIMIT. *)
SolLimitHeld == \A r \in Residents : paidOut[r] <= SolLimit

(* One confirmed "Send tokens" moves tokens at most once, even after "Try sending again". *)
EachSendPostsOnce == \A id \in IntentIds : intentApplied[id] <= 1

TypeOK ==
    /\ \A d \in 1..MaxDeliveries :
         dl[d].pc \in {"unused", "serve", "claim", "lock", "apply", "commit",
                       "respond", "done"}
    /\ \A id \in IntentIds :
         client[id].st \in {"review", "posting", "posted", "rejected", "network"}
=============================================================================
