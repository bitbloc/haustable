# คู่มือฉบับสมบูรณ์: LINE Messaging API Webhook & POS Flex Message Integration
**ระบบจัดการร้านอาหารและบาร์ IN THE HAUS / Bitbloc HausTable**

---

## 📑 สารบัญ (Table of Contents)
1. [บทนำและภาพรวมสถาปัตยกรรม (Architecture & Overview)](#1-บทนำและภาพรวมสถาปัตยกรรม)
2. [โครงสร้างความปลอดภัยและการตรวจสอบลายเซ็น (Security & Signature Verification)](#2-ความปลอดภัยและการตรวจสอบลายเซ็น)
3. [คู่มือ Webhook Events ทั้งหมด 12 ประเภท (Complete Events Reference)](#3-คู่มือ-webhook-events-ทั้งหมด-12-ประเภท)
4. [การออกแบบสถาปัตยกรรมเชื่อมต่อกับระบบ POS (POS Integration Architecture)](#4-สถาปัตยกรรมเชื่อมต่อ-pos--line-webhook)
5. [ชุดดีไซน์ LINE Flex Message สำหรับ POS (Dieter Rams + Thai Modern)](#5-ชุดดีไซน์-line-flex-message-สำหรับ-pos)
6. [โค้ดต้นแบบและการนำไปใช้งานจริง (Production Implementation)](#6-โค้ดต้นแบบและการนำไปใช้งานจริง)

---

## 1. บทนำและภาพรวมสถาปัตยกรรม

LINE Webhook คือระบบ Event-Driven ที่ LINE Platform จะส่ง HTTP POST Request (JSON) มายัง Endpoint ของเราทันทีที่มีการกระทำเกิดขึ้นใน LINE Official Account (เช่น ผู้ใช้ส่งข้อความ, แอดเพื่อน, สแกนบิล, กดปุ่ม Flex Message)

```
┌───────────────────────────────┐
│ ผู้ใช้งาน LINE / กลุ่มร้านค้า │
└───────────────┬───────────────┘
                │ (ส่งข้อความ / กดปุ่ม / แอดเพื่อน / สลิปโอน)
                ▼
┌───────────────────────────────┐
│      LINE Platform Server     │
└───────────────┬───────────────┘
                │ (HTTP POST JSON + Header: x-line-signature)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase Edge Function (`line-webhook` / `pos-line-hub`)        │
│  1. ตรวจสอบ x-line-signature ด้วย HMAC-SHA256                   │
│  2. ตอบกลับ HTTP 200 OK ทันที (ป้องกัน Timeout/Redelivery)      │
│  3. ประมวลผลตรรกะร้านอาหาร / POS Database / OCR AI              │
│  4. ส่ง Flex Message ตอบกลับ (Reply API) หรือ แจ้งเตือน (Push)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. ความปลอดภัยและการตรวจสอบลายเซ็น (Security Verification)

เมื่อมี Webhook ส่งเข้ามา **ห้ามประมวลผลก่อนตรวจสอบลายเซ็นเด็ดขาด** เพื่อป้องกัน Request ปลอมแปลง

### กฎการตรวจสอบ:
1. LINE จะส่งค่า Signature มาใน Header: `x-line-signature`
2. เราต้องนำ **Request Body (Raw String)** มาคำนวณ Hash แบบ **HMAC-SHA256** โดยใช้ `Channel Secret` เป็น Secret Key
3. แปลงผลลัพธ์เป็น **Base64** แล้วเปรียบเทียบกับค่าใน Header `x-line-signature`

### โค้ดตัวอย่างตรวจสอบ Signature (Deno / TypeScript / Web Crypto API):
```typescript
async function verifyLineSignature(
  rawBodyText: string,
  signatureHeader: string,
  channelSecret: string
): Promise<boolean> {
  if (!signatureHeader || !channelSecret) return false

  const encoder = new TextEncoder()
  const keyData = encoder.encode(channelSecret)
  const bodyData = encoder.encode(rawBodyText)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, bodyData)
  const computedBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  return computedBase64 === signatureHeader
}
```

---

## 3. คู่มือ Webhook Events ทั้งหมด 12 ประเภท

โครงสร้างหลักของ JSON Payload ที่ LINE ส่งมา:
```json
{
  "destination": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "events": [ /* Array of Event Objects */ ]
}
```

---

### 3.1. `message` Event
เกิดขึ้นเมื่อมีข้อความถูกส่งเข้ามาในแชท (ส่วนตัว, กลุ่ม, หรือห้อง)

#### 1) ข้อความตัวอักษร (Text):
```json
{
  "type": "message",
  "replyToken": "nHuyWiB7yP5Zw52FIkcQobQuGDXCTA",
  "source": { "type": "user", "userId": "U1234567890abcdef" },
  "timestamp": 1771234567890,
  "webhookEventId": "01FZ74A0TDDPYRVKNK77XKC3ZR",
  "deliveryContext": { "isRedelivery": false },
  "message": {
    "id": "444555666",
    "type": "text",
    "text": "เช็คบิล โต๊ะ 4",
    "emojis": [{ "index": 0, "length": 6, "productId": "...", "emojiId": "..." }]
  }
}
```

#### 2) รูปภาพ (Image - เช่น ใบเสร็จ/สลิปโอนเงิน):
```json
{
  "type": "message",
  "replyToken": "...",
  "source": { "type": "group", "groupId": "C123456..." },
  "message": {
    "id": "444555667",
    "type": "image",
    "contentProvider": { "type": "line" },
    "imageSet": { "id": "set_123", "index": 1, "total": 2 }
  }
}
```
* **การดาวน์โหลดรูป:** ยิง `GET https://api-data.line.me/v2/bot/message/{messageId}/content` พร้อม Header `Authorization: Bearer {CHANNEL_ACCESS_TOKEN}`

#### 3) วิดีโอ (Video):
```json
{
  "type": "message",
  "message": { "id": "444555668", "type": "video", "duration": 15000, "contentProvider": { "type": "line" } }
}
```

#### 4) เสียง (Audio):
```json
{
  "type": "message",
  "message": { "id": "444555669", "type": "audio", "duration": 3500, "contentProvider": { "type": "line" } }
}
```

#### 5) ไฟล์เอกสาร (File - เช่น PDF ใบกำกับภาษี):
```json
{
  "type": "message",
  "message": { "id": "444555670", "type": "file", "fileName": "tax_invoice_aug.pdf", "fileSize": 125400 }
}
```

#### 6) ตำแหน่งพิกัด (Location):
```json
{
  "type": "message",
  "message": {
    "id": "444555671",
    "type": "location",
    "title": "ที่อยู่จัดส่ง",
    "address": "ถ.ศรีนครินทร์ แขวงหนองบอน เขตประเวศ กรุงเทพฯ 10250",
    "latitude": 13.68429,
    "longitude": 100.64821
  }
}
```

#### 7) สติกเกอร์ (Sticker):
```json
{
  "type": "message",
  "message": {
    "id": "444555672",
    "type": "sticker",
    "packageId": "446",
    "stickerId": "1988",
    "stickerResourceType": "STATIC"
  }
}
```

---

### 3.2. `follow` Event
เกิดขึ้นเมื่อผู้ใช้ **เพิ่มเพื่อน (Add Friend)** หรือ **ปลดบล็อก (Unblock)** บอท
```json
{
  "type": "follow",
  "timestamp": 1771234567890,
  "source": { "type": "user", "userId": "U1234567890abcdef" },
  "replyToken": "nHuyWiB7yP5Zw52FIkcQobQuGDXCTA",
  "mode": "active"
}
```
* **Action:** บันทึก `line_user_id` ลง `profiles`, มอบเหรียญ Welcome Bonus และส่ง Flex Card ต้อนรับสมาชิก

---

### 3.3. `unfollow` Event
เกิดขึ้นเมื่อผู้ใช้ **บล็อก (Block)** บอท
```json
{
  "type": "unfollow",
  "timestamp": 1771234567890,
  "source": { "type": "user", "userId": "U1234567890abcdef" },
  "mode": "active"
}
```
* **ข้อควรระวัง:** ไม่มี `replyToken`
* **Action:** อัปเดตตาราง `profiles` ว่าผู้ใช้บล็อกบอท เพื่อระงับการส่ง Push Notifications

---

### 3.4. `join` Event
เกิดขึ้นเมื่อบอทถูกเชิญเข้า **LINE Group** หรือ **Multi-person Room**
```json
{
  "type": "join",
  "timestamp": 1771234567890,
  "source": { "type": "group", "groupId": "C9876543210fedcba" },
  "replyToken": "nHuyWiB7yP5Zw52FIkcQobQuGDXCTA"
}
```
* **Action:** ตอบกลับข้อความแนะนำตัว และบันทึก `groupId` เป็นกลุ่มสำหรับแจ้งเตือนครัวหรือแจ้งเตือนยอดขาย

---

### 3.5. `leave` Event
เกิดขึ้นเมื่อบอทถูกลบ/เตะออกจากกลุ่ม
```json
{
  "type": "leave",
  "timestamp": 1771234567890,
  "source": { "type": "group", "groupId": "C9876543210fedcba" }
}
```

---

### 3.6. `memberJoined` Event
เกิดขึ้นเมื่อมีสมาชิกท่านอื่นเข้าร่วมกลุ่มที่มีบอทอยู่แล้ว
```json
{
  "type": "memberJoined",
  "timestamp": 1771234567890,
  "source": { "type": "group", "groupId": "C9876543210fedcba" },
  "joined": {
    "members": [{ "type": "user", "userId": "U555666777" }]
  },
  "replyToken": "..."
}
```

---

### 3.7. `memberLeft` Event
เกิดขึ้นเมื่อมีสมาชิกออกจากกลุ่ม
```json
{
  "type": "memberLeft",
  "timestamp": 1771234567890,
  "source": { "type": "group", "groupId": "C9876543210fedcba" },
  "left": {
    "members": [{ "type": "user", "userId": "U555666777" }]
  }
}
```

---

### 3.8. `postback` Event
เกิดขึ้นเมื่อผู้ใช้กดปุ่มที่มีแอ็กชันแบบ **Postback** ใน Flex Message หรือ Rich Menu
```json
{
  "type": "postback",
  "timestamp": 1771234567890,
  "source": { "type": "user", "userId": "U1234567890abcdef" },
  "replyToken": "nHuyWiB7yP5Zw52FIkcQobQuGDXCTA",
  "postback": {
    "data": "action=request_etax&bill_no=POS-20260818-042&table=04",
    "params": {
      "datetime": "2026-08-18T14:30"
    }
  }
}
```
* **Use Case:** ใช้ทำปุ่ม Interactive บน Flex เช่น "ขอใบกำกับภาษีเต็มรูป", "เรียกพนักงาน", "สั่งอาหารเพิ่ม", "สะสมแต้ม"

---

### 3.9. `videoPlayComplete` Event
เกิดขึ้นเมื่อผู้ใช้ดูวิดีโอที่บอทส่งให้จนจบ
```json
{
  "type": "videoPlayComplete",
  "timestamp": 1771234567890,
  "source": { "type": "user", "userId": "U123456..." },
  "videoPlayComplete": { "trackingId": "promo_haus_coffee_2026" }
}
```

---

### 3.10. `beacon` Event
เกิดขึ้นเมื่อผู้ใช้เข้าใกล้อุปกรณ์ **LINE Beacon** ที่ติดตั้งไว้หน้าร้าน
```json
{
  "type": "beacon",
  "timestamp": 1771234567890,
  "source": { "type": "user", "userId": "U123456..." },
  "replyToken": "...",
  "beacon": {
    "hwid": "0000000000",
    "type": "enter",
    "dm": "device_message_hex"
  }
}
```

---

### 3.11. `accountLink` Event
เกิดขึ้นเมื่อผู้ใช้ทำขั้นตอนผูกบัญชี LINE กับระบบ Member ของร้านค้าสำเร็จ
```json
{
  "type": "accountLink",
  "timestamp": 1771234567890,
  "source": { "type": "user", "userId": "U123456..." },
  "link": {
    "result": "ok",
    "nonce": "unique_security_nonce_string"
  },
  "replyToken": "..."
}
```

---

### 3.12. `things` Event
เกิดขึ้นเมื่อมีการเชื่อมต่อหรือรับค่าจากอุปกรณ์ IoT (LINE Things Device)

---

## 4. สถาปัตยกรรมเชื่อมต่อ POS + LINE Webhook

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. OUTBOUND: POS Event -> Database Trigger -> Edge Hub -> LINE Push    │
└────────────────────────────────────────────────────────────────────────┘
 [POS Cashier / Kitchen Screen]
               │
               ▼ (ชำระเงิน / เปิดบิล / ปิดกะ / สั่งอาหาร)
 [Supabase Database (`bookings`, `pos_shifts`, `order_items`)]
               │
               ▼ (Database Webhook HTTP POST)
 [Supabase Edge Function: `pos-line-hub`]
               │
               ▼ (Push API + Flex Message JSON)
 ┌───────────────────────────┬───────────────────────────┐
 ▼                           ▼                           ▼
[ลูกค้า: E-Receipt / แต้ม]  [ครัว: ออเดอร์อาหาร]         [ผู้บริหาร: สรุปปิดกะ]

┌────────────────────────────────────────────────────────────────────────┐
│ 2. INBOUND: ลูกค้ากดปุ่ม Flex -> LINE Webhook -> อัปเดต POS Realtime   │
└────────────────────────────────────────────────────────────────────────┘
 [ลูกค้ากดปุ่มใน Flex Message (เช่น เรียกพนักงาน / ขอ e-Tax)]
               │
               ▼
 [LINE Platform ส่ง Webhook POST: event.type = 'postback']
               │
               ▼
 [Supabase Edge Function: `line-webhook`]
               │
               ▼ (อัปเดต DB & Broadcast Supabase Realtime)
 [หน้าจอ POS แคชเชียร์ & หน้าจอเด็กเสิร์ฟ อัปเดตทันที]
```

### 4.1. ตารางคำสั่งหมวดออเดอร์และยอดขายหน้าร้าน (Live POS & Orders Commands)

| คำสั่งที่พิมพ์ | ตัวอย่างการพิมพ์ | การทำงานและผลลัพธ์ที่ตอบกลับ (Flex Message) |
| :--- | :--- | :--- |
| `stsales` หรือ `ยอดขาย` | `stsales` / `ยอดขาย` | **รายงานยอดขายหน้าร้านแบบ Real-time ประจำวัน**<br>• ยอดขายสุทธิรวม, จำนวนบิลที่เสร็จสิ้น, ยอดเฉลี่ยต่อบิล<br>• ยอดแยกตามช่องทาง (PromptPay, เงินสด, บัตรเครดิต)<br>• ยอดส่วนลดโปรโมชั่น และยอดค้างชำระของโต๊ะที่กำลังนั่งทาน |
| `stbill` หรือ `บิลล่าสุด` | `stbill` / `บิลล่าสุด` | **ดู 6 รายการบิลที่ชำระเงินสำเร็จล่าสุดในระบบ**<br>• เลขที่บิล, โต๊ะ/ประเภท (Takeaway/Dine-in), เวลาชำระเงิน, วิธีจ่ายเงิน, รายการอาหารย่อ และยอดสุทธิ |
| `storder` | `storder` | **ดูออเดอร์สดที่กำลังทำในครัวและโต๊ะที่นั่งอยู่**<br>• แสดงรายการอาหารที่กำลังปรุง, เวลาที่สั่ง, โต๊ะ และยอดเงิน |
| `sttables` หรือ `โต๊ะ` | `sttables` / `โต๊ะ` | **สรุปภาพรวมสถานะโต๊ะทั้งหมดในร้าน**<br>• แสดงโต๊ะที่มีลูกค้านั่ง (PAX, ยอดค้าง) และโต๊ะว่าง 🟢 |
| `โต๊ะ [ชื่อโต๊ะ]` หรือ `sttable [ชื่อโต๊ะ]` | `โต๊ะ 3` / `โต๊ะ Bar` / `sttable 4` | **ดูเจาะลึกเฉพาะโต๊ะนั้นๆ**<br>• หากมีลูกค้านั่ง: แสดงรายการอาหารที่สั่งทั้งหมด, ยอดเงินปัจจุบัน<br>• หากโต๊ะว่าง: แจ้งสถานะพร้อมเปิดบิล |
| `stshift` หรือ `กะ` | `stshift` / `กะ` | **ตรวจสอบสถานะกะ POS และเงินในลิ้นชัก**<br>• ชื่อพนักงานเปิดกะ, เวลาเปิด, เงินทอนตั้งต้น (Float), ยอดขายสะสมในกะ และเงินสดที่คาดว่าต้องมีในลิ้นชัก |
| `sthero` | `sthero` | **5 อันดับเมนูขายดีประจำวัน (Top 5 Hero Items)**<br>• พร้อมกราฟแท่งแสดงสัดส่วนยอดขายสะสม |
| `stvoid` หรือ `บิลยกเลิก` | `stvoid` / `บิลยกเลิก` | **ตรวจสอบบิลที่ถูกยกเลิก (Void Audit) ประจำวัน**<br>• แสดงเลขบิล, โต๊ะ, ยอดเงินที่ยกเลิก และเหตุผลจากพนักงาน |
| `sthelp` หรือ `คำสั่ง` | `sthelp` / `คำสั่ง` | **เปิดเมนูช่วยเหลือและสารบัญคำสั่งทั้งหมด** |

---

## 5. ชุดดีไซน์ LINE Flex Message สำหรับ POS
*(ตามปรัชญา Dieter Rams + Thai Modern OKLCH Palette)*

### 5.1. E-Receipt & Tax Invoice Flex (ใบเสร็จรับเงินอิเล็กทรอนิกส์)

```json
{
  "type": "flex",
  "altText": "🧾 ใบเสร็จรับเงินอิเล็กทรอนิกส์ #POS-20260818-042 (฿385.00)",
  "contents": {
    "type": "bubble",
    "size": "mega",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#F4F1EA",
      "paddingAll": "20px",
      "paddingBottom": "16px",
      "contents": [
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "text",
              "text": "IN THE HAUS",
              "weight": "bold",
              "size": "md",
              "color": "#1E1B18",
              "flex": 7
            },
            {
              "type": "text",
              "text": "E-RECEIPT",
              "weight": "bold",
              "size": "xxs",
              "color": "#C85A32",
              "align": "end",
              "flex": 3,
              "gravity": "center"
            }
          ]
        },
        {
          "type": "text",
          "text": "TAX INVOICE (ABB) / ใบกำกับภาษีอย่างย่อ",
          "size": "xxs",
          "color": "#78736A",
          "margin": "xs"
        }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#FBF9F5",
      "paddingAll": "20px",
      "contents": [
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            { "type": "text", "text": "BILL NO", "size": "xxs", "color": "#78736A", "flex": 3 },
            { "type": "text", "text": "POS-20260818-042", "size": "xxs", "weight": "bold", "color": "#1E1B18", "align": "end", "flex": 7 }
          ]
        },
        {
          "type": "box",
          "layout": "horizontal",
          "margin": "xs",
          "contents": [
            { "type": "text", "text": "DATE / TIME", "size": "xxs", "color": "#78736A", "flex": 4 },
            { "type": "text", "text": "18 ส.ค. 2026 · 13:45 น.", "size": "xxs", "color": "#1E1B18", "align": "end", "flex": 6 }
          ]
        },
        {
          "type": "box",
          "layout": "horizontal",
          "margin": "xs",
          "contents": [
            { "type": "text", "text": "TABLE / STAFF", "size": "xxs", "color": "#78736A", "flex": 4 },
            { "type": "text", "text": "โต๊ะ 04 (Indoor) / Nook", "size": "xxs", "color": "#1E1B18", "align": "end", "flex": 6 }
          ]
        },
        { "type": "separator", "margin": "md", "color": "#E6E1D6" },
        {
          "type": "box",
          "layout": "vertical",
          "margin": "md",
          "spacing": "sm",
          "contents": [
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "1x Dirty Coffee (Haus Blend)", "size": "xs", "color": "#1E1B18", "flex": 7, "wrap": true },
                { "type": "text", "text": "120.00", "size": "xs", "weight": "bold", "color": "#1E1B18", "align": "end", "flex": 3 }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "1x Yuzu Sparkling Cold Brew", "size": "xs", "color": "#1E1B18", "flex": 7, "wrap": true },
                { "type": "text", "text": "135.00", "size": "xs", "weight": "bold", "color": "#1E1B18", "align": "end", "flex": 3 }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "1x Smoked Salmon Bagel", "size": "xs", "color": "#1E1B18", "flex": 7, "wrap": true },
                { "type": "text", "text": "130.00", "size": "xs", "weight": "bold", "color": "#1E1B18", "align": "end", "flex": 3 }
              ]
            }
          ]
        },
        { "type": "separator", "margin": "md", "color": "#E6E1D6" },
        {
          "type": "box",
          "layout": "horizontal",
          "margin": "md",
          "contents": [
            { "type": "text", "text": "ยอดรวมสินค้า (Subtotal)", "size": "xs", "color": "#78736A", "flex": 6 },
            { "type": "text", "text": "385.00", "size": "xs", "color": "#1E1B18", "align": "end", "flex": 4 }
          ]
        },
        {
          "type": "box",
          "layout": "horizontal",
          "margin": "xs",
          "contents": [
            { "type": "text", "text": "ภาษีมูลค่าเพิ่ม (VAT 7% รวมในบิล)", "size": "xxs", "color": "#78736A", "flex": 6 },
            { "type": "text", "text": "25.19", "size": "xxs", "color": "#78736A", "align": "end", "flex": 4 }
          ]
        },
        {
          "type": "box",
          "layout": "horizontal",
          "margin": "sm",
          "contents": [
            { "type": "text", "text": "ยอดชำระสุทธิ (PROMPTPAY)", "size": "sm", "weight": "bold", "color": "#1E1B18", "flex": 6 },
            { "type": "text", "text": "฿385.00", "size": "lg", "weight": "bold", "color": "#C85A32", "align": "end", "flex": 4 }
          ]
        },
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#F4F1EA",
          "cornerRadius": "md",
          "paddingAll": "12px",
          "margin": "lg",
          "contents": [
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "MEMBER REWARDS", "size": "xxs", "weight": "bold", "color": "#4A6B3D", "flex": 6 },
                { "type": "text", "text": "HAUS PEOPLE", "size": "xxs", "weight": "bold", "color": "#1E1B18", "align": "end", "flex": 4 }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "margin": "xs",
              "contents": [
                { "type": "text", "text": "🪙 ได้รับแต้ม xHAUS (+1.25x)", "size": "xs", "color": "#1E1B18", "flex": 7 },
                { "type": "text", "text": "+4.81 ฿", "size": "xs", "weight": "bold", "color": "#4A6B3D", "align": "end", "flex": 3 }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "margin": "xs",
              "contents": [
                { "type": "text", "text": "☕ สแตมป์เครื่องดื่ม (สะสม 10 ฟรี 1)", "size": "xs", "color": "#1E1B18", "flex": 7 },
                { "type": "text", "text": "+2 ดวง (รวม 7/10)", "size": "xs", "weight": "bold", "color": "#C85A32", "align": "end", "flex": 3 }
              ]
            }
          ]
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "horizontal",
      "backgroundColor": "#FBF9F5",
      "paddingAll": "16px",
      "spacing": "md",
      "contents": [
        {
          "type": "button",
          "action": {
            "type": "postback",
            "label": "ขอใบกำกับเต็มรูป",
            "data": "action=request_full_tax&booking_id=POS-20260818-042"
          },
          "style": "secondary",
          "color": "#F4F1EA",
          "height": "sm",
          "flex": 5
        },
        {
          "type": "button",
          "action": {
            "type": "uri",
            "label": "เปิดบัตรสมาชิก",
            "uri": "https://liff.line.me/YOUR_LIFF_ID/member-card"
          },
          "style": "primary",
          "color": "#1E1B18",
          "height": "sm",
          "flex": 5
        }
      ]
    }
  }
}
```

---

### 5.2. สรุปยอดขายปิดกะ POS (POS Shift Close Report)

```json
{
  "type": "flex",
  "altText": "📊 สรุปยอดขายปิดกะ POS (กะเช้า 18 ส.ค. 2026) ยอดสุทธิ ฿14,850.00",
  "contents": {
    "type": "bubble",
    "size": "mega",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#1E1B18",
      "paddingAll": "20px",
      "contents": [
        { "type": "text", "text": "POS SHIFT REPORT", "size": "xs", "weight": "bold", "color": "#C85A32" },
        { "type": "text", "text": "สรุปรายงานปิดกะแคชเชียร์", "size": "md", "weight": "bold", "color": "#FBF9F5", "margin": "xs" },
        { "type": "text", "text": "ผู้รับผิดชอบ: Ritha · กะที่ 1 (08:00 - 16:00 น.)", "size": "xxs", "color": "#A09B90", "margin": "xs" }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#FBF9F5",
      "paddingAll": "20px",
      "contents": [
        {
          "type": "box",
          "layout": "horizontal",
          "backgroundColor": "#F4F1EA",
          "cornerRadius": "md",
          "paddingAll": "14px",
          "contents": [
            {
              "type": "box",
              "layout": "vertical",
              "flex": 5,
              "contents": [
                { "type": "text", "text": "ยอดขายสุทธิทั้งหมด", "size": "xs", "color": "#78736A" },
                { "type": "text", "text": "34 บิล (ไม่มีบิลค้าง)", "size": "xxs", "color": "#4A6B3D", "margin": "xs" }
              ]
            },
            {
              "type": "text",
              "text": "฿14,850.00",
              "size": "xl",
              "weight": "bold",
              "color": "#1E1B18",
              "align": "end",
              "flex": 5,
              "gravity": "center"
            }
          ]
        },
        { "type": "separator", "margin": "lg", "color": "#E6E1D6" },
        { "type": "text", "text": "BREAKDOWN ช่องทางชำระเงิน", "size": "xxs", "weight": "bold", "color": "#78736A", "margin": "md" },
        {
          "type": "box",
          "layout": "vertical",
          "margin": "sm",
          "spacing": "xs",
          "contents": [
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "📱 PromptPay / โอนเงิน (22 บิล)", "size": "xs", "color": "#1E1B18", "flex": 7 },
                { "type": "text", "text": "฿9,420.00", "size": "xs", "weight": "bold", "color": "#1E1B18", "align": "end", "flex": 3 }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "💵 เงินสด Cash (10 บิล)", "size": "xs", "color": "#1E1B18", "flex": 7 },
                { "type": "text", "text": "฿4,130.00", "size": "xs", "weight": "bold", "color": "#1E1B18", "align": "end", "flex": 3 }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "💳 บัตรเครดิต Credit Card (2 บิล)", "size": "xs", "color": "#1E1B18", "flex": 7 },
                { "type": "text", "text": "฿1,300.00", "size": "xs", "weight": "bold", "color": "#1E1B18", "align": "end", "flex": 3 }
              ]
            }
          ]
        },
        { "type": "separator", "margin": "md", "color": "#E6E1D6" },
        { "type": "text", "text": "การตรวจนับลิ้นชักเงินสด (DRAWER AUDIT)", "size": "xxs", "weight": "bold", "color": "#78736A", "margin": "md" },
        {
          "type": "box",
          "layout": "vertical",
          "margin": "sm",
          "spacing": "xs",
          "contents": [
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "เงินทอนตั้งต้น (Float)", "size": "xs", "color": "#78736A", "flex": 6 },
                { "type": "text", "text": "฿2,000.00", "size": "xs", "color": "#1E1B18", "align": "end", "flex": 4 }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "เงินสดที่นับได้จริงในลิ้นชัก", "size": "xs", "color": "#78736A", "flex": 6 },
                { "type": "text", "text": "฿6,130.00", "size": "xs", "color": "#1E1B18", "align": "end", "flex": 4 }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "ผลต่างเงินสด (Over / Short)", "size": "xs", "weight": "bold", "color": "#1E1B18", "flex": 6 },
                { "type": "text", "text": "฿0.00 (ตรงเป๊ะ ✅)", "size": "xs", "weight": "bold", "color": "#4A6B3D", "align": "end", "flex": 4 }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

