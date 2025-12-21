export const getThaiDate = () => {
    // Returns YYYY-MM-DD in Thailand time
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

export const toThaiISO = (dateStr, timeStr) => {
    // Construct ISO string with explicit +07:00 offset
    // Input: dateStr (YYYY-MM-DD), timeStr (HH:MM)
    // Output: YYYY-MM-DDTHH:MM:00+07:00
    if (!dateStr || !timeStr) return null
    // Ensure timeStr matches HH:MM format (add seconds if needed or just use as is if purely for the API that accepts Timestamptz)
    // Supabase timestamptz accepts ISO 8601 with offset
    return `${dateStr}T${timeStr}:00+07:00`
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

