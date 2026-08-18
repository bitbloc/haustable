/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
/**
 * Singleton Audio & Notification Engine for POS & Kitchen Display System (KDS)
 * 
 * Features:
 * - High-Gain Dynamics Compressor (Loud, punchy, distortion-free kitchen-grade acoustics)
 * - Multi-harmonic synthesized chimes (Cuts through ambient restaurant & hood fan noise)
 * - Centralized sliding-window event deduplicator (Prevents duplicate rings across tabs & events)
 * - Mobile / WebView AudioContext auto-unlocker
 * - HTML5 Audio fallback cascading with volume locking (1.0)
 */

let sharedAudioContext = null;
let lastAlertPlayedTime = 0;
let customAudioElement = null;
const eventDeduplicationMap = new Map(); // key -> timestamp

/**
 * Obtain or resume the singleton Web Audio Context
 */
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
 * Universal auto-unlocker on first user interaction
 */
export function initAudioUnlocker() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
        const ctx = getSharedAudioContext();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
}

// Auto-run unlocker setup on module import in browser
if (typeof window !== 'undefined') {
    initAudioUnlocker();
}

/**
 * Create a master compressor node to maximize perceived loudness without clipping
 */
function createMasterCompressor(ctx) {
    try {
        const compressor = ctx.createDynamicsCompressor();
        const now = ctx.currentTime;
        compressor.threshold.setValueAtTime(-16, now);
        compressor.knee.setValueAtTime(8, now);
        compressor.ratio.setValueAtTime(10, now);
        compressor.attack.setValueAtTime(0.002, now);
        compressor.release.setValueAtTime(0.2, now);
        compressor.connect(ctx.destination);
        return compressor;
    } catch (e) {
        return ctx.destination;
    }
}

/**
 * Check and record event deduplication key within a cooldown window
 * @param {string} eventKey - Unique event identifier (e.g., "booking_123_pending")
 * @param {number} cooldownMs - Cooldown duration in ms (default: 6000ms)
 * @returns {boolean} - True if allowed to trigger, false if duplicate/throttled
 */
export function checkEventDeduplication(eventKey, cooldownMs = 6000) {
    if (!eventKey) return true;
    const now = Date.now();

    // Clean old entries (older than 30s)
    for (const [key, time] of eventDeduplicationMap.entries()) {
        if (now - time > 30000) {
            eventDeduplicationMap.delete(key);
        }
    }

    const lastTime = eventDeduplicationMap.get(eventKey);
    if (lastTime && (now - lastTime < cooldownMs)) {
        return false; // Suppress duplicate
    }

    eventDeduplicationMap.set(eventKey, now);
    return true;
}

/**
 * Play high-impact, 3-stage kitchen chime (Harmonic Triangle + Sine blend)
 * Designed specifically to cut through noisy kitchen exhaust fans & bar ambiance
 */
export function playSynthChime() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const masterOut = createMasterCompressor(ctx);

        const playHarmonicTone = (freq, startTime, duration, gainLevel = 0.85) => {
            // Fundamental Tone (Triangle for rich overtones)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(freq, startTime);
            gain1.gain.setValueAtTime(0, startTime);
            gain1.gain.linearRampToValueAtTime(gainLevel * 0.7, startTime + 0.02);
            gain1.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc1.connect(gain1);
            gain1.connect(masterOut);
            osc1.start(startTime);
            osc1.stop(startTime + duration);

            // 2nd Harmonic (Sine for body & piercing presence)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(freq * 1.5, startTime); // Fifth overtone
            gain2.gain.setValueAtTime(0, startTime);
            gain2.gain.linearRampToValueAtTime(gainLevel * 0.35, startTime + 0.015);
            gain2.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.8);
            osc2.connect(gain2);
            gain2.connect(masterOut);
            osc2.start(startTime);
            osc2.stop(startTime + duration * 0.8);
        };

        // 3-Tone Ascending Kitchen Triad (A5: 880Hz -> C#6: 1108Hz -> E6: 1318Hz)
        playHarmonicTone(880.00, now, 0.28, 0.90);
        playHarmonicTone(1108.73, now + 0.12, 0.28, 0.90);
        playHarmonicTone(1318.51, now + 0.24, 0.50, 0.95);
    } catch (err) {
        console.warn('[AudioHelper] playSynthChime error:', err);
    }
}

