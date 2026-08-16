// Gemini AI OCR & Thai Receipt Auto-Categorization Helper for In The Haus
import { supabase } from '../lib/supabaseClient';

export const GEMINI_SUPPORTED_MODELS = [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (แนะนำ - เร็วและฉลาดที่สุด)' },
    { id: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash Latest' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Experimental' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
];

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

export async function getGeminiPreferredModel() {
    const localModel = localStorage.getItem('onhaus_gemini_model');
    if (localModel && localModel.trim()) return localModel.trim();
    return 'gemini-2.0-flash';
}

export async function saveGeminiPreferredModel(modelName) {
    if (!modelName) return;
    localStorage.setItem('onhaus_gemini_model', modelName.trim());
    try {
        await supabase
            .from('app_settings')
            .upsert([{ key: 'gemini_model', value: modelName.trim() }]);
    } catch {
        // Fallback
    }
}

/**
 * Scan receipt image using Gemini Vision AI with Auto-Fallback Cascade
 * @param {string} base64Image - Data URL or base64 string of receipt
 * @param {string} customApiKey - Optional custom API key
 * @param {string} preferredModel - Optional model override
 * @returns {Promise<Object>} Parsed structured receipt data
 */
export async function scanReceiptWithGemini(base64Image, customApiKey = null, preferredModel = null) {
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

    // Candidate models order: Start with user selection or gemini-2.0-flash, then cascade down
    const userChoice = preferredModel || (await getGeminiPreferredModel());
    const candidateModels = Array.from(new Set([
        userChoice,
        'gemini-2.0-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash',
        'gemini-2.5-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro'
    ]));

    let lastError = null;

    // Try models in cascade
    for (const model of candidateModels) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errText = await response.text();
                let errMsg = `Model ${model} Error`;
                try {
                    const errObj = JSON.parse(errText);
                    errMsg = errObj?.error?.message || errText;
                } catch {
                    errMsg = errText;
                }

                // If 404 (model not found), continue cascade to next model
                if (response.status === 404 || errMsg.toLowerCase().includes('not found')) {
                    lastError = new Error(`[${model}] ` + errMsg);
                    continue;
                }
                
                throw new Error(errMsg);
            }

            const resJson = await response.json();
            const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawText) {
                continue;
            }

            // Save the working model for future calls
            saveGeminiPreferredModel(model);

            // Clean and parse JSON
            const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return parsed;
        } catch (err) {
            lastError = err;
            if (err.message?.includes('MISSING_API_KEY')) {
                throw err;
            }
            // If it's a model not found error, loop continues
        }
    }

    throw lastError || new Error('ไม่สามารถเชื่อมต่อ Gemini Vision AI ได้ กรุณาตรวจสอบ API Key');
}
