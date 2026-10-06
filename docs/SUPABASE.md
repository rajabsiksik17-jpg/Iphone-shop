# Running Nuqta on Supabase

Nuqta uses Supabase in a **hybrid** setup:

| Supabase service | Used for | Notes |
| --- | --- | --- |
| **Postgres** | All data (Prisma) | App connects through the transaction pooler; migrations through the direct connection. |
| **Storage** | Product images, banners, avatars | Uploaded server-side with the service-role key; served from Supabase's CDN. |
| **Row Level Security** | Defence in depth | Enabled on every table with no policies, so Supabase's auto-generated REST/GraphQL APIs expose nothing. |
| Auth | *Not used* | Nuqta keeps its own auth (roles, granular permissions, admin OTP, audit log). |
| Realtime | *Not used* — see below | Live chat and admin badges use the built-in Socket.IO server. |

## 1. Create the project

1. Create a project at [supabase.com](https://supabase.com) (pick the region closest to your customers, e.g. *Frankfurt* for Jordan).
2. **Project Settings → Database → Connection string**:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`
   - **Direct connection** or **Session pooler** (port `5432`) → `DIRECT_URL`
3. **Storage → New bucket** named `media`, **Public bucket: ON** (images are public; only the server can write).
4. **Project Settings → API**: copy the **Project URL** and the **service_role** key.

## 2. Environment

```env
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres

STORAGE_DRIVER=supabase
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
SUPABASE_STORAGE_BUCKET=media
```

> **Security:** the service-role key bypasses every database check. It is read only on the
> server (`src/server/env.ts`) and the app refuses to start if a secret-looking variable uses
> the `NEXT_PUBLIC_` prefix. Do not commit `.env`. The anon key is not needed.

## 3. Migrate and seed

```bash
npx prisma migrate deploy
SEED_DEMO=false SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='a-long-password' npm run db:seed
```

Migrations run over `DIRECT_URL` (see `prisma.config.ts`); the pooler cannot run DDL.

## 4. What RLS protects

Migration `20261008100000_rls`:

- enables RLS on **every** table in `public` (73 today) and installs an event trigger that enables it on future tables (skipped gracefully if the role lacks the privilege — then add `ALTER TABLE … ENABLE ROW LEVEL SECURITY` to new migrations);
- revokes all privileges from Supabase's `anon` and `authenticated` roles.

The app's own connection uses the table owner, which RLS does not restrict, so all access
control stays in the server (session checks, `adminRun(permission)`, per-customer ownership
checks). A leaked anon key therefore cannot read customers, orders, carts or settings.

You can verify in the SQL editor:

```sql
select tablename from pg_tables where schemaname = 'public' and not rowsecurity;  -- expect only _prisma_migrations
```

## 5. Realtime (why Socket.IO, not Supabase Realtime)

Live chat and admin counters push **private** data (customer messages, order alerts). Supabase
Realtime authorizes private channels with **Supabase Auth** JWTs and RLS policies on
`realtime.messages`. Because Nuqta deliberately keeps its own authentication, a browser could not
prove its identity to Supabase Realtime without issuing custom JWTs — and public channels would
leak data. The bundled Socket.IO server authenticates every socket with the same session cookies as
the app and joins rooms per permission/conversation, so it is the secure choice here.

Consequence for hosting: run the app as a **long-lived Node process** (`npm run build && npm start`
on Railway, Render, Fly.io, a VPS, Docker…). Serverless-only hosts that cannot keep WebSocket
connections open are not supported for the realtime features.

## 6. Moving existing local media

Images uploaded while `STORAGE_DRIVER=local` keep their `/media/...` URLs and are still served by
the app from `STORAGE_DIR`. New uploads go to Supabase. To move old files, upload the contents of
`storage/` to the bucket with the same paths and update `Media.url` / `renditions` to the public
bucket URL.
