Sol Account available is wrong after an own-account send.

When Cameron sends 10,000 tokens from Sol Account to the habitat loan (Between my accounts), the transfer posts and Total / current move, but Available stays put. Offset debit must drop `available` and `current` together. After a 10,000 send from `acc-everyday`, `available` must be 10,000 lower.

Order of operations. Invoke these project skills in order. Do not skip them or invent substitutes:

1. Create a new /canvas as a progress tracker (do not delete other canvases). Link it in chat. Details below.

2. Start with /tdd. Write a focused regression for offset available debit first. Do not change production ledger code until that test has failed for this bug. Save the failing run output (command + assertion) on the canvas before you touch the fix. Then make the smallest ledger change that satisfies the test. Re-run the same command. Save the passing run output on the canvas. Prefer a unit test next to `lib/ledger.test.ts`.

3. After the test is green, follow verify-marsbank. Launch the isolated instance (not :3000). Doctor it. Drive `transfer` as Cameron. Require `acc-everyday.available` dropped by 10,000 versus the pre-transfer register. Put the evidence dir, screenshots, and before/after register files on the canvas and in the PR body.

4. Open a ready PR for the test and the fix. Do not merge. Do not push to `main`.

Separate commits for each distinct step that changed code (failing test, then fix). Do not bundle them.

Progress tracking:

- Update the canvas as you enter each step so I can see where you are.

- Below the latest canvas, keep snapshot history of prior canvas content as toggle dropdowns. Expanded, each dropdown must look exactly like that earlier canvas state.

- On each canvas update, show elapsed time. At goal completion, include total running time.
