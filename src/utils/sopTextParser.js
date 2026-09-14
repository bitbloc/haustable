/**
 * sopTextParser.js
 * Parses natural text notes (from LINE, Apple Notes, Google Keep, etc.)
 * into structured SOP Recipe objects.
 */

import { THAI_UNITS } from './unitUtils.js';

// Standard unit aliases map to canonical unit values
const UNIT_ALIASES = {
    'มล': 'ml',
    'มล.': 'ml',
    'ml': 'ml',
    'ซีซี': 'ml',
    'cc': 'ml',
    'กรัม': 'g',
    'ก.': 'g',
    'g': 'g',
    'gm': 'g',
    'ออนซ์': 'oz',
    'oz': 'oz',
    'ช้อนชา': 'tsp',
    'ชช': 'tsp',
    'ชช.': 'tsp',
    'tsp': 'tsp',
    'ช้อนโต๊ะ': 'tbsp',
    'ชต': 'tbsp',
    'ชต.': 'tbsp',
    'tbsp': 'tbsp',
    'ปั๊ม': 'pump',
    'pump': 'pump',
    'pumps': 'pump',
    'ช็อต': 'shot',
    'shot': 'shot',
    'shots': 'shot',
    'ชิ้น': 'pcs',
    'pcs': 'pcs',
    'แก้ว': 'glass',
    'ใบ': 'glass',
    'แผ่น': 'pcs',
    'หยด': 'drop',
    'drops': 'drop',
    'ลิตร': 'L',
    'liter': 'L',
    'l': 'L'
};

// Common keywords identifying sweeteners
const SWEETENER_KEYWORDS = [
    'ไซรัป', 'น้ำเชื่อม', 'น้ำตาล', 'นมข้น', 'นมข้นหวาน', 'syrup', 'sugar', 'sweet',
    'คาราเมล', 'caramel', 'vanilla', 'วานิลลา', 'น้ำผึ้ง', 'honey', 'ฟรุกโตส', 'fructose'
];

/**
 * Parse raw text into structured recipe components
 * @param {string} rawText 
 * @returns {Object} { name, glassSizeOz, ingredients, steps, sweetnessMatrix, notes }
 */
