# Security hardening plan — haustable POS

Design by Claude Fable 5.2, 2026-11-17. Inventory: [security-audit.md](security-audit.md).
Implementation follows this document; where the code disagrees with an assumption written
here, stop and report instead of improvising.

## 0. Ground rules

- Nothing here is applied to production by an agent. Production is touched only with
  read-only catalog queries (`supabase db query --remote --read-only`) and a schema-only dump.
- Never `supabase db push`, never `functions deploy`, never `git push`.
- No data is deleted. Plaintext PINs are moved to a locked backup table, not dropped.
- If a policy change would break a screen, the policy is left alone and the screen goes on the
  Phase B list (section 5).
- Anything that could make `/pos` unusable, even briefly, is listed in section 6 and needs the
  owner's approval before it is applied.

## 1. The constraint that decides the phasing

The POS, the customer QR page, booking, pickup and tracking all talk to the database as `anon`.
The POS alone has about 150 direct table calls (`POSDashboard.jsx` 75, `usePOSOrder.js` 27,
`offlineHelper.js` 24, `shiftHelper.js` 11, …). Taking `anon` off `bookings`, `order_items`,
`pos_shifts`, `tax_invoices` or `profiles` today stops the shop.

So the work splits in two:

- **Phase A (this branch):** everything that can be closed without changing how any public or
  POS screen talks to the database. Verified against a local copy of the production schema.
