import fs from 'fs';

const filePath = 'c:/Users/Ritha/inthehaus-booking/src/AdsLandingPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to Unix style for reliable string matches
content = content.replace(/\r\n/g, '\n');

// 1. Add showAllMenu state
const stateTarget = '    const [menuImageLoading, setMenuImageLoading] = useState(true);';
const stateReplacement = '    const [menuImageLoading, setMenuImageLoading] = useState(true);\n    const [showAllMenu, setShowAllMenu] = useState(false);';
if (content.includes(stateTarget)) {
    content = content.replace(stateTarget, stateReplacement);
    console.log("Successfully added showAllMenu state.");
} else {
    console.log("Failed to find state target.");
}

// 2. Change featuredMenuItems list logic to recommended items limit 15
const featuredTarget = '    // Limit featured items to exactly 9 items as requested\n    const featuredMenuItems = menuItems.slice(0, 9);';
const featuredReplacement = '    // Filter only recommended items for the initial presentation (10-15 items)\n    const featuredMenuItems = menuItems.filter(item => item.is_recommended).slice(0, 15);';
if (content.includes(featuredTarget)) {
    content = content.replace(featuredTarget, featuredReplacement);
    console.log("Successfully updated featuredMenuItems selection logic.");
} else {
    console.log("Failed to find featuredMenuItems selection target.");
}

// 3. Mobile Plates Opacities
content = content.replace(/opacity=\{0\.75\}/g, 'opacity={0.85}');
content = content.replace('tucked behind content cards for depth', 'overlapping content cards for depth');
console.log("Patched mobile plates config.");

// 4. Replacing the Booklet section + NATIVE FEATURED DISHES section with Signature Dishes + bold specialties + accordion
// Let's identify the start of MENU BOOKLET SECTION and end of NATIVE FEATURED DISHES section
const bookletStartToken = '                {/* ─── MENU BOOKLET SECTION (Original Images + Switching) ─── */}';
const nativeFeaturedEndToken = '                {featuredMenuItems.length > 0 && (\n' +
    '                    <section className="w-full mt-6 bg-white rounded-3xl p-5 border border-neutral-100 shadow-soft">\n' +
    '                        <div className="text-center mb-6 py-1.5 border-b border-dashed border-neutral-100">\n' +
    '                            <span className="bg-neutral-900 text-[#DFFF00] text-[10px] font-black tracking-[0.25em] uppercase px-3 py-1.5 rounded-full inline-block shadow-sm">\n' +
    '                                จริตจัด รสชัดเจน\n' +
    '                            </span>\n' +
    '                            <h2 className="text-neutral-600 text-[10px] font-black tracking-[0.2em] font-mono uppercase mt-3">Featured Specialties</h2>\n' +
    '                        </div>\n' +
    '\n' +
    '                        <div className="space-y-4">\n' +
    '                            {featuredMenuItems.map((item, idx) => (\n' +
    '                                <MenuListItem key={item.id} item={item} index={idx} onImageClick={(url) => setSelectedLightbox({ type: \'menu\', url })} />\n' +
    '                            ))}\n' +
    '                        </div>\n' +
    '                    </section>\n' +
    '                )}';

// Let's replace the whole range between bookletStartToken and nativeFeaturedEndToken with our restructured components.
const bookletStartIndex = content.indexOf(bookletStartToken);
const nativeFeaturedEndIndex = content.indexOf(nativeFeaturedEndToken);