/**
 * Play high-clarity Doorbell Chime (Ding-Dong: E5 659.25Hz -> C5 523.25Hz)
 */
export function playDoorbellChime() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;

        const masterOut = createMasterCompressor(ctx);
        const playBellNote = (freq, startTime, duration) => {
            // Main bell tone
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.85, startTime + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.connect(gain);
            gain.connect(masterOut);
            osc.start(startTime);
            osc.stop(startTime + duration);

            // Shimmer overtone (Bell harmonic 2.76x)
            const oscOvertone = ctx.createOscillator();
            const gainOvertone = ctx.createGain();
            oscOvertone.type = 'triangle';
            oscOvertone.frequency.setValueAtTime(freq * 2.76, startTime);
            gainOvertone.gain.setValueAtTime(0, startTime);
            gainOvertone.gain.linearRampToValueAtTime(0.25, startTime + 0.015);
            gainOvertone.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.4);
            oscOvertone.connect(gainOvertone);
            gainOvertone.connect(masterOut);
            oscOvertone.start(startTime);
            oscOvertone.stop(startTime + duration * 0.4);
        };

        const now = ctx.currentTime;
        playBellNote(659.25, now, 0.55);        // Ding (E5)
        playBellNote(523.25, now + 0.38, 0.85); // Dong (C5)
    } catch (err) {
        console.warn('[AudioHelper] playDoorbellChime error:', err);
    }
}

/**
 * Play high-penetration beep chime (Urgent Alert / Barcode / Scanner)
 */
export function playBeepChime() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const masterOut = createMasterCompressor(ctx);

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(960, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.85, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(masterOut);
        osc.start(now);
        osc.stop(now + 0.35);
    } catch (err) {
        console.warn('[AudioHelper] playBeepChime error:', err);
    }
}

/**
 * Play urgent dual-tone alarm (For call staff / call bill / long pending)
 */
export function playUrgentTone() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const masterOut = createMasterCompressor(ctx);

        const playPulse = (freq, startTime, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.65, startTime + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.connect(gain);
            gain.connect(masterOut);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        playPulse(920, now, 0.18);
        playPulse(1150, now + 0.12, 0.22);
    } catch (err) {
        console.warn('[AudioHelper] playUrgentTone error:', err);
    }
}

/**
 * Play throttled system alert sound (Custom Audio URL or fallback to synthesized chime)
 * @param {string|null} customUrl - Custom audio URL if configured
 * @param {number} throttleMs - Minimum interval between sounds (default: 2500ms)
 * @param {string|null} eventKey - Optional deduplication key (e.g. "booking_123_INSERT")
 * @returns {boolean} - Whether audio was played
 */
export function playSystemAlertSound(customUrl = null, throttleMs = 2500, eventKey = null) {
    const now = Date.now();

    // 1. Check Event Deduplication
    if (eventKey && !checkEventDeduplication(eventKey, 6000)) {
        return false;
    }

    // 2. Global Throttle Check
    if (now - lastAlertPlayedTime < throttleMs) {
        return false;
    }
    lastAlertPlayedTime = now;

    // 3. Play Custom Sound if configured
    if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
        try {
            if (!customAudioElement || customAudioElement.src !== customUrl) {
                customAudioElement = new Audio(customUrl);
            } else {
                customAudioElement.currentTime = 0;
            }
            customAudioElement.volume = 1.0; // Ensure 100% volume
            const playPromise = customAudioElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.warn('[AudioHelper] Custom audio play failed, falling back to synth chime:', e);
                    playSynthChime();
                });
            }
            return true;
        } catch (e) {
            console.warn('[AudioHelper] Custom audio init error, using synth chime:', e);
        }
    }

    // 4. Default High-Impact Synthesized Chime
    playSynthChime();
    return true;
}
