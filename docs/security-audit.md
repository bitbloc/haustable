# Security audit — haustable POS

Snapshot taken 2026-11-17 from the live project `lxfavbzmebqqsffgyyph` with read-only catalog
queries (`pg_policies`, `has_table_privilege`, `pg_proc`). Nothing was changed. No PIN, phone
number or key value was read out; only shapes and counts.

The design that follows from this inventory is in [security-hardening-plan.md](security-hardening-plan.md).

## 1. Who is who to the database

| Surface | Routes | Database role |
|---|---|---|
| POS terminal, customer display | `/pos`, `/pos/cfd` | `anon`. Staff identify with a 4-digit PIN only; there is no Supabase session. |
| Customer QR order, order status | `/table/:id`, `/table/:id/status` | `anon` (a LINE member may also be signed in) |
| Booking, pickup, shop, tracking, arcade, `/link` | `/booking`, `/pickup`, `/hausmade`, `/t/:token`, `/arcade` | `anon` or a signed-in customer (`authenticated`) |
| Staff phone pages | `/staff/*` (tables, stock, SOP) | `authenticated`, role checked in `StaffAuthLayout` |
| Back office | `/admin/*` | `authenticated`, role checked in `AdminLayout` |
| Edge functions, Vercel `api/*` | — | service role (bypasses RLS) |

Consequence: every write the POS makes is, to the database, indistinguishable from a write by
anyone on the internet holding the public key. The key is in the shipped JavaScript.

## 2. Findings, worst first

1. **Anyone can change or delete live sales data.** `bookings`, `order_items`, `pos_shifts`,
   `promotion_codes`, `tax_invoices`, `tax_customer_profiles`, `stock_items`,
   `recipe_ingredients`, `store_exceptions` each have a policy that is `true` for `anon` for
   INSERT, UPDATE and (except the tax documents, which a trigger protects) DELETE.
2. **Staff PINs are plaintext and guessable.** `profiles.pin` holds 8 four-character PINs in
   clear text. `profiles_select_all` lets `anon` read every column of every profile, so the PINs
   are one request away. Separately, `get_staff_offline_pin_hashes()` hands `anon` an unsalted
   SHA-256 of each PIN with a fixed prefix that is in the shipped JavaScript; with 10,000
   possible PINs that is the same as plaintext. `app_settings.staff_pin_code` (4 characters) is
   also publicly readable; no code reads it any more.
3. **Customer personal data is public (PDPA).** `anon` can read all of `profiles`
   (`phone_number`), `bookings` (`customer_phone`, `phone_number`, `pickup_contact_phone`,
   `shipping_address`), `tax_customer_profiles` (`tax_id`, `phone`, address) and `tax_invoices`
   (`customer_tax_id`, `customer_phone`). `search_member_crm_pos('')` also returns the 40 newest
   members with phone numbers to `anon`.
4. **Two keys are committed to a public repository.**
   - LINE channel access token: `api/send-order-email.js:9`, `supabase/functions/send-line-notify/index.ts:4`.
   - EasySlip API key: `api/verify-slip.js:1`, `supabase/functions/verify-payment-slip/index.ts:8`.
   Neither `LINE_CHANNEL_ACCESS_TOKEN` nor `EASYSLIP_API_KEY` exists as a Supabase secret today,
   so the edge functions are running on the committed values.
5. **`authenticated` means "any signed-in customer".** Many policies (`stock_categories`,
   `stock_transactions`, `blocked_dates`, `haus_checkins`, `store_settings`, `sop_*`,
   `recipe_folders`, `option_choice_ingredients`, `stock_item_barcodes`, `ad_events` delete) only
   test that a session exists. A customer who signs in with LINE passes them.
6. **Lower risk, noted:** `leaderboard` is freely updatable by `anon` (game scores);
   `pos_audit_logs` is publicly readable and insertable; `payment_slips_registry` is publicly
   readable; `bookings` "Admins can …" policies test `role = 'admin'` only and miss `owner`.
   The public (`anon`) JWT is hardcoded in `api/link.js`, `api/send-order-email.js` and
   `scratch/*.js`; that key is public by design and is not a leak.