---

## 7. คำสั่งพยากรณ์ทราฟฟิก & เสริมมงคลการค้า (`stpredict`)

คำสั่ง **`stpredict`** (หรือพิมพ์: `ทำนาย`, `พยากรณ์`, `stforecast`) เป็นระบบ AI Intraday Traffic Predictor ที่จำลองโมเดลเดียวกับหน้า **Admin Overview (IntradayTrafficPredictor)** เพื่อวิเคราะห์ทราฟฟิกรายชั่วโมง (11.00 - 23.00 น.) พร้อมผสาน **"ศาสตร์สายดวงมหาเศรษฐี" (Sai Mu Oracle)** ด้วย Gemini AI

### 7.1. สถาปัตยกรรมข้อมูล
1. **สถิติฐานย้อนหลัง (Baseline)**: คำนวณค่าเฉลี่ยรายชั่วโมงจาก `bookings` ย้อนหลัง 4 สัปดาห์ในวันเดียวกัน
2. **ยอดจริงสะสมวันนี้**: ดึงลูกค้าจริงและจำนวนบิลที่บันทึกแล้วในแต่ละชั่วโมง
3. **สัญญาณ Ad Intent Leads**: วิเคราะห์เจตนาลูกค้าจาก `ad_events` (ขอเส้นทาง Maps = 3.0, โทร = 2.5, LINE = 2.0, จอง = 2.0, สั่งกลับ = 1.5, เมนู/วิว = 0.5) เพื่อคำนวณ Near-term Lead Lift
4. **Pacing & Forecast**: คำนวณตัวคูณจังหวะความเร็ววันนี้เทียบสถิติเดิม และพยากรณ์ชั่วโมงที่เหลือของวัน พร้อมคำนวณยอดปิดวัน (กรอบต่ำ-สูง)
5. **Dayparts Matrix**: สรุป 4 ช่วงเวลา: Lunch Rush (11-14), Afternoon (14-17), Prime Dinner (17-21), Late Night (21-23)
6. **Peak Hour Detection**: คำนวณหาช่วงเวลาที่ลูกค้าหนาแน่นที่สุดและอัตราครองที่นั่ง (% ของ 45 ที่นั่ง)

