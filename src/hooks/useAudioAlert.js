import { useRef, useState, useEffect, useCallback } from 'react'
import { playSynthChime, getSharedAudioContext } from '../utils/audioHelper'

export const useAudioAlert = (soundUrl) => {
    const audioRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [error, setError] = useState(null)

    // Unlock audio context on first interaction
    useEffect(() => {
        const unlock = () => {
            if (audioRef.current) {
                audioRef.current.load()
            }
            const ctx = getSharedAudioContext()
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {})
            }
            window.removeEventListener('pointerdown', unlock)
            window.removeEventListener('touchstart', unlock)
            window.removeEventListener('keydown', unlock)
        }

        window.addEventListener('pointerdown', unlock, { once: true })
        window.addEventListener('touchstart', unlock, { once: true })
        window.addEventListener('keydown', unlock, { once: true })

        return () => {
            window.removeEventListener('pointerdown', unlock)
            window.removeEventListener('touchstart', unlock)
            window.removeEventListener('keydown', unlock)
        }
    }, [])

    // Init Audio
    useEffect(() => {
        if (!soundUrl) return

        const audio = new Audio(soundUrl)
        audio.loop = true
        audio.volume = 1.0 // Maximum audio volume
        audioRef.current = audio

        // Sync State
        const handlePlay = () => {
             setIsPlaying(true)
             setError(null)
        }
        const handlePause = () => setIsPlaying(false)
        const handleEnded = () => setIsPlaying(false)
        const handleError = (e) => {
             console.warn("Audio file load warning, will fallback to synthesized chime:", e)
             setIsPlaying(false)
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
        if (!audioRef.current || !soundUrl) {
            playSynthChime()
            return
        }
        
        try {
            if (!audioRef.current.paused) return
            audioRef.current.volume = 1.0
            await audioRef.current.play()
            setError(null)
        } catch (err) {
            console.warn("Audio play prevented, playing synthesized chime fallback:", err)
            playSynthChime()
            if (err.name === 'NotAllowedError') {
                setError("Autoplay blocked. Tap anywhere to enable sound.")
            } else {
                setError(err.message)
            }
        }
    }, [soundUrl])

    const stop = useCallback(() => {
        if (!audioRef.current) return
        audioRef.current.pause()
        audioRef.current.currentTime = 0
    }, [])

    return { play, stop, isPlaying, error }
}