- **Phase B (needs the owner's go-ahead, separate work):** give the POS an identity, move the
  customer flows behind RPCs, then remove `anon` from the sales tables.

## 2. Phase A1 — secrets out of the repository

Committed values to remove (all four places hold a live key):

| File | Today | After |
|---|---|---|
| `api/send-order-email.js:9` | `process.env.LINE_CHANNEL_ACCESS_TOKEN \|\| '<token>'` | env only |
| `supabase/functions/send-line-notify/index.ts:4` | literal token | `Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')` |
| `api/verify-slip.js:1` | `DEFAULT_EASYSLIP_KEY` fallback | request key, else `process.env.EASYSLIP_API_KEY` |
| `supabase/functions/verify-payment-slip/index.ts:8` | `DEFAULT_EASYSLIP_KEY` fallback | unchanged precedence: a non-empty `app_settings.easyslip_api_key` wins, else the request key, else `Deno.env.get('EASYSLIP_API_KEY')` |

Found during implementation: the same EasySlip key is also compiled into the browser bundle
(`src/utils/slipVerificationHelper.js`, sent with every slip check), used as a default in
`src/AdminSettings.jsx` and `GeneralBookingSettingsTab.jsx`, and seeded by migration
`20260901000000`; the LINE token is also in `scratch/sql_archive/update_line_token.sql`. All
are removed (A1b). After that the browser sends a key only when the back-office setting holds
one; otherwise the server resolves it.

Failing loudly:

- `verify-slip` (both): no key resolved → HTTP 500, body
  `{ success: false, error: 'EASYSLIP_API_KEY is not configured' }`, and `console.error`.
  Never fall through to a default.
- `send-line-notify`: no token → HTTP 500 with `LINE_CHANNEL_ACCESS_TOKEN is not configured`.
- `send-order-email` sends email, LINE and Discord in one call. A missing LINE token must not
  take the email down with it: log `console.error('[send-order-email] LINE_CHANNEL_ACCESS_TOKEN is not configured')`
  on every call and report it in the response body (a `line` field saying it was not sent and
  why). Keep the existing response shape otherwise.

Also add `.env.example` at the repo root: every variable name the code reads
(`import.meta.env.*`, `process.env.*`, `Deno.env.get(*)`), grouped by where it is set (Vite
build, Vercel, Supabase secrets), with empty values and a one-line comment each. No values.

Out of scope: the public `anon` JWT hardcoded in `api/link.js`, `api/send-order-email.js:107`
and `scratch/` is public by design. Git history is not rewritten; the owner rotates both keys.

Deployment order (owner): set the env vars first, deploy second. Deploying first breaks LINE
notifications and slip verification (see section 6).

## 3. Phase A2 — close the writes no public screen needs

Migration `supabase/migrations/20261117120000_lock_backoffice_only_writes.sql`, rollback
`supabase/security_hardening/06_lock_backoffice_only_writes_ROLLBACK.sql` (recreates the exact
policies listed in the audit). One transaction. Uses the existing `public.is_backoffice_staff()`.

| Table | Remove | Add | Why it is safe |
|---|---|---|---|
| `promotion_codes` | `promotion_codes_write` (ALL, true) | ALL for `authenticated` where `is_backoffice_staff()` | Only `PromoVoucherManager` writes. Usage counting is the SECURITY DEFINER trigger `handle_promotion_usage`. Public SELECT stays: the POS reads codes. |
| `store_exceptions` | `store_exceptions_write` | same pattern | No frontend writer at all. SELECT stays. |
| `stock_items` | `Enable all access for public` | ALL for `authenticated` where `is_backoffice_staff()` | Every reader and writer is under `/admin` or `/staff` (signed in). Sales deduction runs in SECURITY DEFINER functions. |
| `recipe_ingredients` | `Enable all access for public` | same pattern | Same. |
| `bookings` | `Public can delete bookings` | DELETE for `authenticated` where `is_backoffice_staff()` | Only `AdminBookings`, `AdminTestSandboxModal`, `DataPurgePanel` delete. The POS voids by updating status. |
| `pos_shifts` | `pos_shifts_write` (ALL, true) | INSERT and UPDATE for `anon, authenticated` (true); DELETE for back office | POS opens/closes shifts with insert/update/upsert; only `DataPurgePanel` deletes. |
| `tax_customer_profiles` | both ALL-true policies | SELECT, INSERT, UPDATE for `public` (true); DELETE for back office | POS searches and upserts; only `TaxSettingsTab` deletes. |
| `app_settings` | — | add `staff_pin_code` to the key list of `app_settings_secrets_admin_only` | No code reads it except the admin settings form. |

Before writing each statement the implementer must confirm the "why it is safe" column
against the code: (a) no `anon` screen reads or writes the table, including embedded selects
such as `select('*, stock_items(name)')`; (b) no SECURITY INVOKER trigger or function that runs
during an `anon` write touches it (check the triggers on `bookings` and `order_items`); (c) the
edge functions that touch it (`stock-api`, `telegram-report`, `line-webhook`,
`get-tracking-info`) use the service role key. If any check fails for a table, drop that table
from the migration and add it to section 5.

Not in this migration (still open after Phase A, by necessity): INSERT/UPDATE on `bookings`,
`order_items`, `pos_shifts`; DELETE on `order_items` (the POS removes lines); everything on
`tax_invoices`; public SELECT on `bookings`, `profiles`, `tax_*`, `promotion_codes`.

## 4. Phase A3 — staff PINs

### 4.1 Why not a `pin_hash` column on `profiles`

A 4-digit PIN has 10,000 values. Any hash of it that an attacker can read is cracked in
minutes, bcrypt included. `profiles` is publicly readable, so the hash must live where neither
`anon` nor `authenticated` can select it. The same reasoning retires
`get_staff_offline_pin_hashes()`.

### 4.2 Migration

`supabase/migrations/20261117130000_staff_pin_hashing.sql`, rollback
`supabase/security_hardening/07_staff_pin_hashing_ROLLBACK.sql`. One transaction. pgcrypto is
installed in schema `extensions`; every function sets `search_path = public, extensions`.

1. `public.staff_pin_credentials (profile_id uuid PK → profiles(id) ON DELETE CASCADE,
   pin_hash text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid)`.
   RLS on, no policies, `REVOKE ALL … FROM PUBLIC, anon, authenticated`.
2. `public.staff_pin_legacy_backup (profile_id uuid PK, pin text NOT NULL, backed_up_at
   timestamptz NOT NULL DEFAULT now())`, locked the same way. Exists only so the rollback can
   restore the old column. The owner drops it once the new login has run for a week.
3. Copy `profiles.pin` into the backup, insert
   `crypt(btrim(pin), gen_salt('bf', 10))` into `staff_pin_credentials` for every non-empty
   PIN, then `UPDATE profiles SET pin = NULL`. The column stays (the trigger
   `guard_profile_privileged_columns` and old clients still name it). Check which triggers fire
   on that UPDATE (`auto_link_profile_bookings` in particular) and make sure the statement has
   no side effect beyond clearing the column.
4. `verify_staff_pin_login(p_pin text)` — same name, same return type
   `TABLE(id uuid, display_name text, role text)`, so the POS login code does not change.
   Rejects anything that is not 4–8 digits, then returns the staff member whose
   `pin_hash = crypt(p_pin, pin_hash)`, with the same staff-role predicate as today.
   EXECUTE for `anon, authenticated`.
5. `admin_set_staff_pin(p_profile_id uuid, p_pin text) RETURNS void` — SECURITY DEFINER,
   raises `42501` unless `is_admin()`. Empty/NULL PIN deletes the credential. Otherwise
   validates 4–8 digits, raises `23505` (`PIN already in use`) if another credential matches the
   same PIN (login is by PIN alone, so PINs must stay unique), then upserts the hash.
   EXECUTE for `authenticated` only.
6. `admin_staff_pin_status() RETURNS TABLE(profile_id uuid, updated_at timestamptz)` —
   returns rows only when `is_admin()`. EXECUTE for `authenticated` only.
7. `DROP FUNCTION public.get_staff_offline_pin_hashes()`.

Rollback: restore `profiles.pin` from the backup table, recreate the three old functions from
the definitions recorded in the audit, drop the new functions and `staff_pin_credentials`
(keep the backup table).

### 4.3 Client changes

- `src/pos/POSDashboard.jsx`: no change expected (same RPC). Confirm that a successful online
  login still calls `saveOfflineStaffCredential`.
- `src/utils/staffAuthHelper.js`: remove the call to `get_staff_offline_pin_hashes` and the
  code that only served it. Keep the device-local cache written at a successful online login
  (decision D1 below). When online, drop cached entries whose staff id is no longer returned by
  `get_staff_list_safe`, so a removed staff member cannot log in offline on that device.
  Update `src/utils/__tests__/pos_offline_pin_and_network.test.js` to match.
- `src/AdminMembers.jsx`: stop reading and writing `profiles.pin`. Set, change, generate and
  clear a PIN through `admin_set_staff_pin`; show "has PIN / no PIN" from
  `admin_staff_pin_status`. A PIN can no longer be revealed later: a generated PIN is shown
  once, right after it is set. Remove PIN from the member search filter. Surface the
  "PIN already in use" error in Thai. Keep the existing visual design; this is a UI change, so
  the Design QA in `CLAUDE.md` applies (the planner runs it).

### 4.4 Two places this deliberately differs from the brief

- **D1 — offline login stays.** The brief says to remove every client-side PIN comparison.
  Doing so removes offline login, and the POS must survive an internet outage. What is removed
  is the server handing hashes to anyone; what stays is a per-device cache created only by a
  successful online login. Cost: a staff member must have logged in online on a device once
  before they can log in offline on it, and a changed PIN keeps working offline on a device
  until that person next logs in online there.
- **D2 — the verify RPC returns who logged in, not a boolean.** POS login is by PIN alone; a
  boolean cannot say which staff member it was. It returns id, display name and role, which
  `get_staff_list_safe` already publishes. No secret leaves the database.

### 4.5 Residual risk after Phase A3

`verify_staff_pin_login` is callable by `anon`, so 10,000 PINs can still be tried online.
Throttling it without a device identity lets an attacker lock the staff out instead, so it is
not added here. It is closed properly in Phase B (only a signed-in POS device may call it).

## 5. Phase B — screens that still need `anon` writes, and what each needs

Not built in this branch. Listed per the rule "stop and list the screen and the RPC".

| Screen | What it does as `anon` today | What it needs |
|---|---|---|
| POS `/pos` (`POSDashboard`, `usePOSOrder`, `POSOrderPanel`, `POSTableGrid`, `POSOnlineHub`, `POSReportsPanel`, `POSBillDetailsModal`, `shiftHelper`, `offlineHelper`, `TableManager`, `wmaNativeBridge`) | insert/update `bookings`, insert/update/delete `order_items`, insert/update `pos_shifts`, insert `pos_audit_logs`, read `profiles`, read/insert/update `tax_invoices` and `tax_customer_profiles` | A POS device session: each terminal signs in once to Supabase Auth as a device account (role `pos_device`); policies become `TO authenticated USING (is_pos_device() OR is_backoffice_staff())`. Recommended over rewriting ~150 calls as RPCs. PIN login then also requires the device session. |
| Customer QR order `/table/:id` (`CustomerOrderLanding`) | insert `bookings`, 11 direct updates of `bookings`, insert `order_items`, read `profiles` | `submit_customer_qr_order` (exists) for every write; new `customer_qr_update_order(p_booking_id, p_token, …)` for the edits; member lookup through an RPC that returns one member, not the table |
| Order status `/table/:id/status` (`CustomerOrderStatus`) | 3 updates of `bookings` | `customer_qr_order_action(p_booking_id, p_token, p_action)` and a token-scoped read |
| Booking / pickup / shop checkout (`useOrderSubmission`, `BookingCheckout`, `PickupPage`, `HausmadeShopPage`) | insert `bookings` and `order_items`, update `menu_items` (stock count), update `profiles` | `submit_public_order(payload jsonb)` that validates prices server-side and does the stock decrement itself |
| Tracking `/t/:token` (`TrackingPage`, `useTrackingLogic`) | 2 updates of `bookings`, reads `bookings` and `promotion_codes` | `tracking_get(p_token)`, `tracking_update(p_token, …)`; `get-tracking-info` edge function already covers part of the read |
| Availability (`availabilityUtils`, `useAvailability`) | reads all `bookings`, 1 update | `get_table_availability(p_date)` returning counts only, no customer columns |
| Arcade (`ArcadeLobby`, `ArcadeClaim`) | insert/update/delete `leaderboard` | `submit_arcade_score(...)` |

Once those exist: remove `anon` from `bookings`, `order_items`, `pos_shifts`, `tax_invoices`,
`tax_customer_profiles`, `pos_audit_logs`; replace `profiles_select_all` with own-row plus
staff; restrict `promotion_codes` SELECT; replace the `auth.role() = 'authenticated'` policies
(audit finding 5) with `is_backoffice_staff()`; throttle PIN attempts per device.

## 6. What could interrupt the POS, and when

| Step | Risk to `/pos` | Mitigation |
|---|---|---|
| Deploying A1 before the env vars are set | Slip verification and LINE notifications fail until they are set. Ordering and payment by cash still work. | Set `LINE_CHANNEL_ACCESS_TOKEN` and `EASYSLIP_API_KEY` in Vercel and in Supabase secrets first, then deploy. |
| Rotating the keys | Same failure between rotating and updating the env vars. | Do both in one sitting, after closing time. |
| Applying A2 | None expected: no POS call is covered. | Verified by `scripts/verify-rls.mjs`; apply after closing; rollback file ready. |
| Applying A3 | Online PIN login keeps working (same RPC). Until the new frontend is deployed, the back-office "set PIN" form writes a column nobody reads any more. A device where a staff member never logged in online cannot log them in offline. | Apply after closing, deploy the frontend immediately after, have each staff member log in once on each terminal while online. |
| Phase B | Every POS terminal must sign in as a device once; a mistake in a policy stops ordering. | Separate plan, staged, with the owner present. Not started. |

## 7. Proof (`scripts/verify-rls.mjs`)

Plain Node (ESM) using `@supabase/supabase-js`, no new dependency. Reads `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from the environment and **refuses to run
unless the URL host is `127.0.0.1` or `localhost`**.

Local database: the repository's migrations cannot rebuild the schema from zero (the base
tables predate them), so the local stack is started from an empty work directory, loaded with
a schema-only dump of production (`supabase db dump --linked --schema public`, no data), and
then the two new migration files are applied on top. The script header documents the exact
commands.

The script seeds its own fixtures with the service role (an admin user, a staff profile with a
PIN, a plain customer, a booking with one order item, a promotion code, a stock item, a recipe
line, a tax customer), then prints one line per check and exits non-zero on any failure:

- `anon` must fail: delete a booking; insert/update/delete `promotion_codes`,
  `store_exceptions`; read or write `stock_items`, `recipe_ingredients`; delete `pos_shifts`,
  `tax_customer_profiles`; read `staff_pin_credentials`, `staff_pin_legacy_backup`; find any
  non-null `profiles.pin`; read `app_settings.staff_pin_code`; call
  `get_staff_offline_pin_hashes`, `admin_set_staff_pin`, `admin_staff_pin_status`.
  ("Fail" for RLS means zero rows affected and the row still there, checked with the service
  role, not merely the absence of an error.)
- `anon` must still succeed (the public and POS flows): read `menu_items`, `menu_categories`,
  `tables_layout`, ordinary `app_settings`, `promotion_codes`; insert a booking and an order
  item; update the booking; insert and update a shift; insert and read a tax invoice; insert
  and update a tax customer; `verify_staff_pin_login` returns the staff member for the right
  PIN and nothing for a wrong one; `check_promotion`.
- A signed-in plain customer must fail the same back-office writes.
- A signed-in admin must succeed: delete a booking, write a promotion code, read stock, set a
  PIN, and be refused a duplicate PIN.
- A final section prints, as `OPEN (Phase B)`, the things that are still reachable by `anon`
  on purpose, so the output cannot be read as "everything is closed".
