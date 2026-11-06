# Database backups

Backups only ever **read** your database. They run inside one read-only
transaction (Postgres itself refuses any change), and the script also blocks
anything that is not a read. Every backup file is encrypted.

## The one thing you must keep safe

`BACKUP_PASSPHRASE` (in your `.env`). Without it no backup can be opened.
Copy it into a password manager now. Never share it, never commit it.

## Automatic nightly backups (GitHub)

Runs every night at 02:30 Lagos time and keeps each backup for 30 days.
One-time setup — GitHub → your repository → Settings → Secrets and variables
→ Actions → New repository secret:

| Name | Value |
|---|---|
| `DATABASE_URL` | the same value as on Render |
| `BACKUP_PASSPHRASE` | the same value as in your `.env` |

Then GitHub → Actions → **Database backup** → **Run workflow** once to check
it. Each run shows a green tick and a file named `velosales-db-<number>`.

## A backup on your own computer

```
npm run backup          # saves backups/velosales-<date>.vsbak (never committed)
npm run backup:verify   # proves the newest file opens and is complete
```

Do this before any big change, and keep a copy somewhere off your laptop
(for example Google Drive). The file is encrypted, so that is safe.

## If the live database is ever lost

1. Create a **new, empty** database (for example a new Supabase project).
2. Download the newest backup (GitHub → Actions → a green run → Artifacts),
   unzip it, and put the `.vsbak` file in the `backups/` folder.
3. Run, with the NEW database's address:
   ```
   RESTORE_DATABASE_URL="postgresql://…new database…" npm run restore -- backups/<file>.vsbak --yes
   ```
   It refuses to run against your live database, refuses any database that
   already has data, and stops without changing anything if something fails.
4. Put the new address in `DATABASE_URL` on Render and redeploy.

The restore was tested end to end on 6 Nov 2026: 667 rows, every table's
count matched, and ids continued after the restored ones.