### 7.2. ศาสตร์สายดวงมงคล (Sai Mu Matrix)
ระบบคำนวณตามกำลังวันและธาตุประจำวันของไทย:
- **วันอาทิตย์**: ธาตุไฟ | กำลัง 6 | สีมงคล: เขียวเหนี่ยวทรัพย์, ดำ/ม่วง | เลี่ยง: ฟ้า/น้ำเงิน | ทิศ: ตะวันออกเฉียงใต้
- **วันจันทร์**: ธาตุดิน | กำลัง 15 | สีมงคล: ส้ม/เหลืองทอง, ม่วง | เลี่ยง: แดง | ทิศ: ตะวันออก
- **วันอังคาร**: ธาตุลม | กำลัง 8 | สีมงคล: น้ำตาลทอง, น้ำเงินมหาเศรษฐี | เลี่ยง: ขาว/ครีม | ทิศ: ตะวันออกเฉียงใต้
- **วันพุธ**: ธาตุน้ำ | กำลัง 17 | สีมงคล: ดำ/เทาเงิน, ฟ้าคราม | เลี่ยง: ชมพู | ทิศ: ทิศใต้
- **วันพฤหัสบดี**: ธาตุดิน | กำลัง 19 | สีมงคล: แดงส้มมหาลาภ, ขาว/ทอง | เลี่ยง: ดำ/ม่วงเข้ม | ทิศ: ตะวันตก
- **วันศุกร์**: ธาตุน้ำ | กำลัง 21 | สีมงคล: ชมพู, เขียวมรกต | เลี่ยง: ดำด้าน/เทา | ทิศ: ทิศเหนือ
- **วันเสาร์**: ธาตุไฟ | กำลัง 10 | สีมงคล: น้ำเงินเข้ม, ทองอร่าม | เลี่ยง: เขียวตอง | ทิศ: ตะวันตกเฉียงใต้