export function parseSOPText(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        return {
            name: '',
            glassSizeOz: 16,
            ingredients: [],
            steps: [],
            sweetnessMatrix: null,
            notes: ''
        };
    }

    const lines = rawText
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0);

    let name = '';
    let glassSizeOz = 16;
    const ingredients = [];
    const steps = [];
    const sweetnessMatrix = {
        mode: 'auto',
        levels: {}
    };
    const notesArr = [];

    // State machine for sections
    let currentSection = 'meta'; // 'meta' | 'ingredients' | 'steps' | 'notes'

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();

        // 1. Check section headers
        if (
            lowerLine.includes('ส่วนผสม') || 
            lowerLine.includes('วัตถุดิบ') || 
            lowerLine.includes('ingredients') || 
            lowerLine.includes('สูตร')
        ) {
            currentSection = 'ingredients';
            // Extract glass size if in header (e.g. ส่วนผสม (แก้ว 16 oz))
            const ozMatch = line.match(/(\d+)\s*(?:oz|ออนซ์)/i);
            if (ozMatch) glassSizeOz = parseInt(ozMatch[1], 10);
            continue;
        }

        if (
            lowerLine.includes('วิธีทำ') || 
            lowerLine.includes('ขั้นตอน') || 
            lowerLine.includes('steps') || 
            lowerLine.includes('method') || 
            lowerLine.includes('preparation')
        ) {
            currentSection = 'steps';
            continue;
        }

        if (
            lowerLine.includes('หมายเหตุ') || 
            lowerLine.includes('notes') || 
            lowerLine.includes('จุดสำคัญ') || 
            lowerLine.includes('คำแนะนำ')
        ) {
            currentSection = 'notes';
            continue;
        }

        // 2. Process Line according to current section or heuristics
        if (currentSection === 'meta') {
            // First non-header line is usually the Recipe Name
            if (!name) {
                // Check if glass size is embedded in the title: "มัทฉะลาเต้เย็น 16oz"
                const ozMatch = line.match(/(\d+)\s*(?:oz|ออนซ์)/i);
                if (ozMatch) {
                    glassSizeOz = parseInt(ozMatch[1], 10);
                    name = line.replace(/(\d+)\s*(?:oz|ออนซ์)/i, '').trim();
                } else {
                    name = line.replace(/^#+\s*/, '').replace(/^[•\-*]\s*/, '').trim();
                }
                currentSection = 'ingredients';
                continue;
            }
        }

        // Check if line looks like a Step (starts with 1., 2., Step 1, etc.)
        const stepMatch = line.match(/^(?:step\s*)?(\d+)[.:\-)]\s*(.+)/i);
        if (stepMatch) {
            currentSection = 'steps';
            const stepBody = stepMatch[2].trim();
            
            // Detect action type
            let action = 'pour';
            if (/ชง|คน|ตี|ผสม|whisk|stir/i.test(stepBody)) action = 'stir';
            else if (/สกัด|กด|brew|espresso|extract/i.test(stepBody)) action = 'brew';
            else if (/เชค|shake/i.test(stepBody)) action = 'shake';
            else if (/ปั่น|blend/i.test(stepBody)) action = 'blend';
            else if (/ท็อป|ตกแต่ง|garnish|top/i.test(stepBody)) action = 'garnish';

            // Extract duration if mentioned: (30 วิ, 30s, 1 นาที)
            let durationSec = null;
            const secMatch = stepBody.match(/(\d+)\s*(?:วิ|วินาที|s|sec)/i);
            const minMatch = stepBody.match(/(\d+)\s*(?:นาที|min)/i);
            if (secMatch) durationSec = parseInt(secMatch[1], 10);
            else if (minMatch) durationSec = parseInt(minMatch[1], 10) * 60;

            steps.push({
                order: steps.length + 1,
                title: `ขั้นตอนที่ ${steps.length + 1}`,
                instruction: stepBody,
                action,
                duration_sec: durationSec,
                key_points: '',
                reason: ''
            });
            continue;
        }

        // If in steps section and line is bulleted or plain
        if (currentSection === 'steps') {
            const cleanStep = line.replace(/^[•\-*]\s*/, '').trim();
            if (cleanStep) {
                steps.push({
                    order: steps.length + 1,
                    title: `ขั้นตอนที่ ${steps.length + 1}`,
                    instruction: cleanStep,
                    action: 'pour',
                    duration_sec: null,
                    key_points: '',
                    reason: ''
                });
            }
            continue;
        }

        // If in notes section
        if (currentSection === 'notes') {
            notesArr.push(line.replace(/^[•\-*]\s*/, ''));
            continue;
        }

        // 3. Otherwise, parse as Ingredient line
        // E.g.: "- ผงมัทฉะ 5 g" or "นมสด 120ml" or "ไซรัป 15 ml (หวานปกติ 15ml, หวานน้อย 7ml)"
        const cleanIngLine = line.replace(/^[•\-*+]\s*/, '').trim();
        if (!cleanIngLine) continue;

        // Try extracting ingredient name, quantity, and unit
        const ingMatch = cleanIngLine.match(/^([^\d]+?)\s*(\d+(?:\.\d+)?)\s*([a-zA-Zก-๙.]+)?(?:\s*\((.*)\))?$/);

        if (ingMatch) {
            const rawName = ingMatch[1].trim();
            const qty = parseFloat(ingMatch[2]) || 0;
            const rawUnit = (ingMatch[3] || '').trim();
            const remark = (ingMatch[4] || '').trim();

            const unit = UNIT_ALIASES[rawUnit.toLowerCase()] || rawUnit || 'ml';
            const isSweetener = SWEETENER_KEYWORDS.some(k => rawName.toLowerCase().includes(k));

            // Check if remark contains sweetness breakdown: "หวานปกติ 15, หวานน้อย 7.5, ไม่หวาน 0"
            if (remark && isSweetener) {
                const lessMatch = remark.match(/หวานน้อย\s*(?:[:=]?)\s*(\d+(?:\.\d+)?)/);
                const normalMatch = remark.match(/หวานปกติ\s*(?:[:=]?)\s*(\d+(?:\.\d+)?)/);
                const extraMatch = remark.match(/หวานมาก\s*(?:[:=]?)\s*(\d+(?:\.\d+)?)/);
                const noneMatch = remark.match(/ไม่หวาน\s*(?:[:=]?)\s*(\d+(?:\.\d+)?)/);

                if (lessMatch || normalMatch || extraMatch || noneMatch) {
                    sweetnessMatrix.mode = 'custom';
                    if (!sweetnessMatrix.levels[rawName]) sweetnessMatrix.levels[rawName] = {};
                    if (noneMatch) sweetnessMatrix.levels[rawName]['none'] = parseFloat(noneMatch[1]);
                    if (lessMatch) sweetnessMatrix.levels[rawName]['less'] = parseFloat(lessMatch[1]);
                    if (normalMatch) sweetnessMatrix.levels[rawName]['normal'] = parseFloat(normalMatch[1]);
                    if (extraMatch) sweetnessMatrix.levels[rawName]['extra'] = parseFloat(extraMatch[1]);
                }
            }

            ingredients.push({
                name: rawName,
                qty,
                unit,
                scalable: true,
                is_sweetener: isSweetener,
                remark: remark || ''
            });
        } else {
            // Line doesn't follow strict qty pattern
            const isSweetener = SWEETENER_KEYWORDS.some(k => cleanIngLine.toLowerCase().includes(k));
            ingredients.push({
                name: cleanIngLine,
                qty: 1,
                unit: 'pcs',
                scalable: false,
                is_sweetener: isSweetener,
                remark: ''
            });
        }
    }

    const parsedMatrix = sweetnessMatrix.mode === 'custom' ? sweetnessMatrix : null;
    return {
        name: name || 'สูตรใหม่จากข้อความ',
        glassSizeOz,
        glass_size_oz: glassSizeOz,
        ingredients,
        steps: steps.length > 0 ? steps : [
            { order: 1, action: 'stir', title: 'ผสมส่วนผสม', instruction: 'ใส่ส่วนผสมทั้งหมดลงในแก้ว คนให้เข้ากัน', duration_sec: 15 }
        ],
        sweetnessMatrix: parsedMatrix,
        sweetness_matrix: parsedMatrix,
        notes: notesArr.join('\n')
    };
}
