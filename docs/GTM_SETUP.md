# GTM setup for /link click events

Container: **GTM-NPVTXNM9** · Google Ads: **AW-11227095880** · GA4: **G-D1M18Z54LM**

The page `/link` (`api/link.js`) pushes these events to `dataLayer`. Each push looks like
`{ event: 'click_booking', target_destination: '/booking', page_path: '/link' }`.

Checked against the live container on 2026-11-17: only `click_line`, `click_call` and
`click_directions` have triggers. Every other event below reaches `dataLayer` but nothing
listens for it, so neither GA4 nor Google Ads counts it.

## What is wired today (copy this pattern)

| dataLayer event    | Trigger (Custom Event) | Google Ads conversion tag      | GA4 event tag |
|--------------------|------------------------|--------------------------------|---------------|
| `click_line`       | event equals `click_line`       | label `XCmICO2BwOEcEMjGv-kp` | `Line` |
| `click_directions` | event equals `click_directions` | label `QU1qCJHHvcocEMjGv-kp` | `MAPS` |
| `click_call`       | event equals `click_call`       | label `tBbmCO-Vr-EcEMjGv-kp` | `CALL` |

## To add (by hand in the GTM UI)

### 1. Triggers: Triggers → New → Trigger type **Custom Event**

Create one per row, *Event name* exactly as written, *This trigger fires on* **All Custom Events**:

| Trigger name           | Event name            |
|------------------------|-----------------------|
| CE - click_booking     | `click_booking`       |
| CE - click_pickup      | `click_pickup`        |
| CE - click_instagram   | `click_instagram`     |
| CE - click_facebook    | `click_facebook`      |
| CE - click_faq         | `click_faq`           |
| CE - click_checkin_board | `click_checkin_board` |
| CE - click_lineman     | `click_lineman`       |

### 2. GA4 event tags: Tags → New → **Google Analytics: GA4 Event**

Same settings as the existing `Line` / `MAPS` / `CALL` tags (Measurement ID `G-D1M18Z54LM`).
Add the event parameter `target_destination` = `{{DLV - target_destination}}` (create a
Data Layer Variable named `target_destination` if it doesn't exist yet).

| Tag name               | Event name           | Firing trigger          |
|------------------------|----------------------|-------------------------|
| GA4 - click_booking    | `click_booking`      | CE - click_booking      |
| GA4 - click_pickup     | `click_pickup`       | CE - click_pickup       |
| GA4 - click_instagram  | `click_instagram`    | CE - click_instagram    |
| GA4 - click_facebook   | `click_facebook`     | CE - click_facebook     |
| GA4 - click_faq        | `click_faq`          | CE - click_faq          |
| GA4 - click_checkin_board | `click_checkin_board` | CE - click_checkin_board |
| GA4 - click_lineman    | `click_lineman`      | CE - click_lineman      |

### 3. Google Ads conversions: only booking and pickup clicks

1. In Google Ads → Goals → Conversions → New conversion action → Website → manual setup,
   create **"Click: จองโต๊ะ (/link)"** and **"Click: สั่งรับหน้าร้าน (/link)"**. Copy each
   conversion label.
2. **Set both as _Secondary_ actions.** `booking_complete` and `pickup_complete` are already
   primary conversions with a real value. If the click is primary too, one booking counts twice
   and Smart Bidding over-values the clicks. Secondary keeps them visible in reports without
   affecting bidding.
3. In GTM: Tags → New → **Google Ads Conversion Tracking**, Conversion ID `11227095880`,
   the label from step 1, firing trigger `CE - click_booking` (and a second tag for
   `CE - click_pickup`). Same options as the existing `click_line` conversion tag.

Instagram, Facebook, FAQ, check-in board and LINE MAN stay GA4-only: they are engagement,
not purchase intent.

### 4. Check and publish

1. **Preview** (Tag Assistant) on `https://haustable.vercel.app/link?internal=off`.
   Tap each button and confirm the matching tag fires once.
2. **Submit → Publish** with a version name such as `link click events`.
3. The next day, check GA4 → Reports → Engagement → Events for the new event names.

Staff devices (opened `/admin`, `/staff` or `/pos` before) never load GTM; use
`?internal=off` on such a device to test.