if (bookletStartIndex !== -1 && nativeFeaturedEndIndex !== -1) {
    const originalBlock = content.substring(bookletStartIndex, nativeFeaturedEndIndex + nativeFeaturedEndToken.length);
    
    const replacementBlock = `                {/* ─── FEATURED SIGNATURE DISHES (Pop-Culture Style at Top) ─── */}
                {signatures.length > 0 && (
                    <section className="w-full mt-6 bg-white rounded-3xl p-5 border-2 border-neutral-900 shadow-[6px_6px_0px_#111111] relative z-10">
                        <div className="text-center mb-6 py-1.5 border-b-2 border-neutral-900 relative">
                            {/* Sticker style tag for signature dishes */}
                            <span className="bg-[#FF453A] text-white text-xs font-black tracking-wide px-4 py-2 border-2 border-neutral-900 inline-block shadow-[3px_3px_0px_#111111] transform -rotate-2 select-none rounded-md">
                                ★ เมนูแนะนำเด็ดห้ามพลาด ★
                            </span>
                            <h2 className="text-neutral-950 text-[11px] font-black tracking-[0.2em] font-mono uppercase mt-4">Signature Dishes</h2>
                        </div>

                        <div className={\`grid gap-4 \${signatures.length === 1 ? 'grid-cols-1' : signatures.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}\`}>
                            {signatures.map((dish, i) => (
                                <SignatureDishCard key={i} dish={dish} index={i} />
                            ))}
                        </div>
                    </section>
                )}

                {/* ─── NATIVE FEATURED DISHES (10-15 Recommended Items) ─── */}
                {featuredMenuItems.length > 0 && (
                    <section className="w-full mt-6 bg-white rounded-3xl p-5 border-2 border-neutral-900 shadow-[6px_6px_0px_#111111] relative z-10">
                        <div className="text-center mb-6 py-1.5 border-b-2 border-neutral-900 relative">
                            {/* Yellow Category Tag styled as sticker */}
                            <span className="bg-[#DFFF00] text-neutral-900 text-xs font-black tracking-wide px-4.5 py-2 border-2 border-neutral-900 inline-block shadow-[4px_4px_0px_#111111] transform -rotate-3 select-none rounded-md hover:rotate-0 transition-transform">
                                ✦ เมนูยอดฮิตจริตจัด รสชัดเจน ✦
                            </span>
                            <h2 className="text-neutral-950 text-[11px] font-black tracking-[0.2em] font-mono uppercase mt-4">Featured Specialties</h2>
                        </div>

                        <div className="space-y-4">
                            {featuredMenuItems.map((item, idx) => (
                                <MenuListItem key={item.id} item={item} index={idx} onImageClick={(url) => setSelectedLightbox({ type: 'menu', url })} />
                            ))}
                        </div>

                        {/* Accordion CTA Button */}
                        <div className="mt-6 text-center pt-4 border-t-2 border-dashed border-neutral-200">
                            <button
                                onClick={() => setShowAllMenu(!showAllMenu)}
                                className="inline-flex items-center gap-2 px-6 py-3.5 bg-neutral-900 text-white rounded-2xl hover:bg-neutral-800 border-2 border-neutral-900 shadow-[4px_4px_0px_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-xs font-black cursor-pointer"
                            >
                                <span>{showAllMenu ? "▲ ปิดเมนูทั้งหมด" : "▼ ดูเมนูทั้งหมด (80+ รายการ)"}</span>
                            </button>
                        </div>
                    </section>
                )}

                {/* ─── FULL MENU ACCORDION CONTENT ─── */}
                <AnimatePresence>
                    {showAllMenu && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                            className="w-full mt-4 space-y-6 overflow-hidden relative z-10"
                        >
                            {menuCategories.map((category) => {
                                // Get items in this category
                                const categoryItems = menuItems.filter(item => item.category_id === category.id);
                                if (categoryItems.length === 0) return null;

                                return (
                                    <div key={category.id} className="bg-white rounded-3xl p-5 border-2 border-neutral-900 shadow-[6px_6px_0px_#111111]">
                                        <div className="mb-4 pb-2 border-b-2 border-neutral-900 flex justify-between items-center relative">
                                            {/* Sticker Badge style category tag */}
                                            <span className="bg-[#DFFF00] text-neutral-900 text-xs font-black tracking-wide px-3.5 py-2 border-2 border-neutral-900 inline-block transform -rotate-2 select-none shadow-[3px_3px_0px_#111111] rounded-md">
                                                ★ {category.name}
                                            </span>
                                            <span className="text-[10px] font-black text-neutral-500 font-mono">
                                                {categoryItems.length} รายการ
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            {categoryItems.map((item, idx) => (
                                                <MenuListItem key={item.id} item={item} index={idx} onImageClick={(url) => setSelectedLightbox({ type: 'menu', url })} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>`;

    content = content.substring(0, bookletStartIndex) + replacementBlock + content.substring(nativeFeaturedEndIndex + nativeFeaturedEndToken.length);
    console.log("Successfully replaced Booklet + Native Featured sections with Signature + Specialties + Accordion.");
} else {
    console.log("Failed to find Booklet/Native Featured section indices.");
}

