import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { 
    Save, 
    Upload, 
    Trash2, 
    Plus, 
    Instagram, 
    Facebook, 
    Star, 
    Eye, 
    EyeOff, 
    Link, 
    MessageSquare, 
    Heart, 
    MapPin, 
    Edit2, 
    Loader2, 
    X 
} from 'lucide-react'

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

const getInstagramShortcode = (url) => {
    const match = url.match(/\/(p|reel|tv)\/([a-zA-Z0-9_-]+)/)
    return match ? match[2] : null
}

export default function CheckinManager() {
    const [checkins, setCheckins] = useState([])
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)

    // Quick URL Fetch State
    const [urlToFetch, setUrlToFetch] = useState('')
    const [fetchLoading, setFetchLoading] = useState(false)

    // Quick Add State
    const [quickAddUrl, setQuickAddUrl] = useState('')
    const [quickAddLoading, setQuickAddLoading] = useState(false)

    // Form State
    const [editingId, setEditingId] = useState(null)
    const [showForm, setShowForm] = useState(false)
    const [formData, setFormData] = useState({
        source: 'instagram',
        user_name: '',
        user_handle: '',
        user_avatar: '',
        text: '',
        rating: 5,
        location: 'IN THE HAUS ในบ้าน นครพนม',
        image_url: '',
        post_url: '',
        likes: 0,
        comments: 0,
        is_visible: true
    })

    useEffect(() => {
        fetchCheckins()
    }, [])

    const fetchCheckins = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('haus_checkins')
                .select('*')
                .order('created_at', { ascending: false })
            
            if (error) throw error
            setCheckins(data || [])
        } catch (err) {
            console.error('Failed to load check-ins:', err)
            alert('Failed to load check-ins: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    // Auto-resize image to WebP with JPEG fallback
    const resizeImage = (file, maxWidth = 800) => {
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = (e) => {
                const img = new Image()
                img.onload = () => {
                    const canvas = document.createElement('canvas')
                    const scale = Math.min(1, maxWidth / img.width)
                    canvas.width = img.width * scale
                    canvas.height = img.height * scale
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                    
                    let type = 'image/webp'
                    let ext = '.webp'

                    // Test WebP canvas support
                    try {
                        const testData = canvas.toDataURL('image/webp')
                        if (!testData.startsWith('data:image/webp')) {
                            type = 'image/jpeg'
                            ext = '.jpg'
                        }
                    } catch (err) {
                        type = 'image/jpeg'
                        ext = '.jpg'
                    }

                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ext), { type, lastModified: Date.now() }))
                    }, type, 0.8)
                }
                img.src = e.target.result
            }
            reader.readAsDataURL(file)
        })
    }

    // Handle photo upload
    const handleImageUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setUploadingImage(true)
        try {
            const resized = await resizeImage(file, 800)
            const ext = resized.name.split('.').pop()
            const fileName = `checkins/checkin_${Date.now()}.${ext}`

            const { error: uploadError } = await supabase.storage
                .from('public-assets')
                .upload(fileName, resized, { 
                    upsert: true, 
                    contentType: resized.type, 
                    cacheControl: '15552000' 
                })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('public-assets')
                .getPublicUrl(fileName)

            setFormData(prev => ({ ...prev, image_url: publicUrl }))
        } catch (err) {
            console.error('Upload failed:', err)
            alert('Upload failed: ' + err.message)
        } finally {
            setUploadingImage(false)
        }
    }

