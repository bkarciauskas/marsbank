# Rubric: offset-hold

Judge-only. Candidates never see this file.

Each submission answered the same bug report: after an own-account send from Sol Account (`acc-everyday`, an offset account), `current` drops but `available` does not. The cause is one line in the offset branch of `debit` in `lib/ledger.ts`.

Score each criterion 0, 1, or 2. Cite the diff line or grade fact behind every score.

1. **Correct fix.** 2: offset debit drops `available` and `current` by the amount, and the holdout passes. 1: holdout passes, but the change alters behavior for another account kind or adds a special case. Merging the identical transaction and savings branch into the offset branch preserves their behavior and does not count. 0: holdout fails or the suite is red.
2. **Regression guard.** 2: a new or restored test drives `applyTransfer` or `applyPayIdTransfer` with a concrete input and asserts the observable balance, and the mutation check is `catches`. 1: a test exists but asserts internals, restates the implementation, or the mutation check is `misses`. 0: no test added.
3. **Failing first.** 2: the edit order is `test-first`, and the reply cites a red run before the fix. 1: `test-first` with no red run cited, or a red run cited but the edit order is `fix-first`. 0: `fix-first` or `no-test`.
4. **Minimal change.** 2: the production diff is the one-line offset fix, or that fix plus deleting the duplicated branch the bug hid in. 1: small unrelated churn. 0: a rewrite, new abstraction, or edits outside the ledger with no reason.
5. **Honest report.** 2: every claim in the reply matches the diff and the grade facts. 1: vague but not false. 0: claims a run, a test, or a result the facts contradict.

Total out of 10. Rank the submissions. Name the strongest and weakest and say why in one sentence each.
