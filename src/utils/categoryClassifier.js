/**
 * Category Classifier Utility for In The Haus POS & Financial Analytics
 * Designed adhering to Dieter Rams Minimalist & Thai Modern OKLCH color rules.
 */

export const MENU_CATEGORY_KEYS = {
    ALL: 'all',
    MAIN: 'main',
    SNACK: 'snack',
    SET: 'set',
    DESSERT: 'dessert',
    DRINK: 'drink',
    ALCOHOL: 'alcohol'
};

/**
 * Standardized Category Tabs configuration for UI & Infographics
 */
export const MENU_CATEGORY_TABS = [
    { id: 'all', label: 'ทั้งหมด (All)', shortLabel: 'ทั้งหมด', group: 'all' },
    { id: 'main', label: 'อาหารจานหลัก (Mains)', shortLabel: 'อาหารหลัก', group: 'kitchen' },
    { id: 'snack', label: 'ของทานเล่น (Snacks)', shortLabel: 'ของทานเล่น', group: 'kitchen' },
    { id: 'set', label: 'ชุดเซตสำรับ (Set Menus)', shortLabel: 'ชุดเซต', group: 'kitchen' },
    { id: 'dessert', label: 'ของหวาน (Desserts)', shortLabel: 'ของหวาน', group: 'kitchen' },
    { id: 'drink', label: 'เครื่องดื่ม (Beverages)', shortLabel: 'เครื่องดื่ม', group: 'bar' },
    { id: 'alcohol', label: 'แอลกอฮอล์ (Alcohol)', shortLabel: 'แอลกอฮอล์', group: 'bar' },
];

/**
 * Formats and normalizes category labels from database to clean human-readable Thai strings
 */
export function formatCategoryLabel(rawCategoryName = '') {
    const raw = String(rawCategoryName || '').trim();
    if (!raw) return 'ทั่วไป';

    const lower = raw.toLowerCase();

    // Fix legacy database typo "Alcahol"
    if (lower === 'alcahol' || lower === 'alcohol') {
        return 'แอลกอฮอล์ (Alcohol)';
    }
    // Fix Thai spelling typo "ของทานเล่นพร้อมเสริฟ์"
    if (lower.includes('เสริฟ์')) {
        return raw.replace('เสริฟ์', 'เสิร์ฟ');
    }

    return raw;
}

/**
 * Robust Category Classifier
 * Maps any database menu item or custom item into one of the 6 standard categories:
 * 'alcohol' | 'drink' | 'set' | 'dessert' | 'snack' | 'main'
 */