// 5. Add new minimalist Booklet link above tags section
const tagsLandmark = '                {/* ─── TAGS ─── */}';
const newBookletLink = `                {/* ─── ORIGINAL BOOKLET LINK (Minimalist Text Link) ─── */}
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
                )}\n\n`;

if (content.includes(tagsLandmark)) {
    content = content.replace(tagsLandmark, newBookletLink + tagsLandmark);
    console.log("Added minimalist booklet link above tags");
} else {
    console.log("Failed to find TAGS landmark to insert booklet link.");
}

// 6. Lightbox component replacement to handle zoomable booklet slider inside modal
const oldLightboxTarget = `            {/* ─── SIMPLE LIGHTBOX ─── */}
            <AnimatePresence>
                {selectedLightbox && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-pointer select-none"
                        onClick={() => setSelectedLightbox(null)}
                    >
                        <button
                            onClick={() => setSelectedLightbox(null)}
                            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 transition-colors rounded-full flex items-center justify-center text-white backdrop-blur-md cursor-pointer text-lg font-bold"
                        >
                            ✕
                        </button>
                        <motion.img
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            src={optimizeImageUrl(selectedLightbox.url, 1200)}
                            alt="Zoomed View"
                            className="max-w-full max-h-[85vh] object-contain rounded-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>`;