### 7.3. รูปแบบการแสดงผล Fast Digest (อ่านจบใน 3-5 วินาที)
ส่งข้อความใน LINE Chat หรือกลุ่มร้าน:
```
stpredict
```
หรือ `ทำนาย`, `พยากรณ์`, `stforecast`

บอทจะตอบกลับด้วย LINE Flex Message ขนาด Mega สไตล์ Dieter Rams + Thai Modern OKLCH (Hallmark Zero-Icon Discipline) แบบ **Fast Digest** ที่ออกแบบให้ผู้บริหารและทีมหน้าร้านอ่านเข้าใจได้ทันทีใน 3-5 วินาที:

1. **Header**: `HAUS PRO FORECAST // FAST DIGEST` พร้อมแท็กเวลาสด เช่น `[17.30 น.]`
2. **Snapshot กล่องบน (ย่อยเร็วพิเศษ)**:
   - **ลูกค้าจริงสะสมขณะนี้**: แสดงจำนวนคนตัวใหญ่เด่นชัด (เช่น `28 ท่าน`, ชำระแล้ว `11 บิล`)
   - **คาดการณ์ 1-2 ชม. ข้างหน้า**: คำนวณช่วงเวลาถัดไปทันที (เช่น `~32 ท่าน (18.00 - 20.00 น.)`)
   - **คาดการณ์ยอดปิดวัน**: (เช่น `~68 ท่าน` ช่วง 58-80 ท่าน)
   - **ชั่วโมงลูกค้าสูงสุด (Peak)**: (เช่น `19.00 - 20.00 น.` ~18 คน | โหลด 40%)
   - **Speed Pacing**: เทียบฐาน 4 สัปดาห์ (เช่น `+15% PACING`)
3. **Sai Mu & Action (เสริมดวง & แผนปฏิบัติการฉับไว)**:
   - ตารางสรุป 6 แถวอ่านกระชับ: ฤกษ์ดูดทรัพย์, สีมงคล/เลี่ยง, ทิศรับเงิน, ทริคหน้าร้าน, เตรียมครัวและบาร์, จัดโต๊ะ/บริการ
4. **Dayparts Timeline (4 ช่วงเวลา ย่ออ่านง่าย)**:
   - ตาราง 4 แถว: Lunch Rush, Afternoon Cafe, Prime Dinner, Late Night / Bar พร้อมแท็กสถานะ `[PASSED]`, `[LIVE ACTIVE]`, `[FORECAST]`
5. **Quick Action Buttons**:
   - ปุ่มลัดกดดู `ยอดขายสด (STSALES)`, `บิลล่าสุด (STBILL)`, `ออเดอร์ครัว (STORDER)`

---
*เอกสารนี้จัดทำขึ้นสำหรับระบบ **IN THE HAUS / Bitbloc HausTable** สงวนลิขสิทธิ์ตามมาตรฐานการพัฒนาซอฟต์แวร์*