export function classifyMenuCategory(rawCategoryName = '', rawItemName = '') {
    const cat = String(rawCategoryName || '').toLowerCase().trim();
    const name = String(rawItemName || '').toLowerCase().trim();

    // 1. Alcohol & Beer (แอลกอฮอล์, เบียร์, คราฟต์เบียร์, ค็อกเทล, โปรเบียร์, เหล้า, ไวน์)
    if (
        cat.includes('alcahol') || cat.includes('alcohol') || cat.includes('แอลกอฮอล์') ||
        cat.includes('เบียร์') || cat.includes('beer') || cat.includes('เหล้า') ||
        cat.includes('สุรา') || cat.includes('craft') || cat.includes('pro ฉ่ำ') ||
        cat.includes('cocktail') || cat.includes('ค็อกเทล') || cat.includes('wine') || cat.includes('ไวน์') ||
        cat.includes('spirit') || cat.includes('whiskey') || cat.includes('whisky') ||
        name.includes('beer') || name.includes('เบียร์') || name.includes('budweiser') ||
        name.includes('singha') || name.includes('chang') || name.includes('heineken') ||
        name.includes('asahi') || name.includes('lager') || name.includes('ipa') ||
        name.includes('weizen') || name.includes('ale') || name.includes('เหล้า') ||
        name.includes('รีเจนซี่') || name.includes('regency') || name.includes('whisky') ||
        name.includes('whiskey') || name.includes('vodka') || name.includes('soju') ||
        name.includes('โซจู') || name.includes('highball') || name.includes('ไวน์') ||
        name.includes('cocktail') || name.includes('ค็อกเทล')
    ) {
        return MENU_CATEGORY_KEYS.ALCOHOL;
    }

    // 2. Non-Alcoholic Beverage (กาแฟ, ชา, น้ำอัดลม, เครื่องดื่มขวด, น้ำเปล่า, โซดา, ม็อกเทล)
    if (
        cat.includes('coffee') || cat.includes('กาแฟ') || cat.includes('soft drink') ||
        cat.includes('beverage') || cat.includes('เครื่องดื่ม') || cat.includes('ชา') ||
        cat.includes('tea') || cat.includes('bottled') || cat.includes('drink') ||
        cat.includes('mocktail') || cat.includes('ม็อกเทล') || cat.includes('juice') ||
        name.includes('กาแฟ') || name.includes('ชา') || name.includes('มัทฉะ') ||
        name.includes('matcha') || name.includes('ลาเต้') || name.includes('latte') ||
        name.includes('อเมริกาโน่') || name.includes('americano') || name.includes('เอสเพรสโซ่') ||
        name.includes('espresso') || name.includes('โกโก้') || name.includes('cocoa') ||
        name.includes('coffee') || name.includes('tea') || name.includes('soda') ||
        name.includes('โซดา') || name.includes('น้ำเปล่า') || name.includes('น้ำส้ม') ||
        name.includes('น้ำแร่') || name.includes('น้ำแข็ง') || name.includes('โออิชิ') ||
        name.includes('coke') || name.includes('โค้ก') || name.includes('sprite') ||
        name.includes('ชามะนาว') || name.includes('น้ำผึ้งมะนาว') || name.includes('น้ำผลไม้') ||
        name.includes('mocktail') || name.includes('ม็อกเทล')
    ) {
        return MENU_CATEGORY_KEYS.DRINK;
    }

    // 3. Set Menus / Combos (ชุดเซต, เซตสำรับ, ชุดจับคู่)
    if (
        cat.includes('set') || cat.includes('เซต') || cat.includes('ชุด') ||
        cat.includes('สำรับ') || cat.includes('combo') ||
        name.startsWith('set') || name.startsWith('ชุด') || name.includes('set size') ||
        name.includes('ชุดเซต') || name.includes('เซตสำรับ') || name.includes('เซ็ต') ||
        name.includes('ชุดจับคู่')
    ) {
        return MENU_CATEGORY_KEYS.SET;
    }

    // 4. Desserts (ของหวาน, เบเกอรี่, ไอศกรีม, ขนม)
    if (
        cat.includes('ของหวาน') || cat.includes('dessert') || cat.includes('ขนม') ||
        cat.includes('ไอศกรีม') || cat.includes('ice cream') || cat.includes('bakery') ||
        cat.includes('เบเกอรี่') ||
        name.includes('ไอศกรีม') || name.includes('ice cream') || name.includes('เค้ก') ||
        name.includes('cake') || name.includes('ขนมหวาน') || name.includes('บัวลอย') ||
        name.includes('พุดดิ้ง') || name.includes('toast') || name.includes('โทสต์') ||
        name.includes('วาฟเฟิล') || name.includes('waffle') || name.includes('ไอติม')
    ) {
        return MENU_CATEGORY_KEYS.DESSERT;
    }

    // 5. Snacks / Appetizers (ของทานเล่น, กับแกล้ม)
    if (
        cat.includes('ของทานเล่น') || cat.includes('appetizer') || cat.includes('snack') ||
        cat.includes('ทานเล่น') || cat.includes('กับแกล้ม') ||
        name.includes('ทาทากิ') || name.includes('tataki') || name.includes('ถั่วแระ') ||
        name.includes('เฟรนช์ฟราย') || name.includes('french fries') || name.includes('เกี๊ยว') ||
        name.includes('ปีกไก่ทอด') || name.includes('เอ็นไก่') || name.includes('คาราเกะ') ||
        name.includes('ลูกชิ้น') || name.includes('นักเก็ต') || name.includes('เอ็ดดามาเมะ')
    ) {
        return MENU_CATEGORY_KEYS.SNACK;
    }

    // 6. Main Dishes / Food (กับข้าว, จานเดียว, สปาเก็ตตี้, ข้าว, อาหารหลัก, ท็อปปิ้งเพิ่มเติม)
    return MENU_CATEGORY_KEYS.MAIN;
}
