import { useRef, useState, useEffect, useCallback } from 'react'
import { playOrderAlert, playSynthChime, unlockAudioEngine, getSharedAudioContext } from '../utils/audioHelper'

export const useAudioAlert = (customSoundUrl = null) => {
    const loopTimerRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [error, setError] = useState(null)

    // Unlock audio context on first interaction
    useEffect(() => {
        const unlock = () => {
            unlockAudioEngine()
            window.removeEventListener('pointerdown', unlock)
            window.removeEventListener('touchstart', unlock)
            window.removeEventListener('keydown', unlock)
        }

        window.addEventListener('pointerdown', unlock, { once: true, passive: true })
        window.addEventListener('touchstart', unlock, { once: true, passive: true })
        window.addEventListener('keydown', unlock, { once: true, passive: true })

        return () => {
            window.removeEventListener('pointerdown', unlock)
            window.removeEventListener('touchstart', unlock)
            window.removeEventListener('keydown', unlock)
            if (loopTimerRef.current) {
                clearInterval(loopTimerRef.current)
                loopTimerRef.current = null
            }
        }
    }, [])

    const play = useCallback((eventKey = null) => {
        try {
            setIsPlaying(true)
            setError(null)
            playOrderAlert(eventKey, 600, 3.4)
        } catch (err) {
            console.warn('[useAudioAlert] Play failed:', err)
            setError(err.message)
        }
    }, [])

    const startLoop = useCallback((intervalMs = 12000, eventKey = null) => {
        setIsPlaying(true)
        play(eventKey)
        if (loopTimerRef.current) clearInterval(loopTimerRef.current)
        loopTimerRef.current = setInterval(() => {
            play(eventKey)
        }, intervalMs)
    }, [play])

    const stop = useCallback(() => {
        if (loopTimerRef.current) {
            clearInterval(loopTimerRef.current)
            loopTimerRef.current = null
        }
        setIsPlaying(false)
    }, [])

    return { play, startLoop, stop, isPlaying, error }
}