const newLightboxReplacement = `            {/* ─── SIMPLE LIGHTBOX ─── */}
            <AnimatePresence>
                {selectedLightbox && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 cursor-pointer select-none overflow-y-auto"
                        onClick={() => setSelectedLightbox(null)}
                    >
                        <button
                            onClick={() => setSelectedLightbox(null)}
                            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 transition-colors rounded-full flex items-center justify-center text-white backdrop-blur-md cursor-pointer text-lg font-bold z-50 animate-pulse"
                        >
                            ✕
                        </button>

                        {selectedLightbox.type === 'booklet_slider' ? (
                            <div 
                                className="w-full max-w-lg bg-white rounded-3xl p-5 border-2 border-neutral-900 shadow-2xl flex flex-col items-center z-40 relative my-8" 
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="text-center mb-4 pb-2 border-b-2 border-neutral-900 w-full">
                                    <span className="bg-[#DFFF00] text-neutral-900 text-[10px] font-black tracking-[0.25em] uppercase px-3 py-1.5 rounded-full inline-block border-2 border-neutral-900">
                                        เล่มเมนูดั้งเดิม
                                    </span>
                                </div>

                                {/* Tab Switcher inside Modal */}
                                <div className="flex gap-2 p-1 bg-neutral-100 rounded-2xl mb-4 w-full text-xs font-bold border border-neutral-200/40">
                                    {regularMenuImages.length > 0 && (
                                        <button
                                            onClick={() => {
                                                setActiveTab('regular');
                                                setActiveMenuIndex(0);
                                                setMenuImageLoading(true);
                                            }}
                                            className={\`flex-1 py-2.5 px-4 rounded-xl text-center transition-all cursor-pointer font-black \${activeTab === 'regular' ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200' : 'text-neutral-500 hover:text-neutral-900'}\`}
                                        >
                                            📖 เมนูหลัก
                                        </button>
                                    )}
                                    {promoMenuImages.length > 0 && (
                                        <button
                                            onClick={() => {
                                                setActiveTab('promo');
                                                setActiveMenuIndex(0);
                                                setMenuImageLoading(true);
                                            }}
                                            className={\`flex-1 py-2.5 px-4 rounded-xl text-center transition-all cursor-pointer font-black \${activeTab === 'promo' ? 'bg-red-50 text-red-600 shadow-sm border border-red-100/50' : 'text-neutral-500 hover:text-red-600'}\`}
                                        >
                                            🔥 โปรโมชั่น
                                        </button>
                                    )}
                                </div>

                                {/* Slider Component */}
                                {(() => {
                                    const currentImages = activeTab === 'promo' ? promoMenuImages : regularMenuImages;
                                    if (currentImages.length === 0) return null;
                                    const activeUrl = currentImages[activeMenuIndex];

                                    return (
                                        <div className="w-full flex flex-col items-center">
                                            <TransformWrapper
                                                key={\`\${activeTab}-\${activeMenuIndex}-\${activeUrl}\`}
                                                initialScale={1}
                                                minScale={1}
                                                maxScale={4}
                                                centerOnInit={true}
                                            >
                                                {({ zoomIn, zoomOut, resetTransform }) => (
                                                    <div className="w-full flex flex-col items-center">
                                                        <div className="flex items-center justify-between w-full mb-3 px-1 text-neutral-600 bg-neutral-100 p-1 rounded-xl border border-neutral-200 shadow-sm">
                                                            <div className="flex items-center gap-1">
                                                                <button type="button" onClick={() => zoomIn()} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white text-neutral-800 transition-all cursor-pointer"><ZoomIn size={14} /></button>
                                                                <button type="button" onClick={() => zoomOut()} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white text-neutral-800 transition-all cursor-pointer"><ZoomOut size={14} /></button>
                                                                <button type="button" onClick={() => resetTransform()} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white text-neutral-800 transition-all cursor-pointer"><RefreshCw size={11} /></button>
                                                            </div>
                                                            <span className="text-[10px] font-black text-neutral-600 font-mono px-2">
                                                                หน้า \${activeMenuIndex + 1} / \${currentImages.length}
                                                            </span>
                                                        </div>

                                                        <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden shadow-inner border border-neutral-200 bg-neutral-50 cursor-grab active:cursor-grabbing">
                                                            {menuImageLoading && (
                                                                <div className="absolute inset-0 bg-neutral-100 animate-pulse flex items-center justify-center">
                                                                    <div className="w-6 h-6 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                                                                </div>
                                                            )}
                                                            <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full flex items-center justify-center">
                                                                  <img
                                                                      src={optimizeImageUrl(activeUrl, 900)}
                                                                      alt={\`Menu Page \${activeMenuIndex + 1}\`}
                                                                      onLoad={() => setMenuImageLoading(false)}
                                                                      className={\`w-full h-full object-contain transition-opacity duration-300 \${menuImageLoading ? 'opacity-0' : 'opacity-100'}\`}
                                                                  />
                                                            </TransformComponent>
                                                        </div>
                                                    </div>
                                                )}
                                            </TransformWrapper>

                                            {/* Navigation Controls */}
                                            <div className="flex items-center justify-between w-full mt-4">
                                                <button
                                                    disabled={activeMenuIndex === 0}
                                                    onClick={() => {
                                                        setActiveMenuIndex(prev => Math.max(0, prev - 1));
                                                        setMenuImageLoading(true);
                                                    }}
                                                    className="w-9 h-9 rounded-full border border-neutral-300 flex items-center justify-center text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100 active:scale-95 transition-all cursor-pointer"
                                                >
                                                    <ChevronLeft size={18} />
                                                </button>
                                                
                                                <div className="flex gap-1.5 overflow-x-auto max-w-[180px] no-scrollbar py-1">
                                                    {currentImages.map((_, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => {
                                                                setActiveMenuIndex(i);
                                                                setMenuImageLoading(true);
                                                            }}
                                                            className={\`w-2 h-2 rounded-full transition-all flex-shrink-0 \${activeMenuIndex === i ? 'bg-neutral-900 scale-110' : 'bg-neutral-300 opacity-40 hover:opacity-100'}\`}
                                                        />
                                                    ))}
                                                </div>

                                                <button
                                                    disabled={activeMenuIndex === currentImages.length - 1}
                                                    onClick={() => {
                                                        setActiveMenuIndex(prev => Math.min(currentImages.length - 1, prev + 1));
                                                        setMenuImageLoading(true);
                                                    }}
                                                    className="w-9 h-9 rounded-full border border-neutral-300 flex items-center justify-center text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-100 active:scale-95 transition-all cursor-pointer"
                                                >
                                                    <ChevronRight size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <motion.img
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.9 }}
                                src={optimizeImageUrl(selectedLightbox.url, 1200)}
                                alt="Zoomed View"
                                className="max-w-full max-h-[85vh] object-contain rounded-2xl"
                                onClick={(e) => e.stopPropagation()}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>`;

if (content.includes(oldLightboxTarget)) {
    content = content.replace(oldLightboxTarget, newLightboxReplacement);
    console.log("Successfully replaced Lightbox component.");
} else {
    console.log("Failed to find Lightbox component target.");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("All clean-base patches completed!");