## 3. What was already hardened before this audit

Kept as is (see `supabase/security_hardening/`): the 8 secret rows of `app_settings` are
admin-only; `store_expenses` and `withholding_tax_records` are back-office only; destructive
functions (`purge_system_data`, `delete_user_by_admin`, …) are not callable by `anon`; tax
documents have database running numbers and cannot be deleted; members cannot raise their own
coins, role or PIN (`guard_profile_privileged_columns`).

## 4. Owner constraints that shape the fix

- Front-of-house staff must be able to issue a full tax invoice from the POS (2026-11-11). The
  POS is `anon`, so `tax_invoices`, `tax_customer_profiles` and the `tax_*` settings cannot be
  restricted to logged-in staff until the POS has an identity of its own.
- The POS must keep working through an internet outage (offline PIN login, offline queue).
- Remote migration history is untracked: never `supabase db push`; apply one reviewed SQL file.

## 5. Every table: RLS, grants, policies, frontend writers

Grants are effective privileges (`has_table_privilege`): S=SELECT I=INSERT U=UPDATE D=DELETE. Writers come from a scan of every `supabase.from('<table>')` call in `src/` and `api/` (file, number of call sites). Writes made inside database functions and edge functions (service role) are not listed here.

### ad_events

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow authenticated delete ad_events | authenticated | DELETE | `true` | `-` |
| Allow public insert to ad_events | anon,authenticated | INSERT | `-` | `true` |
| Allow public read ad_events | anon,authenticated | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/utils/analyticsHelper.js` (1)

### app_settings

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Admins can update settings | public | UPDATE | `is_admin()` | `-` |
| Admins manage settings | public | ALL | `is_admin()` | `-` |
| Public can view settings | public | SELECT | `true` | `-` |
| Public view settings | public | SELECT | `true` | `-` |
| app_settings_secrets_admin_only (restrictive) | public | ALL | `((key <> ALL (ARRAY['easyslip_api_key'::text, 'gemini_api_key'::text, 'line_channel_access_token'::text, 'line_channel_secret'::text, 'notte…` | `((key <> ALL (ARRAY['easyslip_api_key'::text, 'gemini_api_key'::text, 'line_channel_access_token'::t…` |

Frontend writes:

- upsert: `src/AdminSettings.jsx` (2), `src/AdminTableEditor.jsx` (2), `src/components/admin/overview/OwnerPosBroadcastBar.jsx` (1), `src/components/admin/StockReconciliationPage.jsx` (1), `src/components/admin/tax/TaxSettingsTab.jsx` (1), `src/hooks/useHausmadeAdmin.js` (1), `src/utils/geminiOcrHelper.js` (2)
- delete: `src/components/admin/overview/OwnerPosBroadcastBar.jsx` (1)

### arcade_rewards_log

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow insert arcade_rewards_log | public | INSERT | `-` | `(auth.uid() = profile_id)` |
| Allow select arcade_rewards_log | public | SELECT | `((auth.uid() = profile_id) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth…` | `-` |

Frontend writes:

- delete: `src/components/admin/DataPurgePanel.jsx` (1)

### blocked_dates

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Enable read access for all users | public | SELECT | `true` | `-` |
| Enable write access for authenticated | public | ALL | `(auth.role() = 'authenticated'::text)` | `-` |

Frontend writes:

- upsert: `src/components/admin/settings/VisualCalendarBlocker.jsx` (1)
- delete: `src/components/admin/settings/VisualCalendarBlocker.jsx` (1)

### bookings

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Admins can update bookings | public | UPDATE | `(EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))` | `-` |
| Admins can view all bookings | public | SELECT | `(EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))` | `-` |
| Public can delete bookings | anon,authenticated | DELETE | `true` | `-` |
| Public can insert bookings | anon,authenticated | INSERT | `-` | `true` |
| Public can update bookings | anon,authenticated | UPDATE | `true` | `-` |
| Public can view bookings | anon,authenticated | SELECT | `true` | `-` |
| Users can create bookings | public | INSERT | `-` | `(auth.uid() = user_id)` |
| Users can view own bookings | public | SELECT | `(auth.uid() = user_id)` | `-` |

Frontend writes:

- insert: `src/components/admin/AdminTestSandboxModal.jsx` (2), `src/components/admin/ManualBookingModal.jsx` (2), `src/components/shared/TableManager.jsx` (1), `src/hooks/useOrderSubmission.js` (3), `src/hooks/usePOSOrder.js` (3), `src/pos/CustomerOrderLanding.jsx` (1), `src/utils/offlineHelper.js` (2), `src/utils/wmaNativeBridge.js` (1)
- update: `src/AdminBookings.jsx` (2), `src/AdminDashboard.jsx` (1), `src/components/admin/overview/AllDailyBillsHub.jsx` (1), `src/components/admin/overview/SimplifiedLiveOverview.jsx` (1), `src/components/admin/settings/GeneralBookingSettingsTab.jsx` (1), `src/components/admin/tax/SalesTaxReportTab.jsx` (1), `src/components/hausmade/HausmadeOnlineBillModal.jsx` (2), `src/components/shared/TableManager.jsx` (4), `src/hooks/useHausmadeAdmin.js` (3), `src/hooks/usePOSOrder.js` (9), `src/pos/CustomerOrderLanding.jsx` (11), `src/pos/CustomerOrderStatus.jsx` (3), `src/pos/POSDashboard.jsx` (21), `src/pos/POSOnlineHub.jsx` (2), `src/pos/POSOrderPanel.jsx` (3), `src/pos/POSReportsPanel.jsx` (1), `src/pos/POSTableGrid.jsx` (1), `src/TrackingPage.jsx` (2), `src/utils/availabilityUtils.js` (1), `src/utils/offlineHelper.js` (12)
- delete: `src/AdminBookings.jsx` (1), `src/components/admin/AdminTestSandboxModal.jsx` (1), `src/components/admin/DataPurgePanel.jsx` (1)

### haus_checkins

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow admin full access | public | ALL | `(auth.role() = 'authenticated'::text)` | `-` |
| Allow public read access | public | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/components/admin/CheckinManager.jsx` (2), `src/pages/HausCheckinPage.jsx` (1)
- update: `src/components/admin/CheckinManager.jsx` (2)
- delete: `src/components/admin/CheckinManager.jsx` (1), `src/components/admin/DataPurgePanel.jsx` (1)

### leaderboard

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow deleting expired monthly leaderboard scores | anon,authenticated | DELETE | `(created_at < (date_trunc('month'::text, (now() AT TIME ZONE 'Asia/Bangkok'::text)) AT TIME ZONE 'Asia/Bangkok'::text))` | `-` |
| Allow public insert to leaderboard | anon,authenticated | INSERT | `-` | `true` |
| Allow public read access to leaderboard | public | SELECT | `true` | `-` |
| Allow public update to leaderboard | anon,authenticated | UPDATE | `true` | `true` |

Frontend writes:

- insert: `src/pages/arcade/ArcadeClaim.jsx` (1), `src/pages/arcade/ArcadeLobby.jsx` (2)
- update: `src/pages/arcade/ArcadeClaim.jsx` (1), `src/pages/arcade/ArcadeLobby.jsx` (2)
- delete: `src/components/admin/AdminArcade.jsx` (1), `src/components/admin/DataPurgePanel.jsx` (1), `src/pages/arcade/ArcadeLobby.jsx` (1)

### menu_categories

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow menu managers to modify categories | authenticated | ALL | `(can_manage_menu() OR is_admin())` | `(can_manage_menu() OR is_admin())` |
| Public read categories | public | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/admin/components/MenuCategoryList.jsx` (1)
- update: `src/admin/components/MenuCategoryList.jsx` (1), `src/components/admin/marketing/DrinkStampManager.jsx` (1), `src/components/admin/settings/IntegrationsTab.jsx` (5)
- upsert: `src/admin/components/MenuCategoryList.jsx` (1)
- delete: `src/admin/components/MenuCategoryList.jsx` (1)

### menu_item_options

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow menu managers to modify menu_item_options | authenticated | ALL | `(can_manage_menu() OR is_admin())` | `(can_manage_menu() OR is_admin())` |
| Public read menu item options | public | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/admin/components/MenuItemList.jsx` (2), `src/components/hausmade/HausmadeCatalogManager.jsx` (1), `src/components/hausmade/HausmadeProductEditorModal.jsx` (1)
- delete: `src/admin/components/MenuItemList.jsx` (1), `src/components/hausmade/HausmadeProductEditorModal.jsx` (1)

### menu_items

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Admins can delete menu_items | authenticated | DELETE | `(can_manage_menu() OR is_admin())` | `-` |
| Admins can insert menu_items | authenticated | INSERT | `-` | `(can_manage_menu() OR is_admin())` |
| Admins can update menu_items | authenticated | UPDATE | `(can_manage_menu() OR is_admin())` | `(can_manage_menu() OR is_admin())` |
| Admins manage menu | public | ALL | `is_admin()` | `-` |
| Public read menu_items | public | SELECT | `true` | `-` |
| Public view menu | public | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/admin/components/MenuItemList.jsx` (2), `src/components/hausmade/HausmadeCatalogManager.jsx` (2), `src/components/hausmade/HausmadeProductEditorModal.jsx` (2), `src/components/recipes/RecipeBuilder.jsx` (1)
- update: `src/admin/components/MenuCategoryList.jsx` (2), `src/admin/components/MenuItemList.jsx` (5), `src/components/admin/marketing/DrinkStampManager.jsx` (2), `src/components/hausmade/HausmadeCatalogManager.jsx` (6), `src/components/hausmade/HausmadeProductEditorModal.jsx` (2), `src/components/recipes/RecipeBuilder.jsx` (1), `src/hooks/useHausmadeAdmin.js` (1), `src/hooks/useOrderSubmission.js` (1)
- upsert: `src/admin/components/MenuItemList.jsx` (1)
- delete: `src/admin/components/MenuItemList.jsx` (1), `src/components/hausmade/HausmadeCatalogManager.jsx` (1)

### option_choice_ingredients

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| option_choice_ingredients_staff | authenticated | ALL | `true` | `true` |

Frontend writes:

- insert: `src/admin/components/ChoiceIngredientsModal.jsx` (1), `src/components/recipes/MenuOptionStockPanel.jsx` (1)
- update: `src/admin/components/ChoiceIngredientsModal.jsx` (1), `src/components/recipes/MenuOptionStockPanel.jsx` (1)
- delete: `src/admin/components/ChoiceIngredientsModal.jsx` (1), `src/components/recipes/MenuOptionStockPanel.jsx` (1)

### option_choices

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow menu managers to modify option_choices | authenticated | ALL | `(can_manage_menu() OR is_admin())` | `(can_manage_menu() OR is_admin())` |
| Public read option choices | public | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/admin/components/OptionGroupList.jsx` (1), `src/components/hausmade/HausmadeProductEditorModal.jsx` (1)
- update: `src/admin/components/OptionGroupList.jsx` (1)
- delete: `src/admin/components/OptionGroupList.jsx` (2), `src/components/hausmade/HausmadeProductEditorModal.jsx` (1)

### option_groups

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow menu managers to modify option_groups | authenticated | ALL | `(can_manage_menu() OR is_admin())` | `(can_manage_menu() OR is_admin())` |
| Public read option groups | public | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/admin/components/OptionGroupList.jsx` (1), `src/components/hausmade/HausmadeProductEditorModal.jsx` (1)
- update: `src/admin/components/OptionGroupList.jsx` (1), `src/components/hausmade/HausmadeProductEditorModal.jsx` (1)
- delete: `src/admin/components/OptionGroupList.jsx` (1)

### order_item_removals

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| order_item_removals_read | authenticated | SELECT | `true` | `-` |

Frontend writes: none.

### order_items

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Public can delete order_items | anon,authenticated | DELETE | `true` | `-` |
| Public can insert order items | anon,authenticated | INSERT | `-` | `true` |
| Public can update order items | anon,authenticated | UPDATE | `true` | `-` |
| Public can view order items | anon,authenticated | SELECT | `true` | `-` |
| Users can add order items | public | INSERT | `-` | `(EXISTS ( SELECT 1 FROM bookings WHERE ((bookings.id = order_items.booking_id) AND (bookings.user_id…` |
| Users can view own order items | public | SELECT | `(EXISTS ( SELECT 1 FROM bookings WHERE ((bookings.id = order_items.booking_id) AND (bookings.user_id = auth.uid()))))` | `-` |

Frontend writes:

- insert: `src/components/admin/AdminTestSandboxModal.jsx` (2), `src/components/admin/ManualBookingModal.jsx` (1), `src/hooks/useOrderSubmission.js` (2), `src/hooks/usePOSOrder.js` (1), `src/pos/CustomerOrderLanding.jsx` (1), `src/utils/offlineHelper.js` (1), `src/utils/wmaNativeBridge.js` (1)
- update: `src/hooks/usePOSOrder.js` (1), `src/pos/POSDashboard.jsx` (2), `src/utils/offlineHelper.js` (2)
- delete: `src/components/admin/AdminTestSandboxModal.jsx` (1), `src/components/admin/DataPurgePanel.jsx` (1), `src/hooks/usePOSOrder.js` (1)

### payment_slips_registry

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow insert payment_slips_registry | public | INSERT | `-` | `true` |
| Allow public read payment_slips_registry | public | SELECT | `true` | `-` |

Frontend writes:

- delete: `src/components/admin/DataPurgePanel.jsx` (1)

### pos_audit_logs

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow insert pos_audit_logs | public | INSERT | `-` | `true` |
| Allow read pos_audit_logs | public | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/utils/auditLogger.js` (1), `src/utils/shiftHelper.js` (1)
- delete: `src/components/admin/DataPurgePanel.jsx` (1)

### pos_shifts

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| pos_shifts_read | anon,authenticated | SELECT | `true` | `-` |
| pos_shifts_write | anon,authenticated | ALL | `true` | `true` |

Frontend writes:

- update: `src/utils/shiftHelper.js` (4)
- upsert: `src/utils/offlineHelper.js` (1), `src/utils/shiftHelper.js` (1)
- delete: `src/components/admin/DataPurgePanel.jsx` (1)

### profiles

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Admins can update all profiles | public | UPDATE | `is_admin()` | `-` |
| Admins can view all profiles | public | SELECT | `is_admin()` | `-` |
| Users can insert their own profile | public | INSERT | `-` | `(auth.uid() = id)` |
| Users can update own profile | public | UPDATE | `(auth.uid() = id)` | `-` |
| Users can update their own profile | public | UPDATE | `(auth.uid() = id)` | `-` |
| Users can view own profile | public | SELECT | `(auth.uid() = id)` | `-` |
| profiles_select_all | public | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/App.jsx` (1)
- update: `src/AdminMembers.jsx` (5), `src/App.jsx` (1), `src/components/admin/DataPurgePanel.jsx` (1), `src/hooks/useOrderSubmission.js` (3), `src/hooks/usePOSOrder.js` (1), `src/pages/MemberCard.jsx` (1), `src/pos/POSDashboard.jsx` (1), `src/pos/POSOrderPanel.jsx` (1), `src/utils/availabilityUtils.js` (1), `src/utils/offlineHelper.js` (1)

### promotion_codes

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| promotion_codes_read | anon,authenticated | SELECT | `true` | `-` |
| promotion_codes_write | anon,authenticated | ALL | `true` | `true` |

Frontend writes:

- insert: `src/components/admin/marketing/PromoVoucherManager.jsx` (1)
- update: `src/components/admin/marketing/PromoVoucherManager.jsx` (2)
- delete: `src/components/admin/marketing/PromoVoucherManager.jsx` (1)

### push_subscriptions

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Users can delete their own subscriptions | public | DELETE | `(auth.uid() = user_id)` | `-` |
| Users can insert their own subscriptions | public | INSERT | `-` | `(auth.uid() = user_id)` |
| Users can view their own subscriptions | public | SELECT | `(auth.uid() = user_id)` | `-` |

Frontend writes: none.

### recipe_folders

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| recipe_folders_staff | authenticated | ALL | `true` | `true` |

Frontend writes:

- insert: `src/components/admin/RecipeLabPage.jsx` (1)

### recipe_ingredients

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Enable all access for public | public | ALL | `true` | `true` |

Frontend writes:

- insert: `src/components/admin/MoveRecipeToMenuModal.jsx` (1), `src/components/admin/RecipeReadinessPanel.jsx` (1), `src/components/recipes/RecipeBuilder.jsx` (4)
- update: `src/components/admin/RecipeUnitCheckPanel.jsx` (1), `src/utils/recipeUnitChange.js` (1)
- delete: `src/components/admin/MoveRecipeToMenuModal.jsx` (2), `src/components/recipes/RecipeBuilder.jsx` (2)

### recipe_versions

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| recipe_versions_insert | authenticated | INSERT | `-` | `true` |
| recipe_versions_read | authenticated | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/utils/recipeVersions.js` (1)

### sale_stock_shadow

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| sale_stock_shadow_read | authenticated | SELECT | `true` | `-` |

Frontend writes: none.

### song_requests

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow admin/staff all operations on song_requests | authenticated | ALL | `(EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND ((profiles.role = 'admin'::text) OR (profiles.role = 'staff'::text)))…` | `-` |
| Allow public insert song_requests | public | INSERT | `-` | `true` |
| Allow public select song_requests | public | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/pages/AdminSongRequests.jsx` (1), `src/pages/SongRequestPage.jsx` (1)
- update: `src/pages/AdminSongRequests.jsx` (1)
- delete: `src/components/admin/DataPurgePanel.jsx` (1), `src/pages/AdminSongRequests.jsx` (1)

### sop_categories

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| sop_categories_read | anon,authenticated | SELECT | `true` | `-` |
| sop_categories_write | authenticated | ALL | `true` | `true` |

Frontend writes:

- upsert: `src/hooks/useBarSOP.js` (1)
- delete: `src/hooks/useBarSOP.js` (1)

### sop_glass_sizes

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| sop_glass_sizes_read | anon,authenticated | SELECT | `true` | `-` |
| sop_glass_sizes_write | authenticated | ALL | `true` | `true` |

Frontend writes:

- upsert: `src/hooks/useBarSOP.js` (1)

### sop_recipes

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| sop_recipes_read | anon,authenticated | SELECT | `true` | `-` |
| sop_recipes_write | authenticated | ALL | `true` | `true` |

Frontend writes:

- insert: `src/hooks/useBarSOP.js` (1)
- update: `src/components/admin/MoveRecipeToMenuModal.jsx` (1), `src/hooks/useBarSOP.js` (1)
- delete: `src/hooks/useBarSOP.js` (1)

### stock_categories

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Enable read/write for authenticated users | public | ALL | `(auth.role() = 'authenticated'::text)` | `-` |

Frontend writes:

- upsert: `src/components/stock/CategoryManager.jsx` (1)
- delete: `src/components/stock/CategoryManager.jsx` (1)

### stock_count_lines

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| stock_count_lines_read | authenticated | SELECT | `true` | `-` |

Frontend writes: none.

### stock_count_sessions

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| stock_count_sessions_read | authenticated | SELECT | `true` | `-` |

Frontend writes: none.

### stock_deduction_errors

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| stock_deduction_errors_read | authenticated | SELECT | `true` | `-` |

Frontend writes: none.

### stock_deduction_settings

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| stock_deduction_settings_read | authenticated | SELECT | `true` | `-` |

Frontend writes: none.

### stock_item_barcodes

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| stock_item_barcodes_staff | authenticated | ALL | `true` | `true` |

Frontend writes:

- insert: `src/utils/stockBarcodeLink.js` (1)

### stock_items

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Enable all access for public | public | ALL | `true` | `true` |

Frontend writes:

- insert: `src/components/admin/RecipeLabPage.jsx` (2), `src/components/recipes/RecipeBuilder.jsx` (2), `src/components/stock/StockItemForm.jsx` (1)
- update: `src/components/admin/DataPurgePanel.jsx` (1), `src/components/admin/RecipeLabPage.jsx` (2), `src/components/recipes/MenuOptionStockPanel.jsx` (1), `src/components/recipes/RecipeBuilder.jsx` (3), `src/components/stock/StockCountPage.jsx` (1), `src/components/stock/StockItemForm.jsx` (2), `src/StockPage.jsx` (1), `src/utils/stockBarcodeLink.js` (1)
- delete: `src/components/admin/MoveRecipeToMenuModal.jsx` (1), `src/components/admin/RecipeLabPage.jsx` (1), `src/components/stock/StockItemForm.jsx` (1)

### stock_receipt_lines

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| stock_receipt_lines_read | authenticated | SELECT | `true` | `-` |

Frontend writes: none.

### stock_receipts

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| stock_receipts_read | authenticated | SELECT | `true` | `-` |

Frontend writes: none.

### stock_transactions

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Enable read/write for authenticated users | public | ALL | `(auth.role() = 'authenticated'::text)` | `-` |

Frontend writes:

- insert: `src/components/stock/StockItemForm.jsx` (1), `src/StockPage.jsx` (2)
- delete: `src/components/admin/DataPurgePanel.jsx` (1)

### store_exceptions

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| store_exceptions_read | anon,authenticated | SELECT | `true` | `-` |
| store_exceptions_write | anon,authenticated | ALL | `true` | `true` |

Frontend writes: none.

### store_expenses

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| store_expenses_backoffice_only | public | ALL | `is_backoffice_staff()` | `is_backoffice_staff()` |

Frontend writes:

- insert: `src/components/admin/tax/ExpenseModal.jsx` (1)
- update: `src/components/admin/tax/ExpenseModal.jsx` (1)
- delete: `src/components/admin/tax/ExpensesTab.jsx` (1)

### store_settings

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow authenticated update | public | UPDATE | `(auth.role() = 'authenticated'::text)` | `-` |
| Allow public read access | public | SELECT | `true` | `-` |

Frontend writes:

- update: `src/AdminSettings.jsx` (1)

### table_staff_calls

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| table_staff_calls_clear | anon,authenticated | UPDATE | `(cleared_at IS NULL)` | `(cleared_at IS NOT NULL)` |
| table_staff_calls_insert | anon,authenticated | INSERT | `-` | `(cleared_at IS NULL)` |
| table_staff_calls_select | anon,authenticated | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/utils/tableStaffCalls.js` (1)
- update: `src/utils/tableStaffCalls.js` (1)

### tables_layout

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Admins manage layout | public | ALL | `is_admin()` | `-` |
| Public view layout | public | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/AdminTableEditor.jsx` (2)
- update: `src/AdminTableEditor.jsx` (1)
- upsert: `src/AdminTableEditor.jsx` (1)
- delete: `src/AdminTableEditor.jsx` (1)

### tax_customer_profiles

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow authenticated full access to tax_customer_profiles | public | ALL | `true` | `true` |
| Allow full access to tax_customer_profiles | public | ALL | `true` | `true` |

Frontend writes:

- insert: `src/utils/taxCustomerDirectory.js` (1)
- update: `src/components/admin/tax/TaxSettingsTab.jsx` (1), `src/utils/taxCustomerDirectory.js` (1)
- delete: `src/components/admin/tax/TaxSettingsTab.jsx` (1)

### tax_document_counters

RLS on · anon `-` · authenticated `-`

No policies (nobody but the service role and SECURITY DEFINER functions can touch it).

Frontend writes: none.

### tax_invoices

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow all access to tax_invoices | public | ALL | `true` | `true` |
| Allow full access to tax_invoices | public | ALL | `true` | `true` |

Frontend writes:

- insert: `src/components/admin/tax/TaxInvoiceModal.jsx` (1)
- update: `src/components/admin/tax/AdminTaxHub.jsx` (2), `src/components/admin/tax/SalesTaxReportTab.jsx` (1), `src/components/admin/tax/TaxInvoicePrintView.jsx` (1)

### withholding_tax_records

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| withholding_tax_records_backoffice_only | public | ALL | `is_backoffice_staff()` | `is_backoffice_staff()` |

Frontend writes:

- insert: `src/components/admin/tax/WithholdingTaxTab.jsx` (1)
- update: `src/components/admin/tax/WithholdingTaxTab.jsx` (1)

### xhaus_checkout_log

RLS on · anon `-` · authenticated `S`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Admins read xhaus_checkout_log | authenticated | SELECT | `is_admin()` | `-` |

Frontend writes: none.

### xhaus_rewards

RLS on · anon `S,I,U,D` · authenticated `S,I,U,D`

| Policy | Roles | Cmd | USING | WITH CHECK |
|---|---|---|---|---|
| Allow admin write on xhaus_rewards | public | ALL | `(((auth.jwt() ->> 'role'::text) = 'admin'::text) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = …` | `-` |
| Allow public select on xhaus_rewards | public | SELECT | `true` | `-` |

Frontend writes:

- insert: `src/components/admin/marketing/RewardsManager.jsx` (1)
- update: `src/components/admin/marketing/RewardsManager.jsx` (1), `src/hooks/usePOSOrder.js` (1), `src/utils/offlineHelper.js` (1)
- delete: `src/components/admin/marketing/RewardsManager.jsx` (1)

## 6. Functions callable with the public key

SECURITY DEFINER (run with owner rights, bypass RLS) and executable by `anon`:

`auto_confirm_email`, `auto_link_booking_member`, `auto_link_profile_bookings`, `can_manage_menu`, `cancel_order_item_removal`, `check_promotion`, `claim_arcade_rewards`, `claim_order_items_for_print`, `claim_staff_removal_slips`, `deduct_order_stock`, `draw_weekly_arcade_raffle_and_reset`, `find_profile_by_name`, `fn_bookings_telegram_notify`, `fn_order_items_enrich_snapshots`, `fn_order_items_telegram_notify`, `fn_pos_shifts_telegram_notify`, `get_member_service_history`, `get_member_tier_details`, `get_staff_list_safe`, `get_staff_offline_pin_hashes`, `grant_welcome_xhaus`, `handle_new_order_push`, `handle_new_user`, `handle_promotion_usage`, `handle_reward_usage`, `handle_stock_transaction`, `is_admin`, `is_backoffice_staff`, `log_direct_stock_quantity_change`, `log_order_item_removal`, `log_pos_audit_event`, `mark_order_items_printed`, `pos_has_open_shift`, `process_checkout_xhaus`, `process_drink_stamps`, `purge_stale_monthly_leaderboard`, `refund_booking_loyalty`, `register_payment_slip`, `release_order_items_print_claim`, `restore_order_stock`, `reverse_xhaus_on_void`, `save_menu_recipe`, `search_member_crm_pos`, `set_stock_quantity`, `settle_staff_removal_slips`, `stock_closing_status`, `submit_customer_qr_order`, `tax_invoices_before_insert`, `toggle_checkin_likes`, `trg_fn_auto_restore_stock_on_cancel`, `trg_fn_order_item_stock_shadow`, `trg_fn_stock_tx_rebaseline`, `update_stock_quantity`, `verify_staff_pin_login`, `withholding_tax_before_insert`

Not executable by `anon`:

`delete_user_by_admin`, `delete_user_by_admin_impl`, `fn_apply_store_hours_nov9`, `fn_stock_count_telegram_notify`, `fn_telegram_dispatch`, `get_system_record_counts`, `merge_stock_items`, `post_stock_movement`, `produce_prep`, `purge_system_data`, `purge_system_data_impl`, `rebuild_sale_stock_shadow`, `receive_stock`, `record_sale_stock_shadow`, `staff_adjust_order_item`, `stock_balance_at`, `stock_daily_reconciliation`, `stock_rebaseline_ledger`, `stock_recipe_requirements`, `stock_requirements_for_sale`, `submit_staff_order`, `submit_stock_count`, `tax_next_document_number`, `tax_setting`
