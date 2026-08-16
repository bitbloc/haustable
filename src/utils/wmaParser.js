/**
 * Wongnai Merchant App (WMA) ESC/POS Order Parser for Frontend & Node
 * Decodes raw thermal printer byte streams (TIS-620 / UTF-8) and extracts structured LINE MAN orders.
 */

// Decode TIS-620 (CP874) buffer/Uint8Array to Unicode JavaScript String
export function decodeTis620(buffer) {
    let result = '';
    const len = buffer.length || buffer.byteLength || 0;
    for (let i = 0; i < len; i++) {
        const byte = buffer[i];
        if (byte >= 0xA1 && byte <= 0xFB) {
            // TIS-620 Thai character range (0xA1-0xFB -> 0x0E01-0x0E5B)
            result += String.fromCharCode(byte - 0xA0 + 0x0E00);
        } else if (byte < 0x80) {
            // Standard ASCII
            result += String.fromCharCode(byte);
        } else {
            result += ' ';
        }
    }
    return result;
}

// Strip ESC/POS control sequences from raw buffer/Uint8Array
export function stripEscPosCommands(buffer) {
    const cleanBytes = [];
    let i = 0;
    const len = buffer.length || buffer.byteLength || 0;
    while (i < len) {
        const byte = buffer[i];

        // ESC commands (0x1B)
        if (byte === 0x1B) {
            const next = buffer[i + 1];
            if (next === 0x40) { // ESC @
                i += 2; continue;
            } else if (next === 0x61 || next === 0x45 || next === 0x21 || next === 0x74 || next === 0x64 || next === 0x2D || next === 0x4D) {
                i += 3; continue;
            } else {
                i += 2; continue;
            }
        }

        // GS commands (0x1D)
        if (byte === 0x1D) {
            const next = buffer[i + 1];
            if (next === 0x21 || next === 0x42 || next === 0x72 || next === 0x4C || next === 0x57) {
                i += 3; continue;
            } else if (next === 0x56) {
                const m = buffer[i + 2];
                if (m === 65 || m === 66) {
                    i += 4; continue;
                } else {
                    i += 3; continue;
                }
            } else {
                i += 2; continue;
            }
        }

        // FS commands (0x1C)
        if (byte === 0x1C) {
            const next = buffer[i + 1];
            if (next === 0x2E) {
                i += 2; continue;
            } else if (next === 0x26 || next === 0x43) {
                i += 3; continue;
            } else {
                i += 2; continue;
            }
        }

        // DLE commands (0x10)
        if (byte === 0x10 && buffer[i + 1] === 0x14) {
            i += 5; continue;
        }

        cleanBytes.push(byte);
        i++;
    }
    return new Uint8Array(cleanBytes);
}

function countThaiChars(str) {
    if (!str) return 0;
    let count = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code >= 0x0E01 && code <= 0x0E5B) count++;
    }
    return count;
}

/**
 * Parses raw text extracted from WMA print stream into structured order object
 * @param {string} rawText 
 * @returns {object} structured order
 */