const decodeHTMLEntities = (text) => {
    if (!text) return ''
    return text
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        .replace(/&#x([0-9a-fA-F]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
}

    // Download an external image via proxy and upload it directly to Supabase storage
    const uploadExternalImageToSupabase = async (externalUrl) => {
        if (!externalUrl) return null
        try {
            let blob
            let mimeType = 'image/jpeg'

            if (externalUrl.startsWith('data:')) {
                // Parse base64 data URL directly to Blob
                const parts = externalUrl.split(',')
                const match = parts[0].match(/:(.*?);/)
                mimeType = match ? match[1] : 'image/png'
                const bstr = atob(parts[1])
                let n = bstr.length
                const u8arr = new Uint8Array(n)
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n)
                }
                blob = new Blob([u8arr], { type: mimeType })
            } else {
                // 1. Try Weserv proxy
                try {
                    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(externalUrl)}`
                    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) })
                    if (res.ok) {
                        blob = await res.blob()
                        mimeType = blob.type
                    }
                } catch (pErr) {
                    console.warn('Weserv proxy fetch failed:', pErr)
                }

                // 2. Direct browser fetch fallback (works if CDN sends Access-Control-Allow-Origin: *)
                if (!blob) {
                    const directRes = await fetch(externalUrl, { signal: AbortSignal.timeout(8000) })
                    if (!directRes.ok) throw new Error(`Direct download failed with status ${directRes.status}`)
                    blob = await directRes.blob()
                    mimeType = blob.type
                }
            }

            const ext = (mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
            const fileName = `checkins/scraped_${Date.now()}.${ext}`

            const { error: uploadError } = await supabase.storage
                .from('public-assets')
                .upload(fileName, blob, {
                    upsert: true,
                    contentType: mimeType,
                    cacheControl: '15552000'
                })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('public-assets')
                .getPublicUrl(fileName)

            return publicUrl
        } catch (err) {
            console.error('Failed to proxy upload external image:', err)
            return null
        }
    }

    const fetchMetadataForUrl = async (cleanUrl, source) => {
        let json = null

        // 1. Fast path for Facebook links via serverless proxy (uses Twitterbot UA to bypass FB login wall)
        if (source === 'facebook') {
            try {
                const proxyRes = await fetch(`/api/scrape-meta?url=${encodeURIComponent(cleanUrl)}`)
                if (proxyRes.ok) {
                    json = await proxyRes.json()
                }
            } catch (err) {
                console.warn('Server-side FB scrape failed, trying microlink:', err)
            }
        }

        // 2. Try client-side microlink query
        if (!json || json.status !== 'success' || !json.data) {
            try {
                const clientRes = await fetch(`https://api.microlink.io?url=${encodeURIComponent(cleanUrl)}&prerender=true`, { signal: AbortSignal.timeout(8000) })
                if (clientRes.ok) {
                    json = await clientRes.json()
                }
            } catch (err) {
                console.warn('Client-side microlink query failed, trying server-side proxy:', err)
            }
        }

        // 3. Fallback to server-side proxy
        if (!json || json.status !== 'success' || !json.data) {
            const proxyRes = await fetch(`/api/scrape-meta?url=${encodeURIComponent(cleanUrl)}`)
            if (proxyRes.ok) {
                json = await proxyRes.json()
            }
        }

        if (!json || json.status !== 'success' || !json.data) {
            throw new Error('ไม่สามารถดึงข้อมูลได้ โปรดตรวจสอบลิงก์อีกครั้ง หรือเพิ่มด้วยตนเอง')
        }

        return json.data
    }

    const handleQuickAdd = async (e) => {
        if (e && e.preventDefault) e.preventDefault()
        
        if (!quickAddUrl) {
            alert('โปรดวางลิงก์โพสต์ Instagram/Facebook หรือ Google Reviews ก่อน')
            return
        }

        setQuickAddLoading(true)
        try {
            let cleanUrl = quickAddUrl.trim();
            
            // Determine source
            let source = 'instagram'
            if (cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch')) {
                source = 'facebook'
            } else if (cleanUrl.includes('google.com') || cleanUrl.includes('maps.app.goo.gl')) {
                source = 'google'
            }

            const data = await fetchMetadataForUrl(cleanUrl, source)
            const title = decodeHTMLEntities(data.title || '')
            const description = decodeHTMLEntities(data.description || '')

            const isLoginWall = 
                (source === 'instagram') && 
                (title.toLowerCase() === 'instagram' || 
                 title.includes('Login • Instagram') ||
                 description.includes('Create an account or log in to Instagram') ||
                 description.includes('Log in to Instagram'))

            if (isLoginWall) {
                throw new Error('ระบบรักษาความปลอดภัยของ Instagram บล็อกการเข้าถึงอัตโนมัติชั่วคราว (Login Wall / Rate Limit) โปรดรอประมาณ 1 นาทีแล้วลองใหม่อีกครั้ง หรือระบุข้อมูลและรูปภาพในโหมด "เพิ่มด้วยตนเอง" ได้ทันที')
            }

            // Extract display name, user handle, and clean text
            let user_name = decodeHTMLEntities(data.author || 'Customer')
            let user_handle = source === 'instagram' ? '@instagram_user' : (source === 'google' ? 'Google Reviewer' : 'Facebook User')
            let text = description || title || ''
            
            // Parsing logic
            if (source === 'instagram') {
                if (title) {
                    const handleMatch = title.match(/\(([^)]+)\)/)
                    if (handleMatch) {
                        user_handle = handleMatch[1] // e.g. "@taewaewg"
                    }
                }

                if (user_name) {
                    user_name = user_name.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim()
                }
                if (user_handle) {
                    user_handle = user_handle.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim()
                }

                if (!user_name || user_name === 'Customer') {
                    user_name = user_handle ? user_handle.replace(/^@/, '') : 'Instagram User'
                }

                if (description) {
                    const captionMatch = description.match(/:\s*[”"“‟]([\s\S]*?)[”"”‟]\.?$/)
                    if (captionMatch) {
                        text = captionMatch[1].trim()
                    } else {
                        const simpleQuoteMatch = description.match(/[”"“‟]([\s\S]*?)[”"”‟]/)
                        if (simpleQuoteMatch) {
                            text = simpleQuoteMatch[1].trim()
                        } else {
                            text = description.trim()
                        }
                    }
                }
            } else if (source === 'facebook') {
                if (title && title !== 'Facebook' && title !== 'Facebook Post' && !title.includes('log in') && !title.includes('Log In') && !title.includes('Security Check')) {
                    user_name = title.trim()
                }
                user_handle = 'Facebook User'
                text = description || title || ''
            } else if (source === 'google') {
                const authorMatch = title.match(/by\s+([^,|-]+)/i) || title.match(/โดย\s+([^,|-]+)/);
                if (authorMatch) {
                    user_name = authorMatch[1].trim();
                    user_handle = 'Google Local Guide';
                } else if (title.includes('Google Maps') || title.includes('Google review of')) {
                    user_name = 'Google Reviewer';
                    user_handle = 'Local Guide';
                }
                
                if (description) {
                    let cleanText = description.replace(/[★☆⭐]/g, '').replace(/^[·\s\-\u2022]+/g, '').trim();
                    const quoteMatch = cleanText.match(/^[”"“‟]([\s\S]*?)[”"”‟]$/);
                    if (quoteMatch) {
                        cleanText = quoteMatch[1].trim();
                    }
                    text = cleanText || 'รีวิวระดับ 5 ดาวจาก Google Maps';
                } else {
                    text = 'รีวิวระดับ 5 ดาวจาก Google Maps';
                }
            }

            // Image fetching & upload
            const scrapedImageUrl = data.image?.url || data.screenshot?.url || ''
            const igShortcode = getInstagramShortcode(cleanUrl)
            let primaryImageUrl = scrapedImageUrl
            
            if (source === 'instagram' && igShortcode) {
                const targetUrl = `https://www.instagram.com/p/${igShortcode}/media/?size=l`
                try {
                    const resolveRes = await fetch(`/api/resolve-image?url=${encodeURIComponent(targetUrl)}`)
                    const resolveJson = await resolveRes.json()
                    if (resolveJson && resolveJson.resolvedUrl) {
                        primaryImageUrl = resolveJson.resolvedUrl
                    } else {
                        primaryImageUrl = targetUrl
                    }
                } catch (e) {
                    console.error('Failed to resolve redirect server-side:', e)
                    primaryImageUrl = targetUrl
                }
            }

            let image_url = ''
            if (!primaryImageUrl && !scrapedImageUrl) {
                image_url = 'text_only'
            } else {
                if (primaryImageUrl) {
                    image_url = await uploadExternalImageToSupabase(primaryImageUrl)
                }
                if (!image_url && scrapedImageUrl && primaryImageUrl !== scrapedImageUrl) {
                    image_url = await uploadExternalImageToSupabase(scrapedImageUrl)
                }
                if (!image_url) {
                    image_url = scrapedImageUrl || primaryImageUrl || 'text_only'
                }
            }

            let ratingValue = source === 'google' ? 5 : null
            if (source === 'google' && description) {
                const starCount = (description.match(/[★⭐]/g) || []).length;
                if (starCount >= 1 && starCount <= 5) {
                    ratingValue = starCount;
                }
            }
            
            const payload = {
                source,
                user_name,
                user_handle,
                user_avatar: data.logo?.url || '',
                text: text.slice(0, 500),
                rating: ratingValue,
                location: 'IN THE HAUS ในบ้าน นครพนม',
                image_url,
                post_url: cleanUrl,
                likes: parseInt(data.likes || 0),
                comments: 0,
                is_visible: true
            }

            const { error: insertErr } = await supabase
                .from('haus_checkins')
                .insert([payload])

            if (insertErr) throw insertErr

            setQuickAddUrl('')
            if (source === 'google' && user_name === 'Google Reviewer') {
                alert('🚀 ดึงข้อมูลรีวิว Google Maps สำเร็จบางส่วนและเพิ่มลงตารางแล้ว!\n\n(หมายเหตุ: เนื่องจากระบบรักษาความปลอดภัยของ Google Maps ป้องกันการดึงข้อมูลอัตโนมัติ ทำให้บางครั้งไม่สามารถดึงรูปภาพของรีวิวจริงและชื่อผู้รีวิวมาได้ตรงๆ โปรดกดปุ่ม "แก้ไข" (รูปดินสอ) บนแถวที่เพิ่มเข้ามา เพื่ออัปโหลดรูปภาพอาหารและระบุชื่อผู้รีวิวที่ถูกต้องด้วยตนเองครับ)')
            } else {
                alert('🚀 เพิ่มโพสต์เช็กอินออโต้สำเร็จ!')
            }
            fetchCheckins()
        } catch (err) {
            console.error('Quick Add failed:', err)
            alert('เพิ่มด่วนอัตโนมัติไม่สำเร็จ: ' + err.message + '\n\n(คุณสามารถกดปุ่ม \"เพิ่มด้วยตนเอง\" เพื่อทำการแอดข้อมูลมือได้)')
        } finally {
            setQuickAddLoading(false)
        }
    }

    const handleFetchUrl = async () => {
        if (!urlToFetch) {
            alert('โปรดวางลิงก์โพสต์ Instagram/Facebook หรือ Google Reviews ก่อน')
            return
        }

        setFetchLoading(true)
        try {
            let cleanUrl = urlToFetch.trim();
            
            let source = 'instagram'
            if (cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch')) {
                source = 'facebook'
            } else if (cleanUrl.includes('google.com') || cleanUrl.includes('maps.app.goo.gl')) {
                source = 'google'
            }

            const data = await fetchMetadataForUrl(cleanUrl, source)
            const title = decodeHTMLEntities(data.title || '')
            const description = decodeHTMLEntities(data.description || '')

            const isLoginWall = 
                (source === 'instagram') && 
                (title.toLowerCase() === 'instagram' || 
                 title.includes('Login • Instagram') ||
                 description.includes('Create an account or log in to Instagram') ||
                 description.includes('Log in to Instagram'))

            if (isLoginWall) {
                throw new Error('ระบบรักษาความปลอดภัยของ Instagram บล็อกการเข้าถึงอัตโนมัติชั่วคราว (Login Wall / Rate Limit) โปรดรอประมาณ 1 นาทีแล้วลองใหม่อีกครั้ง หรือระบุข้อมูลและรูปภาพลงฟอร์มด้วยตนเอง')
            }

            let user_name = decodeHTMLEntities(data.author || 'Customer')
            let user_handle = source === 'instagram' ? '@instagram_user' : (source === 'google' ? 'Google Reviewer' : 'Facebook User')
            let text = description || title || ''
            
            if (source === 'instagram') {
                if (title) {
                    const handleMatch = title.match(/\(([^)]+)\)/)
                    if (handleMatch) {
                        user_handle = handleMatch[1]
                    }
                }

                if (user_name) {
                    user_name = user_name.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim()
                }
                if (user_handle) {
                    user_handle = user_handle.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim()
                }

                if (!user_name || user_name === 'Customer') {
                    user_name = user_handle ? user_handle.replace(/^@/, '') : 'Instagram User'
                }

                if (description) {
                    const captionMatch = description.match(/:\s*[”"“‟]([\s\S]*?)[”"”‟]\.?$/)
                    if (captionMatch) {
                        text = captionMatch[1].trim()
                    } else {
                        const simpleQuoteMatch = description.match(/[”"“‟]([\s\S]*?)[”"”‟]/)
                        if (simpleQuoteMatch) {
                            text = simpleQuoteMatch[1].trim()
                        } else {
                            text = description.trim()
                        }
                    }
                }
            } else if (source === 'facebook') {
                if (title && title !== 'Facebook' && title !== 'Facebook Post' && !title.includes('log in') && !title.includes('Log In') && !title.includes('Security Check')) {
                    user_name = title.trim()
                }
                user_handle = 'Facebook User'
                text = description || title || ''
            } else if (source === 'google') {
                const authorMatch = title.match(/by\s+([^,|-]+)/i) || title.match(/โดย\s+([^,|-]+)/);
                if (authorMatch) {
                    user_name = authorMatch[1].trim();
                    user_handle = 'Google Local Guide';
                } else if (title.includes('Google Maps') || title.includes('Google review of')) {
                    user_name = 'Google Reviewer';
                    user_handle = 'Local Guide';
                }
                
                if (description) {
                    let cleanText = description.replace(/[★☆⭐]/g, '').replace(/^[·\s\-\u2022]+/g, '').trim();
                    const quoteMatch = cleanText.match(/^[”"“‟]([\s\S]*?)[”"”‟]$/);
                    if (quoteMatch) {
                        cleanText = quoteMatch[1].trim();
                    }
                    text = cleanText || 'รีวิวระดับ 5 ดาวจาก Google Maps';
                } else {
                    text = 'รีวิวระดับ 5 ดาวจาก Google Maps';
                }
            }

            const scrapedImageUrl = data.image?.url || data.screenshot?.url || ''
            const igShortcode = getInstagramShortcode(cleanUrl)
            let primaryImageUrl = scrapedImageUrl
            
            if (source === 'instagram' && igShortcode) {
                const targetUrl = `https://www.instagram.com/p/${igShortcode}/media/?size=l`
                try {
                    const resolveRes = await fetch(`/api/resolve-image?url=${encodeURIComponent(targetUrl)}`)
                    const resolveJson = await resolveRes.json()
                    if (resolveJson && resolveJson.resolvedUrl) {
                        primaryImageUrl = resolveJson.resolvedUrl
                    } else {
                        primaryImageUrl = targetUrl
                    }
                } catch (e) {
                    console.error('Failed to resolve redirect server-side:', e)
                    primaryImageUrl = targetUrl
                }
            }

            let image_url = ''
            if (!primaryImageUrl && !scrapedImageUrl) {
                image_url = 'text_only'
            } else {
                if (primaryImageUrl) {
                    image_url = await uploadExternalImageToSupabase(primaryImageUrl)
                }
                if (!image_url && scrapedImageUrl && primaryImageUrl !== scrapedImageUrl) {
                    image_url = await uploadExternalImageToSupabase(scrapedImageUrl)
                }
                if (!image_url) {
                    image_url = scrapedImageUrl || primaryImageUrl || 'text_only'
                }
            }

            let ratingValue = source === 'google' ? 5 : null
            if (source === 'google' && description) {
                // Dynamically count stars in description (e.g. ★★★★★ or ⭐⭐⭐⭐⭐)
                const starCount = (description.match(/[★⭐]/g) || []).length;
                if (starCount >= 1 && starCount <= 5) {
                    ratingValue = starCount;
                }
            }

            setFormData(prev => ({
                ...prev,
                source,
                user_name,
                user_handle,
                user_avatar: data.logo?.url || '',
                text: text.slice(0, 500), // Clamp to prevent overflow
                image_url,
                post_url: cleanUrl,
                likes: data.likes || 0,
                comments: 0,
                rating: ratingValue
            }))

            if (source === 'google' && user_name === 'Google Reviewer') {
                alert('ดึงข้อมูลสำเร็จบางส่วน!\n\n(หมายเหตุ: เนื่องจากระบบความปลอดภัยของ Google Maps ปิดกั้นการดึงข้อมูลอัตโนมัติ ทำให้บางครั้งไม่สามารถดึงรูปภาพของรีวิวจริงและชื่อผู้รีวิวมาได้ตรงๆ โปรดพิมพ์ระบุชื่อผู้รีวิว คอมเมนต์ และอัปโหลดไฟล์รูปภาพรีวิวจริงในฟอร์มด้านล่างนี้ก่อนกดบันทึกครับ)')
            } else {
                alert('ดึงข้อมูลจากลิงก์สำเร็จ! โปรดตรวจทานความถูกต้องแล้วกดบันทึก')
            }
        } catch (err) {
            console.error('Failed to parse URL metadata:', err)
            alert('ดึงข้อมูลอัตโนมัติไม่สำเร็จ: ' + err.message + '\n(หมายเหตุ: คุณยังคงสามารถกรอกข้อมูล แหล่งที่มา, ชื่อ, และรูปภาพลงในฟอร์มเองได้)')
        } finally {
            setFetchLoading(false)
        }
    }

    const resetForm = () => {
        setEditingId(null)
        setShowForm(false)
        setUrlToFetch('')
        setFormData({
            source: 'instagram',
            user_name: '',
            user_handle: '',
            user_avatar: '',
            text: '',
            rating: 5,
            location: 'IN THE HAUS ในบ้าน นครพนม',
            image_url: '',
            post_url: '',
            likes: 0,
            comments: 0,
            is_visible: true
        })
    }

    const handleEdit = (item) => {
        setEditingId(item.id)
        setFormData({
            source: item.source,
            user_name: item.user_name,
            user_handle: item.user_handle || '',
            user_avatar: item.user_avatar || '',
            text: item.text,
            rating: item.rating || 5,
            location: item.location || 'IN THE HAUS ในบ้าน นครพนม',
            image_url: item.image_url,
            post_url: item.post_url || '',
            likes: item.likes || 0,
            comments: item.comments || 0,
            is_visible: item.is_visible !== false
        })
        setShowForm(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.user_name || !formData.text || !formData.image_url) {
            alert('โปรดกรอกข้อมูลสำคัญ: ชื่อผู้ใช้, ข้อความรีวิว, และรูปเช็กอิน')
            return
        }

        setActionLoading(true)
        try {
            // Google Maps uses rating; reset for other networks
            const ratingValue = formData.source === 'google' ? parseInt(formData.rating) : null
            
            const payload = {
                source: formData.source,
                user_name: formData.user_name,
                user_handle: formData.user_handle || (formData.source === 'google' ? 'Google Reviewer' : ''),
                user_avatar: formData.user_avatar || '',
                text: formData.text,
                rating: ratingValue,
                location: formData.location,
                image_url: formData.image_url,
                post_url: formData.post_url,
                likes: parseInt(formData.likes || 0),
                comments: parseInt(formData.comments || 0),
                is_visible: formData.is_visible
            }

            if (editingId) {
                const { error } = await supabase
                    .from('haus_checkins')
                    .update(payload)
                    .eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('haus_checkins')
                    .insert([payload])
                if (error) throw error
            }

            resetForm()
            fetchCheckins()
        } catch (err) {
            console.error('Save failed:', err)
            alert('Save failed: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('ยืนยันที่จะลบรูปเช็กอินนี้ออกจากระบบ?')) return

        setActionLoading(true)
        try {
            const { error } = await supabase
                .from('haus_checkins')
                .delete()
                .eq('id', id)
            
            if (error) throw error
            fetchCheckins()
        } catch (err) {
            console.error('Delete failed:', err)
            alert('Delete failed: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    const toggleVisibility = async (item) => {
        // Optimistic Update
        const targetValue = !item.is_visible
        setCheckins(prev => 
            prev.map(c => c.id === item.id ? { ...c, is_visible: targetValue } : c)
        )

        try {
            const { error } = await supabase
                .from('haus_checkins')
                .update({ is_visible: targetValue })
                .eq('id', item.id)
            if (error) throw error
        } catch (err) {
            console.error('Toggle visibility failed:', err)
            // Rollback
            setCheckins(prev => 
                prev.map(c => c.id === item.id ? { ...c, is_visible: !targetValue } : c)
            )
        }
    }

    return (
        <div className="space-y-6">
            
            {/* Header & Create Button */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-150">
                <div>
                    <h2 className="text-xl font-bold text-ink">📸 Check-in Wall Stream</h2>
                    <p className="text-xs text-subInk mt-0.5">จัดการรูปภาพเช็กอิน โพสต์โซเชียลมีเดีย และรีวิวที่แสดงหน้าบอร์ด</p>
                </div>
            </div>

            {/* Quick Add Bar (Always visible when not editing/showing full form) */}
            {!showForm && (
                <div className="bg-paper border border-gray-200 shadow-sm rounded-3xl p-5 flex flex-col md:flex-row items-stretch md:items-end gap-3 animate-fade-in">
                    <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-bold text-subInk uppercase mb-1">⚡ วางลิงก์เพื่อเพิ่มออโต้ทันที (Instagram / Facebook / Google Maps)</label>
                        <input
                            type="text"
                            value={quickAddUrl}
                            onChange={(e) => setQuickAddUrl(e.target.value)}
                            placeholder="วางลิงก์โพสต์ เช่น https://www.instagram.com/p/..."
                            className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-ink font-bold text-xs outline-none focus:border-brand font-mono h-[42px]"
                        />
                    </div>
                    <div className="flex gap-2 items-center justify-end">
                        <button
                            type="button"
                            onClick={handleQuickAdd}
                            disabled={quickAddLoading}
                            className="bg-brand text-zinc-900 border border-brand hover:opacity-95 font-bold text-xs py-2 px-6 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer h-[42px] whitespace-nowrap"
                        >
                            {quickAddLoading ? (
                                <>
                                    <Loader2 size={13} className="animate-spin" />
                                    <span>กำลังเพิ่ม...</span>
                                </>
                            ) : (
                                <>
                                    <span>🚀 เพิ่มด่วน (Add)</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowForm(true)}
                            className="bg-canvas border border-gray-200 hover:bg-gray-100 text-ink font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer h-[42px] whitespace-nowrap"
                            title="เปิดฟอร์มเพื่ออัปโหลดรูปเองหรือใส่ข้อมูลด้วยมือ"
                        >
                            <Plus size={13} /> เพิ่มด้วยตนเอง (Manual)
                        </button>
                    </div>
                </div>
            )}

            {/* FORM CONTAINER (Add/Edit) */}
            {showForm && (
                <div className="bg-paper border border-gray-250 shadow-sm rounded-3xl p-6 animate-fade-in space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-150">
                        <h3 className="font-bold text-sm text-ink uppercase tracking-wide">
                            {editingId ? '✍️ แก้ไขข้อมูลเช็กอิน' : '📸 เพิ่มโพสต์รีวิว/เช็กอินใหม่'}
                        </h3>
                        <button 
                            onClick={resetForm} 
                            className="w-7 h-7 rounded-full bg-canvas flex items-center justify-center text-subInk hover:text-ink cursor-pointer"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Auto-fetch from URL tool */}
                    {!editingId && (
                        <div className="bg-canvas border border-gray-200 p-4 rounded-2xl flex flex-col md:flex-row md:items-end gap-3 mb-2">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-subInk uppercase mb-1">🔗 ดึงข้อมูลอัตโนมัติจากลิงก์ (Instagram / Facebook / Google Maps)</label>
                                <input
                                    type="text"
                                    value={urlToFetch}
                                    onChange={(e) => setUrlToFetch(e.target.value)}
                                    placeholder="วางลิงก์โพสต์หรือรีวิว เช่น https://www.instagram.com/p/..."
                                    className="w-full bg-paper border border-gray-200 p-2.5 rounded-xl text-ink font-bold text-xs outline-none focus:border-brand font-mono"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleFetchUrl}
                                disabled={fetchLoading}
                                className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer h-[40px] whitespace-nowrap"
                            >
                                {fetchLoading ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin" />
                                        <span>กำลังดึงข้อมูล...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>ดึงข้อมูล (Fetch)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Source Selector */}
                        <div>
                            <label className="block text-[10px] font-bold text-subInk uppercase mb-1">Source / แพลตฟอร์ม</label>
                            <select
                                value={formData.source}
                                onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                                className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-ink font-bold text-xs outline-none focus:border-brand"
                            >
                                <option value="instagram">Instagram Tag</option>
                                <option value="facebook">Facebook Check-in</option>
                                <option value="google">Google Maps Review</option>
                            </select>
                        </div>

                        {/* Location */}
                        <div>
                            <label className="block text-[10px] font-bold text-subInk uppercase mb-1">Location / สถานที่</label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                                placeholder="เช่น IN THE HAUS ในบ้าน นครพนม"
                                className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-ink font-bold text-xs outline-none focus:border-brand"
                            />
                        </div>

                        {/* User Name */}
                        <div>
                            <label className="block text-[10px] font-bold text-subInk uppercase mb-1">User Display Name / ชื่อผู้รีวิว</label>
                            <input
                                type="text"
                                value={formData.user_name}
                                onChange={(e) => setFormData(prev => ({ ...prev, user_name: e.target.value }))}
                                placeholder="เช่น Pimchaya T. หรือ Liam A."
                                className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-ink font-bold text-xs outline-none focus:border-brand"
                                required
                            />
                        </div>

                        {/* User Handle / Description */}
                        <div>
                            <label className="block text-[10px] font-bold text-subInk uppercase mb-1">User Handle / รายละเอียดบัญชี</label>
                            <input
                                type="text"
                                value={formData.user_handle}
                                onChange={(e) => setFormData(prev => ({ ...prev, user_handle: e.target.value }))}
                                placeholder={formData.source === 'instagram' ? 'เช่น @username' : 'เช่น Facebook Check-in / Local Guide'}
                                className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-ink font-bold text-xs outline-none focus:border-brand"
                            />
                        </div>

                        {/* Image Upload/URL */}
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                            
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-subInk uppercase mb-1">Image URL / ลิงก์รูปภาพ</label>
                                <input
                                    type="text"
                                    value={formData.image_url}
                                    onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                                    placeholder="ใส่ลิงก์รูปภาพโดยตรง หรืออัปโหลดไฟล์ด้านข้าง"
                                    className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-ink font-bold text-xs outline-none focus:border-brand"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-subInk uppercase mb-1">Upload Photo / อัปโหลดรูป</label>
                                <label className="flex items-center justify-center gap-2 bg-canvas border border-gray-200 border-dashed p-2 rounded-xl text-subInk hover:text-ink cursor-pointer hover:border-brand transition-all text-xs font-bold h-[40px]">
                                    {uploadingImage ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            <span>Uploading...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={14} />
                                            <span>เลือกไฟล์รูปภาพ</span>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        disabled={uploadingImage}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Avatar Image URL */}
                        <div>
                            <label className="block text-[10px] font-bold text-subInk uppercase mb-1">User Avatar URL / ลิงก์รูปโปรไฟล์</label>
                            <input
                                type="text"
                                value={formData.user_avatar}
                                onChange={(e) => setFormData(prev => ({ ...prev, user_avatar: e.target.value }))}
                                placeholder="เว้นว่างไว้เพื่อใช้รูปโปรไฟล์จำลอง"
                                className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-ink font-bold text-xs outline-none focus:border-brand"
                            />
                        </div>

                        {/* Post Link / URL */}
                        <div>
                            <label className="block text-[10px] font-bold text-subInk uppercase mb-1">Social Post URL / ลิงก์ตรงโพสต์รีวิว</label>
                            <input
                                type="text"
                                value={formData.post_url}
                                onChange={(e) => setFormData(prev => ({ ...prev, post_url: e.target.value }))}
                                placeholder="เช่น https://instagram.com/p/..."
                                className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-ink font-bold text-xs outline-none focus:border-brand"
                            />
                        </div>

                        {/* Review text */}
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-subInk uppercase mb-1">Review text / คำบรรยายโพสต์</label>
                            <textarea
                                value={formData.text}
                                onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                                placeholder="พิมพ์ข้อความรีวิว คีย์เวิร์ด และแฮชแท็ก..."
                                rows={3}
                                className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-ink font-bold text-xs outline-none focus:border-brand"
                                required
                            />
                        </div>

                        {/* Stars (Google) */}
                        {formData.source === 'google' && (
                            <div>
                                <label className="block text-[10px] font-bold text-subInk uppercase mb-1">Rating / คะแนนรีวิว</label>
                                <select
                                    value={formData.rating}
                                    onChange={(e) => setFormData(prev => ({ ...prev, rating: parseInt(e.target.value) }))}
                                    className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-ink font-bold text-xs outline-none focus:border-brand"
                                >
                                    <option value="5">⭐⭐⭐⭐⭐ (5/5)</option>
                                    <option value="4">⭐⭐⭐⭐ (4/5)</option>
                                    <option value="3">⭐⭐⭐ (3/5)</option>
                                    <option value="2">⭐⭐ (2/5)</option>
                                    <option value="1">⭐ (1/5)</option>
                                </select>
                            </div>
                        )}

                        {/* Likes (FB/IG) */}
                        {formData.source !== 'google' && (
                            <div>
                                <label className="block text-[10px] font-bold text-subInk uppercase mb-1">Likes Count / จำนวนไลก์</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.likes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, likes: parseInt(e.target.value) }))}
                                    className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-ink font-bold text-xs outline-none focus:border-brand"
                                />
                            </div>
                        )}

                        {/* Comments (IG) */}
                        {formData.source === 'instagram' && (
                            <div>
                                <label className="block text-[10px] font-bold text-subInk uppercase mb-1">Comments Count / จำนวนความเห็น</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.comments}
                                    onChange={(e) => setFormData(prev => ({ ...prev, comments: parseInt(e.target.value) }))}
                                    className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-ink font-bold text-xs outline-none focus:border-brand"
                                />
                            </div>
                        )}

                        {/* Action Row */}
                        <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="bg-canvas border border-gray-200 hover:bg-gray-100 text-ink font-bold text-xs py-2.5 px-5 rounded-xl transition-all cursor-pointer"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="submit"
                                disabled={actionLoading || uploadingImage}
                                className="bg-brand text-zinc-900 font-bold text-xs py-2.5 px-5 rounded-xl flex items-center gap-1.5 transition-all hover:opacity-95 disabled:opacity-50 cursor-pointer border border-brand"
                            >
                                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                บันทึกข้อมูล
                            </button>
                        </div>

                    </form>
                </div>
            )}

            {/* CHECK-INS LIST TABLE */}
            <div className="bg-paper border border-gray-200 shadow-sm rounded-3xl overflow-hidden">
                {loading ? (
                    <div className="p-12 flex items-center justify-center">
                        <Loader2 className="animate-spin text-subInk" size={24} />
                    </div>
                ) : checkins.length === 0 ? (
                    <div className="p-12 text-center text-subInk font-mono text-xs uppercase tracking-wider">
                        📭 ยังไม่มีข้อมูลเช็กอินในระบบหลังบ้าน
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs text-ink font-medium">
                            <thead className="bg-canvas border-b border-gray-150 font-bold text-subInk">
                                <tr>
                                    <th className="p-4 w-[120px]">รูปภาพ</th>
                                    <th className="p-4">ผู้รีวิว & แพลตฟอร์ม</th>
                                    <th className="p-4 hidden md:table-cell">ข้อความ / คอมเมนต์</th>
                                    <th className="p-4 w-[90px] text-center">แสดงผล</th>
                                    <th className="p-4 w-[100px] text-right">การจัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {checkins.map(item => (
                                    <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-250 bg-gray-50 flex items-center justify-center font-mono p-1.5 text-center text-[9px] leading-tight select-none">
                                                {item.image_url === 'text_only' ? (
                                                    <span className="text-gray-400 font-bold">📝 POST-IT</span>
                                                ) : (
                                                    <img 
                                                        src={getProxiedImageUrl(item.image_url)} 
                                                        alt={item.user_name} 
                                                        crossOrigin="anonymous"
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-ink text-sm">{item.user_name}</span>
                                                <span className="text-[10px] font-mono text-subInk">{item.user_handle}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-subInk">
                                                {item.source === 'instagram' && (
                                                    <span className="inline-flex items-center gap-1 text-[#E1306C] font-semibold"><Instagram size={10} /> Instagram</span>
                                                )}
                                                {item.source === 'facebook' && (
                                                    <span className="inline-flex items-center gap-1 text-[#1877F2] font-semibold"><Facebook size={10} /> Facebook</span>
                                                )}
                                                {item.source === 'google' && (
                                                    <span className="inline-flex items-center gap-1 text-[#4285F4] font-semibold"><Star size={10} className="fill-[#4285F4]" /> Google Maps</span>
                                                )}
                                                {item.source === 'note' && (
                                                    <span className="inline-flex items-center gap-1 text-indigo-600 font-semibold"><MessageSquare size={10} /> Post-it Note</span>
                                                )}
                                                {item.rating && (
                                                    <span className="bg-yellow-100 text-yellow-800 font-bold px-1 rounded-sm">⭐{item.rating}</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-subInk flex items-center gap-1">
                                                <MapPin size={9} /> {item.location}
                                            </div>
                                        </td>
                                        <td className="p-4 max-w-xs truncate hidden md:table-cell">
                                            <p className="text-xs text-subInk line-clamp-3 leading-relaxed whitespace-pre-line">{item.text}</p>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                type="button"
                                                onClick={() => toggleVisibility(item)}
                                                className={`mx-auto w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer border ${item.is_visible !== false ? 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100' : 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100'}`}
                                            >
                                                {item.is_visible !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                                            </button>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="w-8 h-8 rounded-lg hover:bg-gray-100 text-subInk hover:text-ink flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-gray-200"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="w-8 h-8 rounded-lg hover:bg-red-50 text-subInk hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-red-100"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
        </div>
    )
}
