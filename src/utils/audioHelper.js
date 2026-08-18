/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
/**
 * Singleton Audio Helper for POS System
 * Prevents Web Audio Context leaks, manages hardware limit (max 6 on Android WebView),
 * and provides leak-free synthesized alert chimes with sound throttling.
 */

let sharedAudioContext = null;
let lastAlertPlayedTime = 0;
let customAudioElement = null;

export function getSharedAudioContext() {
    if (typeof window === 'undefined') return null;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
            sharedAudioContext = new AudioContextClass();
        }
        if (sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume().catch(() => {});
        }
        return sharedAudioContext;
    } catch (e) {
        console.warn('[AudioHelper] Failed to obtain AudioContext:', e);
        return null;
    }
}

/**
 * Play synthesized 2-tone chime (880Hz -> 1100Hz)
 */
export function playSynthChime() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        
        // Tone 1
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.frequency.value = 880;
        gain1.gain.setValueAtTime(0.3, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc1.start(now);
        osc1.stop(now + 0.15);

        // Tone 2 (delayed)
        const delay = 0.12;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1100;
        gain2.gain.setValueAtTime(0.3, now + delay);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.25);
        osc2.start(now + delay);
        osc2.stop(now + delay + 0.25);
    } catch (err) {
        console.warn('[AudioHelper] playSynthChime error:', err);
    }
}

/**
 * Play synthesized Doorbell (E5: 659.25Hz -> C5: 523.25Hz)
 */
export function playDoorbellChime() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;

        const playNote = (freq, startTime, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = ctx.currentTime;
        playNote(659.25, now, 0.4);        // Ding
        playNote(523.25, now + 0.35, 0.6); // Dong
    } catch (err) {
        console.warn('[AudioHelper] playDoorbellChime error:', err);
    }
}

/**
 * Play synthesized high beep (800Hz)
 */
export function playBeepChime() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    } catch (err) {
        console.warn('[AudioHelper] playBeepChime error:', err);
    }
}

/**
 * Play throttled system alert sound (Custom Audio URL or fallback to synth chime)
 * @param {string|null} customUrl
 * @param {number} throttleMs - Minimum interval between sounds (default 3500ms)
 */
export function playSystemAlertSound(customUrl = null, throttleMs = 3500) {
    const now = Date.now();
    if (now - lastAlertPlayedTime < throttleMs) {
        return;
    }
    lastAlertPlayedTime = now;

    if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
        try {
            if (!customAudioElement || customAudioElement.src !== customUrl) {
                customAudioElement = new Audio(customUrl);
            } else {
                customAudioElement.currentTime = 0;
            }
            customAudioElement.play().catch(e => {
                console.warn('[AudioHelper] Custom audio play failed, falling back to synth chime:', e);
                playSynthChime();
            });
            return;
        } catch (e) {
            console.warn('[AudioHelper] Custom audio init error:', e);
        }
    }

    playSynthChime();
}
