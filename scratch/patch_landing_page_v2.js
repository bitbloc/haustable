import fs from 'fs';

const filePath = 'c:/Users/Ritha/inthehaus-booking/src/AdsLandingPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to Unix style for reliable string matches
content = content.replace(/\r\n/g, '\n');

// 1. Append custom styles to the <style> block
const styleCloseTag = '            `}</style>';
const customStyles = `                @media (max-width: 420px) {
                    .mobile-plate-right {
                        right: -5.5rem !important;
                        width: 8rem !important;
                    }
                    .mobile-plate-left {
                        left: -5.5rem !important;
                        width: 8rem !important;
                    }
                }\n`;

if (content.includes(styleCloseTag)) {
    content = content.replace(styleCloseTag, customStyles + styleCloseTag);
    console.log("Successfully appended custom media query styles to the style tag.");
} else {
    console.log("Failed to find style close tag.");
}

// 2. Update activeTab initial logic to default to 'promo' if promoUrls exist
const activeTabTarget = `                if (regularUrls.length === 0 && promoUrls.length > 0) {
                    setActiveTab('promo');
                } else {
                    setActiveTab('regular');
                }`;

const activeTabReplacement = `                if (promoUrls.length > 0) {
                    setActiveTab('promo');
                } else {
                    setActiveTab('regular');
                }`;

if (content.includes(activeTabTarget)) {
    content = content.replace(activeTabTarget, activeTabReplacement);
    console.log("Successfully updated default activeTab selection in fetchData.");
} else {
    console.log("Failed to find activeTab target in fetchData.");
}

// 3. Remove duplicate booklet link
const duplicateBookletBlock = `                {/* ─── ORIGINAL BOOKLET LINK (Minimalist Text Link) ─── */}
                {(promoMenuImages.length > 0 || regularMenuImages.length > 0) && (
                    <div className="mt-8 text-center">
                        <button
                            onClick={() => {
                                setSelectedLightbox({
                                    type: 'booklet_slider',
                                    urls: activeTab === 'promo' ? promoMenuImages : regularMenuImages
                                });
                            }}
                            className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-950 font-black text-xs cursor-pointer group"
                        >
                            <span>ดูรูปเล่มเมนูฉบับดั้งเดิม (PDF)</span>
                            <span className="group-hover:translate-x-1 transition-transform">➔</span>
                        </button>
                    </div>
                )}\n\n                {/* ─── ORIGINAL BOOKLET LINK (Minimalist Text Link) ─── */}
                {(promoMenuImages.length > 0 || regularMenuImages.length > 0) && (
                    <div className="mt-8 text-center">
                        <button
                            onClick={() => {
                                setSelectedLightbox({
                                    type: 'booklet_slider',
                                    urls: activeTab === 'promo' ? promoMenuImages : regularMenuImages
                                });
                            }}
                            className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-950 font-black text-xs cursor-pointer group"
                        >
                            <span>ดูรูปเล่มเมนูฉบับดั้งเดิม (PDF)</span>
                            <span className="group-hover:translate-x-1 transition-transform">➔</span>
                        </button>
                    </div>
                )}`;

const singleBookletBlock = `                {/* ─── ORIGINAL BOOKLET LINK (Minimalist Text Link) ─── */}
                {(promoMenuImages.length > 0 || regularMenuImages.length > 0) && (
                    <div className="mt-8 text-center">
                        <button
                            onClick={() => {
                                setSelectedLightbox({
                                    type: 'booklet_slider',
                                    urls: activeTab === 'promo' ? promoMenuImages : regularMenuImages
                                });
                            }}
                            className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-950 font-black text-xs cursor-pointer group"
                        >
                            <span>ดูรูปเล่มเมนูฉบับดั้งเดิม (PDF)</span>
                            <span className="group-hover:translate-x-1 transition-transform">➔</span>
                        </button>
                    </div>
                )}`;

if (content.includes(duplicateBookletBlock)) {
    content = content.replace(duplicateBookletBlock, singleBookletBlock);
    console.log("Successfully removed duplicate booklet link.");
} else {
    // If it's separated by different whitespace/lines, do a fallback replace:
    console.log("Failed to find exact duplicate booklet block. Let's do fallback replace.");
    const parts = content.split('                {/* ─── ORIGINAL BOOKLET LINK (Minimalist Text Link) ─── */}');
    if (parts.length > 2) {
        // We have duplicates! Let's reconstruct by dropping one of them.
        // We keep first, second is at index 2.
        // Let's replace the first duplicate block manually.
        console.log("Detected " + (parts.length - 1) + " occurrences. Cleaning up...");
        // Reconstruct content by removing the duplicate part
        content = parts[0] + '                {/* ─── ORIGINAL BOOKLET LINK (Minimalist Text Link) ─── */}' + parts[1] + parts.slice(2).join('').replace(/^\s*\n/, '');
        console.log("Cleaned up duplicates via splitting.");
    }
}

// 4. Update aspect ratio of booklet modal to 4:5
const aspectTarget = 'relative w-full aspect-[3/4] rounded-xl overflow-hidden shadow-inner border border-neutral-200 bg-neutral-50 cursor-grab active:cursor-grabbing';
const aspectReplacement = 'relative w-full aspect-[4/5] rounded-xl overflow-hidden shadow-inner border border-neutral-200 bg-neutral-50 cursor-grab active:cursor-grabbing';
if (content.includes(aspectTarget)) {
    content = content.replace(aspectTarget, aspectReplacement);
    console.log("Successfully updated booklet aspect ratio to 4:5.");
} else {
    console.log("Failed to find booklet aspect ratio target.");
}

