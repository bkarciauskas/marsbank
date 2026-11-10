------------------------------- MODULE MC ----------------------------------
(* Bounded instances of TransferLedger.  Amounts are lib/fixtures.ts       *)
(* registers scaled down: what matters is which side of each check         *)
(* (available, limit, owed, solSendRemaining) an amount lands on.  Aaron   *)
(* holds more tokens (3) than the sol limit (2), so the funds check and    *)
(* the sol-limit check each stop a different send.                         *)
EXTENDS TransferLedger

MCResidentOrder == <<"aaron", "ben">>

MCSeed == [r \in {"aaron", "ben"} |->
             IF r = "aaron" THEN [everyday |-> 3, owed |-> 2]
                            ELSE [everyday |-> 1, owed |-> 0]]

SendBen1      == [id |-> "send-ben-1",       from |-> "aaron", kind |-> "payid",
                  src |-> "acc-everyday", dst |-> "ben", amt |-> 1]
SendBen2      == [id |-> "send-ben-2",       from |-> "aaron", kind |-> "payid",
                  src |-> "acc-everyday", dst |-> "ben", amt |-> 2]
SendOutside1  == [id |-> "send-outside-1",   from |-> "aaron", kind |-> "payid",
                  src |-> "acc-everyday", dst |-> External, amt |-> 1]
BenSendsBack1 == [id |-> "ben-sends-back-1", from |-> "ben", kind |-> "payid",
                  src |-> "acc-everyday", dst |-> "aaron", amt |-> 1]
PayCard2      == [id |-> "pay-card-2",       from |-> "aaron", kind |-> "own",
                  src |-> "acc-everyday", dst |-> "acc-credit", amt |-> 2]
PayCard3      == [id |-> "pay-card-3",       from |-> "aaron", kind |-> "own",
                  src |-> "acc-everyday", dst |-> "acc-credit", amt |-> 3]
CashAdvance1  == [id |-> "cash-advance-1",   from |-> "aaron", kind |-> "own",
                  src |-> "acc-credit", dst |-> "acc-everyday", amt |-> 1]

(* Three sends racing for Aaron's register.  PayID to Ben (2) plus PayID   *)
(* outside (1) passes the sol limit; PayID to Ben (2) plus the card        *)
(* payment (2) passes his 3 tokens.  The one card payment equals the       *)
(* seeded owed, which keeps overpayment (its own finding) out of this set. *)
ContentionIntents == {SendBen2, SendOutside1, PayCard2}

(* Aaron and Ben pay each other at once (both rows, opposite directions)  *)
(* while Aaron takes a cash advance against his card limit.               *)
CrossingIntents == {SendBen2, BenSendsBack1, CashAdvance1}

(* One send and a resident who presses "Send tokens" again after "network". *)
RetryIntents == {SendBen1}

(* Aaron owes 2 on Expedition Credit and pays 3 into it. *)
OverpayIntents == {PayCard3}
=============================================================================
