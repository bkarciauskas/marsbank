#!/usr/bin/env bash
# Model-checks TransferLedger.tla in every scenario below and runs the
# step-contract test against the real lib/ code. Exits 0 only when every
# outcome matches the recorded baseline (passes pass, findings and broken
# variants fail on the named property).
#
#   bash verification/transfer-ledger/check.sh            # everything
#   bash verification/transfer-ledger/check.sh baseline   # scenarios whose name contains "baseline"
#   bash verification/transfer-ledger/check.sh --drift    # covered files changed since the sync commit
#   bash verification/transfer-ledger/check.sh --set LockRows=FALSE baseline
#       # apply a model switch on top of every scenario, to mirror a code change
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
TLA_VERSION="1.7.4"
TLA_SHA256="936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88"
TOOLS="$HERE/.tools"
JAR="$TOOLS/tla2tools-$TLA_VERSION.jar"
OUT="$HERE/out"

drift() {
  local sync
  sync="$(tr -d '[:space:]' < "$HERE/sync-commit")"
  mapfile -t files < <(grep -v '^#' "$HERE/covered-files.txt" | sed '/^$/d')
  echo "Sync commit: $sync"
  if git -C "$ROOT" diff --quiet "$sync" -- "${files[@]}"; then
    echo "Covered files match the sync commit (working tree included)."
  else
    echo "Covered files changed since the sync commit:"
    git -C "$ROOT" diff --stat "$sync" -- "${files[@]}"
  fi
}

if [[ "${1:-}" == "--drift" ]]; then
  drift
  exit 0
fi

EXTRA=""
while [[ "${1:-}" == "--set" ]]; do
  EXTRA="$EXTRA $2"
  shift 2
done

command -v java >/dev/null || { echo "Install a Java 11+ runtime (java on PATH)." >&2; exit 2; }
mkdir -p "$TOOLS" "$OUT"
if [[ ! -f "$JAR" ]]; then
  curl -fsSL -o "$JAR.tmp" \
    "https://github.com/tlaplus/tlaplus/releases/download/v$TLA_VERSION/tla2tools.jar"
  mv "$JAR.tmp" "$JAR"
fi
echo "$TLA_SHA256  $JAR" | sha256sum -c --quiet - || { echo "tla2tools.jar checksum mismatch" >&2; exit 2; }

ALL_INVARIANTS="TypeOK NoOverdraw TokensConserved RequestAppliedOnce SolLimitHeld EachSendPostsOnce"

# name | expected (pass, or the property that must fail) | overrides | invariants (default: all)
SCENARIOS=(
  "baseline-contention-postgres|pass|Backend=\"postgres\" Intents<-ContentionIntents|"
  "baseline-contention-memory|pass|Backend=\"memory\" Intents<-ContentionIntents|"
  "baseline-crossing-postgres|pass|Backend=\"postgres\" Intents<-CrossingIntents|"
  "baseline-crossing-memory|pass|Backend=\"memory\" Intents<-CrossingIntents|"
  "baseline-reset-postgres|pass|Backend=\"postgres\" Intents<-ContentionIntents MaxResets=1 MaxAborts=0|"
  "finding-retry-postgres|EachSendPostsOnce|Backend=\"postgres\" Intents<-RetryIntents ClientRetries=TRUE|"
  "finding-retry-memory|EachSendPostsOnce|Backend=\"memory\" Intents<-RetryIntents ClientRetries=TRUE|"
  "finding-overpay-memory|TokensConserved|Backend=\"memory\" Intents<-OverpayIntents|"
  "reference-retry-same-request-id-postgres|pass|Backend=\"postgres\" Intents<-RetryIntents ClientRetries=TRUE ClientReusesRequestId=TRUE|"
  "broken-no-funds-check|NoOverdraw|Backend=\"postgres\" Intents<-ContentionIntents CheckFunds=FALSE|TypeOK NoOverdraw"
  "broken-no-row-lock-conservation|TokensConserved|Backend=\"postgres\" Intents<-ContentionIntents LockRows=FALSE|TypeOK TokensConserved"
  "broken-no-row-lock-sol-limit|SolLimitHeld|Backend=\"postgres\" Intents<-ContentionIntents LockRows=FALSE|TypeOK SolLimitHeld"
  "broken-no-sol-check|SolLimitHeld|Backend=\"memory\" Intents<-ContentionIntents CheckSolLimit=FALSE|TypeOK SolLimitHeld"
  "broken-no-recipient-credit|TokensConserved|Backend=\"memory\" Intents<-CrossingIntents CreditRecipient=FALSE|TypeOK TokensConserved"
  "broken-no-request-claim|RequestAppliedOnce|Backend=\"postgres\" Intents<-ContentionIntents ClaimRequest=FALSE|TypeOK RequestAppliedOnce"
  "broken-no-processed-check|RequestAppliedOnce|Backend=\"memory\" Intents<-ContentionIntents MemoryChecksProcessed=FALSE|TypeOK RequestAppliedOnce"
)

