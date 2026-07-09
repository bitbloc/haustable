import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    Instagram, 
    Facebook, 
    MapPin, 
    Star, 
    ArrowLeft, 
    ExternalLink, 
    Filter, 
    MessageCircle, 
    Heart, 
    Compass,
    Navigation,
    Phone,
    Info
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import DraggableGrid from '../components/shared/DraggableGrid'

// Helper for image compression proxy (similar to AdsLandingPage)
const optimizeImageUrl = (url, width = 800, quality = 75) => {
    if (!url) return ''
    if (url.startsWith('data:') || url.startsWith('/') || !url.startsWith('http')) {
        return url
    }
    try {
        const cleanUrl = url.split('?')[0]
        return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=${width}&q=${quality}&output=webp`
    } catch (e) {
        console.warn('Image optimization failed:', e)
        return url
    }
}

// Fallback high-quality Unsplash dining/atmosphere images if Supabase settings are empty
const FALLBACK_STREAM_IMAGES = [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop", // Chef plating food
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=800&auto=format&fit=crop", // Dining tables atmosphere
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop", // Southern/spicy looking dish
    "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop", // Ribs/roast food close up
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=800&auto=format&fit=crop", // Pizza/spiced plate
    "https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=800&auto=format&fit=crop", // Restaurant lights/vibe
    "https://images.unsplash.com/photo-1559314809-0d155014e29e?q=80&w=800&auto=format&fit=crop", // People cheers glass
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=800&auto=format&fit=crop"  // Cafe serving/waiter
]

const SOCIAL_MOCK_DATA = [
    {
        id: 1,
        source: 'instagram',
        user: { name: 'Pimchaya T.', handle: '@pim.pimp', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
        text: 'แกงส้มใต้รสจัดจ้านสะใจมากค่าาา ทานคู่กับข้าวสวยร้อนๆ คือที่สุด! หรอยแรงนิ 🌶️🐟 ปล. ร้านแต่งสวยแนวลอฟต์ดิบๆ เท่มากกก @inthehaus.th',
        location: 'IN THE HAUS ในบ้าน นครพนม',
        date: '2 hours ago',
        likes: 142,
        comments: 18,
        url: 'https://instagram.com'
    },
    {
        id: 2,
        source: 'google',
        user: { name: 'Liam Anderson', handle: 'Google Local Guide', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
        text: 'Outstanding southern Thai food right next to the Mekong river. The fish curry is extremely spicy and delicious. Sleek retro industrial vibe with high-quality sound system. 5 stars.',
        rating: 5,
        location: 'IN THE HAUS ในบ้าน นครพนม',
        date: 'Yesterday',
        url: 'https://maps.google.com'
    },
    {
        id: 3,
        source: 'facebook',
        user: { name: 'Tachapon W.', handle: 'Facebook Check-in', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop' },
        text: 'ร้านอาหารใต้บรรยากาศดีริมน้ำโขงนครพนม แกงส้มใต้รสชาติเข้มข้นจัดจ้านสะใจ คอหมูย่างนุ่มอร่อย แนะนำเลยครับ เหมาะพาครอบครัวมาทานมาก 👍',
        location: 'IN THE HAUS - ในบ้าน',
        date: '2 days ago',
        likes: 54,
        url: 'https://facebook.com'
    },
    {
        id: 4,
        source: 'instagram',
        user: { name: 'Kavin.eat', handle: '@kavin.eatstory', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop' },
        text: 'Vibe ดีมากกกก นึกว่าอยู่บาร์ลับกรุงเทพ แต่จริงๆ คือริมโขงนครพนมจ้าาา อาหารรสชาติจัดจ้านจริตใต้แท้ๆ เลิฟเลยยย 🧡🍴 คั่วกลิ้งหมูสับห้ามพลาด!',
        location: 'IN THE HAUS ในบ้าน นครพนม',
        date: '3 days ago',
        likes: 310,
        comments: 29,
        url: 'https://instagram.com'
    },
    {
        id: 5,
        source: 'google',
        user: { name: 'Nattaporn S.', handle: 'Local Guide', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop' },
        text: 'อาหารรสชาติใต้แท้ๆ เผ็ดร้อนสะใจ บรรยากาศช่วงเย็นริมน้ำโขงดีมาก ลมพัดเย็นสบาย แนะนำแกงเหลืองกับคั่วกลิ้งครับ พนักงานบริการสุภาพดีมาก',
        rating: 5,
        location: 'IN THE HAUS ในบ้าน นครพนม',
        date: '4 days ago',
        url: 'https://maps.google.com'
    },
    {
        id: 6,
        source: 'facebook',
        user: { name: 'Saranya K.', handle: 'Facebook User', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop' },
        text: 'จริตจัด รสชัดเจน สมคำร่ำลือจริงๆ ค่ะ อร่อยทุกเมนูเลย โดยเฉพาะหมูฮ้อง ทานแก้เผ็ดจากแกงไตปลาได้ดีมาก บรรยากาศดี ดนตรีเพราะ 😍',
        location: 'IN THE HAUS - ในบ้าน',
        date: '1 week ago',
        likes: 88,
        url: 'https://facebook.com'
    },
    {
        id: 7,
        source: 'instagram',
        user: { name: 'new.journey', handle: '@new.journey.np', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&h=100&fit=crop' },
        text: 'Dinner by the Mekong river at IN THE HAUS. Bold flavors, gorgeous presentation, nice design tunes playing in the background. 10/10.',
        location: 'IN THE HAUS ในบ้าน นครพนม',
        date: '1 week ago',
        likes: 204,
        comments: 11,
        url: 'https://instagram.com'
    },
    {
        id: 8,
        source: 'google',
        user: { name: 'Winston Tan', handle: 'Reviewer', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop' },
        text: 'A surprise find in Nakhon Phanom! Authentic southern food, beautifully designed interior with mid-century details. Clean toilet, cool design elements everywhere.',
        rating: 5,
        location: 'IN THE HAUS ในบ้าน นครพนม',
        date: '2 weeks ago',
        url: 'https://maps.google.com'
    }
]

const getProxiedImageUrl = (url) => {
    if (!url) return ''
    if (
        url.startsWith('/') || 
        url.startsWith('data:') || 
        url.includes('images.weserv.nl') || 
        url.includes('wsrv.nl') || 
        url.includes('supabase.co')
    ) {
        return url
    }
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`
}

// Generic parser for third-party widget JSON feeds (Elfsight, EmbedSocial, Outscraper, Custom JSON)
const parseSocialFeed = (feedData) => {
    let rawItems = []
    if (Array.isArray(feedData)) {
        rawItems = feedData
    } else if (feedData.posts && Array.isArray(feedData.posts)) {
        rawItems = feedData.posts
    } else if (feedData.data && Array.isArray(feedData.data)) {
        rawItems = feedData.data
    } else if (feedData.items && Array.isArray(feedData.items)) {
        rawItems = feedData.items
    }

    return rawItems.map((item, index) => {
        const rawSource = (item.source || item.platform || item.type || '').toLowerCase()
        let source = 'instagram'
        if (rawSource.includes('fb') || rawSource.includes('facebook')) source = 'facebook'
        if (rawSource.includes('google') || rawSource.includes('maps') || rawSource.includes('review') || rawSource.includes('star')) source = 'google'

        const name = item.user_name || item.author_name || item.user?.name || item.author?.name || 'Customer'
        const handle = item.user_handle || item.author_handle || item.user?.username || item.author?.username || (source === 'google' ? 'Google Reviewer' : '')
        const avatar = item.user_avatar || item.author_avatar || item.user?.avatar || item.author?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'
        const text = item.text || item.caption || item.message || item.content || ''
        const image_url = item.image_url || item.media_url || item.image || item.media || ''
        const post_url = item.post_url || item.link || item.url || ''
        const rating = item.rating || item.stars || item.score || null

        // Format date dynamically if possible
        let dateText = 'Recently'
        const rawDate = item.date || item.created_at || item.timestamp
        if (rawDate) {
            try {
                dateText = new Date(rawDate).toLocaleDateString('th-TH', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                })
            } catch (e) {
                dateText = String(rawDate)
            }
        }

        return {
            id: item.id || index,
            source,
            user: { name, handle, avatar },
            text,
            rating: rating ? parseInt(rating) : null,
            location: item.location || 'IN THE HAUS ในบ้าน นครพนม',
            date: dateText,
            likes: parseInt(item.likes || item.likes_count || 0),
            comments: parseInt(item.comments || item.comments_count || 0),
            image_url,
            url: post_url
        }
    }).filter(item => item.image_url) // Filter out items with no images
}

