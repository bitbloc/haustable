// Gemini AI OCR & Thai Receipt Auto-Categorization Helper for In The Haus
import { supabase } from '../lib/supabaseClient';

export async function getGeminiApiKey() {
    // 1. Try env variable
    if (import.meta.env.VITE_GEMINI_API_KEY) {
        return import.meta.env.VITE_GEMINI_API_KEY;
    }

    // 2. Try localStorage
    const localKey = localStorage.getItem('onhaus_gemini_api_key');
    if (localKey && localKey.trim()) {
        return localKey.trim();
    }

    // 3. Try app_settings in Supabase
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'gemini_api_key')
            .maybeSingle();

        if (!error && data?.value) {
            localStorage.setItem('onhaus_gemini_api_key', data.value);
            return data.value;
        }
    } catch {
        // Fallback
    }

    return null;
}

export async function saveGeminiApiKey(apiKey) {
    if (!apiKey) return;
    const cleanKey = apiKey.trim();
    localStorage.setItem('onhaus_gemini_api_key', cleanKey);

    try {
        await supabase
            .from('app_settings')
            .upsert([{ key: 'gemini_api_key', value: cleanKey }]);
    } catch {
        // Fallback to local
    }
}

/**
 * Scan receipt image using Gemini Vision AI
 * @param {string} base64Image - Data URL or base64 string of receipt
 * @param {string} customApiKey - Optional custom API key
 * @returns {Promise<Object>} Parsed structured receipt data
 */
export async function scanReceiptWithGemini(base64Image, customApiKey = null) {
    const apiKey = customApiKey || (await getGeminiApiKey());
    if (!apiKey) {
        throw new Error('MISSING_API_KEY');
    }

    // Extract mime type and raw base64 data
    const match = base64Image.match(/^data:([^;]+);base64,(.+)$/);
    const mimeType = match ? match[1] : 'image/jpeg';
    const rawBase64 = match ? match[2] : base64Image;

    const systemInstruction = `
You are an expert Thai Restaurant & Accounting AI Auditor for "IN THE HAUS" restaurant.
Analyze the provided image of a receipt, tax invoice, delivery slip, utility bill, fuel receipt, or bank transfer slip.

Extract and return ONLY a valid JSON object matching this schema:
{
  "title": "Clear concise summary in Thai (e.g. 'ซื้อเนื้อสัตว์ นมสด Makro สาขาศรีนครินทร์', 'ค่าน้ำมันรถ ปตท.', 'ค่าไฟประจำเดือนสิงหาคม', 'ค่ายิงแอด Facebook Ads')",
  "amount": 0.00, // Total payable amount (number, no commas)
  "expense_date": "YYYY-MM-DD", // Date of purchase/payment. If missing, use today's date
  "category": "raw_material", // EXACTLY ONE OF: 'raw_material' (Makro, fresh food, beverages, ingredients), 'marketing' (Facebook, TikTok, IG, Google ads), 'fuel_logistics' (gasoline, PTT, Shell, Bangchak, Lalamove, Grab), 'utilities' (electricity, water, internet), 'rent' (store rent), 'staff_wages' (payroll, wages), 'equipment_supplies' (cups, bags, tableware), 'maintenance' (repairs, HomePro, hardware), 'software_service' (POS, music, subscriptions), 'other' (misc)
  "vendor_name": "Name of store/vendor (e.g. 'Siam Makro', 'ปั๊ม ปตท. (PTT)', 'การไฟฟ้านครหลวง', 'Facebook Ads')",
  "vendor_tax_id": "13-digit Thai Tax ID if visible, else empty string",
  "doc_type": "tax_invoice", // EXACTLY ONE OF: 'tax_invoice' (Full tax invoice / ใบกำกับภาษีเต็มรูป), 'cash_bill' (Cash receipt / บิลเงินสด), 'receipt_voucher' (Payment voucher / ใบสำคัญรับเงิน), 'slip_only' (Bank transfer slip / สลิปโอน)
  "vat_included": true, // Boolean: true if VAT 7% is included in the bill (like Makro, gas stations), false otherwise
  "payment_method": "TRANSFER", // 'TRANSFER', 'CASH', or 'CREDIT'
  "notes": "Brief summary of purchased line items in Thai (e.g. 'หมูสามชั้น 3kg, นม 4 แกลลอน, ผักสลัด')",
  "confidence": 0.95 // Confidence score from 0.0 to 1.0
}

Category Rules:
- Makro, Lotus, Big C, Foodland, fresh markets, meat, vegetables, milk, coffee beans, syrups -> 'raw_material'
- Facebook, TikTok, Instagram, Google Ads, LINE Ads, marketing agencies -> 'marketing'
- PTT, Shell, Bangchak, Caltex, gasoline, diesel, Lalamove, GrabExpress -> 'fuel_logistics'
- MEA (การไฟฟ้า), PEA, MWA (การประปา), PWA, True, AIS, 3BB, TOT -> 'utilities'
- Rent, landlord, lease -> 'rent'
- Cups, plastic lids, straw, packaging, takeout boxes, napkins, cleaning supplies -> 'equipment_supplies'
- Electrician, plumbing, HomePro, repairs -> 'maintenance'
`;

    const requestBody = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: 'Please analyze this receipt and extract structured expense and tax information in Thai.' },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: rawBase64
                        }
                    }
                ]
            }
        ],
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1
        }
    };

    // Call Gemini 1.5 Flash (fallback to gemini-2.0-flash / gemini-1.5-pro if needed)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errText = await response.text();
        let errMsg = 'Gemini API Error';
        try {
            const errObj = JSON.parse(errText);
            errMsg = errObj?.error?.message || errText;
        } catch {
            errMsg = errText;
        }
        throw new Error(errMsg);
    }

    const resJson = await response.json();
    const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
        throw new Error('ไม่สามารถอ่านข้อมูลจากภาพใบเสร็จได้ กรุณาลองใหม่อีกครั้ง');
    }

    // Clean and parse JSON
    let parsed;
    try {
        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
    } catch (err) {
        throw new Error('รูปแบบข้อมูลจาก AI ไม่ถูกต้อง: ' + err.message);
    }

    return parsed;
}
