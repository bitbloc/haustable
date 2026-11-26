import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildStockSummaryMessage, buildRestockMessage, remainingText } from "./stockSummary.ts"
import { handleReceiptEvents } from "./receipt.ts"
import { installShopLogoOnLineMessages } from "./brand.ts"

// Every Flex card the bot sends gets the shop logo in its header corner (brand.ts).
installShopLogoOnLineMessages()
import { claudeEnabled, generateWithClaude, CLAUDE_FAST_MODEL } from "../_shared/claude.ts"

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function parseBookingPayment(b: any) {
  const total = Number(b.total_amount || b.total_price || 0);
  const remark = String(b.staff_remark || b.customer_note || '').toLowerCase();
  
  const splitMatch = remark.match(/\[split:?\s*([^\]]+)\]/i) || remark.match(/split:\s*([^,\n\]]+(?:,[^,\n\]]+)*)/i);
  if (splitMatch) {
    const splitText = splitMatch[1];
    let cash = 0, qr = 0, credit = 0;
    const cashM = splitText.match(/cash[:=\s]+(\d+(?:\.\d+)?)/i);
    if (cashM) cash = parseFloat(cashM[1]) || 0;
    const qrM = splitText.match(/(?:qr|transfer|โอน)[:=\s]+(\d+(?:\.\d+)?)/i);
    if (qrM) qr = parseFloat(qrM[1]) || 0;
    const creditM = splitText.match(/(?:credit|card|บัตร)[:=\s]+(\d+(?:\.\d+)?)/i);
    if (creditM) credit = parseFloat(creditM[1]) || 0;
    return { cash, qr, credit, methodLabel: 'SPLIT' };
  }
  
  const method = String(b.payment_method || '').toLowerCase();
  if (method === 'cash') return { cash: total, qr: 0, credit: 0, methodLabel: 'CASH' };
  if (method === 'qr' || method === 'transfer' || method === 'promptpay') return { cash: 0, qr: total, credit: 0, methodLabel: 'PROMPTPAY' };
  if (method === 'credit' || method === 'card') return { cash: 0, qr: 0, credit: total, methodLabel: 'CREDIT' };

  if (remark.includes('credit') || remark.includes('card') || remark.includes('บัตร')) {
    return { cash: 0, qr: 0, credit: total, methodLabel: 'CREDIT' };
  }
  if (b.payment_slip_url || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน') || remark.includes('promptpay')) {
    return { cash: 0, qr: total, credit: 0, methodLabel: 'PROMPTPAY' };
  }
  return { cash: total, qr: 0, credit: 0, methodLabel: 'CASH' };
}

function getShortBookingId(booking: any): string {
  if (!booking) return '0000';
  if (typeof booking === 'string') {
    const raw = booking.trim();
    if (raw.startsWith('local')) {
      const digits = raw.replace(/[^0-9]/g, '');
      return digits.length >= 4 ? digits.slice(-4) : (digits || '0000');
    }
    const clean = raw.replace(/[^a-zA-Z0-9]/g, '');
    return clean.length >= 4 ? clean.slice(-4).toUpperCase() : (clean.toUpperCase() || '0000');
  }
  if (booking.short_id) {
    return String(booking.short_id).toUpperCase();
  }
  const token = booking.tracking_token || booking.trackingToken;
  if (token) {
    const cleanToken = String(token).replace(/[^a-zA-Z0-9]/g, '');
    return cleanToken.length >= 4 ? cleanToken.slice(-4).toUpperCase() : cleanToken.toUpperCase();
  }
  const rawId = String(booking.id || booking.booking_id || booking.order_id || '');
  if (rawId.startsWith('local')) {
    const digits = rawId.replace(/[^0-9]/g, '');
    return digits.length >= 4 ? digits.slice(-4) : (digits || '0000');
  }
  const cleanUuid = rawId.replace(/[^a-zA-Z0-9]/g, '');
  return cleanUuid ? cleanUuid.slice(-4).toUpperCase() : '0000';
}

async function verifySignature(body: string, signature: string, secret: string) {
  const encoder = new TextEncoder()
  const keyBuffer = encoder.encode(secret)
  const bodyBuffer = encoder.encode(body)

  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, bodyBuffer)
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  if (base64Signature.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < signature.length; i++) diff |= base64Signature.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

// ==========================================
// --- STPREDICT & SAI MU ORACLE HELPERS ---
// ==========================================

function getDailySaiMuContext(dateObj: Date) {
  const dayIndex = dateObj.getDay();
  const daysMap = [
    {
      dayName: 'วันอาทิตย์',
      element: 'ธาตุไฟ',
      powerNumber: 6,
      luckyColors: 'เขียวเหนี่ยวทรัพย์, ดำ/ม่วงเสริมอำนาจ',
      unluckyColor: 'น้ำเงิน/ฟ้า',
      luckyDirection: 'ทิศตะวันออกเฉียงใต้',
      deity: 'พระสิวลีมหาลาภ & พระสุริยเทพ',
      saiMuHacks: 'วางผลส้มมงคลหรือเครื่องดื่มโทนส้ม-เขียวหน้าร้าน เปิดไฟป้ายร้านสว่างสดใสเพื่อดึงดูดพลังสุริยะ'
    },
    {
      dayName: 'วันจันทร์',
      element: 'ธาตุดิน',
      powerNumber: 15,
      luckyColors: 'ส้ม/เหลืองทองเปิดทรัพย์, ม่วงเม็ดมะปราง',
      unluckyColor: 'แดง',
      luckyDirection: 'ทิศตะวันออก',
      deity: 'ท้าวเวสสุวรรณ & แม่นางกวัก',
      saiMuHacks: 'ถวายน้ำสะอาดใสแจ๋วที่โต๊ะบูชา ยิ้มแย้มต้อนรับด้วยวาจามหาเสน่ห์ เจรจาปิดการขายคล่องตัว'
    },
    {
      dayName: 'วันอังคาร',
      element: 'ธาตุลม',
      powerNumber: 8,
      luckyColors: 'น้ำตาลทอง, น้ำเงิน/ฟ้ามหาเศรษฐี',
      unluckyColor: 'ขาว/ครีม',
      luckyDirection: 'ทิศตะวันออกเฉียงใต้',
      deity: 'พระพิฆเนศ & พระราหูมหาลาภ',
      saiMuHacks: 'เคลียร์เคาน์เตอร์แคชเชียร์และบาร์น้ำให้โล่งสะอาด อากาศถ่ายเท รับคลื่นพลังงานเงินหมุนเวียนเร็ว'
    },
    {
      dayName: 'วันพุธ',
      element: 'ธาตุน้ำ',
      powerNumber: 17,
      luckyColors: 'ดำ/เทาเงินเหนี่ยวดวงการค้า, ฟ้าคราม',
      unluckyColor: 'ชมพู',
      luckyDirection: 'ทิศใต้',
      deity: 'พระแม่ลักษมี & พระอุปคุต',
      saiMuHacks: 'เปิดเพลงคลอเบาๆ จังหวะชวนผ่อนคลาย จัดไฟวอร์มไวท์อบอุ่น ดึงดูดลูกค้าให้นั่งชิลและสั่งเพิ่ม'
    },
    {
      dayName: 'วันพฤหัสบดี',
      element: 'ธาตุดิน',
      powerNumber: 19,
      luckyColors: 'แดงส้มมหาลาภ, ขาว/ทองประกาย',
      unluckyColor: 'ดำ/ม่วงเข้ม',
      luckyDirection: 'ทิศตะวันตก',
      deity: 'พระพรหม & หลวงพ่อโสธร',
      saiMuHacks: 'จัดระเบียบเงินในลิ้นชักเรียงแบงก์หน้าเดียวกัน ตั้งจิตขอบคุณลูกค้าทุกท่าน เสริมบารมีร้านค้า'
    },
    {
      dayName: 'วันศุกร์',
      element: 'ธาตุน้ำ',
      powerNumber: 21,
      luckyColors: 'ชมพูดึงดูดลูกค้า, เขียวมรกตเรียกบิลใหญ่',
      unluckyColor: 'เทา/ดำด้าน',
      luckyDirection: 'ทิศเหนือ',
      deity: 'พระแม่ลักษมี & เจ้าแม่กวนอิม',
      saiMuHacks: 'ฉีดกลิ่นหอมสะอาดสดชื่นบริเวณทางเข้าร้าน ตกแต่งมุมถ่ายรูปสวยๆ รับทราฟฟิกสายเช็คอิน'
    },
    {
      dayName: 'วันเสาร์',
      element: 'ธาตุไฟ',
      powerNumber: 10,
      luckyColors: 'น้ำเงินเข้ม, ทองอร่ามเหนี่ยวทรัพย์ก้อนโต',
      unluckyColor: 'เขียวตองอ่อน',
      luckyDirection: 'ทิศตะวันตกเฉียงใต้',
      deity: 'พญานาคราชริมโขง & พระศิวะ',
      saiMuHacks: 'ตั้งแก้วน้ำสะอาดริมแม่น้ำ/หน้าร้าน ขอบารมีพญานาคราชประทานโชคลาภ ดึงดูดครอบครัวและกลุ่มเพื่อนบิลใหญ่'
    }
  ];
  return daysMap[dayIndex] || daysMap[0];
}

async function generateIntradayTrafficWithSaiMu(
  summaryPayload: any,
  apiKey: string,
  preferredModel: string = 'gemini-flash-latest'
): Promise<any> {
  const saiMu = summaryPayload.saiMuContext;
  const promptText = `
You are the Executive Operations & Marketing Strategist and Astrological Business Advisor (ที่ปรึกษากลยุทธ์และการตลาดร้านอาหารควบคู่ศาสตร์สายมูมงคลการค้า) for "IN THE HAUS" restaurant.
Analyze the following live intraday traffic data, Ad Intent leads, Dayparts projection, and the day's auspicious Sai Mu astrological context:

${JSON.stringify(summaryPayload, null, 2)}

Your task: Synthesize a sharp, executive-level summary and actionable advice that combines scientific restaurant operations with Thai auspicious Sai Mu principles (ฤกษ์นาทีทองดูดทรัพย์, สีมงคล, ทริคมูรับทรัพย์).
Guidelines:
1. "sai_mu_oracle.auspicious_window": Identify the Golden Auspicious Hour (ฤกษ์นาทีทองเปิดรับทรัพย์) by aligning the Peak Hour (~${summaryPayload.peakHour || '18.00 - 20.00 น.'}) with Thai merchant astrology.
2. "sai_mu_oracle.lucky_color_advice": Recommend employee attire / decor accents based on ${saiMu.luckyColors} (warn to avoid ${saiMu.unluckyColor}).
3. "sai_mu_oracle.money_direction": Auspicious direction (${saiMu.luckyDirection}) for cashier / welcoming host / altar.
4. "sai_mu_oracle.sai_mu_hack": A concise, modern lucky tip for front-of-house (1-2 sentences).
5. "operational_advice.kitchen_bar": Concrete prep advice for kitchen and bar for the dinner rush (1-2 sentences).
6. "operational_advice.floor_service": Seating and host strategy for walk-ins vs reservations (1-2 sentences).
7. "operational_advice.marketing_ads": Actionable ad timing or content boost advice based on Ad leads (1-2 sentences).
8. "executive_summary": 2 sentences summarizing the overall day pacing and closing outlook.

Return ONLY a valid JSON object matching this schema:
{
  "sai_mu_oracle": {
    "auspicious_window": "string",
    "lucky_color_advice": "string",
    "money_direction": "string",
    "sai_mu_hack": "string"
  },
  "operational_advice": {
    "kitchen_bar": "string",
    "floor_service": "string",
    "marketing_ads": "string"
  },
  "executive_summary": "string"
}
`;

  if (claudeEnabled()) {
    try {
      const json = await generateWithClaude({
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        generationConfig: { response_mime_type: 'application/json' },
      }, { model: CLAUDE_FAST_MODEL, timeoutMs: 25_000, maxRetries: 0, feature: 'line:stpredict' })
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const parsed = JSON.parse(rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
      if (parsed?.sai_mu_oracle && parsed?.operational_advice) return parsed
    } catch (err: any) {
      console.warn('[Claude Traffic AI] failed:', err?.message)
    }
  } else if (apiKey) {
    const candidateModels = Array.from(new Set([
      preferredModel,
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
      'gemini-3.8-flash',
      'gemini-4-argon',
      'gemini-3.7-flash',
      'gemini-pro-latest'
    ]));

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.2
            }
          })
        });
        clearTimeout(timeout);

        if (!response.ok) {
          console.warn(`[Gemini Traffic AI ${model}] failed status ${response.status}`);
          continue;
        }

        const resJson = await response.json();
        const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed?.sai_mu_oracle && parsed?.operational_advice) {
          return parsed;
        }
      } catch (err: any) {
        console.warn(`[Gemini Traffic AI Error with ${model}]:`, err?.message);
      }
    }
  }

  // Deterministic Fallback if Gemini fails or is unconfigured
  const peakHourStr = summaryPayload.peakHour || 'ช่วงที่ลูกค้าเข้าแน่นของวันนี้';
  const primeDinner = summaryPayload.dayparts?.find((d: any) => d.key === 'dinner');
  const dinnerForecast = primeDinner && Number.isFinite(Number(primeDinner.forecastPax)) ? primeDinner.forecastPax : null;
  const adDirs = summaryPayload.adStats?.totalAdDirections || 0;

  return {
    sai_mu_oracle: {
      auspicious_window: `ฤกษ์เปิดทรัพย์ ${peakHourStr} (ช่วงเหนี่ยวทรัพย์หนาแน่น)`,
      lucky_color_advice: `ทีมงานสวมใส่หรือพกไอเทม ${saiMu.luckyColors} เปิดรับทรัพย์ (เลี่ยง ${saiMu.unluckyColor})`,
      money_direction: `จัดโต๊ะต้อนรับหรือเคาน์เตอร์คิดเงินทาง ${saiMu.luckyDirection} เสริมพลัง ${saiMu.element}`,
      sai_mu_hack: saiMu.saiMuHacks
    },
    operational_advice: {
      kitchen_bar: dinnerForecast !== null
        ? `เตรียมสำรองสต็อกวัตถุดิบและพรีเซตเครื่องดื่มล่วงหน้าก่อน 17.30 น. เพื่อรองรับ ~${dinnerForecast} ท่านช่วง Prime Dinner`
        : 'เตรียมสำรองสต็อกวัตถุดิบและพรีเซตเครื่องดื่มล่วงหน้าก่อน 17.30 น. (ยังไม่มีข้อมูลพอคาดจำนวนลูกค้าช่วงเย็น)',
      floor_service: `จัดโซนโต๊ะรองรับกลุ่ม Walk-in ควบคู่กับลูกค้าที่โทร/LINE จองโต๊ะล่วงหน้าเพื่อการระบายรอบโต๊ะที่รวดเร็ว`,
      marketing_ads: adDirs > 0
        ? `พบสัญญาณลูกค้าขอเส้นทางใน Google Maps ${adDirs} ครั้ง เตรียมทีมหน้าร้านต้อนรับกลุ่มที่กำลังเดินทางมา`
        : `บูสต์โพสต์โปรโมทบรรยากาศริมโขงและเมนูซิกเนเจอร์ช่วง 15.30-17.30 น. เพื่อดึงดูดลูกค้ามื้อค่ำ`
    },
    executive_summary: `วันนี้ทราฟฟิกมีจังหวะความเร็ว ${summaryPayload.dayPacePct >= 0 ? `+${summaryPayload.dayPacePct}%` : `${summaryPayload.dayPacePct}%`} เทียบสถิติเดิม คาดการณ์ยอดปิดวันรวม ~${summaryPayload.forecastedClosingPax} ท่าน`
  };
}

