import { useRef, useState, useEffect, useCallback } from 'react'

export const useAudioAlert = (soundUrl) => {
    const audioRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [error, setError] = useState(null)

    // Init Audio
    useEffect(() => {
        if (!soundUrl) return

        const audio = new Audio(soundUrl)
        audio.loop = true
        audioRef.current = audio

        // Sync State
        const handlePlay = () => {
             setIsPlaying(true)
             setError(null)
        }
        const handlePause = () => setIsPlaying(false)
        const handleEnded = () => setIsPlaying(false)
        const handleError = (e) => {
             console.error("Audio Error Event:", e)
             setIsPlaying(false)
             setError("Audio failed to load or play.")
        }

        audio.addEventListener('play', handlePlay)
        audio.addEventListener('pause', handlePause)
        audio.addEventListener('ended', handleEnded)
        audio.addEventListener('error', handleError)

        return () => {
            audio.removeEventListener('play', handlePlay)
            audio.removeEventListener('pause', handlePause)
            audio.removeEventListener('ended', handleEnded)
            audio.removeEventListener('error', handleError)
            audio.pause()
            audio.src = ''
        }
    }, [soundUrl])

    const play = useCallback(async () => {
        if (!audioRef.current) return
        
        try {
            // Check if already playing to avoid promise spam
            if (!audioRef.current.paused) return

            await audioRef.current.play()
            setError(null)
        } catch (err) {
            console.error("Audio Play Catch:", err)
            setIsPlaying(false)
            if (err.name === 'NotAllowedError') {
                setError("Autoplay blocked. Tap anywhere to enable sound.")
            } else {
                setError(err.message)
            }
        }
    }, [])

    const stop = useCallback(() => {
        if (!audioRef.current) return
        audioRef.current.pause()
        audioRef.current.currentTime = 0
    }, [])

    return { play, stop, isPlaying, error }
}
