# Production scale-readiness runbook

This runbook is for preparing the student platform for larger enrolment cohorts without changing its user-facing design or business rules.

## What the application now does

- Reuses one Prisma client per running application instance.
- Limits each Prisma instance to a deliberately small database pool through `DATABASE_URL`.
- Writes student and admin session activity at most once every ten minutes instead of on every request.
- Reads the student profile image as part of the session query.
- Uses a direct access decision for lesson playback and progress instead of building the complete course dashboard.
- Saves a visible lesson heartbeat once per minute instead of every 15 seconds.
- Rejects implausible progress increments and burst traffic.
- Keeps schema creation out of the progress hot path.
- Adds indexes used by student course-access decisions.
- Provides an owner-only database readiness endpoint at `/api/internal/system/readiness`.

The in-process request limiter is a first line of defence. It is intentionally bounded so it cannot grow without limit. Because Vercel runs more than one application instance, enforce public endpoint limits at the Vercel Firewall as well.

## Current database constraint

The audited MySQL server had:

- `max_connections`: 151
- peak observed connections: 52
- InnoDB buffer pool: 128 MB

The buffer pool is the clearest resource constraint. Increasing only `max_connections` would let more requests compete for the same small memory allocation and can make failure worse.

## Recommended database target

For the next stage, use a managed MySQL service or a dedicated database server with:

- 2–4 vCPUs
- 4 GB RAM minimum
- SSD-backed storage
- automated daily backups and point-in-time recovery
- a 2 GB InnoDB buffer pool when the host is dedicated to MySQL
- connection monitoring and slow-query logging
- a private or allow-listed connection path

For a large scheduled launch or a target above roughly 1,000 simultaneously active learners, move to 8 GB RAM, load test first, and size from measured p95 latency and peak connections.

## How to upgrade the database resource

The database address is a direct IP, so the repository does not identify the hosting provider. Use the matching path below.

### If MySQL is on a VPS

1. In the VPS provider dashboard, take a full snapshot.
2. Create and verify a logical database backup:

   ```bash
   mysqldump --single-transaction --routines --triggers --databases DB_NAME > pre-upgrade.sql
   ```

3. Resize the VPS to at least 2 vCPUs and 4 GB RAM.
4. In the MySQL configuration file, set a conservative baseline:

   ```ini
   [mysqld]
   innodb_buffer_pool_size=2G
   innodb_buffer_pool_instances=2
   max_connections=200
   thread_cache_size=50
   wait_timeout=300
   interactive_timeout=300
   slow_query_log=ON
   long_query_time=1
   ```

5. Restart MySQL during a maintenance window.
6. Verify:

   ```sql
   SHOW VARIABLES WHERE Variable_name IN
     ('max_connections', 'innodb_buffer_pool_size', 'wait_timeout');
   SHOW GLOBAL STATUS WHERE Variable_name IN
     ('Threads_connected', 'Threads_running', 'Max_used_connections', 'Aborted_connects');
   ```

Do not copy the values blindly if the VPS also runs other memory-heavy software. The database should not be allowed to consume all host memory.

### If MySQL is managed by a hosting provider

1. Take an on-demand backup or snapshot.
2. Select the next plan with at least 2 vCPUs and 4 GB RAM.
3. Enable automated backups and point-in-time recovery.
4. Enable the provider’s connection proxy/pool endpoint if it offers one.
5. Keep the original direct endpoint available for migrations and emergency rollback.
6. Record the provider’s connection ceiling and maintenance window.

If the provider cannot offer a pool/proxy endpoint, metrics, automated recovery and at least 4 GB RAM, migrate to a managed MySQL provider before a large launch.

## Application connection settings

Set the production `DATABASE_URL` to the pool/proxy endpoint when one is available. Start with:

```text
mysql://USER:PASSWORD@HOST:3306/DB_NAME?connection_limit=2&pool_timeout=10&connect_timeout=10
```

- `connection_limit=2` caps each Vercel function instance.
- `pool_timeout=10` prevents requests waiting indefinitely for a connection.
- `connect_timeout=10` fails predictably when the database cannot be reached.

If no proxy exists, these parameters still protect the database per application instance, but they do not create a shared pool across Vercel instances.

To change the setting in Vercel:

1. Open the Vercel project.
2. Go to **Settings → Environment Variables**.
3. Edit `DATABASE_URL` for Production and Preview as appropriate.
4. Save it.
5. Do not redeploy until the database resize, backup and migration checks are complete.

A Vercel environment change only affects a new deployment. Deployment must remain a separate, explicitly approved step.

## Migration order

1. Back up the database.
2. Resize or migrate the database.
3. Apply `prisma/migrations/20260730180000_student_scale_readiness/migration.sql`.
4. Run the owner-only readiness check.
5. Run type checking and the production build.
6. Run the load test against a non-production environment.
7. Deploy during a monitored window.

The migration is idempotent for the new indexes and does not delete or rewrite student data.

## Readiness endpoint

While signed in as the owner, request:

```text
GET /api/internal/system/readiness
```

It reports connection use, buffer-pool size, configured application pool parameters, required indexes and warnings. It never returns the database password or host.

Treat these as release blockers:

- database check returns HTTP 503;
- scale-readiness indexes are missing;
- peak connections are at or above 70% of `max_connections`;
- the buffer pool is below 1 GB for the intended production scale;
- p95 application latency exceeds 1.5 seconds in the staged load test;
- error rate exceeds 1%.

## Load-test procedure

Install k6 on the operator’s machine, create a dedicated test learner in a staging environment, then run:

```bash
BASE_URL=https://staging.example.com \
STUDENT_SESSION_COOKIE=REDACTED \
LESSON_ID=123 \
k6 run scripts/load/student-learning.k6.js
```

The test ramps through 25 and 100 active virtual learners. Increase in stages—250, 500 and 1,000—only when the previous stage meets the thresholds. Never point a high-volume test at production without an approved test window.

Monitor during each run:

- Vercel function errors, duration and concurrency;
- MySQL `Threads_connected`, `Threads_running` and CPU;
- p95 and p99 response time;
- failed playback-authorisation and progress requests;
- Cloudflare Stream delivery errors.

## Failure and recovery checks

Before launch, verify:

- payment callbacks are idempotent;
- enrolment retries do not create duplicate access;
- external email, WhatsApp and analytics failures do not reverse a successful payment or enrolment;
- scheduled reconciliation repairs incomplete post-payment work;
- database backups can actually be restored;
- Cloudflare Stream signed playback still works when the application is under load;
- the system shows a recoverable error when MySQL or an external provider times out.

## Remaining infrastructure work

Code changes cannot provision these services:

- database CPU/RAM and backup upgrades;
- a provider-managed MySQL proxy/pool;
- Vercel Firewall rate-limit rules;
- central error monitoring and alerts.

Recommended production additions are Vercel Firewall rate limiting for authentication and learner-write endpoints, plus Sentry (or an equivalent APM) with alerts for HTTP 5xx, slow database calls and payment/enrolment failures.