/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
function createTrafficPredictorFlexMessage(
  trafficData: any,
  saiMuData: any,
  aiAnalysis: any,
  dateTitleStr: string,
  currentTimeFormatted: string,
  nextHoursInfo: { label: string; forecastPax: number }
) {
  const {
    totalActualPax,
    totalActualBills,
    forecastedClosingPax,
    forecastedClosingPaxLow,
    forecastedClosingPaxHigh,
    dayPacePct,
    peakHour,
    peakCapacityLoad,
    dayparts
  } = trafficData;

  const peakHourLabel = peakHour ? `${peakHour.hour}.00 - ${peakHour.hour + 1}.00 น.` : '19.00 - 20.00 น.';
  const peakPaxVal = peakHour ? (peakHour.isFuture ? peakHour.forecast : peakHour.actual) : 0;

  // Render Daypart Rows (Hallmark Zero-Icon Minimalist Badges)
  const daypartRows = (dayparts || []).map((dp: any, idx: number) => {
    let statusBg = "#ECE4E7";
    let statusColor = "#635B5F";
    let statusText = "FORECAST";

    if (dp.status === 'passed') {
      statusBg = "#ECE4E7";
      statusColor = "#41032A";
      statusText = "PASSED";
    } else if (dp.status === 'active') {
      statusBg = "#ECE4E7";
      statusColor = "#41032A";
      statusText = "LIVE ACTIVE";
    }

    const paxDisplay = dp.status === 'passed'
      ? `${dp.actualPax} ท่าน`
      : `~${dp.forecastPax} ท่าน`;

    return {
      type: "box",
      layout: "horizontal",
      margin: idx === 0 ? "xs" : "sm",
      contents: [
        {
          type: "box",
          layout: "vertical",
          flex: 6,
          contents: [
            { type: "text", text: dp.title, size: "xs", weight: "bold", color: "#1A1A1A" },
            { type: "text", text: dp.timeLabel, size: "xxs", color: "#635B5F" }
          ]
        },
        {
          type: "box",
          layout: "vertical",
          flex: 3,
          contents: [
            { type: "text", text: paxDisplay, size: "xs", weight: "bold", color: "#1A1A1A", align: "end" },
            { type: "text", text: `เทียบฐาน ${dp.diffPct >= 0 ? `+${dp.diffPct}%` : `${dp.diffPct}%`}`, size: "xxs", color: dp.diffPct >= 0 ? "#41032A" : "#635B5F", align: "end" }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          flex: 3,
          justifyContent: "flex-end",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              backgroundColor: statusBg,
              cornerRadius: "xs",
              paddingStart: "sm",
              paddingEnd: "sm",
              paddingTop: "xs",
              paddingBottom: "xs",
              contents: [
                { type: "text", text: statusText, size: "xxs", weight: "bold", color: statusColor }
              ]
            }
          ]
        }
      ]
    };
  });

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#41032A",
      paddingAll: "18px",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "HAUS PRO FORECAST // FAST DIGEST", size: "xxs", weight: "bold", color: "#D0B5C1", flex: 8 },
            { type: "text", text: `[${currentTimeFormatted}]`, size: "xxs", weight: "bold", color: "#D0B5C1", align: "end", flex: 4, gravity: "center" }
          ]
        },
        {
          type: "text",
          text: `พยากรณ์ทราฟฟิก & สรุปข้อมูลฉับไว · ${dateTitleStr}`,
          size: "sm",
          weight: "bold",
          color: "#F6F2EA",
          margin: "xs"
        }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#F6F2EA",
      paddingAll: "16px",
      contents: [
        // 1. HIGHLIGHT DIGEST BOX: ณ ปัจจุบัน & คาดการณ์ช่วงถัดไป (อ่านจบใน 3 วิ)
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#ECE4E7",
          cornerRadius: "sm",
          borderColor: "#D4CBCF",
          borderWidth: "1px",
          paddingAll: "14px",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: `SNAPSHOT ปัจจุบัน [${currentTimeFormatted}]`, size: "xxs", weight: "bold", color: "#41032A", flex: 7 },
                {
                  type: "text",
                  text: `${dayPacePct >= 0 ? `+${dayPacePct}%` : `${dayPacePct}%`} PACING`,
                  size: "xxs",
                  weight: "bold",
                  color: dayPacePct >= 0 ? "#1A1A1A" : "#41032A",
                  align: "end",
                  flex: 5
                }
              ]
            },
            { type: "separator", margin: "sm", color: "#D4CBCF" },
            {
              type: "box",
              layout: "horizontal",
              margin: "sm",
              contents: [
                {
                  type: "box",
                  layout: "vertical",
                  flex: 6,
                  contents: [
                    { type: "text", text: "ลูกค้าจริงสะสมขณะนี้:", size: "xxs", color: "#635B5F" },
                    { type: "text", text: `${totalActualPax} ท่าน`, size: "lg", weight: "bold", color: "#1A1A1A" },
                    { type: "text", text: `ชำระแล้ว ${totalActualBills} บิล`, size: "xxs", color: "#635B5F" }
                  ]
                },
                {
                  type: "box",
                  layout: "vertical",
                  flex: 6,
                  alignItems: "flex-end",
                  contents: [
                    { type: "text", text: `คาดการณ์ 1-2 ชม. ข้างหน้า:`, size: "xxs", color: "#635B5F" },
                    { type: "text", text: `~${nextHoursInfo.forecastPax} ท่าน`, size: "lg", weight: "bold", color: "#41032A" },
                    { type: "text", text: `(${nextHoursInfo.label})`, size: "xxs", color: "#635B5F" }
                  ]
                }
              ]
            },
            { type: "separator", margin: "sm", color: "#D4CBCF" },
            {
              type: "box",
              layout: "horizontal",
              margin: "sm",
              contents: [
                { type: "text", text: "คาดการณ์ยอดปิดวัน:", size: "xxs", weight: "bold", color: "#1A1A1A", flex: 5 },
                { type: "text", text: `~${forecastedClosingPax} ท่าน (${forecastedClosingPaxLow}-${forecastedClosingPaxHigh})`, size: "xxs", weight: "bold", color: "#1A1A1A", align: "end", flex: 7 }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              margin: "xs",
              contents: [
                { type: "text", text: "ชั่วโมงลูกค้าสูงสุด (Peak):", size: "xxs", weight: "bold", color: "#41032A", flex: 5 },
                { type: "text", text: `${peakHourLabel} (~${peakPaxVal} คน | โหลด ${peakCapacityLoad}%)`, size: "xxs", color: "#41032A", align: "end", flex: 7 }
              ]
            }
          ]
        },

        // 2. FAST ACTION & SAI MU (กลยุทธ์ & เสริมดวง ย่อยเร็ว)
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F6F2EA",
          borderColor: "#D4CBCF",
          borderWidth: "1px",
          cornerRadius: "sm",
          paddingAll: "12px",
          margin: "md",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "SAI MU & ACTION // เสริมดวง & สิ่งที่ต้องทำทันที", size: "xxs", weight: "bold", color: "#41032A", flex: 8 },
                { type: "text", text: `[${saiMuData.dayName}]`, size: "xxs", weight: "bold", color: "#635B5F", align: "end", flex: 4 }
              ]
            },
            { type: "separator", margin: "sm", color: "#D4CBCF" },
            {
              type: "box",
              layout: "vertical",
              margin: "xs",
              spacing: "xs",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "ฤกษ์ดูดทรัพย์:", size: "xxs", weight: "bold", color: "#1A1A1A", flex: 3 },
                    { type: "text", text: aiAnalysis.sai_mu_oracle.auspicious_window, size: "xxs", color: "#41032A", weight: "bold", flex: 9, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "สีมงคล / เลี่ยง:", size: "xxs", weight: "bold", color: "#1A1A1A", flex: 3 },
                    { type: "text", text: `${saiMuData.luckyColors} (เลี่ยง: ${saiMuData.unluckyColor})`, size: "xxs", color: "#41032A", weight: "bold", flex: 9, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "ทิศรับเงิน:", size: "xxs", weight: "bold", color: "#1A1A1A", flex: 3 },
                    { type: "text", text: `${saiMuData.luckyDirection} (เสริมพลัง: ${saiMuData.element})`, size: "xxs", color: "#1A1A1A", flex: 9, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "ทริคหน้าร้าน:", size: "xxs", weight: "bold", color: "#1A1A1A", flex: 3 },
                    { type: "text", text: aiAnalysis.sai_mu_oracle.sai_mu_hack, size: "xxs", color: "#524A4E", flex: 9, wrap: true }
                  ]
                },
                { type: "separator", margin: "xs", color: "#D4CBCF" },
                {
                  type: "box",
                  layout: "horizontal",
                  margin: "xs",
                  contents: [
                    { type: "text", text: "ครัวและบาร์:", size: "xxs", weight: "bold", color: "#41032A", flex: 3 },
                    { type: "text", text: aiAnalysis.operational_advice.kitchen_bar, size: "xxs", color: "#1A1A1A", flex: 9, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "จัดโต๊ะ/บริการ:", size: "xxs", weight: "bold", color: "#41032A", flex: 3 },
                    { type: "text", text: aiAnalysis.operational_advice.floor_service, size: "xxs", color: "#1A1A1A", flex: 9, wrap: true }
                  ]
                }
              ]
            }
          ]
        },

        // 3. DAYPARTS TIMELINE (4 ช่วงเวลา ย่ออ่านง่าย)
        {
          type: "box",
          layout: "horizontal",
          margin: "sm",
          contents: [
            { type: "text", text: "DAYPARTS TIMELINE // 4 ช่วงเวลาของวัน", size: "xxs", weight: "bold", color: "#635B5F", flex: 1 }
          ]
        },
        ...daypartRows
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#F6F2EA",
      paddingAll: "14px",
      spacing: "xs",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "message",
                label: "ยอดขายสด (STSALES)",
                text: "stsales"
              },
              color: "#ECE4E7"
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "message",
                label: "บิลล่าสุด (STBILL)",
                text: "stbill"
              },
              color: "#ECE4E7"
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "message",
                label: "ออเดอร์ครัว (STORDER)",
                text: "storder"
              },
              color: "#ECE4E7"
            }
          ]
        }
      ]
    }
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const signature = req.headers.get('x-line-signature')
  if (!signature) {
    return new Response('Missing signature', { status: 401 })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. LINE configuration (one query)
    const { data: lineRows } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['line_channel_secret', 'line_channel_access_token'])
    const lineCfg: Record<string, string> = Object.fromEntries((lineRows || []).map((r: any) => [r.key, r.value]))
    const CHANNEL_SECRET = lineCfg.line_channel_secret
    const CHANNEL_ACCESS_TOKEN = lineCfg.line_channel_access_token
    if (!CHANNEL_SECRET || !CHANNEL_ACCESS_TOKEN) {
      console.error('LINE configuration missing in app_settings')
      return new Response('Config error', { status: 500 })
    }

    // 2. Verify signature (no request bodies or secrets in logs: they carry user IDs and tokens)
    const body = await req.text()
    if (!(await verifySignature(body, signature, CHANNEL_SECRET))) {
      console.error('Invalid LINE signature')
      return new Response('Invalid signature', { status: 401 })
    }

    const { events = [] } = JSON.parse(body)
    console.log('Events:', events.map((e: any) => `${e.type}/${e.message?.type || '-'}${e.deliveryContext?.isRedelivery ? '/redelivery' : ''}`).join(', '))

    // 3. Answer LINE at once and keep working in the background. Receipt OCR can take
    //    tens of seconds; holding the HTTP request that long makes LINE time out and redeliver.
    const processEvents = async () => {
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim().toLowerCase()
        console.log('Received text:', text)

        if (text === 'ping') {
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [{ type: 'text', text: 'Pong! \n(Webhook is working)' }]
            }),
          })
          continue
        }

        if (text === 'stbuy' || text === 'stbuyback') {
          try {
            const isBuyback = text === 'stbuyback';
            console.log(`Processing ${text} command...`)
            const thNow = new Date(new Date().getTime() + (7 * 60 * 60 * 1000))
            let dateStr = ""
            try {
              dateStr = thNow.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
            } catch (e) {
              dateStr = thNow.toISOString().split('T')[0]
            }

            let query = supabaseAdmin
              .from('stock_items')
              .select('id, name, category, unit, pack_unit, usage_unit, conversion_factor, current_quantity, min_stock_threshold, reorder_point, updated_at')
              .order('name', { ascending: true })

            // stbuy: every item below its reorder point, however long ago it was last touched
            // (the 3-day window hid items that ran out earlier, fixed 2026-11-26).
            // stbuyback: only items that moved in the last 24 hours.
            if (isBuyback) {
               const dayAgo = new Date(new Date().getTime() - (24 * 60 * 60 * 1000)).toISOString()
               query = query.gte('updated_at', dayAgo)
            }

            const { data: items, error } = await query

            if (error) throw error

            const periodTitle = isBuyback ? 'ของที่ต้องซื้อ (เปลี่ยนใน 24 ชม.)' : 'ของที่ต้องซื้อทั้งหมด'
            const messages = [buildRestockMessage(items || [], periodTitle, dateStr)]

            const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({ replyToken: event.replyToken, messages: messages })
            })
            if (!resp.ok) {
              const txt = await resp.text()
              console.error('stbuy Reply Failed:', txt)
              const targetId = event.source.groupId || event.source.roomId || event.source.userId
              if (targetId) {
                 await fetch('https://api.line.me/v2/bot/message/push', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
                  body: JSON.stringify({ to: targetId, messages: [{ type: 'text', text: `ระบบไม่สามารถส่งรายการซื้อของแบบ Flex ได้\nลองใหม่อีกครั้ง หรือดูในหลังบ้าน` }] })
                })
              }
            }
          } catch (err: any) {
            console.error('stbuy Command Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({ replyToken: event.replyToken, messages: [{ type: 'text', text: 'เกิดข้อผิดพลาดในการดึงรายการซื้อของ\nลองใหม่อีกครั้งในอีกสักครู่' }] })
            })
          }
          continue
        }

        if (text === 'stback' || text === 'stday' || text === 'sthour') {
          try {
            const isToday = text === 'stday'
            const isHour = text === 'sthour'
            console.log(`Processing ${text} command...`)
            
            // Thailand Time (UTC+7)
            const now = new Date()
            const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
            
            let dbStart, dbEnd;
            let dateStr = "";
            let headerTitle = "อัพเดทสต๊อก";

            if (isHour) {
               dbEnd = now.toISOString();
               dbStart = new Date(now.getTime() - (60 * 60 * 1000)).toISOString();
               headerTitle += " (1 ชม. ล่าสุด)";
               try {
                 dateStr = thNow.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
                 dateStr += " " + thNow.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + " น.";
               } catch (e) {
                 dateStr = thNow.toISOString().split('T')[0]
               }
            } else {
               // Determine Query Range
               const queryDateStart = new Date(thNow)
               if (!isToday) {
                  queryDateStart.setDate(queryDateStart.getDate() - 1) // Yesterday
                  headerTitle += "เมื่อวาน"
               } else {
                  headerTitle += "วันนี้"
               }
               queryDateStart.setHours(0, 0, 0, 0)
               
               const queryDateEnd = new Date(queryDateStart)
               queryDateEnd.setHours(23, 59, 59, 999)

               // Convert back to UTC for DB query
               dbStart = new Date(queryDateStart.getTime() - (7 * 60 * 60 * 1000)).toISOString()
               dbEnd = new Date(queryDateEnd.getTime() - (7 * 60 * 60 * 1000)).toISOString()
               
               try {
                 dateStr = queryDateStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
               } catch (e) {
                 dateStr = queryDateStart.toISOString().split('T')[0]
               }
            }

            console.log(`Querying stocks from ${dbStart} to ${dbEnd}`)

            const { data: transactions, error } = await supabaseAdmin
              .from('stock_transactions')
              .select(`
                quantity_change,
                transaction_type,
                created_at,
                note,
                stock_items (
                  id,
                  name,
                  unit,
                  category,
                  current_quantity,
                  min_stock_threshold,
                  reorder_point,
                  pack_unit,
                  usage_unit,
                  conversion_factor
                )
              `)
              .gte('created_at', dbStart)
              .lte('created_at', dbEnd)
              .order('created_at', { ascending: true })

            if (error) {
              console.error('Supabase Query Error:', error)
              throw error
            }

            console.log(`Found ${transactions?.length ?? 0} transactions`)

            // Construct Reply
            let messages = []
            messages.push(buildStockSummaryMessage(transactions || [], headerTitle, dateStr))

            console.log(`Sending Stock Reply (${messages.length} bubbles)`)

            const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: messages
              }),
            })
            
            if (!resp.ok) {
              const txt = await resp.text()
              console.error('LINE Reply Failed:', txt)
              const targetId = event.source.groupId || event.source.roomId || event.source.userId
              if (targetId) {
                 const pushResp = await fetch('https://api.line.me/v2/bot/message/push', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
                  },
                  body: JSON.stringify({ to: targetId, messages: [{ type: 'text', text: `ระบบไม่สามารถส่งสรุปสต็อกแบบ Flex ได้ (อาจจะรายการเยอะเกินไป)\nลองใหม่อีกครั้ง หรือดูในหลังบ้าน` }] }),
                })
                if (!pushResp.ok) console.error('LINE Push Failed:', await pushResp.text())
              }
            }
          } catch (err) {
            console.error('Stock Command Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'เกิดข้อผิดพลาดในการดึงข้อมูลสต็อก\nลองใหม่อีกครั้งในอีกสักครู่' }]
              }),
            })
          }
        }

        // --- NEW: Staff Attendance Command ---
        if (text === 'staff') {
          console.log('Processing staff command...')
          
          const now = new Date()
          const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
          const dateStrApi = thNow.toISOString().split('T')[0] // YYYY-MM-DD
          
          let titleDateStr = ""
          try {
            titleDateStr = thNow.toLocaleDateString('th-TH', { 
              day: 'numeric', month: 'long', year: 'numeric' 
            })
          } catch (e) {
            titleDateStr = dateStrApi
          }

          try {
            // Fetch Data from HR API with Timeout
            const hrApiUrl = `https://inthehaus-hr.vercel.app/api/export/staff-data?startDate=${dateStrApi}&endDate=${dateStrApi}`
            console.log(`Fetching HR Data from: ${hrApiUrl}`)
            
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout
            
            let hrResp;
            try {
              hrResp = await fetch(hrApiUrl, { signal: controller.signal })
              clearTimeout(timeoutId)
            } catch (fetchErr) {
              if (fetchErr.name === 'AbortError') throw new Error('HR API request timed out (15s)')
              throw fetchErr
            }

            if (!hrResp.ok) throw new Error(`HR API returned status: ${hrResp.status}`)
            
            const hrData = await hrResp.json()
            const attendances = hrData.attendance || []
            const leaves = hrData.leaves || []

            let flexContents = [];

            if (attendances.length === 0 && leaves.length === 0) {
               flexContents.push({ type: "text", text: "NO RECORDED TRANSACTIONS FOR TODAY", color: "#635B5F", size: "xs", align: "center", weight: "bold" });
            } else {
               if (attendances.length > 0) {
                  flexContents.push({ type: "text", text: "SHIFT RECORDINGS", weight: "bold", color: "#1A1A1A", size: "sm", margin: "md" });
                  
                  const attendanceHeader = {
                      type: "box",
                      layout: "horizontal",
                      margin: "sm",
                      contents: [
                          { type: "text", text: "EMPLOYEE", color: "#635B5F", size: "xxs", weight: "bold", flex: 4 },
                          { type: "text", text: "CLOCK IN", color: "#635B5F", size: "xxs", weight: "bold", flex: 3 },
                          { type: "text", text: "CLOCK OUT", color: "#635B5F", size: "xxs", weight: "bold", flex: 3 }
                      ]
                  };
                  flexContents.push(attendanceHeader);
                  flexContents.push({ type: "separator", margin: "sm", color: "#1A1A1A" });

                  const empMap = new Map()
                  attendances.forEach((record: any) => {
                     if (!empMap.has(record.employee_id)) {
                        empMap.set(record.employee_id, { name: record.employee_name, in: null, out: null, moodIn: null, moodOut: null })
                     }
                     const emp = empMap.get(record.employee_id)
                     
                     let timeStr = ""
                     try {
                       timeStr = new Date(new Date(record.timestamp).getTime() + (7 * 60 * 60 * 1000))
                         .toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                     } catch (e) {
                       timeStr = record.timestamp.substring(11, 16)
                     }
                     
                     if (record.action_type === 'check_in' || record.action_type === 'clock_in') {
                        emp.in = timeStr
                        emp.moodIn = record.mood_status || ''
                     } else if (record.action_type === 'check_out' || record.action_type === 'clock_out') {
                        emp.out = timeStr
                        emp.moodOut = record.mood_status || ''
                     }
                  })

                  Array.from(empMap.values()).forEach((emp: any, i: number, arr: any[]) => {
                     const inTxt = emp.in ? `${emp.in} ${emp.moodIn}` : '-'
                     const outTxt = emp.out ? `${emp.out} ${emp.moodOut}` : '-'
                     
                     flexContents.push({
                         type: "box",
                         layout: "horizontal",
                         margin: "md",
                         contents: [
                             { type: "text", text: emp.name.toUpperCase(), weight: "bold", size: "sm", color: "#1A1A1A", flex: 4, wrap: true },
                             { type: "text", text: inTxt, color: "#1A1A1A", size: "xs", flex: 3 },
                             { type: "text", text: outTxt, color: "#1A1A1A", size: "xs", flex: 3 }
                         ]
                     })
                     if (i < arr.length - 1) flexContents.push({ type: "separator", margin: "md", color: "#D4CBCF" })
                  })
               }

               if (leaves.length > 0) {
                  flexContents.push({ type: "text", text: "ACTIVE LEAVES", weight: "bold", color: "#1A1A1A", size: "sm", margin: "xl" });
                  
                  const leaveHeader = {
                      type: "box",
                      layout: "horizontal",
                      margin: "sm",
                      contents: [
                          { type: "text", text: "EMPLOYEE", color: "#635B5F", size: "xxs", weight: "bold", flex: 3 },
                          { type: "text", text: "REASON", color: "#635B5F", size: "xxs", weight: "bold", flex: 4 },
                          { type: "text", text: "STATUS", color: "#635B5F", size: "xxs", weight: "bold", align: "end", flex: 3 }
                      ]
                  };
                  flexContents.push(leaveHeader);
                  flexContents.push({ type: "separator", margin: "sm", color: "#1A1A1A" });

                  leaves.forEach((leave: any, i: number, arr: any[]) => {
                     const statusColor = leave.status === 'approved' ? '#41032A' : (leave.status === 'pending' ? '#41032A' : '#B42318')
                     const statusText = leave.status === 'approved' ? 'APPROVED' : (leave.status === 'pending' ? 'PENDING' : 'REJECTED')
                     
                     flexContents.push({
                         type: "box",
                         layout: "horizontal",
                         margin: "md",
                         contents: [
                             { type: "text", text: leave.employee_name.toUpperCase(), weight: "bold", size: "sm", color: "#1A1A1A", flex: 3, wrap: true },
                             { type: "text", text: leave.reason || '-', color: "#635B5F", size: "xs", flex: 4, wrap: true },
                             { type: "text", text: statusText, color: statusColor, size: "xs", weight: "bold", align: "end", flex: 3 }
                         ]
                     })
                     if (i < arr.length - 1) flexContents.push({ type: "separator", margin: "md", color: "#D4CBCF" })
                  })
               }
            }

            const messagesPayload = [{
                type: "flex",
                altText: `ATTENDANCE REPORT: ${titleDateStr}`,
                contents: {
                    type: "bubble",
                    size: "mega",
                    header: {
                        type: "box",
                        layout: "vertical",
                        backgroundColor: "#ECE4E7",
                        paddingAll: "20px",
                        contents: [
                            { type: "text", text: "ATTENDANCE SUMMARY", weight: "bold", color: "#1A1A1A", size: "sm" },
                            { type: "text", text: titleDateStr.toUpperCase(), color: "#635B5F", size: "xs", margin: "xs" }
                        ]
                    },
                    body: {
                        type: "box",
                        layout: "vertical",
                        backgroundColor: "#F6F2EA",
                        paddingAll: "20px",
                        contents: flexContents
                    }
                }
            }];

            console.log('Sending Staff Reply...')
            const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: messagesPayload
              }),
            })
            
            if (!resp.ok) {
              const txt = await resp.text()
              console.error('Staff Reply Failed:', txt)
              const targetId = event.source.groupId || event.source.roomId || event.source.userId
              if (targetId) {
                 await fetch('https://api.line.me/v2/bot/message/push', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
                  body: JSON.stringify({ to: targetId, messages: [{ type: 'text', text: `ไม่สามารถส่งข้อมูลพนักงานแบบ Flex ได้\nลองใหม่อีกครั้ง หรือดูในหลังบ้าน` }] }),
                })
              }
            }
          } catch (apiErr) {
             console.error('Staff Command Error:', apiErr)
             await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'ไม่สามารถดึงข้อมูลพนักงานได้\nลองใหม่อีกครั้งในอีกสักครู่' }]
              }),
            })
          }
        }

        // --- NEW: Active Orders Command (storder) - All Tables Consolidated Summary ---
        if (text === 'storder' || text === 'ออเดอร์' || text === 'orders') {
          console.log('Processing storder (All Tables Consolidated) command...')
          try {
            const eighteenHoursAgo = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
            const { data: bookings, error } = await supabaseAdmin
              .from('bookings')
              .select(`
                id, tracking_token, total_amount, status, booking_type, booking_time, created_at, pax,
                pickup_contact_name, customer_note, staff_remark,
                tables_layout ( table_name ),
                order_items (
                  id, quantity, price_at_time, selected_options,
                  menu_items ( name, category_id )
                )
              `)
              .in('status', ['pending', 'confirmed', 'seated', 'ready'])
              .gte('booking_time', eighteenHoursAgo)
              .order('booking_time', { ascending: true })

            if (error) throw error

            const translateStatus = (status: string) => {
              if (status === 'pending') return { text: 'รอรับออเดอร์', color: '#41032A' }
              if (status === 'confirmed') return { text: 'กำลังปรุง', color: '#41032A' }
              if (status === 'seated') return { text: 'นั่งที่โต๊ะ', color: '#41032A' }
              if (status === 'ready') return { text: 'พร้อมเสิร์ฟ', color: '#41032A' }
              return { text: status.toUpperCase(), color: '#635B5F' }
            }

            const formatOptions = (options: any) => {
              if (!options) return ''
              let opts: string[] = []
              if (Array.isArray(options)) {
                opts = options.map(o => typeof o === 'object' ? `${o.name}` : o)
              } else if (typeof options === 'object') {
                opts = Object.entries(options).map(([key, value]) => `${key}: ${value}`)
              }
              return opts.length > 0 ? ` (${opts.join(', ')})` : ''
            }

            if (!bookings || bookings.length === 0) {
              await fetch('https://api.line.me/v2/bot/message/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
                body: JSON.stringify({
                  replyToken: event.replyToken,
                  messages: [{
                    type: "flex",
                    altText: "ออเดอร์ปัจจุบัน: ไม่มีออเดอร์ค้างอยู่",
                    contents: {
                      type: "bubble",
                      size: "mega",
                      header: {
                        type: "box",
                        layout: "vertical",
                        backgroundColor: "#ECE4E7",
                        paddingAll: "20px",
                        contents: [
                          { type: "text", text: "ALL ACTIVE ORDERS", weight: "bold", color: "#41032A", size: "xs" },
                          { type: "text", text: "สรุปออเดอร์ทุกโต๊ะในร้าน", weight: "bold", color: "#1A1A1A", size: "md", margin: "xs" }
                        ]
                      },
                      body: {
                        type: "box",
                        layout: "vertical",
                        backgroundColor: "#F6F2EA",
                        paddingAll: "24px",
                        contents: [
                          { type: "text", text: "ไม่มีออเดอร์ค้างอยู่ในขณะนี้", color: "#41032A", size: "sm", align: "center", weight: "bold" },
                          { type: "text", text: "ทุกโต๊ะเช็คบิลเรียบร้อย หรือยังไม่มีการเปิดบิลใหม่", color: "#635B5F", size: "xs", align: "center", margin: "sm", wrap: true }
                        ]
                      }
                    }
                  }]
                })
              })
              continue
            }

            // 1. Calculate Aggregate Metrics & Kitchen Queue
            let totalUnpaidAmt = 0
            let totalPax = 0
            const kitchenQueueMap: { [itemName: string]: number } = {}

            bookings.forEach(b => {
              totalUnpaidAmt += Number(b.total_amount || b.total_price || 0)
              totalPax += Number(b.pax || 1)

              ;(b.order_items || []).forEach((it: any) => {
                const name = it.menu_items?.name || 'Unknown Item'
                const qty = Number(it.quantity || 0)
                kitchenQueueMap[name] = (kitchenQueueMap[name] || 0) + qty
              })
            })

            // 2. Build Table Summary Blocks
            const tableBlocks: any[] = []

            bookings.forEach((b: any, bIdx: number) => {
              const isPickup = b.booking_type === 'pickup'
              const tblName = isPickup
                ? `TAKEAWAY (${b.pickup_contact_name || b.customer_note || 'ลูกค้า'})`
                : `${b.tables_layout?.table_name || 'WALK-IN'}`
              
              const statusObj = translateStatus(b.status)
              const bAmt = Number(b.total_amount || b.total_price || 0)

              let orderTimeStr = ''
              try {
                const bTime = new Date(b.booking_time || b.created_at)
                const thTime = new Date(bTime.getTime() + (7 * 60 * 60 * 1000))
                orderTimeStr = thTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
              } catch {
                orderTimeStr = ''
              }

              const itemsList = (b.order_items || []).map((it: any) => {
                const name = it.menu_items?.name || 'Item'
                const qty = it.quantity || 0
                const price = it.price_at_time || 0
                const optStr = formatOptions(it.selected_options)
                return {
                  type: "box",
                  layout: "horizontal",
                  margin: "xs",
                  contents: [
                    { type: "text", text: `${qty}x ${name}${optStr}`, size: "xs", color: "#1A1A1A", flex: 7, wrap: true },
                    { type: "text", text: `฿${(qty * price).toFixed(2)}`, size: "xs", color: "#635B5F", align: "end", flex: 3 }
                  ]
                }
              })

              tableBlocks.push({
                type: "box",
                layout: "vertical",
                backgroundColor: "#F6F2EA",
                cornerRadius: "md",
                paddingAll: "md",
                margin: "md",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      { type: "text", text: tblName, weight: "bold", size: "sm", color: "#1A1A1A", flex: 7, wrap: true },
                      { type: "text", text: `฿${bAmt.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, weight: "bold", size: "sm", color: "#41032A", align: "end", flex: 3 }
                    ]
                  },
                  {
                    type: "box",
                    layout: "horizontal",
                    margin: "xs",
                    contents: [
                      { type: "text", text: `${statusObj.text} · สั่งเมื่อ ${orderTimeStr}`, size: "xxs", weight: "bold", color: statusObj.color, flex: 8 },
                      { type: "text", text: `${b.pax || 1} PAX`, size: "xxs", color: "#635B5F", align: "end", flex: 2 }
                    ]
                  },
                  { type: "separator", margin: "sm", color: "#D4CBCF" },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "sm",
                    spacing: "xs",
                    contents: itemsList.length > 0 ? itemsList : [{ type: "text", text: "ไม่มีรายการอาหาร", size: "xxs", color: "#635B5F" }]
                  }
                ]
              })

              if (bIdx < bookings.length - 1) {
                tableBlocks.push({ type: "separator", margin: "sm", color: "#D4CBCF" })
              }
            })

            // 3. Build Kitchen Preparation Queue Rows (Consolidated across all tables)
            const sortedKitchenQueue = Object.entries(kitchenQueueMap).sort((a, b) => b[1] - a[1])
            const kitchenRows = sortedKitchenQueue.slice(0, 10).map(([name, qty]) => ({
              type: "box",
              layout: "horizontal",
              margin: "xs",
              contents: [
                { type: "text", text: `• ${name}`, size: "xs", color: "#1A1A1A", flex: 8, wrap: true },
                { type: "text", text: `${qty} ที่`, size: "xs", weight: "bold", color: "#41032A", align: "end", flex: 2 }
              ]
            }))

            // 4. Construct Bubbles
            const bubbles: any[] = []

            // Bubble 1: Table-by-Table Summary
            bubbles.push({
              type: "bubble",
              size: "mega",
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#ECE4E7",
                paddingAll: "20px",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      { type: "text", text: "ALL ACTIVE TABLES", size: "xs", weight: "bold", color: "#41032A", flex: 7 },
                      { type: "text", text: "PAGE 1/2", size: "xxs", color: "#635B5F", align: "end", flex: 3 }
                    ]
                  },
                  { type: "text", text: `สรุปออเดอร์สด (${bookings.length} โต๊ะกำลังทาน)`, size: "md", weight: "bold", color: "#1A1A1A", margin: "xs", wrap: true }
                ]
              },
              body: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#ECE4E7",
                paddingAll: "16px",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    backgroundColor: "#1A1A1A",
                    cornerRadius: "md",
                    paddingAll: "12px",
                    contents: [
                      {
                        type: "box",
                        layout: "vertical",
                        flex: 6,
                        contents: [
                          { type: "text", text: "ยอดรวมทุกโต๊ะ (ยังไม่เช็คบิล)", size: "xxs", color: "#BEB4B9" },
                          { type: "text", text: `${bookings.length} โต๊ะ · รวม ${totalPax} ท่าน`, size: "xs", weight: "bold", color: "#F6F2EA", margin: "xs" }
                        ]
                      },
                      {
                        type: "text",
                        text: `฿${totalUnpaidAmt.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
                        size: "md",
                        weight: "bold",
                        color: "#F6F2EA",
                        align: "end",
                        flex: 4,
                        gravity: "center"
                      }
                    ]
                  },
                  { type: "separator", margin: "md", color: "#D4CBCF" },
                  ...tableBlocks
                ]
              }
            })

            // Bubble 2: Kitchen Queue Matrix (Consolidated Items to Cook)
            bubbles.push({
              type: "bubble",
              size: "mega",
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#41032A",
                paddingAll: "20px",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      { type: "text", text: "KITCHEN & BAR QUEUE", size: "xs", weight: "bold", color: "#D0B5C1", flex: 7 },
                      { type: "text", text: "PAGE 2/2", size: "xxs", color: "#D0B5C1", align: "end", flex: 3 }
                    ]
                  },
                  { type: "text", text: "สรุปจำนวนจานที่ต้องเตรียมทั้งหมด", size: "md", weight: "bold", color: "#F6F2EA", margin: "xs", wrap: true }
                ]
              },
              body: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#F6F2EA",
                paddingAll: "20px",
                contents: [
                  { type: "text", text: "รวมจำนวนจานอาหารทุกโต๊ะในร้าน", size: "xxs", weight: "bold", color: "#635B5F" },
                  { type: "separator", margin: "sm", color: "#D4CBCF" },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "md",
                    spacing: "xs",
                    contents: kitchenRows.length > 0 ? kitchenRows : [{ type: "text", text: "ไม่มีรายการอาหาร", size: "xs", color: "#635B5F" }]
                  },
                  { type: "separator", margin: "lg", color: "#D4CBCF" },
                  { type: "text", text: `รวมเมนูที่ต้องทำทั้งหมด ${sortedKitchenQueue.reduce((s, [, q]) => s + q, 0)} ที่`, size: "xs", weight: "bold", color: "#1A1A1A", align: "center", margin: "md" }
                ]
              }
            })

            const flexPayload = {
              type: "flex",
              altText: `สรุปออเดอร์ทุกโต๊ะ (${bookings.length} โต๊ะ: ฿${totalUnpaidAmt.toLocaleString('th-TH')})`,
              contents: {
                type: "carousel",
                contents: bubbles
              }
            }

            console.log('Sending storder consolidated reply...')
            const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [flexPayload]
              }),
            })

            if (!resp.ok) {
              const errTxt = await resp.text()
              console.error('storder reply failed:', errTxt)
            }
          } catch (err: any) {
            console.error('storder Command Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'เกิดข้อผิดพลาดในการดึงรายการออเดอร์ทุกโต๊ะ\nลองใหม่อีกครั้งในอีกสักครู่' }]
              })
            })
          }
          continue
        }

        // --- NEW: Top 5 Hero Items Command (sthero) ---
        if (text === 'sthero') {
          console.log('Processing sthero command...')
          try {
            const now = new Date()
            const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
            
            const queryDateStart = new Date(thNow)
            queryDateStart.setHours(0, 0, 0, 0)
            const queryDateEnd = new Date(queryDateStart)
            queryDateEnd.setHours(23, 59, 59, 999)

            const dbStart = new Date(queryDateStart.getTime() - (7 * 60 * 60 * 1000)).toISOString()
            const dbEnd = new Date(queryDateEnd.getTime() - (7 * 60 * 60 * 1000)).toISOString()

            let titleDateStr = ""
            try {
              titleDateStr = queryDateStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
            } catch (e) {
              titleDateStr = queryDateStart.toISOString().split('T')[0]
            }

            console.log(`Querying hero items from ${dbStart} to ${dbEnd}`)

            const { data: bookingsData, error } = await supabaseAdmin
              .from('bookings')
              .select('id, order_items(quantity, menu_item_id, menu_items(name))')
              .gte('booking_time', dbStart)
              .lte('booking_time', dbEnd)
              .not('status', 'eq', 'void')
              .not('status', 'eq', 'cancelled')

            if (error) throw error

            const itemTotals: { [key: string]: { name: string; quantity: number } } = {}
            bookingsData?.forEach((b: any) => {
              b.order_items?.forEach((item: any) => {
                const itemId = item.menu_item_id
                if (!itemId) return
                const itemName = item.menu_items?.name || 'Unknown Item'
                const qty = Number(item.quantity) || 0
                if (!itemTotals[itemId]) {
                  itemTotals[itemId] = { name: itemName, quantity: 0 }
                }
                itemTotals[itemId].quantity += qty
              })
            })

            const sortedItems = Object.entries(itemTotals)
              .map(([id, val]) => ({ id, name: val.name, quantity: val.quantity }))
              .sort((a, b) => b.quantity - a.quantity)
              .slice(0, 5)

            let messages = []

            if (sortedItems.length === 0) {
              messages.push({
                type: "flex",
                altText: `5 อันดับเมนูฮิตวันนี้: ${titleDateStr}`,
                contents: {
                  type: "bubble",
                  size: "mega",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#ECE4E7",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "HERO MENU (TODAY)", weight: "bold", color: "#41032A", size: "xs" },
                      { type: "text", text: `5 อันดับเมนูขายดีประจำวัน · ${titleDateStr}`, weight: "bold", color: "#1A1A1A", size: "md", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#F6F2EA",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "ยังไม่มีรายการสั่งอาหารในวันนี้", color: "#635B5F", size: "sm", align: "center", weight: "bold" }
                    ]
                  }
                }
              })
            } else {
              const maxQty = sortedItems[0].quantity
              const flexContents: any[] = []

              sortedItems.forEach((item, index) => {
                const percent = maxQty > 0 ? Math.round((item.quantity / maxQty) * 100) : 0
                const rankColors = ["#41032A", "#41032A", "#41032A", "#635B5F", "#635B5F"]
                const rankColor = rankColors[index] || "#635B5F"

                flexContents.push({
                  type: "box",
                  layout: "vertical",
                  margin: "md",
                  contents: [
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "box",
                          layout: "vertical",
                          width: "22px",
                          height: "22px",
                          backgroundColor: rankColor,
                          cornerRadius: "4px",
                          contents: [
                            { type: "text", text: String(index + 1), color: "#F6F2EA", size: "xs", weight: "bold", align: "center", gravity: "center" }
                          ]
                        },
                        {
                          type: "text",
                          text: item.name.toUpperCase(),
                          weight: "bold",
                          size: "sm",
                          color: "#1A1A1A",
                          margin: "md",
                          gravity: "center",
                          flex: 7
                        },
                        {
                          type: "text",
                          text: `${item.quantity} ที่`,
                          weight: "bold",
                          size: "sm",
                          color: "#41032A",
                          align: "end",
                          gravity: "center",
                          flex: 3
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      margin: "sm",
                      height: "6px",
                      backgroundColor: "#D4CBCF",
                      cornerRadius: "sm",
                      contents: [
                        {
                          type: "box",
                          layout: "vertical",
                          width: `${percent}%`,
                          backgroundColor: rankColor,
                          cornerRadius: "sm",
                          contents: []
                        }
                      ]
                    }
                  ]
                })

                if (index < sortedItems.length - 1) {
                  flexContents.push({ type: "separator", margin: "md", color: "#D4CBCF" })
                }
              })

              messages.push({
                type: "flex",
                altText: `5 อันดับเมนูฮิตวันนี้: ${titleDateStr}`,
                contents: {
                  type: "bubble",
                  size: "mega",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#ECE4E7",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "HERO MENU (TODAY)", weight: "bold", color: "#41032A", size: "xs" },
                      { type: "text", text: `5 อันดับเมนูขายดีประจำวัน · ${titleDateStr}`, weight: "bold", color: "#1A1A1A", size: "md", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#F6F2EA",
                    paddingAll: "20px",
                    contents: flexContents
                  }
                }
              })
            }

            console.log('Sending sthero reply...')
            const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: messages
              }),
            })
            if (!resp.ok) {
              console.error('sthero reply failed:', await resp.text())
            }
          } catch (err: any) {
            console.error('sthero Command Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'เกิดข้อผิดพลาดในการคำนวณเมนูฮิต\nลองใหม่อีกครั้งในอีกสักครู่' }]
              })
            })
          }
          continue
        }

        // --- NEW: Web Price Search Command (Replaces Makro Search) ---
        if (text.startsWith('ราคา ') || text.startsWith('makro ')) {
          console.log('Processing price search command...')
          const isMakroAlias = text.startsWith('makro ')
          const keyword = text.substring(isMakroAlias ? 6 : 5).trim()
          
          if (!keyword) {
             await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'กรุณาระบุคำค้นหา เช่น ราคา น้ำมันปาล์ม' }]
              }),
            })
            continue
          }

          try {
            console.log(`Searching Web for Price. Keyword: ${keyword}`)
            // Query DuckDuckGo HTML
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword + ' ราคา')}`
            const dResponse = await fetch(searchUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            })

            if (!dResponse.ok) {
              throw new Error(`DuckDuckGo request failed with status: ${dResponse.status}`)
            }

            const html = await dResponse.text()
            
            // Split HTML by result block
            const resultBlocks = html.split('class="result ')
            const results = []
            
            const currentYear = new Date().getFullYear()
            const thaiYear = currentYear + 543
            const yearsToIgnore = [currentYear, currentYear - 1, currentYear + 1, thaiYear, thaiYear - 1, thaiYear + 1]

            for (let i = 1; i < resultBlocks.length; i++) {
              const block = resultBlocks[i]
              const titleMatch = block.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/)
              const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
              const urlMatch = block.match(/href="([^"]+uddg=([^"&]+)[^"]*)"/)

              if (titleMatch && snippetMatch) {
                const rawTitle = titleMatch[1].replace(/<[^>]*>/g, '').trim()
                const rawSnippet = snippetMatch[1].replace(/<[^>]*>/g, '').trim()
                
                let targetUrl = ''
                if (urlMatch) {
                  try {
                    targetUrl = decodeURIComponent(urlMatch[2])
                  } catch {
                    targetUrl = urlMatch[1]
                  }
                }

                let domain = ''
                try {
                  const urlObj = new URL(targetUrl)
                  domain = urlObj.hostname.replace('www.', '')
                } catch {
                  domain = ''
                }

                // Extract prices
                const combinedText = `${rawTitle} ${rawSnippet}`
                const prices: number[] = []
                const priceRegexes = [
                  /฿\s*(\d+(?:\.\d+)?)/g,
                  /(\d+(?:\.\d+)?)\s*บาท/g,
                  /ราคา\s*(\d+(?:\.\d+)?)/g,
                  /(\d+(?:\.\d+)?)\s*\.-\s*/g
                ]

                for (const regex of priceRegexes) {
                  let match
                  regex.lastIndex = 0
                  while ((match = regex.exec(combinedText)) !== null) {
                    const price = parseFloat(match[1])
                    if (price > 0 && !prices.includes(price) && price < 100000) {
                      if (yearsToIgnore.includes(price)) continue
                      prices.push(price)
                    }
                  }
                }

                results.push({
                  title: rawTitle,
                  snippet: rawSnippet,
                  url: targetUrl,
                  domain: domain,
                  prices: prices.sort((a, b) => a - b)
                })
              }
            }

            let flexContents = [];
            
            if (results.length === 0) {
               flexContents.push({ type: "text", text: "NO PRICES FOUND FOR KEYWORD", color: "#635B5F", size: "xs", align: "center", weight: "bold" });
            } else {
               const displayItems = results.slice(0, 5)
               displayItems.forEach((r: any, i: number, arr: any[]) => {
                  
                  const contents = [
                      { 
                        type: "box", 
                        layout: "horizontal", 
                        contents: [
                          { type: "text", text: r.title.toUpperCase(), weight: "bold", size: "sm", color: "#1A1A1A", wrap: true, flex: 7 },
                          { type: "text", text: r.prices && r.prices.length > 0 ? `฿${r.prices[0]}` : "-", weight: "bold", size: "sm", color: "#41032A", align: "end", flex: 3 }
                        ]
                      }
                  ];

                  if (r.prices && r.prices.length > 1) {
                      const otherPrices = r.prices.slice(1).map((p: number) => `฿${p}`).join(', ');
                      contents.push({
                         type: "text", text: `RANGE: ${otherPrices}`, color: "#635B5F", size: "xs", margin: "xs"
                      });
                  }

                  contents.push({
                      type: "text",
                      text: r.snippet,
                      color: "#635B5F",
                      size: "xs",
                      wrap: true,
                      margin: "sm"
                  });

                  if (r.domain) {
                      contents.push({
                          type: "text",
                          text: `SOURCE: ${r.domain.toUpperCase()}`,
                          color: "#635B5F",
                          size: "xxs",
                          margin: "xs",
                          weight: "bold"
                      });
                  }

                  flexContents.push({
                      type: "box",
                      layout: "vertical",
                      margin: "md",
                      contents: contents
                  });

                  if (i < arr.length - 1) flexContents.push({ type: "separator", margin: "md", color: "#D4CBCF" });
               })
               
               if (results.length > 5) {
                   flexContents.push({ type: "separator", margin: "md", color: "#D4CBCF" });
                   flexContents.push({ type: "text", text: `(SHOWN 5 OF ${results.length} ENTRIES)`, color: "#635B5F", size: "xs", align: "center", margin: "md" });
               }
            }

            const messagesPayload = [{
                type: "flex",
                altText: `PRICE INDEX: ${keyword}`,
                contents: {
                    type: "bubble",
                    size: "mega",
                    header: {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "PRICE INDEX", weight: "bold", color: "#1A1A1A", size: "sm" },
                            { type: "text", text: `SEARCH: "${keyword.toUpperCase()}"`, color: "#635B5F", size: "xs", margin: "xs" }
                        ]
                    },
                    body: {
                        type: "box",
                        layout: "vertical",
                        paddingAll: "20px",
                        contents: flexContents
                    },
                    styles: {
                        header: {
                            backgroundColor: "#F6F2EA",
                            separator: true,
                            separatorColor: "#D4CBCF"
                        },
                        body: {
                            backgroundColor: "#F6F2EA"
                        }
                    }
                }
            }];

            console.log('Sending Price Search Reply...')
            const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: messagesPayload
              }),
            })
            
            if (!resp.ok) {
              const txt = await resp.text()
              console.error('Price Reply Failed:', txt)
            }

          } catch (err) {
             console.error('Price Command Error:', err)
             await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'ไม่สามารถดึงข้อมูลราคากลางได้\nลองใหม่อีกครั้งในอีกสักครู่' }]
              }),
            })
          }
          continue
        }

        // --- NEW: Daily Expenses Summary Command (stexp / stexpense) ---
        if (text === 'stexp' || text === 'stexpense' || text === 'stexpenses') {
          console.log('Processing stexp command...')
          try {
            const now = new Date()
            const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
            const todayStr = thNow.toISOString().split('T')[0]

            let titleDateStr = ''
            try {
              titleDateStr = thNow.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
            } catch {
              titleDateStr = todayStr
            }

            const { data: expenses, error } = await supabaseAdmin
              .from('store_expenses')
              .select('*')
              .eq('expense_date', todayStr)
              .order('created_at', { ascending: false })

            if (error) throw error

            let totalAmount = 0
            let totalVat = 0
            ;(expenses || []).forEach((exp: any) => {
              totalAmount += Number(exp.amount) || 0
              totalVat += Number(exp.vat_amount) || 0
            })

            let messages = []

            if (!expenses || expenses.length === 0) {
              messages.push({
                type: "flex",
                altText: `สรุปค่าใช้จ่ายวันนี้ (${titleDateStr}): ยังไม่มีรายการ`,
                contents: {
                  type: "bubble",
                  size: "mega",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#ECE4E7",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "DAILY EXPENSES", weight: "bold", color: "#41032A", size: "xs" },
                      { type: "text", text: `รายงานค่าใช้จ่ายประจำวัน · ${titleDateStr}`, weight: "bold", color: "#1A1A1A", size: "md", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#F6F2EA",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "ยังไม่มีการบันทึกค่าใช้จ่ายในวันนี้", color: "#635B5F", size: "sm", align: "center", weight: "bold" },
                      { type: "text", text: "ส่งภาพสลิป/ใบเสร็จเข้ามาในกลุ่มเพื่อบันทึกอัตโนมัติได้ทันที", color: "#635B5F", size: "xs", align: "center", margin: "sm", wrap: true }
                    ]
                  }
                }
              })
            } else {
              const flexContents: any[] = []

              expenses.slice(0, 8).forEach((exp: any, index: number) => {
                const vendor = exp.vendor_name || 'ไม่ระบุ'
                const title = exp.title || 'ค่าใช้จ่าย'
                const amt = Number(exp.amount) || 0

                flexContents.push({
                  type: "box",
                  layout: "horizontal",
                  margin: "md",
                  contents: [
                    {
                      type: "box",
                      layout: "vertical",
                      flex: 7,
                      contents: [
                        { type: "text", text: vendor.toUpperCase(), weight: "bold", size: "xs", color: "#1A1A1A", wrap: true },
                        { type: "text", text: title, size: "xxs", color: "#635B5F", wrap: true, margin: "xs" }
                      ]
                    },
                    {
                      type: "text",
                      text: `฿${amt.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      weight: "bold",
                      size: "sm",
                      color: "#41032A",
                      align: "end",
                      gravity: "center",
                      flex: 3
                    }
                  ]
                })

                if (index < Math.min(expenses.length, 8) - 1) {
                  flexContents.push({ type: "separator", margin: "md", color: "#D4CBCF" })
                }
              })

              if (expenses.length > 8) {
                flexContents.push({ type: "separator", margin: "md", color: "#D4CBCF" })
                flexContents.push({
                  type: "text",
                  text: `...แสดง 8 จากทั้งหมด ${expenses.length} รายการ`,
                  color: "#635B5F",
                  size: "xxs",
                  align: "center",
                  margin: "sm"
                })
              }

              messages.push({
                type: "flex",
                altText: `สรุปค่าใช้จ่ายวันนี้ (${titleDateStr}): ฿${totalAmount.toLocaleString('th-TH')}`,
                contents: {
                  type: "bubble",
                  size: "mega",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#ECE4E7",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "DAILY EXPENSES", weight: "bold", color: "#41032A", size: "xs" },
                      { type: "text", text: `รายงานค่าใช้จ่ายประจำวัน · ${titleDateStr}`, weight: "bold", color: "#1A1A1A", size: "md", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#F6F2EA",
                    paddingAll: "20px",
                    contents: [
                      {
                        type: "box",
                        layout: "horizontal",
                        backgroundColor: "#ECE4E7",
                        cornerRadius: "md",
                        paddingAll: "md",
                        contents: [
                          {
                            type: "box",
                            layout: "vertical",
                            flex: 5,
                            contents: [
                              { type: "text", text: "ยอดรวมค่าใช้จ่ายวันนี้", weight: "bold", size: "xs", color: "#1A1A1A" },
                              { type: "text", text: `(${expenses.length} รายการ)`, color: "#635B5F", size: "xxs", margin: "xs" }
                            ]
                          },
                          {
                            type: "text",
                            text: `฿${totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            weight: "bold",
                            size: "lg",
                            color: "#41032A",
                            align: "end",
                            gravity: "center",
                            flex: 5
                          }
                        ]
                      },
                      { type: "separator", margin: "md", color: "#D4CBCF" },
                      { type: "text", text: "รายการที่บันทึกวันนี้", weight: "bold", size: "xs", color: "#635B5F", margin: "md" },
                      ...flexContents
                    ]
                  }
                }
              })
            }

            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: messages
              }),
            })
          } catch (err: any) {
            console.error('stexp Command Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'เกิดข้อผิดพลาดในการดึงรายการค่าใช้จ่าย\nลองใหม่อีกครั้งในอีกสักครู่' }]
              })
            })
          }
          continue
        }

        // --- NEW: Live POS Daily Sales Summary (stsales / ยอดขาย / สรุปยอดขาย / รายงานยอดขาย / sttoday) ---
        if (
          text === 'stsales' || text === 'ยอดขาย' || text === 'สรุปยอดขาย' || text === 'รายงานยอดขาย' ||
          text === 'ยอดวันนี้' || text === 'sttoday' || text === 'stsales today' || text === 'sales'
        ) {
          console.log('Processing stsales command...')
          try {
            const now = new Date()
            const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
            const todayStr = thNow.toISOString().split('T')[0]
            const dbStart = `${todayStr}T00:00:00+07:00`
            const dbEnd = `${todayStr}T23:59:59+07:00`

            let titleDateStr = ''
            try {
              titleDateStr = thNow.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
            } catch {
              titleDateStr = todayStr
            }

            const { data: bookingsData, error: bookingsErr } = await supabaseAdmin
              .from('bookings')
              .select('id, total_amount, discount_amount, staff_remark, payment_method, payment_slip_url, status, booking_type, booking_time')
              .gte('booking_time', dbStart)
              .lte('booking_time', dbEnd)

            if (bookingsErr) throw bookingsErr

            const allBookings = bookingsData || []
            const completed = allBookings.filter(b => b.status === 'completed')
            const activeUnpaid = allBookings.filter(b => ['seated', 'confirmed', 'ready', 'pending'].includes(b.status))
            const voided = allBookings.filter(b => ['void', 'cancelled'].includes(b.status))

            let totalSales = 0
            let totalDiscounts = 0
            let cashSales = 0
            let qrSales = 0
            let creditSales = 0

            completed.forEach(b => {
              const amt = Number(b.total_amount) || 0
              const disc = Number(b.discount_amount) || 0
              totalSales += amt
              totalDiscounts += disc

              const breakdown = parseBookingPayment(b)
              cashSales += breakdown.cash
              qrSales += breakdown.qr
              creditSales += breakdown.credit
            })

            const activeUnpaidAmount = activeUnpaid.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0)
            const avgTicket = completed.length > 0 ? (totalSales / completed.length) : 0

            const salesFlex = {
              type: "flex",
              altText: `สรุปยอดขายวันนี้ (${titleDateStr}): ฿${totalSales.toLocaleString('th-TH')}`,
              contents: {
                type: "bubble",
                size: "mega",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#ECE4E7",
                  paddingAll: "20px",
                  contents: [
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        { type: "text", text: "HAUS POS", weight: "bold", size: "md", color: "#1A1A1A", flex: 6 },
                        { type: "text", text: "LIVE SALES", weight: "bold", size: "xxs", color: "#41032A", align: "end", flex: 4, gravity: "center" }
                      ]
                    },
                    { type: "text", text: `รายงานยอดขายประจำวัน · ${titleDateStr}`, size: "xxs", color: "#635B5F", margin: "xs" }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#F6F2EA",
                  paddingAll: "20px",
                  contents: [
                    {
                      type: "box",
                      layout: "vertical",
                      backgroundColor: "#ECE4E7",
                      cornerRadius: "md",
                      paddingAll: "14px",
                      contents: [
                        {
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            { type: "text", text: "ยอดขายสุทธิ (ไม่รวมเงินทอน)", size: "xs", color: "#635B5F", flex: 6, gravity: "center" },
                            {
                              type: "text",
                              text: `฿${totalSales.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                              size: "lg",
                              weight: "bold",
                              color: "#1A1A1A",
                              align: "end",
                              flex: 6,
                              gravity: "center"
                            }
                          ]
                        },
                        {
                          type: "box",
                          layout: "horizontal",
                          margin: "xs",
                          contents: [
                            { type: "text", text: `${completed.length} บิลชำระแล้ว · เฉลี่ย ฿${avgTicket.toFixed(0)}/บิล`, size: "xxs", color: "#41032A", flex: 1 }
                          ]
                        }
                      ]
                    },
                    { type: "separator", margin: "lg", color: "#D4CBCF" },
                    { type: "text", text: "BREAKDOWN ช่องทางชำระเงิน", size: "xxs", weight: "bold", color: "#635B5F", margin: "md" },
                    {
                      type: "box",
                      layout: "vertical",
                      margin: "sm",
                      spacing: "xs",
                      contents: [
                        {
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            { type: "text", text: "PromptPay / QR / โอน", size: "xs", color: "#1A1A1A", flex: 7 },
                            { type: "text", text: `฿${qrSales.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, size: "xs", weight: "bold", color: "#1A1A1A", align: "end", flex: 3 }
                          ]
                        },
                        {
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            { type: "text", text: "เงินสด Cash", size: "xs", color: "#1A1A1A", flex: 7 },
                            { type: "text", text: `฿${cashSales.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, size: "xs", weight: "bold", color: "#1A1A1A", align: "end", flex: 3 }
                          ]
                        },
                        {
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            { type: "text", text: "บัตรเครดิต Credit Card", size: "xs", color: "#1A1A1A", flex: 7 },
                            { type: "text", text: `฿${creditSales.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, size: "xs", weight: "bold", color: "#1A1A1A", align: "end", flex: 3 }
                          ]
                        }
                      ]
                    },
                    ...(totalDiscounts > 0 ? [
                      { type: "separator", margin: "md", color: "#D4CBCF" },
                      {
                        type: "box",
                        layout: "horizontal",
                        margin: "sm",
                        contents: [
                          { type: "text", text: "ยอดส่วนลดโปรโมชั่น/แต้ม", size: "xs", color: "#635B5F", flex: 7 },
                          { type: "text", text: `-฿${totalDiscounts.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, size: "xs", weight: "bold", color: "#41032A", align: "end", flex: 3 }
                        ]
                      }
                    ] : []),
                    { type: "separator", margin: "md", color: "#D4CBCF" },
                    {
                      type: "box",
                      layout: "horizontal",
                      margin: "sm",
                      contents: [
                        { type: "text", text: `ยอดค้างในร้าน (${activeUnpaid.length} โต๊ะ)`, size: "xs", color: "#635B5F", flex: 7 },
                        { type: "text", text: `฿${activeUnpaidAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, size: "xs", weight: "bold", color: "#41032A", align: "end", flex: 3 }
                      ]
                    },
                    ...(voided.length > 0 ? [
                      {
                        type: "box",
                        layout: "horizontal",
                        margin: "xs",
                        contents: [
                          { type: "text", text: `บิลยกเลิก Void (${voided.length} รายการ)`, size: "xxs", color: "#635B5F", flex: 7 },
                          { type: "text", text: "ตรวจสอบพิมพ์: stvoid", size: "xxs", color: "#635B5F", align: "end", flex: 5 }
                        ]
                      }
                    ] : [])
                  ]
                }
              }
            }

            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [salesFlex]
              })
            })
          } catch (err: any) {
            console.error('stsales Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'ไม่สามารถดึงยอดขายได้\nลองใหม่อีกครั้งในอีกสักครู่' }]
              })
            })
          }
          continue
        }

        // --- NEW: Intraday Traffic Prediction & Sai Mu Oracle (stpredict / ทำนาย / พยากรณ์ / stforecast) ---
        if (
          text === 'stpredict' || text === 'predict' || text === 'ทำนาย' ||
          text === 'พยากรณ์' || text === 'stforecast' || text === 'st forecast'
        ) {
          console.log('Processing stpredict command...')
          try {
            const now = new Date()
            const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
            const todayStr = thNow.toISOString().split('T')[0]
            const currentBangkokHour = thNow.getUTCHours()
            const currentBangkokMinute = thNow.getUTCMinutes()
            const currentTimeFormatted = `${String(currentBangkokHour).padStart(2, '0')}.${String(currentBangkokMinute).padStart(2, '0')} น.`

            const thaiDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์']
            const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
            const dayOfWeekIndex = thNow.getUTCDay()
            const dayName = thaiDays[dayOfWeekIndex]
            const dateNum = thNow.getUTCDate()
            const monthName = thaiMonths[thNow.getUTCMonth()]
            const yearThai = thNow.getUTCFullYear() + 543
            const dateTitleStr = `${dayName}ที่ ${dateNum} ${monthName} ${yearThai}`

            // 1. Fetch Historical Baseline (Past 4 weeks on same day of week)
            const pastDates: string[] = []
            for (let i = 1; i <= 4; i++) {
              const d = new Date(thNow.getTime() - i * 7 * 24 * 3600 * 1000)
              pastDates.push(d.toISOString().split('T')[0])
            }
            const earliestPastDate = pastDates[pastDates.length - 1]
            const latestPastDate = pastDates[0]

            const { data: pastBookings, error: pastErr } = await supabaseAdmin
              .from('bookings')
              .select('id, booking_time, created_at, pax, status')
              .in('status', ['completed', 'paid', 'success', 'seated', 'confirmed', 'ready'])
              .gte('booking_time', `${earliestPastDate}T00:00:00+07:00`)
              .lte('booking_time', `${latestPastDate}T23:59:59+07:00`)

            if (pastErr) console.warn('[stpredict] Past bookings warning:', pastErr.message)

            const operatingHours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
            const hourlyBaselineTotals: Record<number, number> = {}
            operatingHours.forEach(h => { hourlyBaselineTotals[h] = 0 })
            const daysWithPastData = new Set<string>()

            ;(pastBookings || []).forEach((b: any) => {
              const t = b.booking_time || b.created_at
              if (!t) return
              const datePart = t.split('T')[0]
              if (pastDates.includes(datePart)) {
                daysWithPastData.add(datePart)
                const bDate = new Date(t)
                const bHour = new Date(bDate.getTime() + (7 * 3600 * 1000)).getUTCHours()
                if (hourlyBaselineTotals[bHour] !== undefined) {
                  hourlyBaselineTotals[bHour] += Number(b.pax) || 1
                }
              }
            })

            const divisor = Math.max(1, daysWithPastData.size)
            const baselineHourly: Record<number, number> = {}
            operatingHours.forEach(h => {
              baselineHourly[h] = Math.round(hourlyBaselineTotals[h] / divisor)
            })

            const fallbackBaseline: Record<number, number> = {
              11: 4, 12: 10, 13: 12, 14: 7, 15: 5, 16: 6,
              17: 9, 18: 15, 19: 18, 20: 14, 21: 8, 22: 4, 23: 1
            }
            const baseline = daysWithPastData.size > 0 ? baselineHourly : fallbackBaseline

            // 2. Fetch Today's Live Bookings
            const dbStart = `${todayStr}T00:00:00+07:00`
            const dbEnd = `${todayStr}T23:59:59+07:00`

            const { data: todayBookings, error: todayErr } = await supabaseAdmin
              .from('bookings')
              .select('id, booking_time, created_at, pax, status, total_amount')
              .gte('booking_time', dbStart)
              .lte('booking_time', dbEnd)

            if (todayErr) throw todayErr

            const validStatuses = ['completed', 'paid', 'success', 'seated', 'confirmed', 'ready']
            const activeBookings = (todayBookings || []).filter((b: any) => {
              const st = (b.status || '').toLowerCase()
              return validStatuses.includes(st) && st !== 'cancelled' && st !== 'void'
            })

            const hourlyActualPax: Record<number, number> = {}
            const hourlyActualBills: Record<number, number> = {}
            operatingHours.forEach(h => {
              hourlyActualPax[h] = 0
              hourlyActualBills[h] = 0
            })

            let totalActualPax = 0
            let totalActualBills = activeBookings.length

            activeBookings.forEach((b: any) => {
              const t = b.booking_time || b.created_at
              if (!t) return
              const bDate = new Date(t)
              const h = new Date(bDate.getTime() + (7 * 3600 * 1000)).getUTCHours()
              const p = Number(b.pax) || 1
              if (hourlyActualPax[h] !== undefined) {
                hourlyActualPax[h] += p
                hourlyActualBills[h] += 1
                totalActualPax += p
              }
            })

            // 3. Fetch Today's Ad Events for Lead Lift
            const { data: adEventsData } = await supabaseAdmin
              .from('ad_events')
              .select('event_name, created_at, utm_source')
              .gte('created_at', dbStart)
              .lte('created_at', dbEnd)
              .limit(1000)

            const adEvents = adEventsData || []
            let totalAdDirections = 0
            let totalAdPhone = 0
            let totalAdLine = 0
            let totalAdBooking = 0
            let totalAdPickup = 0
            let totalAdMenu = 0
            let totalAdVibe = 0

            const hourlyAdLeads: Record<number, number> = {}
            operatingHours.forEach(h => { hourlyAdLeads[h] = 0 })

            adEvents.forEach((e: any) => {
              const t = e.created_at
              if (!t) return
              const eDate = new Date(t)
              const h = new Date(eDate.getTime() + (7 * 3600 * 1000)).getUTCHours()
              const ev = e.event_name || ''

              if (ev === 'click_directions' || ev === 'find_location' || ev === 'directions') {
                totalAdDirections++
                if (hourlyAdLeads[h] !== undefined) hourlyAdLeads[h] += 3.0
              } else if (ev === 'click_phone' || ev === 'contact' || ev === 'call') {
                totalAdPhone++
                if (hourlyAdLeads[h] !== undefined) hourlyAdLeads[h] += 2.5
              } else if (ev === 'click_line' || ev === 'generate_lead' || ev === 'line') {
                totalAdLine++
                if (hourlyAdLeads[h] !== undefined) hourlyAdLeads[h] += 2.0
              } else if (ev === 'click_booking_link' || ev === 'booking') {
                totalAdBooking++
                if (hourlyAdLeads[h] !== undefined) hourlyAdLeads[h] += 2.0
              } else if (ev === 'click_pickup_link' || ev === 'pickup') {
                totalAdPickup++
                if (hourlyAdLeads[h] !== undefined) hourlyAdLeads[h] += 1.5
              } else if (ev === 'view_full_menu' || ev === 'view_booklet_menu' || ev === 'menu' || ev === 'booklet') {
                totalAdMenu++
                if (hourlyAdLeads[h] !== undefined) hourlyAdLeads[h] += 0.6
              } else if (ev === 'view_atmosphere' || ev === 'vibe' || ev === 'vibe_gallery') {
                totalAdVibe++
                if (hourlyAdLeads[h] !== undefined) hourlyAdLeads[h] += 0.4
              }
            })

            // 4. Calculate Pacing & Projections
            const cappedHour = Math.min(23, Math.max(11, currentBangkokHour))
            let baselineSoFar = 0
            let actualSoFar = 0
            operatingHours.forEach(h => {
              const bVal = baseline[h] || 0
              if (h <= cappedHour) {
                baselineSoFar += bVal
                actualSoFar += (hourlyActualPax[h] || 0)
              }
            })

            const rawPace = baselineSoFar > 0 ? (actualSoFar / baselineSoFar) : 1.0
            const paceMultiplier = Math.max(0.65, Math.min(1.75, rawPace * 0.75 + 0.25))
            const dayPacePct = baselineSoFar > 0 ? Math.round(((actualSoFar - baselineSoFar) / baselineSoFar) * 100) : 0

            const recentHighIntent = (hourlyAdLeads[cappedHour - 1] || 0) + (hourlyAdLeads[cappedHour] || 0)
            const adLiftPct = Math.min(0.35, recentHighIntent * 0.04)

            let forecastedClosingPax = totalActualPax
            let forecastedClosingPaxHigh = totalActualPax
            let forecastedClosingPaxLow = totalActualPax

            const points = operatingHours.map(h => {
              const actual = hourlyActualPax[h]
              const base = baseline[h] || 0
              const isFuture = h > cappedHour

              let forecast = null
              let forecastHigh = null
              let forecastLow = null

              if (isFuture) {
                const nearTermLift = (h <= cappedHour + 2) ? (1 + adLiftPct) : 1.0
                forecast = Math.round(base * paceMultiplier * nearTermLift)
                forecastHigh = Math.round(base * paceMultiplier * (nearTermLift + 0.25))
                forecastLow = Math.max(0, Math.round(base * paceMultiplier * Math.max(0.4, nearTermLift - 0.25)))

                forecastedClosingPax += forecast
                forecastedClosingPaxHigh += forecastHigh
                forecastedClosingPaxLow += forecastLow
              }

              return {
                hour: h,
                actual,
                bills: hourlyActualBills[h],
                baseline: base,
                forecast,
                forecastHigh,
                forecastLow,
                isFuture
              }
            })

            // 5. Peak Hour & Dayparts
            let maxPax = 0
            let peakH = points[0]
            points.forEach(p => {
              const val = p.isFuture ? (p.forecast || 0) : p.actual
              if (val > maxPax) {
                maxPax = val
                peakH = p
              }
            })
            const totalSeats = 45
            const peakCapacityLoad = Math.min(100, Math.round((maxPax / totalSeats) * 100))

            const daypartDefs = [
              { key: 'lunch', title: 'LUNCH RUSH', hours: [11, 12, 13], timeLabel: '11.00 - 14.00 น.' },
              { key: 'afternoon', title: 'AFTERNOON CAFE', hours: [14, 15, 16], timeLabel: '14.00 - 17.00 น.' },
              { key: 'dinner', title: 'PRIME DINNER', hours: [17, 18, 19, 20], timeLabel: '17.00 - 21.00 น.' },
              { key: 'late', title: 'LATE NIGHT / BAR', hours: [21, 22, 23], timeLabel: '21.00 - 23.00 น.' }
            ]

            const dayparts = daypartDefs.map(dp => {
              let actualCount = 0
              let forecastCount = 0
              let baselineCount = 0
              let allPassed = true
              let allFuture = true

              dp.hours.forEach(h => {
                const pt = points.find(p => p.hour === h)
                if (pt) {
                  baselineCount += pt.baseline
                  if (pt.isFuture) {
                    allPassed = false
                    forecastCount += (pt.forecast || 0)
                  } else {
                    allFuture = false
                    actualCount += pt.actual
                    forecastCount += pt.actual
                  }
                }
              })

              let status = 'upcoming'
              if (allPassed) status = 'passed'
              else if (!allFuture) status = 'active'

              const targetPax = (status === 'passed') ? actualCount : forecastCount
              const diffPct = baselineCount > 0 ? Math.round(((targetPax - baselineCount) / baselineCount) * 100) : 0

              return {
                key: dp.key,
                title: dp.title,
                timeLabel: dp.timeLabel,
                status,
                actualPax: actualCount,
                forecastPax: forecastCount,
                baselinePax: baselineCount,
                diffPct
              }
            })

            // 6. Gemini AI + Sai Mu Oracle Synthesis
            let geminiApiKey = Deno.env.get('GEMINI_API_KEY') || ''
            if (!geminiApiKey) {
              const { data: keyRow } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'gemini_api_key').maybeSingle()
              geminiApiKey = keyRow?.value || ''
            }

            let preferredModel = 'gemini-flash-latest'
            const { data: modelRow } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'gemini_model').maybeSingle()
            if (modelRow?.value) preferredModel = modelRow.value

            const saiMuData = getDailySaiMuContext(thNow)
            const summaryPayload = {
              date: todayStr,
              dayOfWeek: dayName,
              totalActualPax,
              totalActualBills,
              forecastedClosingPax,
              forecastRange: `ต่ำ ${forecastedClosingPaxLow} - สูง ${forecastedClosingPaxHigh} ท่าน`,
              dayPacePct,
              peakHour: peakH ? `${peakH.hour}.00 น.` : '19.00 น.',
              peakCapacityLoad: `${peakCapacityLoad}%`,
              dayparts,
              adStats: {
                totalAdDirections,
                totalAdPhone,
                totalAdLine,
                totalAdBooking,
                totalAdPickup,
                totalAdMenu,
                totalAdVibe
              },
              saiMuContext: saiMuData
            }

            const aiAnalysis = await generateIntradayTrafficWithSaiMu(summaryPayload, geminiApiKey, preferredModel)

            // Calculate 1-2 hours forward forecast
            let nextHoursLabel = ''
            let nextHoursForecast = 0

            if (currentBangkokHour < 11) {
              nextHoursLabel = '11.00 - 13.00 น. (เปิดร้าน)'
              const pt1 = points.find(p => p.hour === 11)
              const pt2 = points.find(p => p.hour === 12)
              nextHoursForecast = (pt1?.forecast || 0) + (pt2?.forecast || 0)
            } else if (currentBangkokHour >= 23) {
              nextHoursLabel = 'ช่วงปิดร้าน (Closing)'
              nextHoursForecast = 0
            } else {
              const startH = currentBangkokHour + 1
              const endH = Math.min(23, currentBangkokHour + 2)
              nextHoursLabel = `${startH}.00 - ${endH + 1}.00 น.`
              for (let h = startH; h <= endH; h++) {
                const pt = points.find(p => p.hour === h)
                if (pt) {
                  nextHoursForecast += (pt.isFuture ? (pt.forecast || 0) : pt.actual)
                }
              }
            }

            const nextHoursInfo = {
              label: nextHoursLabel,
              forecastPax: nextHoursForecast
            }

            // 7. Render LINE Flex Message (Fast Digest Layout)
            const predictorFlex = createTrafficPredictorFlexMessage(
              {
                totalActualPax,
                totalActualBills,
                forecastedClosingPax,
                forecastedClosingPaxLow,
                forecastedClosingPaxHigh,
                dayPacePct,
                peakHour: peakH,
                peakCapacityLoad,
                dayparts
              },
              saiMuData,
              aiAnalysis,
              dateTitleStr,
              currentTimeFormatted,
              nextHoursInfo
            )

            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{
                  type: 'flex',
                  altText: `พยากรณ์ด่วน [${currentTimeFormatted}] (${dateTitleStr}): 1-2 ชม. ถัดไป ~${nextHoursInfo.forecastPax} ท่าน (ปิดวัน ~${forecastedClosingPax} ท่าน)`,
                  contents: predictorFlex
                }]
              })
            })
          } catch (err: any) {
            console.error('stpredict Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'ไม่สามารถประมวลผลการทำนายได้\nลองใหม่อีกครั้งในอีกสักครู่' }]
              })
            })
          }
          continue
        }

        // --- NEW: Recent Bills List (stbill / stbills / บิลล่าสุด / บิล) ---
        if (text === 'stbill' || text === 'stbills' || text === 'บิลล่าสุด' || text === 'บิล') {
          console.log('Processing stbill command...')
          try {
            const { data: bills, error: billsErr } = await supabaseAdmin
              .from('bookings')
              .select(`
                id, tracking_token, total_amount, discount_amount, staff_remark, payment_method, payment_slip_url, status, booking_type, booking_time, created_at,
                pickup_contact_name, customer_note, tables_layout ( table_name ),
                order_items ( quantity, price_at_time, menu_items(name) )
              `)
              .eq('status', 'completed')
              .order('created_at', { ascending: false })
              .limit(6)

            if (billsErr) throw billsErr

            if (!bills || bills.length === 0) {
              await fetch('https://api.line.me/v2/bot/message/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
                body: JSON.stringify({
                  replyToken: event.replyToken,
                  messages: [{ type: 'text', text: 'ยังไม่มีรายการบิลที่ชำระเงินสำเร็จในระบบ' }]
                })
              })
              continue
            }

            const billRows: any[] = []
            bills.forEach((b: any, idx: number) => {
              const billNo = `#${getShortBookingId(b)}`
              const tableName = b.tables_layout?.table_name || (b.booking_type === 'pickup' ? 'TAKEAWAY' : 'WALK-IN')
              
              let timeStr = ''
              try {
                const dateObj = new Date(b.created_at || b.booking_time)
                const thDate = new Date(dateObj.getTime() + (7 * 60 * 60 * 1000))
                timeStr = thDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
              } catch {
                timeStr = ''
              }

              const itemsBrief = (b.order_items || [])
                .slice(0, 3)
                .map((it: any) => `${it.quantity}x ${it.menu_items?.name || 'Item'}`)
                .join(', ')
              const moreItems = (b.order_items || []).length > 3 ? ` +อีก ${(b.order_items || []).length - 3} รายการ` : ''

              const payBreakdown = parseBookingPayment(b)
              const payMethod = payBreakdown.methodLabel
              const amt = Number(b.total_amount) || 0

              billRows.push({
                type: "box",
                layout: "vertical",
                backgroundColor: "#F6F2EA",
                cornerRadius: "md",
                paddingAll: "md",
                margin: "md",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      { type: "text", text: billNo, weight: "bold", size: "sm", color: "#1A1A1A", flex: 6 },
                      { type: "text", text: `฿${amt.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, weight: "bold", size: "sm", color: "#41032A", align: "end", flex: 4 }
                    ]
                  },
                  {
                    type: "box",
                    layout: "horizontal",
                    margin: "xs",
                    contents: [
                      { type: "text", text: `${tableName} · ${timeStr}`, size: "xxs", color: "#635B5F", flex: 7 },
                      { type: "text", text: payMethod, size: "xxs", weight: "bold", color: "#41032A", align: "end", flex: 3 }
                    ]
                  },
                  {
                    type: "text",
                    text: `${itemsBrief}${moreItems}` || 'ไม่มีรายละเอียดสินค้า',
                    size: "xxs",
                    color: "#635B5F",
                    margin: "xs",
                    wrap: true
                  }
                ]
              })

              if (idx < bills.length - 1) {
                billRows.push({ type: "separator", margin: "sm", color: "#D4CBCF" })
              }
            })

            const billsFlex = {
              type: "flex",
              altText: `รายการบิลล่าสุด ${bills.length} รายการ`,
              contents: {
                type: "bubble",
                size: "mega",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#ECE4E7",
                  paddingAll: "20px",
                  contents: [
                    { type: "text", text: "RECENT COMPLETED BILLS", size: "xs", weight: "bold", color: "#41032A" },
                    { type: "text", text: `รายการบิลล่าสุดในระบบ (${bills.length} บิลล่าสุด)`, size: "md", weight: "bold", color: "#1A1A1A", margin: "xs", wrap: true }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#ECE4E7",
                  paddingAll: "16px",
                  contents: billRows
                }
              }
            }

            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [billsFlex]
              })
            })
          } catch (err: any) {
            console.error('stbill Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'ไม่สามารถดึงรายการบิลล่าสุดได้\nลองใหม่อีกครั้งในอีกสักครู่' }]
              })
            })
          }
          continue
        }

        // --- NEW: Table Status & Running Bill (sttable / sttables / โต๊ะ / โต๊ะ [เลข]) ---
        if (text === 'sttable' || text === 'sttables' || text === 'โต๊ะ' || text.startsWith('sttable ') || text.startsWith('โต๊ะ ')) {
          console.log('Processing sttable command...')
          try {
            const isSpecific = text.startsWith('sttable ') || text.startsWith('โต๊ะ ')
            const targetTableKeyword = isSpecific ? text.replace(/^(sttable|โต๊ะ)\s+/, '').trim().toLowerCase() : ''

            const { data: tablesData, error: tblErr } = await supabaseAdmin
              .from('tables_layout')
              .select('*')
              .order('table_name')

            if (tblErr) throw tblErr

            const eighteenHoursAgo = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
            const { data: activeBookings, error: bkgErr } = await supabaseAdmin
              .from('bookings')
              .select(`
                id, table_id, pax, total_amount, status, booking_time, booking_type, pickup_contact_name,
                order_items ( quantity, price_at_time, menu_items(name) )
              `)
              .in('status', ['seated', 'confirmed', 'pending', 'ready'])
              .gte('booking_time', eighteenHoursAgo)

            if (bkgErr) throw bkgErr

            const tableMap = new Map()
            ;(activeBookings || []).forEach(b => {
              if (b.table_id) tableMap.set(b.table_id, b)
            })

            if (isSpecific && targetTableKeyword) {
              const matchedTable = (tablesData || []).find((t: any) => 
                (t.table_name || '').toLowerCase().includes(targetTableKeyword) ||
                String(t.table_number || '').toLowerCase() === targetTableKeyword
              )

              if (!matchedTable) {
                await fetch('https://api.line.me/v2/bot/message/reply', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
                  body: JSON.stringify({
                    replyToken: event.replyToken,
                    messages: [{ type: 'text', text: `ไม่พบข้อมูลโต๊ะ "${targetTableKeyword}" ในระบบร้าน` }]
                  })
                })
                continue
              }

              const activeBkg = tableMap.get(matchedTable.id)
              const isOccupied = !!activeBkg
              const totalAmt = Number(activeBkg?.total_amount) || 0

              let itemRows: any[] = []
              if (isOccupied && activeBkg.order_items?.length > 0) {
                itemRows = activeBkg.order_items.map((it: any) => ({
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: `${it.quantity}x ${it.menu_items?.name || 'Item'}`, size: "xs", color: "#1A1A1A", flex: 7, wrap: true },
                    { type: "text", text: `฿${(it.quantity * it.price_at_time).toFixed(2)}`, size: "xs", weight: "bold", color: "#1A1A1A", align: "end", flex: 3 }
                  ]
                }))
              }

              const singleTableFlex = {
                type: "flex",
                altText: `สถานะ ${matchedTable.table_name}: ${isOccupied ? `มีลูกค้านั่ง (฿${totalAmt.toLocaleString('th-TH')})` : 'โต๊ะว่าง'}`,
                contents: {
                  type: "bubble",
                  size: "mega",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: isOccupied ? "#ECE4E7" : "#ECE4E7",
                    paddingAll: "20px",
                    contents: [
                      { type: "text", text: "TABLE STATUS", size: "xs", weight: "bold", color: isOccupied ? "#41032A" : "#41032A" },
                      { type: "text", text: matchedTable.table_name.toUpperCase(), size: "lg", weight: "bold", color: "#1A1A1A", margin: "xs" },
                      { type: "text", text: isOccupied ? `สถานะ: มีลูกค้านั่ง (${activeBkg.pax || 1} ท่าน)` : "สถานะ: โต๊ะว่างพร้อมให้บริการ", size: "xs", color: isOccupied ? "#635B5F" : "#41032A", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#F6F2EA",
                    paddingAll: "20px",
                    contents: isOccupied ? [
                      {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                          { type: "text", text: "ยอดบิลปัจจุบัน", size: "sm", weight: "bold", color: "#1A1A1A", flex: 6 },
                          { type: "text", text: `฿${totalAmt.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, size: "lg", weight: "bold", color: "#41032A", align: "end", flex: 4 }
                        ]
                      },
                      { type: "separator", margin: "md", color: "#D4CBCF" },
                      { type: "text", text: "รายการที่สั่ง", size: "xxs", weight: "bold", color: "#635B5F", margin: "md" },
                      {
                        type: "box",
                        layout: "vertical",
                        margin: "sm",
                        spacing: "xs",
                        contents: itemRows.length > 0 ? itemRows : [{ type: "text", text: "ยังไม่มีรายการอาหาร", size: "xs", color: "#635B5F" }]
                      }
                    ] : [
                      { type: "text", text: "โต๊ะนี้พร้อมเปิดบิลใหม่ได้ทันทีผ่านหน้าจอ POS หรือลูกค้าสแกน QR Code ประจำโต๊ะ", size: "xs", color: "#635B5F", wrap: true }
                    ]
                  }
                }
              }

              await fetch('https://api.line.me/v2/bot/message/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
                body: JSON.stringify({
                  replyToken: event.replyToken,
                  messages: [singleTableFlex]
                })
              })
              continue
            }

            // General tables summary (sttables)
            const allTbls = tablesData || []
            const occupiedCount = allTbls.filter((t: any) => tableMap.has(t.id)).length
            const totalTblAmt = (activeBookings || []).reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0)

            const tableRows = allTbls.slice(0, 12).map((t: any) => {
              const bkg = tableMap.get(t.id)
              const occ = !!bkg
              const amt = Number(bkg?.total_amount) || 0
              return {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: `${t.table_name}`, size: "xs", weight: "bold", color: occ ? "#1A1A1A" : "#41032A", flex: 6 },
                  { type: "text", text: occ ? `฿${amt.toFixed(0)} (${bkg.pax || 1}P)` : 'ว่าง', size: "xs", weight: "bold", color: occ ? "#41032A" : "#635B5F", align: "end", flex: 4 }
                ]
              }
            })

            const allTablesFlex = {
              type: "flex",
              altText: `สรุปโต๊ะอาหาร (${occupiedCount}/${allTbls.length} โต๊ะที่นั่ง)`,
              contents: {
                type: "bubble",
                size: "mega",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#ECE4E7",
                  paddingAll: "20px",
                  contents: [
                    { type: "text", text: "ALL TABLES OVERVIEW", size: "xs", weight: "bold", color: "#41032A" },
                    { type: "text", text: `ภาพรวมโต๊ะอาหาร (${occupiedCount} จาก ${allTbls.length} โต๊ะมีลูกค้า)`, size: "md", weight: "bold", color: "#1A1A1A", margin: "xs" },
                    { type: "text", text: `ยอดบิลที่ยังไม่เช็คบิลรวม: ฿${totalTblAmt.toLocaleString('th-TH')}`, size: "xxs", color: "#635B5F", margin: "xs" }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#F6F2EA",
                  paddingAll: "20px",
                  contents: [
                    {
                      type: "box",
                      layout: "vertical",
                      spacing: "sm",
                      contents: tableRows
                    },
                    { type: "separator", margin: "md", color: "#D4CBCF" },
                    { type: "text", text: "ดูเฉพาะโต๊ะพิมพ์: โต๊ะ [ชื่อโต๊ะ] เช่น โต๊ะ 3", size: "xxs", color: "#635B5F", align: "center", margin: "md" }
                  ]
                }
              }
            }

            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [allTablesFlex]
              })
            })
          } catch (err: any) {
            console.error('sttable Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'ไม่สามารถดึงสถานะโต๊ะได้\nลองใหม่อีกครั้งในอีกสักครู่' }]
              })
            })
          }
          continue
        }

        // --- NEW: POS Shift Status (stshift / กะ / ยอดกะ / สรุปกะ / รายงานกะ / รอบขาย / รอบการขาย / ปิดกะ) ---
        if (
          text === 'stshift' || text === 'กะ' || text === 'ยอดกะ' || text === 'สรุปกะ' ||
          text === 'รายงานกะ' || text === 'รอบขาย' || text === 'รอบการขาย' || text === 'ปิดกะ'
        ) {
          console.log('Processing stshift command...')
          try {
            const { data: shifts, error: shiftErr } = await supabaseAdmin
              .from('pos_shifts')
              .select('*')
              .order('opened_at', { ascending: false })
              .limit(1)

            if (shiftErr) throw shiftErr

            if (!shifts || shifts.length === 0) {
              await fetch('https://api.line.me/v2/bot/message/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
                body: JSON.stringify({
                  replyToken: event.replyToken,
                  messages: [{ type: 'text', text: 'ยังไม่มีประวัติการเปิดกะในระบบ POS' }]
                })
              })
              continue
            }

            const currentShift = shifts[0]
            const isOpen = currentShift.status === 'open'

            let openTimeStr = ''
            try {
              const thDate = new Date(new Date(currentShift.opened_at).getTime() + (7 * 60 * 60 * 1000))
              openTimeStr = thDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
            } catch {
              openTimeStr = ''
            }

            const openingFloat = Number(currentShift.opening_float || 0)
            const cashSales = Number(currentShift.cash_sales || 0)
            const totalIn = Number(currentShift.total_in || 0)
            const totalOut = Number(currentShift.total_out || 0)
            const expectedCash = currentShift.expected_cash !== undefined && currentShift.expected_cash !== null
              ? Number(currentShift.expected_cash)
              : (openingFloat + cashSales + totalIn - totalOut)
            const closedCash = currentShift.closed_cash !== undefined && currentShift.closed_cash !== null
              ? Number(currentShift.closed_cash)
              : null
            const difference = currentShift.difference !== undefined && currentShift.difference !== null
              ? Number(currentShift.difference)
              : (closedCash !== null ? (closedCash - expectedCash) : 0)

            const shiftFlex = {
              type: "flex",
              altText: `ข้อมูลกะ POS ล่าสุด (${isOpen ? 'กะกำลังเปิดอยู่' : 'ปิดกะแล้ว'})`,
              contents: {
                type: "bubble",
                size: "mega",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#41032A",
                  paddingAll: "20px",
                  contents: [
                    { type: "text", text: "POS SHIFT STATUS", size: "xs", weight: "bold", color: "#D0B5C1" },
                    { type: "text", text: isOpen ? "กะที่กำลังทำงานอยู่ (ACTIVE)" : "กะล่าสุด (CLOSED)", size: "md", weight: "bold", color: "#F6F2EA", margin: "xs" },
                    { type: "text", text: `พนักงาน: ${currentShift.staff_name || 'Staff'} · เปิดเมื่อ: ${openTimeStr}`, size: "xxs", color: "#D0B5C1", margin: "xs" }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#F6F2EA",
                  paddingAll: "20px",
                  contents: [
                    {
                      type: "box",
                      layout: "horizontal",
                      backgroundColor: "#ECE4E7",
                      cornerRadius: "md",
                      paddingAll: "14px",
                      contents: [
                        { type: "text", text: "ยอดขายรวมในกะ", size: "xs", color: "#635B5F", flex: 5, gravity: "center" },
                        { type: "text", text: `฿${Number(currentShift.total_sales || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, size: "lg", weight: "bold", color: "#1A1A1A", align: "end", flex: 5 }
                      ]
                    },
                    { type: "separator", margin: "md", color: "#D4CBCF" },
                    {
                      type: "box",
                      layout: "vertical",
                      margin: "sm",
                      spacing: "xs",
                      contents: [
                        {
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            { type: "text", text: "เงินสด Cash", size: "xs", color: "#1A1A1A", flex: 7 },
                            { type: "text", text: `฿${cashSales.toFixed(2)}`, size: "xs", weight: "bold", color: "#1A1A1A", align: "end", flex: 3 }
                          ]
                        },
                        {
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            { type: "text", text: "PromptPay / โอน", size: "xs", color: "#1A1A1A", flex: 7 },
                            { type: "text", text: `฿${Number(currentShift.qr_sales || 0).toFixed(2)}`, size: "xs", weight: "bold", color: "#1A1A1A", align: "end", flex: 3 }
                          ]
                        },
                        {
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            { type: "text", text: "บัตรเครดิต Credit", size: "xs", color: "#1A1A1A", flex: 7 },
                            { type: "text", text: `฿${Number(currentShift.credit_sales || 0).toFixed(2)}`, size: "xs", weight: "bold", color: "#1A1A1A", align: "end", flex: 3 }
                          ]
                        }
                      ]
                    },
                    { type: "separator", margin: "md", color: "#D4CBCF" },
                    {
                      type: "box",
                      layout: "vertical",
                      margin: "sm",
                      spacing: "xs",
                      contents: [
                        {
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            { type: "text", text: "เงินทอนตั้งต้น", size: "xs", color: "#635B5F", flex: 6 },
                            { type: "text", text: `฿${openingFloat.toFixed(2)}`, size: "xs", color: "#1A1A1A", align: "end", flex: 4 }
                          ]
                        },
                        ...(totalIn > 0 ? [{
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            { type: "text", text: "เงินนำเข้าลิ้นชัก (+)", size: "xs", color: "#41032A", flex: 6 },
                            { type: "text", text: `+฿${totalIn.toFixed(2)}`, size: "xs", color: "#41032A", align: "end", flex: 4 }
                          ]
                        }] : []),
                        ...(totalOut > 0 ? [{
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            { type: "text", text: "เงินนำออกลิ้นชัก (-)", size: "xs", color: "#41032A", flex: 6 },
                            { type: "text", text: `-฿${totalOut.toFixed(2)}`, size: "xs", color: "#41032A", align: "end", flex: 4 }
                          ]
                        }] : []),
                        {
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            { type: "text", text: "เงินที่ควรมีในลิ้นชัก", size: "xs", weight: "bold", color: "#1A1A1A", flex: 6 },
                            { type: "text", text: `฿${expectedCash.toFixed(2)}`, size: "xs", weight: "bold", color: "#1A1A1A", align: "end", flex: 4 }
                          ]
                        },
                        ...(closedCash !== null ? [
                          {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                              { type: "text", text: "จำนวนจริงในลิ้นชัก", size: "xs", weight: "bold", color: "#1A1A1A", flex: 6 },
                              { type: "text", text: `฿${closedCash.toFixed(2)}`, size: "xs", weight: "bold", color: "#1A1A1A", align: "end", flex: 4 }
                            ]
                          },
                          {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                              { type: "text", text: Math.abs(difference) < 0.01 ? "ส่วนต่าง (ตรงยอดพอดี)" : ">> ส่วนต่าง", size: "xs", weight: "bold", color: Math.abs(difference) < 0.01 ? "#41032A" : "#41032A", flex: 6 },
                              { type: "text", text: `${difference > 0 ? '+' : ''}฿${difference.toFixed(2)}`, size: "xs", weight: "bold", color: Math.abs(difference) < 0.01 ? "#41032A" : "#41032A", align: "end", flex: 4 }
                            ]
                          }
                        ] : [])
                      ]
                    }
                  ]
                }
              }
            }

            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [shiftFlex]
              })
            })
          } catch (err: any) {
            console.error('stshift Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'ไม่สามารถดึงข้อมูลกะ POS ได้\nลองใหม่อีกครั้งในอีกสักครู่' }]
              })
            })
          }
          continue
        }

        // --- NEW: Void & Cancelled Bills Audit (stvoid / บิลยกเลิก / ยกเลิก) ---
        if (text === 'stvoid' || text === 'บิลยกเลิก' || text === 'ยกเลิก') {
          console.log('Processing stvoid command...')
          try {
            const now = new Date()
            const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000))
            const todayStr = thNow.toISOString().split('T')[0]
            const dbStart = `${todayStr}T00:00:00+07:00`
            const dbEnd = `${todayStr}T23:59:59+07:00`

            const { data: voidedData, error: voidErr } = await supabaseAdmin
              .from('bookings')
              .select(`
                id, tracking_token, total_amount, status, staff_remark, customer_note, booking_time, created_at,
                pickup_contact_name, tables_layout ( table_name )
              `)
              .in('status', ['void', 'cancelled'])
              .gte('booking_time', dbStart)
              .lte('booking_time', dbEnd)
              .order('created_at', { ascending: false })

            if (voidErr) throw voidErr

            if (!voidedData || voidedData.length === 0) {
              await fetch('https://api.line.me/v2/bot/message/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
                body: JSON.stringify({
                  replyToken: event.replyToken,
                  messages: [{ type: 'text', text: 'วันนี้ไม่มีรายการบิลที่ถูกยกเลิก (No Void Bills Today)' }]
                })
              })
              continue
            }

            const voidRows: any[] = []
            let totalVoidAmt = 0

            voidedData.forEach((b: any, idx: number) => {
              const amt = Number(b.total_amount) || 0
              totalVoidAmt += amt
              const billNo = getShortBookingId(b)
              const tbl = b.tables_layout?.table_name || 'WALK-IN'
              const reason = b.staff_remark || b.customer_note || 'ไม่ระบุเหตุผล'

              voidRows.push({
                type: "box",
                layout: "vertical",
                margin: "md",
                backgroundColor: "#ECE4E7",
                cornerRadius: "md",
                paddingAll: "md",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      { type: "text", text: `#${billNo} · ${tbl}`, weight: "bold", size: "xs", color: "#1A1A1A", flex: 7 },
                      { type: "text", text: `฿${amt.toFixed(2)}`, weight: "bold", size: "xs", color: "#B42318", align: "end", flex: 3 }
                    ]
                  },
                  { type: "text", text: `เหตุผล: ${reason}`, size: "xxs", color: "#635B5F", margin: "xs", wrap: true }
                ]
              })

              if (idx < voidedData.length - 1) voidRows.push({ type: "separator", margin: "sm", color: "#D4CBCF" })
            })

            const voidFlex = {
              type: "flex",
              altText: `บิลยกเลิกวันนี้ (${voidedData.length} บิล: ฿${totalVoidAmt.toFixed(2)})`,
              contents: {
                type: "bubble",
                size: "mega",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#ECE4E7",
                  paddingAll: "20px",
                  contents: [
                    { type: "text", text: "VOID BILLS AUDIT", size: "xs", weight: "bold", color: "#B42318" },
                    { type: "text", text: `รายงานบิลยกเลิกประจำวัน (${voidedData.length} รายการ)`, size: "md", weight: "bold", color: "#1A1A1A", margin: "xs" },
                    { type: "text", text: `ยอดเงินที่ยกเลิกรวม: ฿${totalVoidAmt.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, size: "xxs", color: "#635B5F", margin: "xs" }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#F6F2EA",
                  paddingAll: "16px",
                  contents: voidRows
                }
              }
            }

            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [voidFlex]
              })
            })
          } catch (err: any) {
            console.error('stvoid Error:', err)
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: 'ไม่สามารถดึงรายงานบิลยกเลิกได้\nลองใหม่อีกครั้งในอีกสักครู่' }]
              })
            })
          }
          continue
        }

        // --- NEW: Command Help Menu (sthelp / คำสั่ง / คู่มือ / help) ---
        if (text === 'sthelp' || text === 'คำสั่ง' || text === 'คู่มือ' || text === 'help' || text === 'เมนู') {
          const helpFlex = {
            type: "flex",
            altText: "คู่มือคำสั่งบอท IN THE HAUS",
            contents: {
              type: "bubble",
              size: "mega",
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#41032A",
                paddingAll: "20px",
                contents: [
                  { type: "text", text: "IN THE HAUS · COMMAND MANUAL", size: "xs", weight: "bold", color: "#D0B5C1" },
                  { type: "text", text: "สารบัญคำสั่งบอทสั่งงาน", size: "md", weight: "bold", color: "#F6F2EA", margin: "xs" }
                ]
              },
              body: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#F6F2EA",
                paddingAll: "20px",
                contents: [
                  { type: "text", text: "หมวด POS & ออเดอร์หน้าร้าน", size: "xxs", weight: "bold", color: "#41032A" },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "xs",
                    spacing: "xs",
                    contents: [
                      { type: "text", text: "• stsales หรือ ยอดขาย : สรุปยอดขายหน้าร้านวันนี้", size: "xs", color: "#1A1A1A", wrap: true },
                      { type: "text", text: "• stpredict หรือ ทำนาย : พยากรณ์ลูกค้าต่อชั่วโมง & ทริคสายมู AI", size: "xs", color: "#41032A", wrap: true, weight: "bold" },
                      { type: "text", text: "• stbill หรือ บิลล่าสุด : ดู 6 บิลที่ชำระเงินล่าสุด", size: "xs", color: "#1A1A1A", wrap: true },
                      { type: "text", text: "• storder : ดูออเดอร์สดที่กำลังทำในครัว", size: "xs", color: "#1A1A1A", wrap: true },
                      { type: "text", text: "• sttable หรือ โต๊ะ 3 : ดูสถานะโต๊ะและยอดค้าง", size: "xs", color: "#1A1A1A", wrap: true },
                      { type: "text", text: "• stshift หรือ กะ : ดูสถานะกะ POS และเงินในลิ้นชัก", size: "xs", color: "#1A1A1A", wrap: true },
                      { type: "text", text: "• sthero : 5 อันดับเมนูขายดีประจำวัน", size: "xs", color: "#1A1A1A", wrap: true },
                      { type: "text", text: "• stvoid : ตรวจสอบบิลที่ถูกยกเลิกในวันนี้", size: "xs", color: "#1A1A1A", wrap: true }
                    ]
                  },
                  { type: "separator", margin: "md", color: "#D4CBCF" },
                  { type: "text", text: "หมวดสต็อก & ค่าใช้จ่าย", size: "xxs", weight: "bold", color: "#41032A", margin: "md" },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "xs",
                    spacing: "xs",
                    contents: [
                      { type: "text", text: "• stbuy : รายการสินค้าที่ต้องซื้อ/ของหมด", size: "xs", color: "#1A1A1A", wrap: true },
                      { type: "text", text: "• stday : ประวัติการตัดสต็อกวันนี้", size: "xs", color: "#1A1A1A", wrap: true },
                      { type: "text", text: "• stexp : สรุปรายจ่ายร้านวันนี้", size: "xs", color: "#1A1A1A", wrap: true },
                      { type: "text", text: "• ราคา [ชื่อสินค้า] : ค้นหาราคากลางของสินค้า", size: "xs", color: "#1A1A1A", wrap: true },
                      { type: "text", text: "• ส่งภาพสลิป/บิล : สแกนบันทึกบัญชี AI อัตโนมัติ", size: "xs", color: "#1A1A1A", wrap: true }
                    ]
                  },
                  { type: "separator", margin: "md", color: "#D4CBCF" },
                  { type: "text", text: "หมวดพนักงาน & ระบบ", size: "xxs", weight: "bold", color: "#635B5F", margin: "md" },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "xs",
                    spacing: "xs",
                    contents: [
                      { type: "text", text: "• staff : สรุปเวลาเข้า-ออกงานและการลา", size: "xs", color: "#1A1A1A", wrap: true },
                      { type: "text", text: "• ping : เช็คสถานะการเชื่อมต่อบอท", size: "xs", color: "#1A1A1A", wrap: true }
                    ]
                  }
                ]
              }
            }
          }

          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [helpFlex]
            })
          })
          continue
        }
      }
    } // End of per-event text loop

    // Receipt photos / PDF files -> Gemini OCR -> store_expenses (see receipt.ts)
    await handleReceiptEvents(events, CHANNEL_ACCESS_TOKEN, supabaseAdmin)
    } // end processEvents

    const work = processEvents().catch((err) => console.error('Webhook processing error:', err))
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(work)
    } else {
      await work // local serve without EdgeRuntime
    }
    return new Response('OK', { headers: corsHeaders })
  } catch (err) {
    console.error('Global Webhook Error:', err)
    return new Response('Error', { status: 500 })
  }
})