// 5. Remove the food-pouring-curry.webp plates (both mobile and desktop)
const desktopPouringPlate = '            <FloatingPlate src="/assets/food-pouring-curry.webp" alt="ราดแกงเขียวหวาน" top="76%" right="calc(50% - 330px)" size="w-52 lg:w-64" delay={0.4} />\n';
if (content.includes(desktopPouringPlate)) {
    content = content.replace(desktopPouringPlate, '');
    console.log("Successfully removed desktop pouring curry plate.");
} else {
    console.log("Failed to find desktop pouring curry plate.");
}

const mobilePouringPlate = '            <FloatingPlate src="/assets/food-pouring-curry.webp" alt="ราดแกงเขียวหวาน" top="28%" left="-5rem" size="w-40" delay={1.5} isMobile opacity={0.85} hasSteam />\n';
if (content.includes(mobilePouringPlate)) {
    content = content.replace(mobilePouringPlate, '');
    console.log("Successfully removed mobile pouring curry plate.");
} else {
    console.log("Failed to find mobile pouring curry plate.");
}

// 6. Update remaining mobile plates classes to include mobile-plate-right/left
const mobilePlate1Target = '<FloatingPlate src="/assets/food-green-curry.webp" alt="แกงเขียวหวาน" top="8%" right="-4.5rem" size="w-36" delay={0} isMobile opacity={0.85} />';
const mobilePlate1Replacement = '<FloatingPlate src="/assets/food-green-curry.webp" alt="แกงเขียวหวาน" top="8%" right="-4.5rem" size="w-36" delay={0} isMobile opacity={0.85} className="mobile-plate-right" />';

const mobilePlate2Target = '<FloatingPlate src="/assets/food-pork-belly.webp" alt="หมูสามชั้นย่าง" top="48%" right="-4.5rem" size="w-36" delay={0.8} isMobile opacity={0.85} hasSteam />';
const mobilePlate2Replacement = '<FloatingPlate src="/assets/food-pork-belly.webp" alt="หมูสามชั้นย่าง" top="48%" right="-4.5rem" size="w-36" delay={0.8} isMobile opacity={0.85} hasSteam className="mobile-plate-right" />';

const mobilePlate3Target = '<FloatingPlate src="/assets/food-chicken-curry.webp" alt="มัสนั่นไก่" top="68%" left="-4.5rem" size="w-40" delay={2.2} isMobile opacity={0.85} hasSteam />';
const mobilePlate3Replacement = '<FloatingPlate src="/assets/food-chicken-curry.webp" alt="มัสนั่นไก่" top="68%" left="-4.5rem" size="w-40" delay={2.2} isMobile opacity={0.85} hasSteam className="mobile-plate-left" />';

if (content.includes(mobilePlate1Target)) {
    content = content.replace(mobilePlate1Target, mobilePlate1Replacement);
    console.log("Updated mobile plate 1 to use mobile-plate-right.");
}
if (content.includes(mobilePlate2Target)) {
    content = content.replace(mobilePlate2Target, mobilePlate2Replacement);
    console.log("Updated mobile plate 2 to use mobile-plate-right.");
}
if (content.includes(mobilePlate3Target)) {
    content = content.replace(mobilePlate3Target, mobilePlate3Replacement);
    console.log("Updated mobile plate 3 to use mobile-plate-left.");
}

// 7. Update FloatingPlate component to support className prop
const componentSignatureTarget = 'function FloatingPlate({ src, alt, top, left, right, size = "w-36", delay = 0, hasSteam = false, isMobile = false, opacity = 1 }) {\n' +
    '    return (\n' +
    '        <motion.div\n' +
    '            initial={{ opacity: 0, scale: 0.8 }}\n' +
    '            whileInView={{ opacity: opacity, scale: 1 }}\n' +
    '            viewport={{ once: true, margin: "-50px" }}\n' +
    '            transition={{ duration: 0.8, delay }}\n' +
    '            style={{ top, left, right }}\n' +
    '            className={`absolute pointer-events-none select-none z-20 ${size} ${isMobile ? \'md:hidden\' : \'hidden md:block\'}`}\n' +
    '        >';

const componentSignatureReplacement = 'function FloatingPlate({ src, alt, top, left, right, size = "w-36", delay = 0, hasSteam = false, isMobile = false, opacity = 1, className = "" }) {\n' +
    '    return (\n' +
    '        <motion.div\n' +
    '            initial={{ opacity: 0, scale: 0.8 }}\n' +
    '            whileInView={{ opacity: opacity, scale: 1 }}\n' +
    '            viewport={{ once: true, margin: "-50px" }}\n' +
    '            transition={{ duration: 0.8, delay }}\n' +
    '            style={{ top, left, right }}\n' +
    '            className={`absolute pointer-events-none select-none z-20 ${size} ${isMobile ? \'md:hidden\' : \'hidden md:block\'} ${className}`}\n' +
    '        >';

if (content.includes(componentSignatureTarget)) {
    content = content.replace(componentSignatureTarget, componentSignatureReplacement);
    console.log("Successfully updated FloatingPlate component definition to accept className.");
} else {
    console.log("Failed to find FloatingPlate component definition target.");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done patching v2!");
