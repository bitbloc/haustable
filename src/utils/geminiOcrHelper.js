// Gemini AI OCR & Thai Receipt Auto-Categorization Helper for In The Haus
import { supabase } from '../lib/supabaseClient';

export const GEMINI_SUPPORTED_MODELS = [
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash (ล่าสุด - แนะนำ ฉลาดและแม่นยำสูงสุด)' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (เสถียร & รวดเร็ว)' },
    { id: 'gemini-3.7-pro', label: 'Gemini 3.7 Pro' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash Latest' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
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
    return 'gemini-3.7-flash';
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
 * Rotates a base64 image by specified degrees (e.g. 90, 180, 270) using canvas
 * @param {string} base64Str - Image data URL
 * @param {number} degrees - Degrees to rotate clockwise (default 90)
 * @returns {Promise<string>} Rotated base64 image data URL
 */
export function rotateImageBase64(base64Str, degrees = 90) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const rad = (degrees * Math.PI) / 180;
            const isPerpendicular = Math.abs(degrees % 180) === 90;

            canvas.width = isPerpendicular ? img.height : img.width;
            canvas.height = isPerpendicular ? img.width : img.height;

            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rad);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            resolve(canvas.toDataURL('image/jpeg', 0.90));
        };
        img.onerror = (err) => reject(err);
        img.src = base64Str;
    });
}

/**
 * Scan receipt image(s) using Gemini Vision AI with Auto-Fallback Cascade
 * Supports single image or multiple images in a set (multi-page invoices, bill + slip)
 * @param {string|string[]} base64Image - Single data URL or array of data URLs/base64 strings
 * @param {string} customApiKey - Optional custom API key
 * @param {string} preferredModel - Optional model override
 * @returns {Promise<Object>} Parsed structured receipt data
 */
