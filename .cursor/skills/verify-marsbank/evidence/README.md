# Evidence

Proof artifacts from `scripts/drive.mjs` land here:

```
.cursor/skills/verify-marsbank/evidence/<runId>/<feature>/
```

Typical files: `01-*.png`, `02-*.png`, matching `.aria.txt` snapshots, `register.json`, and `proof.json`.

Cleanup deletes `.run/` only. It never deletes this directory. Screenshots and run folders are gitignored; keep them on disk for the verification report.
