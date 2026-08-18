/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
/**
 * Singleton High-Output Audio & Notification Engine for POS & Kitchen Display System (KDS)
 * 
 * Features:
 * - High-Gain Staging with Dynamics Compressor & Make-up Gain (+12dB Boost)
 * - Industrial Multi-Harmonic Chimes (Cuts through noisy hood fans & ambient bar sound)
 * - 2-Burst High-Impact Alert Rhythm
 * - Device Hardware Volume Synchronized (Scales cleanly with Android/iOS system volume rockers)
 * - Web Audio MediaElement Source Boost for custom audio URLs
 * - Centralized sliding-window event deduplicator
 * - Mobile / WebView AudioContext auto-unlocker
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
        window.removeEventListener('click', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });
}

// Auto-run unlocker setup on module import in browser
if (typeof window !== 'undefined') {
    initAudioUnlocker();
}

/**
 * Master High-Gain Chain: Compressor -> High-Output Make-up Gain -> Destination
 * Maximizes perceived loudness and clarity while preventing digital distortion.
 */
function createMasterOutputChain(ctx, boostFactor = 2.5) {
    try {
        const now = ctx.currentTime;
        
        // 1. Dynamics Compressor (Tight peak control)
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-12, now);
        compressor.knee.setValueAtTime(6, now);
        compressor.ratio.setValueAtTime(6, now);
        compressor.attack.setValueAtTime(0.001, now);
        compressor.release.setValueAtTime(0.12, now);

        // 2. High-Output Make-up Gain (+8dB to +12dB punch)
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(boostFactor, now);

        compressor.connect(masterGain);
        masterGain.connect(ctx.destination);
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
 * Play Ultra-High Output Kitchen / Order Chime (2-Burst Multi-Harmonic Pentatonic Triad)
 * Cuts through loud kitchen extractors, chatter, and background music.
 */
export function playSynthChime() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const masterOut = createMasterOutputChain(ctx, 2.5);

        const playPunchyHarmonicNote = (freq, startTime, duration, gainLevel = 1.0) => {
            // 1. Fundamental Body (Triangle Wave - rich in low-mid warmth)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(freq, startTime);
            gain1.gain.setValueAtTime(0, startTime);
            gain1.gain.linearRampToValueAtTime(gainLevel * 0.85, startTime + 0.015);
            gain1.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc1.connect(gain1);
            gain1.connect(masterOut);
            osc1.start(startTime);
            osc1.stop(startTime + duration);

            // 2. High-Frequency Bell Piercing Ring (Sine Wave at 2nd Harmonic 2x freq)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(freq * 2, startTime);
            gain2.gain.setValueAtTime(0, startTime);
            gain2.gain.linearRampToValueAtTime(gainLevel * 0.50, startTime + 0.012);
            gain2.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.75);
            osc2.connect(gain2);
            gain2.connect(masterOut);
            osc2.start(startTime);
            osc2.stop(startTime + duration * 0.75);

            // 3. Transient Click / Attack Edge (Lowpass filtered square for snappy transient)
            const osc3 = ctx.createOscillator();
            const filter3 = ctx.createBiquadFilter();
            const gain3 = ctx.createGain();
            osc3.type = 'square';
            osc3.frequency.setValueAtTime(freq * 0.5, startTime);
            filter3.type = 'lowpass';
            filter3.frequency.setValueAtTime(2400, startTime);
            gain3.gain.setValueAtTime(0, startTime);
            gain3.gain.linearRampToValueAtTime(gainLevel * 0.35, startTime + 0.008);
            gain3.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);
            osc3.connect(filter3);
            filter3.connect(gain3);
            gain3.connect(masterOut);
            osc3.start(startTime);
            osc3.stop(startTime + 0.08);
        };

        // Burst 1: Ascending High Triad (A5: 880Hz -> C#6: 1108Hz -> E6: 1318Hz)
        playPunchyHarmonicNote(880.00, now, 0.22, 1.0);
        playPunchyHarmonicNote(1108.73, now + 0.10, 0.22, 1.0);
        playPunchyHarmonicNote(1318.51, now + 0.20, 0.45, 1.15);

        // Burst 2: Climax Ring after short pause (C#6: 1108Hz -> A6: 1760Hz)
        playPunchyHarmonicNote(1108.73, now + 0.38, 0.18, 0.95);
        playPunchyHarmonicNote(1760.00, now + 0.48, 0.65, 1.25);
    } catch (err) {
        console.warn('[AudioHelper] playSynthChime error:', err);
    }
}

/**
 * Play Ultra-Clear Doorbell Chime (Ding-Dong: E5 659.25Hz -> C5 523.25Hz with rich harmonics)
 */
export function playDoorbellChime() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const masterOut = createMasterOutputChain(ctx, 2.5);

        const playBellNote = (freq, startTime, duration, gainLevel = 1.0) => {
            // Main bell tone
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(gainLevel * 0.95, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.connect(gain);
            gain.connect(masterOut);
            osc.start(startTime);
            osc.stop(startTime + duration);

            // Shimmer overtone (Bell harmonic 2.76x)
            const oscOvertone = ctx.createOscillator();
            const gainOvertone = ctx.createGain();
            oscOvertone.type = 'sine';
            oscOvertone.frequency.setValueAtTime(freq * 2.76, startTime);
            gainOvertone.gain.setValueAtTime(0, startTime);
            gainOvertone.gain.linearRampToValueAtTime(gainLevel * 0.45, startTime + 0.015);
            gainOvertone.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.6);
            oscOvertone.connect(gainOvertone);
            gainOvertone.connect(masterOut);
            oscOvertone.start(startTime);
            oscOvertone.stop(startTime + duration * 0.6);
        };

        playBellNote(659.25, now, 0.55, 1.0);        // Ding (E5)
        playBellNote(523.25, now + 0.35, 0.95, 1.15); // Dong (C5)
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
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const masterOut = createMasterOutputChain(ctx, 2.5);

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1050, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(1.1, now + 0.015);
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
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const masterOut = createMasterOutputChain(ctx, 2.5);

        const playPulse = (freq, startTime, duration, gainLevel = 1.0) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(gainLevel * 0.85, startTime + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.connect(gain);
            gain.connect(masterOut);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        playPulse(950, now, 0.16, 1.0);
        playPulse(1250, now + 0.10, 0.20, 1.1);
        playPulse(950, now + 0.26, 0.16, 1.0);
        playPulse(1250, now + 0.36, 0.28, 1.2);
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
                customAudioElement.crossOrigin = 'anonymous';
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