export default function HausCheckinPage() {
    const [settings, setSettings] = useState({})
    const [streamImages, setStreamImages] = useState([])
    const [dbCheckins, setDbCheckins] = useState([])
    const [feedCheckins, setFeedCheckins] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'instagram' | 'facebook' | 'google'
    const [selectedItem, setSelectedItem] = useState(null)

    useEffect(() => {
        const fetchSettingsAndImages = async () => {
            try {
                // Fetch restaurant app settings from Supabase
                const { data } = await supabase
                    .from('app_settings')
                    .select('*')
                    .like('key', 'link_%')

                let map = {}
                if (data) {
                    map = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {})
                    setSettings(map)

                    // Collect all active images in settings
                    const images = []
                    
                    // Atmosphere pictures
                    for (let i = 1; i <= 10; i++) {
                        if (map[`link_atm_${i}`]) {
                            images.push(map[`link_atm_${i}`])
                        }
                    }
                    
                    // Menu booklet pictures
                    for (let i = 1; i <= 10; i++) {
                        if (map[`link_menu_${i}`]) {
                            images.push(map[`link_menu_${i}`])
                        }
                    }

                    // Signatures
                    for (let i = 1; i <= 3; i++) {
                        if (map[`link_sig_img_${i}`]) {
                            images.push(map[`link_sig_img_${i}`])
                        }
                    }

                    if (map.link_hero_url) {
                        images.push(map.link_hero_url)
                    }

                    // Remove duplicates and filter empty
                    const uniqueImages = [...new Set(images)].filter(Boolean)
                    setStreamImages(uniqueImages)
                }

                // Progressive paginated fetching (50 rows per batch) to load 1000+ items fast
                const fetchDbCheckinsProgressively = async (offset = 0) => {
                    try {
                        const pageSize = 50
                        const { data: batch, error: checkinErr } = await supabase
                            .from('haus_checkins')
                            .select('*')
                            .eq('is_visible', true)
                            .order('created_at', { ascending: false })
                            .range(offset, offset + pageSize - 1)

                        if (!checkinErr && batch && batch.length > 0) {
                            setDbCheckins(prev => {
                                const existingIds = new Set(prev.map(x => x.id))
                                const merged = [...prev]
                                batch.forEach(item => {
                                    if (!existingIds.has(item.id)) {
                                        merged.push(item)
                                    }
                                })
                                return merged
                            })

                            // If we fetched a full page, schedule the next batch progressively in the background
                            if (batch.length === pageSize) {
                                setTimeout(() => {
                                    fetchDbCheckinsProgressively(offset + pageSize)
                                }, 800) // Delay slightly to prioritize page animations
                            }
                        }
                    } catch (dbErr) {
                        console.warn('haus_checkins table progressive fetch error:', dbErr)
                    }
                }

                fetchDbCheckinsProgressively(0)

                // Fetch third-party social feed (e.g. Elfsight, EmbedSocial widget data) if configured
                if (map.link_social_feed_url) {
                    try {
                        const response = await fetch(map.link_social_feed_url)
                        const feedData = await response.json()
                        const parsed = parseSocialFeed(feedData)
                        if (parsed && parsed.length > 0) {
                            setFeedCheckins(parsed)
                        }
                    } catch (feedErr) {
                        console.error('Failed to fetch third-party social feed:', feedErr)
                    }
                }

            } catch (err) {
                console.error('Failed to fetch check-in stream images:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchSettingsAndImages()
    }, [])

    // Prepare grid items with matched images
    const gridItems = useMemo(() => {
        // 1. If we have third-party feed check-ins, use them first (automates 100%)
        if (feedCheckins.length > 0) {
            return feedCheckins.map(item => ({
                ...item,
                image: {
                    src: optimizeImageUrl(item.image_url, 600),
                    alt: item.text
                }
            }))
        }

        // 2. Otherwise, if we have database check-ins, use them
        if (dbCheckins.length > 0) {
            return dbCheckins.map(item => {
                // Calculate display date format
                let displayDate = 'Recently'
                if (item.created_at) {
                    try {
                        displayDate = new Date(item.created_at).toLocaleDateString('th-TH', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                        })
                    } catch (e) {
                        displayDate = 'Recently'
                    }
                }
                return {
                    id: item.id,
                    source: item.source,
                    user: {
                        name: item.user_name,
                        handle: item.user_handle,
                        avatar: item.user_avatar
                    },
                    text: item.text,
                    rating: item.rating,
                    location: item.location,
                    date: displayDate,
                    likes: item.likes,
                    comments: item.comments,
                    url: item.post_url,
                    image: {
                        src: optimizeImageUrl(item.image_url, 600),
                        alt: item.text
                    }
                }
            })
        }

        // 3. Otherwise fallback to mock data
        const imagePool = streamImages.length > 0 ? streamImages : FALLBACK_STREAM_IMAGES
        return SOCIAL_MOCK_DATA.map((mockItem, index) => {
            const imgUrl = imagePool[index % imagePool.length]
            return {
                ...mockItem,
                image: {
                    src: optimizeImageUrl(imgUrl, 600),
                    alt: mockItem.text
                }
            }
        })
    }, [feedCheckins, dbCheckins, streamImages])

    // Filter items based on selected tab
    const filteredItems = useMemo(() => {
        if (activeFilter === 'all') return gridItems
        return gridItems.filter(item => item.source === activeFilter)
    }, [gridItems, activeFilter])

    const shopName = settings.link_shop_name || 'IN THE HAUS'
    const shopNameTh = settings.link_shop_name_th || 'ในบ้าน'

    // SEO Dynamic Setup
    useEffect(() => {
        document.title = `HAUS Check-in Wall | ภาพลูกค้าเช็กอินและรีวิว ${shopNameTh}`
        const metaDesc = document.querySelector('meta[name="description"]')
        if (metaDesc) {
            metaDesc.setAttribute('content', `ชมภาพความประทับใจ การเช็กอิน และรีวิวร้าน ในบ้าน นครพนม จาก Instagram, Facebook และ Google Maps ร่วมแชร์ภาพของคุณด้วยการเช็กอินที่ร้านได้เลย`)
        }
    }, [shopNameTh])

    const handleItemClick = (item) => {
        setSelectedItem(item)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0e0f0a] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="haus-checkin-page w-screen h-screen bg-[#0e0f0a] text-neutral-100 font-sans relative overflow-hidden fixed inset-0">
            
            {/* Background noise grid for modern technical look */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,_transparent_1px),_linear-gradient(90deg,_rgba(255,255,255,0.012)_1px,_transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0" />
            
            {/* ─── IMMERSIVE FULLSCREEN GRID ─── */}
            <div className="w-full h-full relative z-10 overflow-hidden">
                {filteredItems.length > 0 ? (
                    <DraggableGrid 
                        items={filteredItems}
                        columns={14}
                        imageWidth={256}
                        imageHeight={320}
                        rounded={4}
                        gap={4}
                        enableWheel={true}
                        onItemClick={handleItemClick}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center font-mono">
                        <Compass className="w-8 h-8 text-[var(--color-brand)] animate-spin-slow" />
                        <p className="text-xs text-neutral-500 uppercase tracking-widest">No atmosphere posts found</p>
                    </div>
                )}
            </div>

            {/* ─── FLOATING OVERLAY: TOP LEFT BACK BUTTON ─── */}
            <div className="absolute top-4 left-4 z-40">
                <a
                    href="/link"
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                    title="BACK TO DIRECTORY"
                >
                    <ArrowLeft size={16} />
                </a>
            </div>

            {/* ─── FLOATING OVERLAY: TOP CENTER TITLE PILL ─── */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-md border border-neutral-800 px-4 py-2 rounded-full flex items-center gap-3 text-[10px] font-mono select-none shadow-lg whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-[var(--color-brand)] animate-pulse" />
                <span className="text-white font-extrabold tracking-wider uppercase">{shopName} STREAM</span>
                <span className="text-neutral-600">|</span>
                <span className="text-neutral-400 flex items-center gap-1 font-bold">4.9 <Star size={11} className="fill-[var(--color-brand)] text-[var(--color-brand)]" /></span>
                <span className="text-neutral-600">|</span>
                <span className="text-neutral-400 font-bold">1.2K+ POSTS</span>
            </div>

            {/* ─── FLOATING OVERLAY: BOTTOM CENTER PLATFORM FILTERS (Minimalist Pill) ─── */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-black/85 backdrop-blur-lg border border-neutral-800 p-1.5 rounded-full flex items-center gap-1 shadow-2xl">
                {[
                    { id: 'all', label: 'All', icon: <Compass size={11} /> },
                    { id: 'instagram', label: 'Instagram', icon: <Instagram size={11} /> },
                    { id: 'facebook', label: 'Facebook', icon: <Facebook size={11} /> },
                    { id: 'google', label: 'Google', icon: <Star size={11} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveFilter(tab.id)}
                        className={`px-3 py-2 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${activeFilter === tab.id ? 'bg-[var(--color-brand)] text-neutral-900' : 'text-neutral-400 hover:text-white bg-transparent hover:bg-neutral-900/60'}`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* ─── FLOATING OVERLAY: BOTTOM RIGHT JOIN PILL ─── */}
            <div className="absolute bottom-6 right-6 z-40 hidden md:flex items-center gap-2">
                <div className="bg-black/60 backdrop-blur-md border border-neutral-800 px-4 py-2.5 rounded-2xl text-[10px] text-neutral-400 max-w-[220px] text-right shadow-lg leading-relaxed">
                    <span className="block font-extrabold text-white uppercase tracking-wider text-[9px] mb-0.5">📸 ร่วมแชร์บรรยากาศ</span>
                    แท็ก <span className="text-white font-bold font-mono">@inthehaus.th</span> บน Instagram หรือเช็กอินที่ร้านเพื่อนำรูปขึ้นบอร์ดนี้!
                </div>
            </div>

            {/* ─── FLOATING OVERLAY: BOTTOM LEFT HELP MOUSE DRAG INDICATOR ─── */}
            <div className="absolute bottom-6 left-6 z-40 hidden lg:flex items-center gap-2 select-none pointer-events-none">
                <div className="bg-black/40 backdrop-blur-sm border border-neutral-800/60 px-3 py-1.5 rounded-full text-[9px] text-neutral-500 font-mono flex items-center gap-2 uppercase tracking-wider">
                    <span>🖱️ Click & Drag to explore</span>
                </div>
            </div>

            {/* ─── LIGHTBOX MODAL / DETAIL DRAWER ─── */}
            <AnimatePresence>
                {selectedItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedItem(null)}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 cursor-pointer select-none"
                    >
                        <motion.div
                            initial={{ scale: 0.96, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.96, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-3xl bg-[#0e0f0a] border border-neutral-850 rounded-sm overflow-hidden flex flex-col md:flex-row cursor-default shadow-2xl relative"
                        >
                            {/* Close button in modal */}
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="absolute top-4 right-4 w-8 h-8 rounded-sm bg-black/60 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center font-mono text-[10px] tracking-wide transition-all z-20 cursor-pointer"
                            >
                                [X]
                            </button>

                            {/* Image side */}
                            <div className="w-full md:w-1/2 aspect-square md:aspect-auto md:h-[480px] bg-neutral-950 relative border-b md:border-b-0 md:border-r border-neutral-800 flex items-center justify-center">
                                <img
                                    src={getProxiedImageUrl(selectedItem.image?.src)}
                                    alt={selectedItem.text}
                                    crossOrigin="anonymous"
                                    className="w-full h-full object-cover"
                                />
                                {/* Platform label Overlay */}
                                <div className="absolute bottom-4 left-4 z-10">
                                    {selectedItem.source === 'instagram' && (
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#E1306C] text-white rounded-sm font-mono text-[9px] font-bold uppercase tracking-wider">
                                            <Instagram size={10} /> INSTAGRAM
                                        </span>
                                    )}
                                    {selectedItem.source === 'facebook' && (
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1877F2] text-white rounded-sm font-mono text-[9px] font-bold uppercase tracking-wider">
                                            <Facebook size={10} /> FACEBOOK
                                        </span>
                                    )}
                                    {selectedItem.source === 'google' && (
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#4285F4] text-white rounded-sm font-mono text-[9px] font-bold uppercase tracking-wider">
                                            <Star size={10} className="fill-white" /> GOOGLE REVIEWS
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Details side */}
                            <div className="w-full md:w-1/2 p-6 flex flex-col justify-between md:h-[480px] bg-[#0e0f0a]">
                                <div className="space-y-5">
                                    
                                    {/* User Profile info */}
                                    <div className="flex items-center gap-3 pb-3 border-b border-neutral-900">
                                        <img
                                            src={getProxiedImageUrl(selectedItem.user.avatar)}
                                            alt={selectedItem.user.name}
                                            crossOrigin="anonymous"
                                            className="w-10 h-10 rounded-full object-cover border border-neutral-800"
                                        />
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-bold text-white tracking-tight uppercase">
                                                {selectedItem.user.name}
                                            </h4>
                                            <span className="text-[10px] font-mono text-neutral-500 block">
                                                {selectedItem.user.handle}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Location & Rating */}
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-1 text-[10px] font-mono text-[var(--color-brand)] font-semibold uppercase tracking-wider">
                                            <MapPin size={10} /> {selectedItem.location}
                                        </div>
                                        {selectedItem.rating && (
                                            <div className="flex gap-0.5">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        size={12}
                                                        className={i < selectedItem.rating ? 'fill-[var(--color-brand)] text-[var(--color-brand)]' : 'text-neutral-700'}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* User Text */}
                                    <p className="text-xs text-neutral-300 leading-relaxed font-sans font-medium whitespace-pre-line pr-2 overflow-y-auto max-h-[160px]">
                                        {selectedItem.text}
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-neutral-900 mt-4 space-y-4">
                                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                                        <span>POSTED: {selectedItem.date}</span>
                                        
                                        {/* Likes & Comments Counters */}
                                        {selectedItem.likes !== undefined && (
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center gap-1"><Heart size={10} className="text-[#E1306C] fill-[#E1306C]" /> {selectedItem.likes}</span>
                                                {selectedItem.comments !== undefined && (
                                                    <span className="flex items-center gap-1"><MessageCircle size={10} /> {selectedItem.comments}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Direct Action Link */}
                                    <a
                                        href={selectedItem.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-2.5 rounded-sm bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40 text-white font-mono text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <ExternalLink size={11} /> VIEW ORIGINAL POST
                                    </a>
                                </div>

                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Custom Embedded animations styling */}
            <style>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 15s linear infinite;
                }
            `}</style>

        </div>
    )
}