export async function scanReceiptWithGemini(base64Image, customApiKey = null, preferredModel = null) {
    const apiKey = customApiKey || (await getGeminiApiKey());
    if (!apiKey) {
        throw new Error('MISSING_API_KEY');
    }

    const imagesArray = Array.isArray(base64Image) ? base64Image : [base64Image];
    const isMultiPage = imagesArray.length > 1;

    const imageParts = imagesArray.map(img => {
        const match = img.match(/^data:([^;]+);base64,(.+)$/);
        const mimeType = match ? match[1] : 'image/jpeg';
        const rawBase64 = match ? match[2] : img;
        return {
            inline_data: {
                mime_type: mimeType,
                data: rawBase64
            }
        };
    });

    const systemInstruction = `
You are an expert Thai Restaurant & Accounting AI Auditor for "IN THE HAUS" restaurant.
You are provided with ${imagesArray.length} image(s). ${isMultiPage ? 'These images are part of a SINGLE multi-page receipt set, tax invoice set, or bill + transfer slip combination (e.g. Page 1, Page 2 of the same Makro/Lotus bill, or invoice + bank slip).' : ''}
Analyze all provided images TOGETHER as a single cohesive expense record.

CRITICAL ORIENTATION & ROTATION INSTRUCTIONS (แนวนอน / หมุนข้าง / ตะแคง / กลับหัว):
- Receipts, invoices, and slips are often photographed HORIZONTALLY (แนวนอน / landscape), ROTATED SIDEWAYS (90° clockwise, 90° counter-clockwise / 270°), or at an angle.
- You MUST automatically detect text orientation and read text in ANY orientation (horizontal, vertical, rotated 90°, 180°, 270°).
- NEVER fail, return blank, or hallucinate missing data just because the receipt was captured horizontally or sideways. Mentally orient the document to read all lines correctly.

Extract and return ONLY a valid JSON object matching this schema:
{
  "title": "Clear concise summary in Thai (e.g. 'ซื้อเนื้อสัตว์ ผักสด Makro ศรีนครินทร์${isMultiPage ? ` (ชุด ${imagesArray.length} แผ่น)` : ''}', 'ค่าแกัสหุงต้มครัว (เวิลด์แก๊ส)', 'ค่าน้ำมันรถ ปตท.', 'ค่าไฟประจำเดือน', 'ค่าน้ำแข็งหลอด', 'ค่ายิงแอด Facebook Ads')",
  "amount": 0.00, // CRITICAL: Extract the SINGLE final grand total payable amount of the entire set (do NOT sum page subtotals if one page shows the grand total; extract the final net amount).
  "expense_date": "YYYY-MM-DD", // Date of purchase/payment. If missing, use today's date
  "category": "raw_material", // EXACTLY ONE OF: 'raw_material', 'marketing', 'fuel_logistics', 'utilities', 'rent', 'staff_wages', 'equipment_supplies', 'maintenance', 'software_service', 'other'
  "vendor_name": "Name of store/vendor (e.g. 'Siam Makro', 'ร้านแก๊ส / เวิลด์แก๊ส / สยามแก๊ส', 'ปั๊ม ปตท. (PTT)', 'โรงน้ำแข็ง', 'การไฟฟ้านครหลวง', 'Facebook Ads')",
  "vendor_tax_id": "13-digit Thai Tax ID if visible, else empty string",
  "doc_type": "tax_invoice", // EXACTLY ONE OF: 'tax_invoice' (Full tax invoice / ใบกำกับภาษีเต็มรูป), 'cash_bill' (Cash receipt / บิลเงินสด), 'receipt_voucher' (Payment voucher / ใบสำคัญรับเงิน), 'slip_only' (Bank transfer slip / สลิปโอน)
  "vat_included": true, // Boolean: true if VAT 7% is included in the bill (like Makro, gas stations, power bills), false otherwise
  "payment_method": "TRANSFER", // DEFAULT IS ALWAYS 'TRANSFER'. Use 'CASH' only if explicitly marked as cash payment, or 'CREDIT' if marked as credit card.
  "notes": "Comprehensive summary of purchased line items from all pages in Thai (e.g. 'แก๊สถัง 15kg 2 ถัง', 'หมูสามชั้น 3kg, นม 4 แกลลอน', 'น้ำแข็งหลอด 5 กระสอบ')",
  "confidence": 0.95 // Confidence score from 0.0 to 1.0
}

Category Rules:
- Cooking Gas / LPG / Gas Tanks (แก๊สหุงต้ม, แก๊สครัว, ถังแก๊ส, เวิลด์แก๊ส, สยามแก๊ส, ปตท.แก๊ส, ร้านส่งแก๊ส, ค่าเติมแก๊ส) -> 'utilities'
- Electricity / Water / Internet (MEA/PEA การไฟฟ้า, MWA/PWA การประปา, True, AIS, 3BB, NT) -> 'utilities'
- Vehicle Fuel & Logistics (ค่าน้ำมันรถ, ดีเซล, เบนซิน, แก๊สรถยนต์, ปั๊ม ปตท., บางจาก, Shell, Caltex, Lalamove, Grab, Lineman, Flash, Kerry) -> 'fuel_logistics'
- Fresh Food / Market / Ingredients / Ice (Makro, Lotus, Big C, CJ More, ตลาดสด, ตลาดไท, โรงน้ำแข็ง, น้ำแข็งหลอด, เนื้อสัตว์, ผักผลไม้, นม, ไข่ไก่, ซอส, เมล็ดกาแฟ, ไซรัป) -> 'raw_material'
- Marketing & Ads (Facebook, TikTok, Instagram, Google Ads, LINE Ads, ป้ายโฆษณา) -> 'marketing'
- Rent & Premises (ค่าเช่าร้าน, ค่าเช่าพื้นที่, ค่าเช่าที่ดิน, เงินมัดจำ) -> 'rent'
- Staff Wages (ค่าแรง, เงินเดือน, ค่าจ้างพาร์ทไทม์, โอที) -> 'staff_wages'
- Equipment & Packaging (แก้วกาแฟ, ฝา, หลอด, ถุงหิ้ว, ถุงขยะ, กล่องอาหาร, ทิชชู่, น้ำยาล้างจาน, อุปกรณ์ครัว) -> 'equipment_supplies'
- Maintenance & Repairs (ช่างไฟ, ช่างประปา, ล้างแอร์, ซ่อมตู้เย็น, HomePro, ไทวัสดุ, ดูโฮม) -> 'maintenance'
- Software & Subscriptions (Spotify, Canva, POS, ระบบรายเดือน) -> 'software_service'

Multi-Page Rules:
- If multiple pages have separate line items, combine the line items into the 'notes' field.
- Do NOT double-count totals across pages if one page is a subtotal and another is the grand total.
- If one page is an invoice and another is a bank transfer slip, verify that the amounts match, use the invoice vendor and tax details, and set payment_method to 'TRANSFER'.

Payment Method Rules:
- DEFAULT: 'TRANSFER' (Mobile banking, PromptPay QR, KPlus, SCB Easy, Krungthai NEXT, KKP, ttb, Bank Transfer slip, etc.)
- Use 'CASH' ONLY if the bill explicitly states cash payment / จ่ายเงินสด.
- Use 'CREDIT' ONLY if the bill explicitly states credit/debit card payment / รูดบัตร.
`;

    const requestBody = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: `Please analyze these ${imagesArray.length} receipt/invoice/slip image(s) together as one single cohesive document set and extract structured expense and tax information in Thai.` },
                    ...imageParts
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

    // Candidate models order: Start with user selection or gemini-3.7-flash, then cascade down
    const userChoice = preferredModel || (await getGeminiPreferredModel());
    const candidateModels = Array.from(new Set([
        userChoice,
        'gemini-3.7-flash',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-3.7-pro',
        'gemini-2.5-pro',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash',
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
