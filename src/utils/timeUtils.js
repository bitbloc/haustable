export const getThaiDate = () => {
    // Returns YYYY-MM-DD in Thailand time
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

export const toThaiISO = (dateStr, timeStr) => {
    // Construct ISO string with explicit +07:00 offset
    // Input: dateStr (YYYY-MM-DD), timeStr (HH:MM or HH.MM)
    // Output: YYYY-MM-DDTHH:MM:00+07:00
    if (!dateStr || !timeStr) return null
    
    // Auto-fix dot notation (e.g. "19.00" -> "19:00", "21.30" -> "21:30")
    let cleanTime = String(timeStr).trim().replace('.', ':')
    const parts = cleanTime.split(':')
    if (parts.length >= 2) {
        const hh = parts[0].padStart(2, '0')
        const mm = parts[1].padStart(2, '0')
        cleanTime = `${hh}:${mm}`
    }
    
    return `${dateStr}T${cleanTime}:00+07:00`
}

export const formatThaiTime = (isoString) => {
    if (!isoString) return '-'
    // Forces display in Bangkok time
    return new Date(isoString).toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

export const formatThaiTimeOnly = (isoString) => {
    if (!isoString) return '-'
    return new Date(isoString).toLocaleTimeString('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit'
    })
}

export const formatThaiDateOnly = (isoString) => {
    if (!isoString) return '-'
    return new Date(isoString).toLocaleDateString('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'short',
    })
}

export const formatThaiDateLong = (isoString) => {
    if (!isoString) return '-'
    return new Date(isoString).toLocaleDateString('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    })
}

export const calculateDurationMinutes = (startTime, endTime = null) => {
    if (!startTime) return 0
    const start = new Date(startTime).getTime()
    const end = endTime ? new Date(endTime).getTime() : Date.now()
    if (isNaN(start) || isNaN(end)) return 0
    return Math.max(0, Math.floor((end - start) / (1000 * 60)))
}

export const formatThaiDuration = (minutes) => {
    if (minutes === undefined || minutes === null || isNaN(minutes) || minutes < 0) return '-'
    if (minutes < 60) {
        return `${minutes} นาที`
    }
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hrs} ชม. ${mins} น.` : `${hrs} ชม.`
}

export const formatShortDuration = (minutes) => {
    if (minutes === undefined || minutes === null || isNaN(minutes) || minutes < 0) return '-'
    if (minutes < 60) {
        return `${minutes}m`
    }
    const hrs = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

