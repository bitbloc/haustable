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
    Info,
    Plus,
    X
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import BentoStreamGrid from '../components/shared/BentoStreamGrid'
import { toast } from 'sonner'

// Helper for image compression proxy (similar to AdsLandingPage)
const optimizeImageUrl = (url, width = 600, quality = 75) => {
    if (!url) return ''
    if (
        url.startsWith('data:') || 
        url.startsWith('/') || 
        !url.startsWith('http') ||
        url.includes('wsrv.nl') ||
        url.includes('images.weserv.nl')
    ) {
        return url
    }
    try {
        return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&q=${quality}&output=webp`
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
        user: { name: 'Pimchaya T.', handle: '@pim.pimp' },
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
        user: { name: 'Liam Anderson', handle: 'Google Local Guide' },
        text: 'Outstanding southern Thai food right next to the Mekong river. The fish curry is extremely spicy and delicious. Sleek retro industrial vibe with high-quality sound system. 5 stars.',
        rating: 5,
        location: 'IN THE HAUS ในบ้าน นครพนม',
        date: 'Yesterday',
        url: 'https://maps.google.com'
    },
    {
        id: 3,
        source: 'facebook',
        user: { name: 'Tachapon W.', handle: 'Facebook Check-in' },
        text: 'ร้านอาหารใต้บรรยากาศดีริมน้ำโขงนครพนม แกงส้มใต้รสชาติเข้มข้นจัดจ้านสะใจ คอหมูย่างนุ่มอร่อย แนะนำเลยครับ เหมาะพาครอบครัวมาทานมาก 👍',
        location: 'IN THE HAUS - ในบ้าน',
        date: '2 days ago',
        likes: 54,
        url: 'https://facebook.com'
    },
    {
        id: 4,
        source: 'instagram',
        user: { name: 'Kavin.eat', handle: '@kavin.eatstory' },
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
        user: { name: 'Nattaporn S.', handle: 'Local Guide' },
        text: 'อาหารรสชาติใต้แท้ๆ เผ็ดร้อนสะใจ บรรยากาศช่วงเย็นริมน้ำโขงดีมาก ลมพัดเย็นสบาย แนะนำแกงเหลืองกับคั่วกลิ้งครับ พนักงานบริการสุภาพดีมาก',
        rating: 5,
        location: 'IN THE HAUS ในบ้าน นครพนม',
        date: '4 days ago',
        url: 'https://maps.google.com'
    },
    {
        id: 6,
        source: 'facebook',
        user: { name: 'Saranya K.', handle: 'Facebook User' },
        text: 'จริตจัด รสชัดเจน สมคำร่ำลือจริงๆ ค่ะ อร่อยทุกเมนูเลย โดยเฉพาะหมูฮ้อง ทานแก้เผ็ดจากแกงไตปลาได้ดีมาก บรรยากาศดี ดนตรีเพราะ 😍',
        location: 'IN THE HAUS - ในบ้าน',
        date: '1 week ago',
        likes: 88,
        url: 'https://facebook.com'
    },
    {
        id: 7,
        source: 'instagram',
        user: { name: 'new.journey', handle: '@new.journey.np' },
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
        user: { name: 'Winston Tan', handle: 'Reviewer' },
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
        const avatar = item.user_avatar || item.author_avatar || item.user?.avatar || item.author?.avatar_url || ''
        const text = item.text || item.caption || item.message || item.content || ''
        const image_url = item.image_url || item.media_url || item.image || item.media || ''
        const post_url = item.post_url || item.link || item.url || ''
        const rating = item.rating || item.stars || item.score || null

        // Format date dynamically if possible
        let dateText = 'Recently'
        let timestamp = 0
        const rawDate = item.date || item.created_at || item.timestamp
        if (rawDate) {
            try {
                const parsedDate = new Date(rawDate)
                timestamp = parsedDate.getTime()
                dateText = parsedDate.toLocaleDateString('th-TH', { 
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
            timestamp,
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
    const [showAddTextModal, setShowAddTextModal] = useState(false)
    const [noteName, setNoteName] = useState('')
    const [noteText, setNoteText] = useState('')
    const [isSubmittingNote, setIsSubmittingNote] = useState(false)

    const handleNoteSubmit = async (e) => {
        if (e) e.preventDefault()
        if (!noteText.trim()) return

        setIsSubmittingNote(true)
        try {
            const { error } = await supabase
                .from('haus_checkins')
                .insert({
                    source: 'note',
                    user_name: noteName.trim() || 'GUEST',
                    text: noteText.trim(),
                    image_url: 'text_only',
                    is_visible: false // Requires admin approval!
                })

            if (error) throw error

            toast.success('ส่งข้อความเรียบร้อย! รอตรวจสอบจาก Admin ครับ 📝✨')
            setNoteName('')
            setNoteText('')
            setShowAddTextModal(false)
        } catch (err) {
            console.error('Failed to submit guest note:', err)
            toast.error('ล้มเหลวในการส่งข้อความ: ' + err.message)
        } finally {
            setIsSubmittingNote(false)
        }
    }

    const [likedIds, setLikedIds] = useState(() => {
        try {
            const stored = localStorage.getItem('haus_liked_checkins')
            return stored ? JSON.parse(stored) : []
        } catch {
            return []
        }
    })

    useEffect(() => {
        try {
            localStorage.setItem('haus_liked_checkins', JSON.stringify(likedIds))
        } catch (e) {
            console.error('Failed to save likes to localStorage:', e)
        }
    }, [likedIds])

    const handleLikeToggle = async (e, itemId) => {
        if (e) e.stopPropagation()
        if (!itemId) return

        const wasLiked = likedIds.includes(itemId)
        let nextLikedIds
        let diff = 0

        if (wasLiked) {
            nextLikedIds = likedIds.filter(id => id !== itemId)
            diff = -1
        } else {
            nextLikedIds = [...likedIds, itemId]
            diff = 1
        }

        setLikedIds(nextLikedIds)

        // Optimistically update lists and selected item
        setDbCheckins(prev => prev.map(item => {
            if (item.id === itemId) {
                return { ...item, likes: Math.max(0, (item.likes || 0) + diff) }
            }
            return item
        }))

        setFeedCheckins(prev => prev.map(item => {
            if (item.id === itemId) {
                return { ...item, likes: Math.max(0, (item.likes || 0) + diff) }
            }
            return item
        }))

        if (selectedItem && selectedItem.id === itemId) {
            setSelectedItem(prev => ({
                ...prev,
                likes: Math.max(0, (prev.likes || 0) + diff)
            }))
        }

        // Call Supabase RPC securely to adjust likes count
        try {
            const { data: newLikes, error } = await supabase.rpc('toggle_checkin_likes', {
                checkin_id: itemId,
                increment_by: diff
            })

            // If db returned updated likes, align our local state to it
            if (!error && typeof newLikes === 'number') {
                setDbCheckins(prev => prev.map(item => {
                    if (item.id === itemId) {
                        return { ...item, likes: newLikes }
                    }
                    return item
                }))
                if (selectedItem && selectedItem.id === itemId) {
                    setSelectedItem(prev => ({
                        ...prev,
                        likes: newLikes
                    }))
                }
            }
        } catch (err) {
            console.error('Failed to sync toggle likes to database:', err)
        }
    }

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

                // Single pass fetch for all active check-ins to prevent 800ms re-render loops
                try {
                    const { data: dbData, error: checkinErr } = await supabase
                        .from('haus_checkins')
                        .select('*')
                        .eq('is_visible', true)
                        .order('created_at', { ascending: false })
                        .limit(250)

                    if (!checkinErr && dbData) {
                        setDbCheckins(dbData)
                    }
                } catch (dbErr) {
                    console.warn('haus_checkins fetch error:', dbErr)
                }

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

    // Prepare grid items with matched images and combined sources
    const gridItems = useMemo(() => {
        const combined = []
        const existingUrls = new Set()

        // 1. Process database check-ins first (gives priority to guest notes and custom uploads)
        if (dbCheckins.length > 0) {
            dbCheckins.forEach(item => {
                let displayDate = 'Recently'
                let timestamp = 0
                if (item.created_at) {
                    try {
                        const parsedDate = new Date(item.created_at)
                        timestamp = parsedDate.getTime()
                        displayDate = parsedDate.toLocaleDateString('th-TH', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                        })
                    } catch (e) {
                        displayDate = 'Recently'
                    }
                }
                if (item.image_url && item.image_url !== 'text_only') {
                    existingUrls.add(item.image_url)
                }
                combined.push({
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
                    timestamp,
                    likes: item.likes,
                    comments: item.comments,
                    url: item.post_url,
                    image_url: item.image_url,
                    image: {
                        src: item.image_url === 'text_only' ? '' : optimizeImageUrl(item.image_url, 600),
                        alt: item.text || ''
                    }
                })
            })
        }

        // 2. Add feed check-ins that are not duplicates
        if (feedCheckins.length > 0) {
            feedCheckins.forEach(item => {
                if (!existingUrls.has(item.image_url)) {
                    combined.push({
                        ...item,
                        image_url: item.image_url,
                        image: {
                            src: optimizeImageUrl(item.image_url, 600),
                            alt: item.text || ''
                        }
                    })
                }
            })
        }

        // Sort combined chronologically (newest first)
        combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

        if (combined.length > 0) {
            return combined
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
            <div className="haus-checkin-page min-h-screen bg-[var(--color-paper,#FBF9F5)] relative overflow-x-hidden pt-[140px] md:pt-[112px] pb-24 px-4 md:px-6">
                {/* Structural Top Header Placeholder */}
                <div className="fixed top-0 left-0 right-0 z-40 flex flex-col w-full shadow-sm bg-[var(--color-paper,#FBF9F5)]">
                    <div className="w-full bg-[#E9F344] h-[32px] border-b border-[var(--color-rule,#E2DDD3)]"></div>
                    <div className="w-full h-[52px] border-b border-[var(--color-rule,#E2DDD3)]"></div>
                    <div className="w-full h-[44px] md:hidden border-b border-[var(--color-rule,#E2DDD3)] bg-[var(--color-paper-2,#F4F1EA)]"></div>
                </div>
                
                <div className="w-full max-w-[1600px] mx-auto mt-4">
                    <div className="grid grid-flow-dense grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 auto-rows-[280px]">
                        {[...Array(10)].map((_, i) => {
                            const pattern = i % 10;
                            let span = 'col-span-1 sm:col-span-1 md:col-span-1 row-span-1';
                            if (pattern === 0 || pattern === 5) span = 'col-span-1 sm:col-span-2 md:col-span-2 row-span-2';
                            else if (pattern === 3) span = 'col-span-1 sm:col-span-2 md:col-span-2 row-span-1';
                            return (
                                <div key={i} className={`bg-black/5 animate-pulse rounded-[28px] ${span}`} />
                            )
                        })}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="haus-checkin-page min-h-screen bg-[var(--color-paper,#FBF9F5)] text-[var(--color-ink,#23201D)] font-sans relative overflow-x-hidden">
            
            {/* Background noise grid for light modern technical look */}
            <div className="fixed inset-0 bg-[linear-gradient(rgba(35,32,29,0.025)_1px,_transparent_1px),_linear-gradient(90deg,_rgba(35,32,29,0.025)_1px,_transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0" />
            
            {/* ─── BENTO STREAM GRID ─── */}
            <div className="w-full relative z-10 pb-20">
                {filteredItems.length > 0 ? (
                    <BentoStreamGrid 
                        items={filteredItems}
                        onItemClick={handleItemClick}
                        likedIds={likedIds}
                        onLikeToggle={handleLikeToggle}
                    />
                ) : (
                    <div className="w-full h-screen flex flex-col items-center justify-center gap-2 text-center font-mono">
                        <p className="text-xs text-[var(--color-neutral,#888279)] uppercase tracking-widest font-bold border border-[var(--color-rule,#E2DDD3)] px-4 py-2 bg-[var(--color-paper-2,#F4F1EA)]">
                            NO ATMOSPHERE POSTS FOUND
                        </p>
                    </div>
                )}
            </div>

            {/* ─── STRUCTURAL TOP HEADER (TAB DESIGN) ─── */}
            <div className="fixed top-0 left-0 right-0 z-40 flex flex-col w-full select-none shadow-sm">
                {/* Yellow Marquee / Info Bar */}
                <div className="w-full bg-[#E9F344] text-[#23201D] flex items-center h-[32px] px-4 overflow-hidden whitespace-nowrap border-b border-[var(--color-rule,#E2DDD3)]">
                    <span className="font-mono text-[9px] font-extrabold tracking-widest uppercase truncate w-full text-center">
                        *** TAG @INTHEHAUS OR #INTHEHAUS TO JOIN THE STREAM ***
                    </span>
                </div>
                
                {/* Main Header Bar */}
                <header className="bg-[var(--color-paper,#FBF9F5)] border-b border-[var(--color-rule,#E2DDD3)] flex flex-col md:flex-row h-auto md:h-[52px]">
                    {/* Top Row on Mobile / Left on Desktop */}
                    <div className="flex h-[52px] w-full md:w-auto border-b md:border-b-0 border-[var(--color-rule,#E2DDD3)]">
                        {/* Logo / Back */}
                        <a href="/link" className="flex items-center justify-center px-4 md:px-8 border-r border-[var(--color-rule,#E2DDD3)] hover:bg-[var(--color-paper-2,#F4F1EA)] transition-colors cursor-pointer text-[var(--color-ink,#23201D)] flex-shrink-0">
                            <ArrowLeft size={16} className="mr-2 md:mr-3" />
                            <span className="font-mono text-[11px] md:text-[12px] font-extrabold tracking-widest uppercase">{shopName}</span>
                        </a>

                        {/* Mobile Spacer */}
                        <div className="flex-1 md:hidden"></div>

                        {/* Status (Desktop only) */}
                        <div className="hidden md:flex items-center justify-center px-6 border-l border-r border-[var(--color-rule,#E2DDD3)] flex-shrink-0 bg-[var(--color-paper,#FBF9F5)]">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-[var(--color-accent,#D85436)] rounded-full animate-pulse" />
                                <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--color-ink,#23201D)] uppercase">ONLINE</span>
                            </div>
                        </div>

                        {/* CTA (Mobile only, Desktop is at the end) */}
                        <button
                            onClick={() => setShowAddTextModal(true)}
                            className="md:hidden flex items-center justify-center px-6 bg-[var(--color-ink,#23201D)] text-[var(--color-paper,#FBF9F5)] hover:bg-black transition-colors font-mono text-[9px] font-extrabold tracking-widest uppercase cursor-pointer border-0 flex-shrink-0 border-l border-[var(--color-rule,#E2DDD3)]"
                        >
                            WRITE NOTE
                        </button>
                    </div>

                    {/* Filters as Tab Links (Bottom Row on Mobile, Center on Desktop) */}
                    <div className="flex-1 min-w-0 flex items-center overflow-x-auto overflow-y-hidden scrollbar-hide bg-[var(--color-paper-2,#F4F1EA)] touch-pan-x h-[44px] md:h-full">
                        {['all', 'instagram', 'facebook', 'google'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveFilter(tab)}
                                className={`h-full px-5 md:px-8 flex items-center justify-center font-mono text-[9px] md:text-[10px] font-bold tracking-widest uppercase border-r border-[var(--color-rule,#E2DDD3)] transition-colors hover:bg-[var(--color-paper,#FBF9F5)] cursor-pointer flex-shrink-0
                                ${activeFilter === tab ? 'text-[var(--color-ink,#23201D)] bg-[var(--color-paper,#FBF9F5)]' : 'text-[var(--color-neutral,#888279)] bg-transparent'}`}
                            >
                                {tab}
                            </button>
                        ))}
                        {/* Empty space filler */}
                        <div className="flex-1 min-w-[20px] h-full"></div>
                    </div>

                    {/* CTA (Desktop only) */}
                    <button
                        onClick={() => setShowAddTextModal(true)}
                        className="hidden md:flex items-center justify-center px-8 bg-[var(--color-ink,#23201D)] text-[var(--color-paper,#FBF9F5)] hover:bg-black transition-colors font-mono text-[10px] font-extrabold tracking-widest uppercase cursor-pointer border-0 flex-shrink-0"
                    >
                        WRITE NOTE
                    </button>
                </header>
            </div>

            {/* ─── ADD TEXT (POST-IT NOTE) MODAL ─── */}
            <AnimatePresence>
                {showAddTextModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-ink,#23201D)]/40 backdrop-blur-xs p-4"
                        onClick={() => setShowAddTextModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="w-full max-w-sm bg-[var(--color-paper,#FBF9F5)] border border-[var(--color-rule,#E2DDD3)] p-6 rounded-xs shadow-2xl relative text-[var(--color-ink,#23201D)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close button */}
                            <button
                                onClick={() => setShowAddTextModal(false)}
                                className="absolute top-4 right-4 text-[9px] font-mono font-bold hover:text-[var(--color-accent,#D85436)] cursor-pointer text-[var(--color-neutral,#888279)] border-0 bg-transparent outline-none p-1 tracking-wider"
                            >
                                [ CLOSE ]
                            </button>

                            {/* Header */}
                            <div className="border-b border-[var(--color-rule,#E2DDD3)] pb-3 mb-4">
                                <h3 className="font-mono text-[9px] font-extrabold uppercase tracking-widest text-[var(--color-neutral,#888279)]">
                                    // WRITE A NOTE / ฝากข้อความ
                                </h3>
                            </div>

                            <form onSubmit={handleNoteSubmit} className="space-y-4">
                                {/* Name Input */}
                                <div className="space-y-1">
                                    <label className="block font-mono text-[8px] uppercase tracking-wider text-[var(--color-neutral,#888279)] font-bold">
                                        Your Name (ชื่อของคุณ)
                                    </label>
                                    <input
                                        type="text"
                                        value={noteName}
                                        onChange={(e) => setNoteName(e.target.value)}
                                        placeholder="Guest"
                                        maxLength={25}
                                        className="w-full bg-[var(--color-paper-2,#F4F1EA)] border border-[var(--color-rule,#E2DDD3)] p-2.5 rounded-xs font-mono text-xs text-[var(--color-ink,#23201D)] focus:border-[var(--color-neutral,#888279)] outline-none transition-colors"
                                    />
                                </div>

                                {/* Message Input */}
                                <div className="space-y-1">
                                    <label className="block font-mono text-[8px] uppercase tracking-wider text-[var(--color-neutral,#888279)] font-bold">
                                        Your Message (ข้อความของคุณ) *
                                    </label>
                                    <textarea
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        placeholder="พิมพ์ข้อความของคุณที่นี่..."
                                        required
                                        maxLength={70}
                                        rows={4}
                                        style={{ fontFamily: "Space Mono, Geist Mono, monospace" }}
                                        className="w-full bg-[var(--color-paper-2,#F4F1EA)] border border-[var(--color-rule,#E2DDD3)] p-2.5 rounded-xs text-xs text-[var(--color-ink,#23201D)] focus:border-[var(--color-neutral,#888279)] outline-none transition-colors resize-none leading-relaxed"
                                    />
                                    <div className="flex justify-between items-center text-[8px] font-mono text-[var(--color-neutral,#888279)] mt-1">
                                        <span>* สูงสุด 70 ตัวอักษร</span>
                                        <span>{noteText.length}/70</span>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isSubmittingNote || !noteText.trim()}
                                    className="w-full bg-[var(--color-accent,#D85436)] hover:opacity-90 disabled:bg-[var(--color-paper-2,#F4F1EA)] disabled:text-[var(--color-muted,#656058)] text-white font-mono text-[9px] font-extrabold uppercase tracking-widest py-3 rounded-xs cursor-pointer disabled:cursor-not-allowed transition-all select-none border-0 shadow-xs"
                                >
                                    {isSubmittingNote ? "SUBMITTING..." : "[ POST NOTE // ส่งข้อความ ]"}
                                </button>

                                {/* Footer Disclaimer */}
                                <p className="text-[8px] font-mono text-[var(--color-neutral,#888279)] leading-normal text-center mt-2">
                                    * ข้อความจะถูกตรวจสอบโดย Admin ก่อนนำขึ้นแสดงบนบอร์ดนี้
                                </p>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── LIGHTBOX MODAL / DETAIL DRAWER ─── */}
            <AnimatePresence>
                {selectedItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedItem(null)}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-ink,#23201D)]/40 backdrop-blur-xs p-4 cursor-pointer select-none"
                    >
                        <motion.div
                            initial={{ scale: 0.96, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.96, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-3xl bg-[var(--color-paper,#FBF9F5)] border border-[var(--color-rule,#E2DDD3)] rounded-xs overflow-hidden flex flex-col md:flex-row cursor-default shadow-2xl relative text-[var(--color-ink,#23201D)]"
                        >
                            {/* Close button in modal */}
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="absolute top-4 right-4 w-8 h-8 rounded-xs bg-[var(--color-paper-2,#F4F1EA)] border border-[var(--color-rule,#E2DDD3)] text-[var(--color-neutral,#888279)] hover:text-[var(--color-ink,#23201D)] flex items-center justify-center font-mono text-[10px] tracking-wide transition-all z-20 cursor-pointer shadow-xs"
                            >
                                [X]
                            </button>

                            {/* Image side */}
                            <div className="w-full md:w-1/2 aspect-square md:aspect-auto md:h-[480px] bg-[var(--color-paper-2,#F4F1EA)] relative border-b md:border-b-0 md:border-r border-[var(--color-rule,#E2DDD3)] flex items-center justify-center">
                                {selectedItem.image_url === 'text_only' ? (
                                    <div className="w-full h-full bg-[var(--color-paper,#FBF9F5)] p-8 flex flex-col justify-between text-[var(--color-ink,#23201D)] select-text">
                                        <div className="flex justify-between items-center w-full">
                                            <span className="font-mono text-[9px] text-[var(--color-neutral,#888279)] tracking-widest">
                                                {selectedItem.source === 'google' ? '// GOOGLE REVIEW' : '// GUEST NOTE'}
                                            </span>
                                            {selectedItem.rating && (
                                                <div className="flex gap-0.5 text-[var(--color-accent,#D85436)]">
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <span key={i} className="text-xs">
                                                            {i < selectedItem.rating ? '★' : '☆'}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <p className="font-mono text-center leading-relaxed text-sm text-[var(--color-ink,#23201D)] break-words w-full my-auto" style={{ fontFamily: "Space Mono, Geist Mono, monospace" }}>
                                            "{selectedItem.text}"
                                        </p>
                                        <span className="font-mono text-[9px] text-[var(--color-neutral,#888279)] text-center tracking-wider uppercase border-t border-[var(--color-rule,#E2DDD3)] pt-3 font-bold">
                                            BY {selectedItem.user.name}
                                        </span>
                                    </div>
                                ) : (
                                    <img
                                        src={getProxiedImageUrl(selectedItem.image?.src)}
                                        alt={selectedItem.text}
                                        crossOrigin="anonymous"
                                        className="w-full h-full object-cover"
                                    />
                                )}
                                {/* Platform label Overlay */}
                                <div className="absolute bottom-4 left-4 z-10">
                                    {selectedItem.source === 'instagram' && (
                                        <span className="px-2.5 py-1 bg-[#E1306C] text-white rounded-xs font-mono text-[9px] font-bold uppercase tracking-wider shadow-xs">
                                            INSTAGRAM
                                        </span>
                                    )}
                                    {selectedItem.source === 'facebook' && (
                                        <span className="px-2.5 py-1 bg-[#1877F2] text-white rounded-xs font-mono text-[9px] font-bold uppercase tracking-wider shadow-xs">
                                            FACEBOOK
                                        </span>
                                    )}
                                    {selectedItem.source === 'google' && (
                                        <span className="px-2.5 py-1 bg-[#4285F4] text-white rounded-xs font-mono text-[9px] font-bold uppercase tracking-wider shadow-xs">
                                            GOOGLE REVIEWS
                                        </span>
                                    )}
                                    {selectedItem.source === 'note' && (
                                        <span className="px-2.5 py-1 bg-[var(--color-accent,#D85436)] text-white rounded-xs font-mono text-[9px] font-bold uppercase tracking-wider shadow-xs">
                                            GUEST NOTE
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Details side */}
                            <div className="w-full md:w-1/2 p-6 flex flex-col justify-between md:h-[480px] bg-[var(--color-paper,#FBF9F5)]">
                                <div className="space-y-5">
                                    
                                    {/* User Profile info */}
                                    <div className="pb-3 border-b border-[var(--color-rule,#E2DDD3)]">
                                        <h4 className="text-xs font-bold text-[var(--color-ink,#23201D)] tracking-tight uppercase">
                                            {selectedItem.user?.name || selectedItem.user_name || 'GUEST'}
                                        </h4>
                                        {selectedItem.user?.handle && (
                                            <span className="text-[10px] font-mono text-[var(--color-neutral,#888279)] block mt-0.5">
                                                {selectedItem.user.handle}
                                            </span>
                                        )}
                                    </div>

                                    {/* Location & Rating */}
                                    <div className="flex flex-col gap-1.5">
                                        <div className="text-[10px] font-mono text-[var(--color-accent,#D85436)] font-bold uppercase tracking-wider">
                                            {selectedItem.location}
                                        </div>
                                        {selectedItem.rating && (
                                            <div className="flex gap-0.5">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        size={12}
                                                        className={i < selectedItem.rating ? 'fill-[var(--color-accent,#D85436)] text-[var(--color-accent,#D85436)]' : 'text-[var(--color-rule,#E2DDD3)]'}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* User Text */}
                                    <p className="text-xs text-[var(--color-ink,#23201D)] leading-relaxed font-sans font-medium whitespace-pre-line pr-2 overflow-y-auto max-h-[160px]">
                                        {selectedItem.text}
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-[var(--color-rule,#E2DDD3)] mt-4 space-y-4">
                                    <div className="flex items-center justify-between text-[10px] font-mono text-[var(--color-neutral,#888279)] font-bold">
                                        <span>POSTED: {selectedItem.date}</span>
                                        
                                        {/* Likes & Comments Counters */}
                                        {selectedItem.likes !== undefined && (
                                            <div className="flex items-center gap-3">
                                                 <button
                                                     onClick={(e) => handleLikeToggle(e, selectedItem.id)}
                                                     className="flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all text-[var(--color-neutral,#888279)] hover:text-[var(--color-accent,#D85436)] cursor-pointer bg-transparent border-0 p-0 outline-none"
                                                 >
                                                     <Heart
                                                         size={12}
                                                         className={likedIds.includes(selectedItem.id) ? "text-[var(--color-accent,#D85436)] fill-[var(--color-accent,#D85436)]" : "text-[var(--color-neutral,#888279)]"}
                                                     />
                                                     <span className={likedIds.includes(selectedItem.id) ? "text-[var(--color-accent,#D85436)] font-bold" : "text-[var(--color-neutral,#888279)]"}>
                                                         {selectedItem.likes}
                                                     </span>
                                                 </button>
                                                {selectedItem.comments !== undefined && (
                                                    <span className="flex items-center gap-1"><MessageCircle size={10} /> {selectedItem.comments}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Direct Action Link */}
                                    {selectedItem.url && (
                                        <a
                                            href={selectedItem.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full py-2.5 rounded-xs bg-[var(--color-ink,#23201D)] hover:bg-[var(--color-ink,#23201D)]/90 text-white font-mono text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-0 shadow-xs"
                                        >
                                            <ExternalLink size={11} /> VIEW ORIGINAL POST
                                        </a>
                                    )}
                                </div>

                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Custom Embedded animations & variables styling */}
            <style>{`
                :root {
                    --color-paper: oklch(97% 0.008 28);
                    --color-paper-2: oklch(94% 0.010 28);
                    --color-rule: oklch(85% 0.012 28);
                    --color-neutral: oklch(55% 0.010 28);
                    --color-muted: oklch(42% 0.010 28);
                    --color-ink: oklch(18% 0.012 28);
                    --color-accent: oklch(52% 0.16 28);
                    --color-accent-2: oklch(45% 0.08 140);
                    --color-focus: oklch(60% 0.15 28);
                }
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