export function parseWmaOrderText(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    const order = {
        source: 'lineman',
        order_id: '',
        short_id: '',
        created_at: new Date().toISOString(),
        customer_name: 'LINE MAN Customer',
        customer_phone: '',
        customer_note: '',
        rider_name: '',
        items: [],
        total_amount: 0,
        subtotal: 0,
        delivery_discount: 0,
        payment_method: 'LINEMAN_PREPAID',
        raw_text: rawText
    };

    let currentItem = null;

    // Regex matchers
    const orderIdRegex = /(?:#|ORDER|ID|ออเดอร์|รหัสออเดอร์)[:\s]*([#A-Z0-9-]{4,})/i;
    const phoneRegex = /(?:โทร|เบอร์โทร|Phone|Tel)[:\s]*([0-9-]{9,12})/i;
    const customerRegex = /(?:ลูกค้า|Customer|คุณ)[:\s]*(.+)/i;
    const riderRegex = /(?:ไรเดอร์|Rider|คนขับ)[:\s]*(.+)/i;
    const noteRegex = /(?:หมายเหตุ|Note|ข้อความถึงร้าน)[:\s]*(.+)/i;
    const totalRegex = /(?:ยอดรวม|รวมทั้งสิ้น|รวมสุทธิ|Total|Grand\s*Total|ยอดชำระ)[:\s]*([0-9,]+\.?[0-9]*)/i;

    for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];

        // 1. Order ID
        if (!order.order_id) {
            const idMatch = line.match(orderIdRegex);
            if (idMatch && (idMatch[1].includes('LM') || idMatch[1].includes('-') || idMatch[1].length >= 4)) {
                order.order_id = idMatch[1].trim();
                order.short_id = order.order_id.replace(/^#?LM-?/i, '').slice(-4).toUpperCase();
            } else if (line.toUpperCase().includes('LM-') || line.toUpperCase().includes('LINEMAN-')) {
                const match = line.match(/(?:LM|LINEMAN)-[A-Z0-9]+/i);
                if (match) {
                    order.order_id = match[0].trim();
                    order.short_id = order.order_id.slice(-4).toUpperCase();
                }
            }
        }

        // 2. Customer Name & Phone
        if (customerRegex.test(line)) {
            const cMatch = line.match(customerRegex);
            if (cMatch && cMatch[1]) order.customer_name = cMatch[1].trim();
        }

        if (phoneRegex.test(line)) {
            const pMatch = line.match(phoneRegex);
            if (pMatch && pMatch[1]) order.customer_phone = pMatch[1].trim();
        }

        // 3. Rider Info
        if (riderRegex.test(line)) {
            const rMatch = line.match(riderRegex);
            if (rMatch && rMatch[1]) order.rider_name = rMatch[1].trim();
        }

        // 4. Special Note
        if (noteRegex.test(line)) {
            const nMatch = line.match(noteRegex);
            if (nMatch && nMatch[1]) order.customer_note = nMatch[1].trim();
        }

        // 5. Total Amount
        if (totalRegex.test(line)) {
            const tMatch = line.match(totalRegex);
            if (tMatch && tMatch[1]) {
                const parsedTotal = parseFloat(tMatch[1].replace(/,/g, ''));
                if (!isNaN(parsedTotal) && parsedTotal > 0) {
                    order.total_amount = parsedTotal;
                }
            }
        }

        // 6. Section divider / Items Detection
        const isDivider = /^[-=_*#]{3,}$/.test(line);
        if (isDivider) {
            if (currentItem) {
                order.items.push(currentItem);
                currentItem = null;
            }
            continue;
        }

        // Check if line represents an item line
        const itemLineRegex = /^(\d+)\s*(?:x|X|\*|\s)\s*(.+?)(?:\s+([\d,]+\.?\d*)\s*(?:บาท|.-|฿)?)?$/;
        const itemMatch = line.match(itemLineRegex);

        if (itemMatch && !totalRegex.test(line) && !customerRegex.test(line) && !phoneRegex.test(line) && !noteRegex.test(line)) {
            if (currentItem) {
                order.items.push(currentItem);
            }

            const qty = parseInt(itemMatch[1], 10) || 1;
            const name = itemMatch[2].trim();
            const price = itemMatch[3] ? parseFloat(itemMatch[3].replace(/,/g, '')) : 0;

            currentItem = {
                name: name,
                quantity: qty,
                price: price,
                price_at_time: qty > 0 && price > 0 ? (price / qty) : price,
                selected_options: [],
                special_instructions: ''
            };
            continue;
        }

        // Check if line represents an option / modifier
        if (currentItem) {
            const isOptionLine = line.startsWith('-') || line.startsWith('+') || line.startsWith('*') || line.startsWith('•') || line.startsWith('[') || line.startsWith('(');
            if (isOptionLine) {
                const optText = line.replace(/^[-+*•\s]+/, '').trim();
                currentItem.selected_options.push({ name: optText });
                continue;
            } else if (!totalRegex.test(line) && !customerRegex.test(line) && !phoneRegex.test(line) && !noteRegex.test(line)) {
                if (!currentItem.special_instructions) {
                    currentItem.special_instructions = line;
                } else {
                    currentItem.special_instructions += ` | ${line}`;
                }
            }
        }
    }

    if (currentItem) {
        order.items.push(currentItem);
    }

    if (order.total_amount === 0 && order.items.length > 0) {
        order.total_amount = order.items.reduce((sum, itm) => sum + (itm.price || (itm.price_at_time * itm.quantity) || 0), 0);
    }

    if (!order.order_id) {
        order.order_id = `LM-${Date.now().toString().slice(-6)}`;
        order.short_id = order.order_id.slice(-4);
    }

    return order;
}

/**
 * Main entrance to decode & parse raw buffer (Uint8Array or Buffer)
 * @param {Uint8Array|Buffer} rawBuffer 
 * @returns {object} parsed order
 */
export function decodeAndParseWmaBuffer(rawBuffer) {
    const stripped = stripEscPosCommands(rawBuffer);
    
    let utf8Text = '';
    let utf8HasErrors = false;
    try {
        if (typeof TextDecoder !== 'undefined') {
            utf8Text = new TextDecoder('utf-8').decode(stripped);
        } else {
            utf8Text = stripped.toString('utf8');
        }
        if (utf8Text.includes('\uFFFD')) {
            utf8HasErrors = true;
        }
    } catch (e) {
        utf8HasErrors = true;
    }

    const tisText = decodeTis620(stripped);
    const tisThaiCount = countThaiChars(tisText);
    const utf8ThaiCount = utf8HasErrors ? 0 : countThaiChars(utf8Text);

    const chosenText = (utf8ThaiCount > tisThaiCount && !utf8HasErrors) ? utf8Text : tisText;
    return parseWmaOrderText(chosenText);
}