write_cfg() {
  local overrides="$1" invariants="$2" cfg="$3"
  declare -A c=(
    [Backend]='= "postgres"' [Residents]='= {"aaron", "ben"}'
    [ResidentOrder]='<- MCResidentOrder' [Seed]='<- MCSeed' [Intents]='<- ContentionIntents'
    [CreditLimit]='= 3' [SolLimit]='= 2' [MaxDeliveries]='= 4' [MaxAborts]='= 1' [MaxResets]='= 0'
    [ClientRetries]='= FALSE' [ClientReusesRequestId]='= FALSE' [DuplicateDelivery]='= TRUE'
    [CheckFunds]='= TRUE' [CheckSolLimit]='= TRUE' [CreditRecipient]='= TRUE'
    [ClaimRequest]='= TRUE' [LockRows]='= TRUE' [MemoryChecksProcessed]='= TRUE'
  )
  local o
  for o in $overrides; do
    if [[ "$o" == *"<-"* ]]; then c[${o%%<-*}]="<- ${o#*<-}"; else c[${o%%=*}]="= ${o#*=}"; fi
  done
  {
    echo "SPECIFICATION Spec"
    echo "CONSTANTS"
    for k in "${!c[@]}"; do echo "    $k ${c[$k]}"; done | sort
    echo "INVARIANTS"
    for i in ${invariants:-$ALL_INVARIANTS}; do echo "    $i"; done
  } > "$cfg"
}

filter="${1:-}"
status=0
printf '%-44s %-20s %-20s %s\n' SCENARIO EXPECTED GOT TIME
for row in "${SCENARIOS[@]}"; do
  IFS='|' read -r name expected overrides invariants <<< "$row"
  [[ -n "$filter" && "$name" != *"$filter"* ]] && continue
  cfg="$OUT/$name.cfg"
  write_cfg "$overrides $EXTRA" "$invariants" "$cfg"
  start=$SECONDS
  (cd "$HERE" && java -XX:+UseParallelGC -cp "$JAR" tlc2.TLC -workers auto -cleanup \
     -metadir "$OUT/states-$name" -config "$cfg" MC.tla > "$OUT/$name.txt" 2>&1) || true
  rm -rf "$OUT/states-$name"
  if grep -q "Model checking completed. No error has been found." "$OUT/$name.txt"; then
    got=pass
  elif violated="$(grep -oP 'Error: Invariant \K\w+(?= is violated)' "$OUT/$name.txt")"; then
    got="$violated"
  elif grep -q "Deadlock reached" "$OUT/$name.txt"; then
    got=deadlock
  else
    got=tlc-error
  fi
  mark=ok
  if [[ "$got" != "$expected" ]]; then mark=MISMATCH; status=1; fi
  printf '%-44s %-20s %-20s %ss %s\n' "$name" "$expected" "$got" "$((SECONDS - start))" "$mark"
done

if [[ -z "$filter" || "step-contract" == *"$filter"* ]]; then
  echo
  echo "step-contract (real lib/ code, vitest):"
  (cd "$ROOT" && npx vitest run verification/transfer-ledger/step-contract.test.ts) || status=1
fi

echo
drift
echo
if [[ -n "$EXTRA" ]]; then
  echo "Ran with --set$EXTRA on every scenario; compare against the baseline in the skill, not this exit code." >&2
fi
if [[ $status -eq 0 ]]; then
  echo "All outcomes match the baseline. Traces: $OUT/<scenario>.txt"
else
  echo "Outcome differs from the baseline. Read $OUT/<scenario>.txt for each MISMATCH." >&2
fi
exit $status
