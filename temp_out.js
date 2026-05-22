// supabase/functions/line-webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
async function verifySignature(body, signature, secret) {
  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(secret);
  const bodyBuffer = encoder.encode(body);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, bodyBuffer);
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  return base64Signature === signature;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const signature = req.headers.get("x-line-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 401 });
  }
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: channelSecretData } = await supabaseAdmin.from("app_settings").select("value").eq("key", "line_channel_secret").single();
    const { data: channelTokenData } = await supabaseAdmin.from("app_settings").select("value").eq("key", "line_channel_access_token").single();
    if (!channelSecretData?.value || !channelTokenData?.value) {
      console.error("LINE configuration missing in app_settings");
      return new Response("Config error", { status: 500 });
    }
    const CHANNEL_SECRET = channelSecretData.value;
    const CHANNEL_ACCESS_TOKEN = channelTokenData.value;
    const body = await req.text();
    console.log("Request Body:", body);
    console.log("Signature Header:", signature);
    console.log("Channel Secret (first 5):", CHANNEL_SECRET.substring(0, 5));
    const isValid = await verifySignature(body, signature, CHANNEL_SECRET);
    console.log("Signature Valid:", isValid);
    if (!isValid) {
      console.error("Invalid LINE signature");
      return new Response("Invalid signature", { status: 401 });
    }
    const { events } = JSON.parse(body);
    console.log("Events:", JSON.stringify(events));
    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        const text = event.message.text.trim().toLowerCase();
        console.log("Received text:", text);
        if (text === "ping") {
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [{ type: "text", text: "Pong! \u{1F3D3}\n(Webhook is working)" }]
            })
          });
          continue;
        }
        if (text === "stbuy" || text === "stbuyback") {
          try {
            const isBuyback = text === "stbuyback";
            console.log(`Processing ${text} command...`);
            const thNow = new Date((/* @__PURE__ */ new Date()).getTime() + 7 * 60 * 60 * 1e3);
            let dateStr = "";
            try {
              dateStr = thNow.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
            } catch (e) {
              dateStr = thNow.toISOString().split("T")[0];
            }
            let query = supabaseAdmin.from("stock_items").select("name, unit, current_quantity, min_stock_threshold, reorder_point, updated_at").order("name", { ascending: true });
            if (isBuyback) {
              const dayAgo = new Date((/* @__PURE__ */ new Date()).getTime() - 24 * 60 * 60 * 1e3).toISOString();
              query = query.gte("updated_at", dayAgo);
            }
            const { data: items, error } = await query;
            if (error) throw error;
            const EPSILON = 1e-4;
            const itemsToBuy = items.filter((item) => {
              const qty = Number(item.current_quantity) || 0;
              const min = Number(item.min_stock_threshold) || 0;
              const reorder = Number(item.reorder_point) || 0;
              return qty <= EPSILON || min > 0 && qty <= min + EPSILON || reorder > 0 && qty <= reorder + EPSILON;
            });
            console.log(`Found ${itemsToBuy.length} items to buy`);
            const headerTitle = isBuyback ? "\u{1F6D2} \u0E02\u0E2D\u0E07\u0E15\u0E49\u0E2D\u0E07\u0E0B\u0E37\u0E49\u0E2D (\u0E2D\u0E31\u0E1E\u0E40\u0E14\u0E17 24 \u0E0A\u0E21.)" : "\u{1F6D2} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E02\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E0B\u0E37\u0E49\u0E2D";
            let messages = [];
            if (itemsToBuy.length === 0) {
              messages.push({
                type: "flex",
                altText: headerTitle,
                contents: {
                  type: "bubble",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#1A1A1A",
                    contents: [
                      { type: "text", text: headerTitle, weight: "bold", color: "#FFFFFF", size: "lg" },
                      { type: "text", text: dateStr, color: "#CCCCCC", size: "xs", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    contents: [{ type: "text", text: "\u2705 \u0E2A\u0E15\u0E47\u0E2D\u0E01\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E1E\u0E2D\u0E17\u0E38\u0E01\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", color: "#06C755", size: "sm", align: "center", weight: "bold" }]
                  }
                }
              });
            } else {
              const bubbles = [];
              let currentItems = [];
              itemsToBuy.forEach((item, index) => {
                const itemName = item.name || "Unknown Item";
                const current = Number(item.current_quantity) || 0;
                const min = Number(item.min_stock_threshold) || 0;
                const reorder = Number(item.reorder_point) || 0;
                let statusEmoji = "\u{1F7E2}";
                let statusColor = "#06C755";
                if (current <= EPSILON) {
                  statusEmoji = "\u26AB \u0E2B\u0E21\u0E14";
                  statusColor = "#111111";
                } else if (min > 0 && current <= min + EPSILON) {
                  statusEmoji = "\u{1F534} \u0E27\u0E34\u0E01\u0E24\u0E15";
                  statusColor = "#EF4444";
                } else if (reorder > 0 && current <= reorder + EPSILON) {
                  statusEmoji = "\u{1F7E0} \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E15\u0E34\u0E21";
                  statusColor = "#F59E0B";
                }
                currentItems.push({
                  type: "box",
                  layout: "horizontal",
                  margin: "md",
                  contents: [
                    { type: "text", text: statusEmoji, flex: 0, margin: "none", size: "xs" },
                    { type: "text", text: itemName, weight: "bold", size: "sm", color: "#1A1A1A", wrap: true, margin: "md", flex: 3 },
                    {
                      type: "box",
                      layout: "vertical",
                      flex: 2,
                      alignItems: "flex-end",
                      contents: [
                        { type: "text", text: `\u0E40\u0E2B\u0E25\u0E37\u0E2D ${current}`, color: statusColor, size: "xs", weight: "bold" },
                        { type: "text", text: `(\u0E02\u0E31\u0E49\u0E19\u0E15\u0E48\u0E33 ${min > 0 ? min : reorder})`, color: "#aaaaaa", size: "xxs" }
                      ]
                    }
                  ]
                });
                if (index < itemsToBuy.length - 1) {
                  currentItems.push({ type: "separator", margin: "md", color: "#F0F0F0" });
                }
                if (currentItems.length >= 19 || index === itemsToBuy.length - 1) {
                  if (currentItems.length > 0 && currentItems[currentItems.length - 1].type === "separator") {
                    currentItems.pop();
                  }
                  bubbles.push({
                    type: "bubble",
                    size: "mega",
                    header: {
                      type: "box",
                      layout: "vertical",
                      backgroundColor: "#1A1A1A",
                      paddingAll: "20px",
                      contents: [
                        { type: "text", text: headerTitle, weight: "bold", color: "#FFFFFF", size: "lg" },
                        { type: "text", text: `${dateStr} (\u0E2B\u0E19\u0E49\u0E32 ${bubbles.length + 1})`, color: "#CCCCCC", size: "xs", margin: "xs" }
                      ]
                    },
                    body: {
                      type: "box",
                      layout: "vertical",
                      paddingAll: "20px",
                      contents: currentItems
                    }
                  });
                  currentItems = [];
                }
              });
              if (bubbles.length > 5) {
                bubbles.length = 5;
                bubbles[4].body.contents.push({ type: "separator", margin: "md", color: "#F0F0F0" });
                bubbles[4].body.contents.push({ type: "text", text: "...(\u0E41\u0E2A\u0E14\u0E07\u0E44\u0E14\u0E49\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 5 \u0E2B\u0E19\u0E49\u0E32)", color: "#EF4444", size: "xs", margin: "md", align: "center" });
              }
              if (bubbles.length === 1) {
                messages.push({ type: "flex", altText: headerTitle, contents: bubbles[0] });
              } else {
                messages.push({ type: "flex", altText: headerTitle, contents: { type: "carousel", contents: bubbles } });
              }
            }
            const resp = await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({ replyToken: event.replyToken, messages })
            });
            if (!resp.ok) {
              const txt = await resp.text();
              console.error("stbuy Reply Failed:", txt);
              const targetId = event.source.groupId || event.source.roomId || event.source.userId;
              if (targetId) {
                await fetch("https://api.line.me/v2/bot/message/push", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}` },
                  body: JSON.stringify({ to: targetId, messages: [{ type: "text", text: `\u274C \u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E48\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E0B\u0E37\u0E49\u0E2D\u0E02\u0E2D\u0E07\u0E41\u0E1A\u0E1A Flex \u0E44\u0E14\u0E49
Error: ${txt.substring(0, 100)}` }] })
                });
              }
            }
          } catch (err) {
            console.error("stbuy Command Error:", err);
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({ replyToken: event.replyToken, messages: [{ type: "text", text: "\u274C \u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E43\u0E19\u0E01\u0E32\u0E23\u0E14\u0E36\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E0B\u0E37\u0E49\u0E2D\u0E02\u0E2D\u0E07: " + err.message }] })
            });
          }
          continue;
        }
        if (text === "stback" || text === "stday" || text === "sthour") {
          try {
            const isToday = text === "stday";
            const isHour = text === "sthour";
            console.log(`Processing ${text} command...`);
            const now = /* @__PURE__ */ new Date();
            const thNow = new Date(now.getTime() + 7 * 60 * 60 * 1e3);
            let dbStart, dbEnd;
            let dateStr = "";
            let headerTitle = "\u{1F4E6} \u0E2D\u0E31\u0E1E\u0E40\u0E14\u0E17\u0E2A\u0E15\u0E4A\u0E2D\u0E01";
            if (isHour) {
              dbEnd = now.toISOString();
              dbStart = new Date(now.getTime() - 60 * 60 * 1e3).toISOString();
              headerTitle += " (1 \u0E0A\u0E21. \u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14)";
              try {
                dateStr = thNow.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
                dateStr += " " + thNow.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " \u0E19.";
              } catch (e) {
                dateStr = thNow.toISOString().split("T")[0];
              }
            } else {
              const queryDateStart = new Date(thNow);
              if (!isToday) {
                queryDateStart.setDate(queryDateStart.getDate() - 1);
                headerTitle += "\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E27\u0E32\u0E19";
              } else {
                headerTitle += "\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49";
              }
              queryDateStart.setHours(0, 0, 0, 0);
              const queryDateEnd = new Date(queryDateStart);
              queryDateEnd.setHours(23, 59, 59, 999);
              dbStart = new Date(queryDateStart.getTime() - 7 * 60 * 60 * 1e3).toISOString();
              dbEnd = new Date(queryDateEnd.getTime() - 7 * 60 * 60 * 1e3).toISOString();
              try {
                dateStr = queryDateStart.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
              } catch (e) {
                dateStr = queryDateStart.toISOString().split("T")[0];
              }
            }
            console.log(`Querying stocks from ${dbStart} to ${dbEnd}`);
            const { data: transactions, error } = await supabaseAdmin.from("stock_transactions").select(`
                quantity_change,
                transaction_type,
                created_at,
                note,
                stock_items (
                  name,
                  unit,
                  current_quantity,
                  min_stock_threshold,
                  reorder_point
                )
              `).gte("created_at", dbStart).lte("created_at", dbEnd).order("created_at", { ascending: true });
            if (error) {
              console.error("Supabase Query Error:", error);
              throw error;
            }
            console.log(`Found ${transactions?.length ?? 0} transactions`);
            let messages = [];
            if (!transactions || transactions.length === 0) {
              messages.push({
                type: "flex",
                altText: headerTitle,
                contents: {
                  type: "bubble",
                  header: {
                    type: "box",
                    layout: "vertical",
                    backgroundColor: "#1A1A1A",
                    contents: [
                      { type: "text", text: headerTitle, weight: "bold", color: "#FFFFFF", size: "lg" },
                      { type: "text", text: dateStr, color: "#CCCCCC", size: "xs", margin: "xs" }
                    ]
                  },
                  body: {
                    type: "box",
                    layout: "vertical",
                    contents: [{ type: "text", text: "\u{1F6AB} \u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2D\u0E31\u0E1E\u0E40\u0E14\u0E17", color: "#888888", size: "sm", align: "center" }]
                  }
                }
              });
            } else {
              const bubbles = [];
              let currentItems = [];
              transactions.forEach((tx, index) => {
                const sign = tx.quantity_change > 0 ? "+" : "";
                let time = "";
                try {
                  time = new Date(new Date(tx.created_at).getTime() + 7 * 60 * 60 * 1e3).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
                } catch (e) {
                  time = tx.created_at.substring(11, 16);
                }
                const item = tx.stock_items;
                const itemName = item?.name || "Unknown Item";
                const itemUnit = item?.unit || "";
                const current = Number(item?.current_quantity) || 0;
                const min = Number(item?.min_stock_threshold) || 0;
                const reorder = Number(item?.reorder_point) || 0;
                const EPSILON = 1e-4;
                let statusEmoji = "\u{1F7E2}";
                let statusColor = "#06C755";
                if (current <= EPSILON) {
                  statusEmoji = "\u26AB \u0E2B\u0E21\u0E14";
                  statusColor = "#111111";
                } else if (min > 0 && current <= min + EPSILON) {
                  statusEmoji = "\u{1F534} \u0E27\u0E34\u0E01\u0E24\u0E15";
                  statusColor = "#EF4444";
                } else if (reorder > 0 && current <= reorder + EPSILON) {
                  statusEmoji = "\u{1F7E0} \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E15\u0E34\u0E21";
                  statusColor = "#F59E0B";
                }
                currentItems.push({
                  type: "box",
                  layout: "vertical",
                  margin: "md",
                  contents: [
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        { type: "text", text: `\u{1F552} ${time}`, color: "#aaaaaa", size: "xs", flex: 0 },
                        { type: "text", text: itemName, weight: "bold", size: "sm", color: "#1A1A1A", wrap: true, margin: "md", flex: 1 }
                      ]
                    },
                    {
                      type: "box",
                      layout: "baseline",
                      margin: "xs",
                      contents: [
                        { type: "text", text: `\u{1F4DD} ${sign}${tx.quantity_change} ${itemUnit}`, color: "#888888", size: "xs", flex: 2 },
                        { type: "text", text: `\u0E40\u0E2B\u0E25\u0E37\u0E2D ${current} ${statusEmoji}`, color: statusColor, size: "xs", align: "end", weight: "bold", flex: 3 }
                      ]
                    },
                    ...tx.note ? [{
                      type: "text",
                      text: `\u{1F4AC} Note: ${tx.note}`,
                      color: "#aaaaaa",
                      size: "xxs",
                      margin: "xs",
                      wrap: true
                    }] : []
                  ]
                });
                if (index < transactions.length - 1) {
                  currentItems.push({ type: "separator", margin: "md", color: "#F0F0F0" });
                }
                if (currentItems.length >= 19 || index === transactions.length - 1) {
                  if (currentItems.length > 0 && currentItems[currentItems.length - 1].type === "separator") {
                    currentItems.pop();
                  }
                  bubbles.push({
                    type: "bubble",
                    size: "mega",
                    header: {
                      type: "box",
                      layout: "vertical",
                      backgroundColor: "#1A1A1A",
                      paddingAll: "20px",
                      contents: [
                        { type: "text", text: headerTitle, weight: "bold", color: "#FFFFFF", size: "lg" },
                        { type: "text", text: `${dateStr} (\u0E2B\u0E19\u0E49\u0E32 ${bubbles.length + 1})`, color: "#CCCCCC", size: "xs", margin: "xs" }
                      ]
                    },
                    body: {
                      type: "box",
                      layout: "vertical",
                      paddingAll: "20px",
                      contents: currentItems
                    }
                  });
                  currentItems = [];
                }
              });
              if (bubbles.length > 5) {
                bubbles.length = 5;
                bubbles[4].body.contents.push({ type: "separator", margin: "md", color: "#F0F0F0" });
                bubbles[4].body.contents.push({ type: "text", text: "...(\u0E41\u0E2A\u0E14\u0E07\u0E44\u0E14\u0E49\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 5 \u0E2B\u0E19\u0E49\u0E32)", color: "#EF4444", size: "xs", margin: "md", align: "center" });
              }
              messages.push({
                type: "flex",
                altText: headerTitle,
                contents: {
                  type: "carousel",
                  contents: bubbles
                }
              });
            }
            console.log(`Sending Stock Reply (${messages.length} bubbles)`);
            const resp = await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages
              })
            });
            if (!resp.ok) {
              const txt = await resp.text();
              console.error("LINE Reply Failed:", txt);
              const targetId = event.source.groupId || event.source.roomId || event.source.userId;
              if (targetId) {
                const pushResp = await fetch("https://api.line.me/v2/bot/message/push", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`
                  },
                  body: JSON.stringify({ to: targetId, messages: [{ type: "text", text: `\u274C \u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E48\u0E07\u0E2A\u0E23\u0E38\u0E1B\u0E2A\u0E15\u0E47\u0E2D\u0E01\u0E41\u0E1A\u0E1A Flex \u0E44\u0E14\u0E49 (\u0E2D\u0E32\u0E08\u0E08\u0E30\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E40\u0E22\u0E2D\u0E30\u0E40\u0E01\u0E34\u0E19\u0E44\u0E1B)
Error: ${txt.substring(0, 100)}` }] })
                });
                if (!pushResp.ok) console.error("LINE Push Failed:", await pushResp.text());
              }
            }
          } catch (err) {
            console.error("Stock Command Error:", err);
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: "text", text: "\u274C \u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E43\u0E19\u0E01\u0E32\u0E23\u0E14\u0E36\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E15\u0E47\u0E2D\u0E01: " + err.message }]
              })
            });
          }
        }
        if (text === "staff") {
          console.log("Processing staff command...");
          const now = /* @__PURE__ */ new Date();
          const thNow = new Date(now.getTime() + 7 * 60 * 60 * 1e3);
          const dateStrApi = thNow.toISOString().split("T")[0];
          let titleDateStr = "";
          try {
            titleDateStr = thNow.toLocaleDateString("th-TH", {
              day: "numeric",
              month: "long",
              year: "numeric"
            });
          } catch (e) {
            titleDateStr = dateStrApi;
          }
          try {
            const hrApiUrl = `https://inthehaus-hr.vercel.app/api/export/staff-data?startDate=${dateStrApi}&endDate=${dateStrApi}`;
            console.log(`Fetching HR Data from: ${hrApiUrl}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15e3);
            let hrResp;
            try {
              hrResp = await fetch(hrApiUrl, { signal: controller.signal });
              clearTimeout(timeoutId);
            } catch (fetchErr) {
              if (fetchErr.name === "AbortError") throw new Error("HR API request timed out (15s)");
              throw fetchErr;
            }
            if (!hrResp.ok) throw new Error(`HR API returned status: ${hrResp.status}`);
            const hrData = await hrResp.json();
            const attendances = hrData.attendance || [];
            const leaves = hrData.leaves || [];
            let flexContents = [];
            if (attendances.length === 0 && leaves.length === 0) {
              flexContents.push({ type: "text", text: "\u{1F6AB} \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E19\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49", color: "#888888", size: "sm", align: "center" });
            } else {
              if (attendances.length > 0) {
                flexContents.push({ type: "text", text: "[\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E40\u0E02\u0E49\u0E32-\u0E2D\u0E2D\u0E01\u0E40\u0E27\u0E25\u0E32]", weight: "bold", color: "#1A1A1A", size: "sm", margin: "md" });
                flexContents.push({ type: "separator", margin: "sm", color: "#F0F0F0" });
                const empMap = /* @__PURE__ */ new Map();
                attendances.forEach((record) => {
                  if (!empMap.has(record.employee_id)) {
                    empMap.set(record.employee_id, { name: record.employee_name, in: null, out: null, moodIn: null, moodOut: null });
                  }
                  const emp = empMap.get(record.employee_id);
                  let timeStr = "";
                  try {
                    timeStr = new Date(new Date(record.timestamp).getTime() + 7 * 60 * 60 * 1e3).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
                  } catch (e) {
                    timeStr = record.timestamp.substring(11, 16);
                  }
                  if (record.action_type === "check_in" || record.action_type === "clock_in") {
                    emp.in = timeStr;
                    emp.moodIn = record.mood_status || "";
                  } else if (record.action_type === "check_out" || record.action_type === "clock_out") {
                    emp.out = timeStr;
                    emp.moodOut = record.mood_status || "";
                  }
                });
                Array.from(empMap.values()).forEach((emp, i, arr) => {
                  const inTxt = emp.in ? `${emp.in} \u0E19. ${emp.moodIn}` : "-";
                  const outTxt = emp.out ? `${emp.out} \u0E19. ${emp.moodOut}` : "-";
                  flexContents.push({
                    type: "box",
                    layout: "vertical",
                    margin: "md",
                    contents: [
                      { type: "text", text: `\u{1F464} ${emp.name}`, weight: "bold", size: "sm", color: "#1A1A1A" },
                      {
                        type: "box",
                        layout: "horizontal",
                        margin: "sm",
                        contents: [
                          { type: "text", text: "\u{1F7E2} \u0E40\u0E02\u0E49\u0E32", color: "#aaaaaa", size: "xs", flex: 1 },
                          { type: "text", text: inTxt, color: "#1A1A1A", size: "xs", flex: 3 },
                          { type: "text", text: "\u{1F534} \u0E2D\u0E2D\u0E01", color: "#aaaaaa", size: "xs", flex: 1 },
                          { type: "text", text: outTxt, color: "#1A1A1A", size: "xs", flex: 3 }
                        ]
                      }
                    ]
                  });
                  if (i < arr.length - 1) flexContents.push({ type: "separator", margin: "md", color: "#F0F0F0" });
                });
              }
              if (leaves.length > 0) {
                flexContents.push({ type: "text", text: "[\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E25\u0E32\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49]", weight: "bold", color: "#1A1A1A", size: "sm", margin: "xl" });
                flexContents.push({ type: "separator", margin: "sm", color: "#F0F0F0" });
                leaves.forEach((leave, i, arr) => {
                  const statusColor = leave.status === "approved" ? "#06C755" : leave.status === "pending" ? "#F59E0B" : "#EF4444";
                  const statusText = leave.status === "approved" ? "\u2705 \u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E41\u0E25\u0E49\u0E27" : leave.status === "pending" ? "\u23F3 \u0E23\u0E2D\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34" : "\u274C \u0E44\u0E21\u0E48\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34";
                  flexContents.push({
                    type: "box",
                    layout: "vertical",
                    margin: "md",
                    contents: [
                      { type: "text", text: `\u26F1\uFE0F ${leave.employee_name}`, weight: "bold", size: "sm", color: "#1A1A1A" },
                      {
                        type: "box",
                        layout: "baseline",
                        margin: "xs",
                        contents: [
                          { type: "text", text: "\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25", color: "#aaaaaa", size: "xs", flex: 1 },
                          { type: "text", text: leave.reason || "-", color: "#1A1A1A", size: "xs", flex: 4, wrap: true }
                        ]
                      },
                      {
                        type: "box",
                        layout: "baseline",
                        margin: "xs",
                        contents: [
                          { type: "text", text: "\u0E2A\u0E16\u0E32\u0E19\u0E30", color: "#aaaaaa", size: "xs", flex: 1 },
                          { type: "text", text: statusText, color: statusColor, size: "xs", flex: 4, weight: "bold" }
                        ]
                      }
                    ]
                  });
                  if (i < arr.length - 1) flexContents.push({ type: "separator", margin: "md", color: "#F0F0F0" });
                });
              }
            }
            const messagesPayload = [{
              type: "flex",
              altText: `\u{1F9D1}\u200D\u{1F4BC} \u0E2A\u0E23\u0E38\u0E1B\u0E01\u0E32\u0E23\u0E40\u0E02\u0E49\u0E32\u0E07\u0E32\u0E19\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49 (${titleDateStr})`,
              contents: {
                type: "bubble",
                size: "mega",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#1A1A1A",
                  paddingAll: "20px",
                  contents: [
                    { type: "text", text: "\u{1F9D1}\u200D\u{1F4BC} \u0E2A\u0E23\u0E38\u0E1B\u0E01\u0E32\u0E23\u0E40\u0E02\u0E49\u0E32\u0E07\u0E32\u0E19", weight: "bold", color: "#FFFFFF", size: "lg" },
                    { type: "text", text: titleDateStr, color: "#CCCCCC", size: "xs", margin: "xs" }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "20px",
                  contents: flexContents
                }
              }
            }];
            console.log("Sending Staff Reply...");
            const resp = await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: messagesPayload
              })
            });
            if (!resp.ok) {
              const txt = await resp.text();
              console.error("Staff Reply Failed:", txt);
              const targetId = event.source.groupId || event.source.roomId || event.source.userId;
              if (targetId) {
                await fetch("https://api.line.me/v2/bot/message/push", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}` },
                  body: JSON.stringify({ to: targetId, messages: [{ type: "text", text: `\u274C \u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E41\u0E1A\u0E1A Flex \u0E44\u0E14\u0E49
Error: ${txt.substring(0, 100)}` }] })
                });
              }
            }
          } catch (apiErr) {
            console.error("Staff Command Error:", apiErr);
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: "text", text: "\u274C \u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E14\u0E36\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E44\u0E14\u0E49: " + apiErr.message }]
              })
            });
          }
        }
        if (text.startsWith("\u0E23\u0E32\u0E04\u0E32 ") || text.startsWith("makro ")) {
          console.log("Processing price search command...");
          const isMakroAlias = text.startsWith("makro ");
          const keyword = text.substring(isMakroAlias ? 6 : 5).trim();
          if (!keyword) {
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: "text", text: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E04\u0E33\u0E04\u0E49\u0E19\u0E2B\u0E32 \u0E40\u0E0A\u0E48\u0E19 \u0E23\u0E32\u0E04\u0E32 \u0E19\u0E49\u0E33\u0E21\u0E31\u0E19\u0E1B\u0E32\u0E25\u0E4C\u0E21" }]
              })
            });
            continue;
          }
          try {
            console.log(`Searching Web for Price. Keyword: ${keyword}`);
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword + " \u0E23\u0E32\u0E04\u0E32")}`;
            const dResponse = await fetch(searchUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              }
            });
            if (!dResponse.ok) {
              throw new Error(`DuckDuckGo request failed with status: ${dResponse.status}`);
            }
            const html = await dResponse.text();
            const resultBlocks = html.split('class="result ');
            const results = [];
            const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
            const thaiYear = currentYear + 543;
            const yearsToIgnore = [currentYear, currentYear - 1, currentYear + 1, thaiYear, thaiYear - 1, thaiYear + 1];
            for (let i = 1; i < resultBlocks.length; i++) {
              const block = resultBlocks[i];
              const titleMatch = block.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/);
              const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
              const urlMatch = block.match(/href="([^"]+uddg=([^"&]+)[^"]*)"/);
              if (titleMatch && snippetMatch) {
                const rawTitle = titleMatch[1].replace(/<[^>]*>/g, "").trim();
                const rawSnippet = snippetMatch[1].replace(/<[^>]*>/g, "").trim();
                let targetUrl = "";
                if (urlMatch) {
                  try {
                    targetUrl = decodeURIComponent(urlMatch[2]);
                  } catch {
                    targetUrl = urlMatch[1];
                  }
                }
                let domain = "";
                try {
                  const urlObj = new URL(targetUrl);
                  domain = urlObj.hostname.replace("www.", "");
                } catch {
                  domain = "";
                }
                const combinedText = `${rawTitle} ${rawSnippet}`;
                const prices = [];
                const priceRegexes = [
                  /฿\s*(\d+(?:\.\d+)?)/g,
                  /(\d+(?:\.\d+)?)\s*บาท/g,
                  /ราคา\s*(\d+(?:\.\d+)?)/g,
                  /(\d+(?:\.\d+)?)\s*\.-\s*/g
                ];
                for (const regex of priceRegexes) {
                  let match;
                  regex.lastIndex = 0;
                  while ((match = regex.exec(combinedText)) !== null) {
                    const price = parseFloat(match[1]);
                    if (price > 0 && !prices.includes(price) && price < 1e5) {
                      if (yearsToIgnore.includes(price)) continue;
                      prices.push(price);
                    }
                  }
                }
                results.push({
                  title: rawTitle,
                  snippet: rawSnippet,
                  url: targetUrl,
                  domain,
                  prices: prices.sort((a, b) => a - b)
                });
              }
            }
            let flexContents = [];
            if (results.length === 0) {
              flexContents.push({ type: "text", text: "\u274C \u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1C\u0E25\u0E25\u0E31\u0E1E\u0E18\u0E4C\u0E23\u0E32\u0E04\u0E32\u0E01\u0E25\u0E32\u0E07\u0E1A\u0E19\u0E40\u0E27\u0E47\u0E1A", color: "#888888", size: "sm", align: "center" });
            } else {
              const displayItems = results.slice(0, 5);
              displayItems.forEach((r, i, arr) => {
                const contents = [
                  { type: "text", text: r.title, weight: "bold", size: "sm", color: "#1A1A1A", wrap: true }
                ];
                if (r.prices && r.prices.length > 0) {
                  const priceStr = r.prices.map((p) => `\u0E3F${p}`).join(", ");
                  contents.push({
                    type: "text",
                    text: `\u{1F4B0} \u0E23\u0E32\u0E04\u0E32\u0E17\u0E35\u0E48\u0E1E\u0E1A: ${priceStr}`,
                    color: "#EF4444",
                    size: "xs",
                    weight: "bold",
                    margin: "xs"
                  });
                }
                contents.push({
                  type: "text",
                  text: r.snippet,
                  color: "#666666",
                  size: "xs",
                  wrap: true,
                  margin: "sm"
                });
                if (r.domain) {
                  contents.push({
                    type: "text",
                    text: `\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E17\u0E35\u0E48\u0E21\u0E32: ${r.domain}`,
                    color: "#aaaaaa",
                    size: "xs",
                    margin: "xs"
                  });
                }
                flexContents.push({
                  type: "box",
                  layout: "vertical",
                  margin: "md",
                  contents
                });
                if (i < arr.length - 1) flexContents.push({ type: "separator", margin: "md", color: "#F0F0F0" });
              });
              if (results.length > 5) {
                flexContents.push({ type: "separator", margin: "md", color: "#F0F0F0" });
                flexContents.push({ type: "text", text: `(\u0E41\u0E2A\u0E14\u0E07 5 \u0E08\u0E32\u0E01 ${results.length} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23)`, color: "#aaaaaa", size: "xs", align: "center", margin: "md" });
              }
            }
            const messagesPayload = [{
              type: "flex",
              altText: `\u{1F50D} \u0E23\u0E32\u0E04\u0E32\u0E01\u0E25\u0E32\u0E07: ${keyword}`,
              contents: {
                type: "bubble",
                size: "mega",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#1A1A1A",
                  // Premium Dark Theme
                  paddingAll: "20px",
                  contents: [
                    { type: "text", text: "\u{1F50D} \u0E1C\u0E25\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E23\u0E32\u0E04\u0E32\u0E01\u0E25\u0E32\u0E07", weight: "bold", color: "#FFFFFF", size: "lg" },
                    { type: "text", text: `\u0E04\u0E49\u0E19\u0E2B\u0E32: "${keyword}"`, color: "#AAAAAA", size: "xs", margin: "xs" }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  paddingAll: "20px",
                  contents: flexContents
                }
              }
            }];
            console.log("Sending Price Search Reply...");
            const resp = await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: messagesPayload
              })
            });
            if (!resp.ok) {
              const txt = await resp.text();
              console.error("Price Reply Failed:", txt);
            }
          } catch (err) {
            console.error("Price Command Error:", err);
            await fetch("https://api.line.me/v2/bot/message/reply", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{ type: "text", text: "\u274C \u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E14\u0E36\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E32\u0E04\u0E32\u0E01\u0E25\u0E32\u0E07\u0E44\u0E14\u0E49: " + err.message }]
              })
            });
          }
        }
      }
    }
    return new Response("OK", { headers: corsHeaders });
  } catch (err) {
    console.error("Global Webhook Error:", err);
    return new Response("Error", { status: 500 });
  }
});
