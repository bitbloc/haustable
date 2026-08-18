import { useRef, useState, useEffect, useCallback } from 'react'

// Web Audio Fallback Chime (Plays a clean, pleasant two-tone kitchen alert if soundUrl fails or not set)
const playSynthesizedChime = () => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (!AudioCtx) return
        const ctx = new AudioCtx()
        if (ctx.state === 'suspended') {
            ctx.resume()
        }

        const now = ctx.currentTime
        // Note 1 (E5 - 659Hz)
        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(659.25, now)
        gain1.gain.setValueAtTime(0.2, now)
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
        osc1.connect(gain1)
        gain1.connect(ctx.destination)
        osc1.start(now)
        osc1.stop(now + 0.4)

        // Note 2 (A5 - 880Hz)
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(880.00, now + 0.15)
        gain2.gain.setValueAtTime(0.25, now + 0.15)
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.start(now + 0.15)
        osc2.stop(now + 0.6)
    } catch (e) {
        console.warn('Synthesized chime error:', e)
    }
}

export const useAudioAlert = (soundUrl) => {
    const audioRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [error, setError] = useState(null)

    // Unlock audio on first interaction
    useEffect(() => {
        const unlock = () => {
            if (audioRef.current) {
                audioRef.current.load()
            }
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext
                if (AudioCtx) {
                    const ctx = new AudioCtx()
                    if (ctx.state === 'suspended') ctx.resume()
                }
            } catch (e) {}
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
            playSynthesizedChime()
            return
        }
        
        try {
            if (!audioRef.current.paused) return
            await audioRef.current.play()
            setError(null)
        } catch (err) {
            console.warn("Audio play prevented, playing synthesized chime fallback:", err)
            playSynthesizedChime()
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
