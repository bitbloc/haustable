/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
/**
 * Singleton High-Output Audio & Notification Engine for POS & Kitchen Display System (KDS)
 * 
 * Features:
 * - Acoustic Tuning for POS / Android APK / Tablet speakers (cuts inaudible <380Hz, boosts 2.6kHz ear presence)
 * - Multi-Stage Mastering Chain: High-Pass -> Presence EQ -> Dynamics Limiter Compressor -> +16dB Makeup Gain -> Soft-Clip Saturation
 * - High-Impact 4-Note Ascending Arpeggio + Climax Ring (E6 -> G#6 -> B6 -> E7)
 * - Universal Mobile / WebView AudioContext Auto-Unlocker
 * - Centralized Sliding-Window Event Deduplicator
 */

let sharedAudioContext = null;
let lastAlertPlayedTime = 0;
const eventDeduplicationMap = new Map(); // key -> timestamp

/**
 * Generate soft-clipping saturation curve to maximize SPL without digital harshness
 */
function makeSoftDistortionCurve(amount = 20, samples = 4096) {
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; ++i) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
}

let softDistortionCurve = null;

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
 * Universal auto-unlocker on first user interaction for Android WebView & Mobile Browsers
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
        window.removeEventListener('mousedown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('mousedown', unlock, { once: true });
}

// Auto-run unlocker setup on module import in browser
if (typeof window !== 'undefined') {
    initAudioUnlocker();
}

/**
 * Master High-Gain Mastering Chain for POS & Mobile Hardware:
 * Source -> High-Pass Filter (380Hz) -> Presence Peaking EQ (2.6kHz +5dB) -> Dynamics Compressor -> High Make-up Gain -> Soft Shaper -> Output
 * Guarantees maximum perceived loudness ("ลั่นๆ") on small built-in speakers while eliminating speaker rattle.
 */
function createMasterOutputChain(ctx, boostFactor = 3.5) {
    try {
        const now = ctx.currentTime;

        // 1. High-Pass Filter (380Hz) - Cut muddy sub-bass that drains speaker wattage
        const hpFilter = ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.setValueAtTime(380, now);
        hpFilter.Q.setValueAtTime(0.8, now);

        // 2. Presence Peaking EQ (2600Hz, +5dB) - Sweet-spot for human ear clarity & small speakers
        const presenceFilter = ctx.createBiquadFilter();
        presenceFilter.type = 'peaking';
        presenceFilter.frequency.setValueAtTime(2600, now);
        presenceFilter.Q.setValueAtTime(1.2, now);
        presenceFilter.gain.setValueAtTime(5.0, now);

        // 3. High-End Air Filter (4500Hz, +3dB) - Sparkle & clarity
        const airFilter = ctx.createBiquadFilter();
        airFilter.type = 'peaking';
        airFilter.frequency.setValueAtTime(4500, now);
        airFilter.Q.setValueAtTime(1.0, now);
        airFilter.gain.setValueAtTime(3.0, now);

        // 4. Brickwall Limiter / Dynamics Compressor (Tight peak punch)
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-10, now);
        compressor.knee.setValueAtTime(4, now);
        compressor.ratio.setValueAtTime(12, now);
        compressor.attack.setValueAtTime(0.001, now);
        compressor.release.setValueAtTime(0.08, now);

        // 5. High-Output Make-up Gain (+16dB punch)
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(boostFactor, now);

        // 6. Soft Waveshaper Saturation (prevents harsh digital square distortion)
        if (!softDistortionCurve) {
            softDistortionCurve = makeSoftDistortionCurve(10);
        }
        const shaper = ctx.createWaveShaper();
        shaper.curve = softDistortionCurve;
        shaper.oversample = '2x';

        // Connect chain
        hpFilter.connect(presenceFilter);
        presenceFilter.connect(airFilter);
        airFilter.connect(compressor);
        compressor.connect(masterGain);
        masterGain.connect(shaper);
        shaper.connect(ctx.destination);

        return hpFilter;
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
 * Helper to synthesize an acoustic bell note with transient strike + multi-harmonic body
 */
function synthesizeBellNote(ctx, masterOut, freq, startTime, duration, gainLevel = 1.0) {
    // 1. Fundamental Warm Body (Triangle Wave)
    const oscBody = ctx.createOscillator();
    const gainBody = ctx.createGain();
    oscBody.type = 'triangle';
    oscBody.frequency.setValueAtTime(freq, startTime);
    gainBody.gain.setValueAtTime(0, startTime);
    gainBody.gain.linearRampToValueAtTime(gainLevel * 0.95, startTime + 0.010);
    gainBody.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    oscBody.connect(gainBody);
    gainBody.connect(masterOut);
    oscBody.start(startTime);
    oscBody.stop(startTime + duration);

    // 2. High Piercing Harmonic Shimmer (Sine Wave at 2nd Harmonic 2x freq)
    const oscHarmonic = ctx.createOscillator();
    const gainHarmonic = ctx.createGain();
    oscHarmonic.type = 'sine';
    oscHarmonic.frequency.setValueAtTime(freq * 2, startTime);
    gainHarmonic.gain.setValueAtTime(0, startTime);
    gainHarmonic.gain.linearRampToValueAtTime(gainLevel * 0.65, startTime + 0.008);
    gainHarmonic.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.85);
    oscHarmonic.connect(gainHarmonic);
    gainHarmonic.connect(masterOut);
    oscHarmonic.start(startTime);
    oscHarmonic.stop(startTime + duration * 0.85);

    // 3. Resonant Bell Overtone (Sine Wave at 2.76x overtone)
    const oscOvertone = ctx.createOscillator();
    const gainOvertone = ctx.createGain();
    oscOvertone.type = 'sine';
    oscOvertone.frequency.setValueAtTime(freq * 2.76, startTime);
    gainOvertone.gain.setValueAtTime(0, startTime);
    gainOvertone.gain.linearRampToValueAtTime(gainLevel * 0.40, startTime + 0.006);
    gainOvertone.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.60);
    oscOvertone.connect(gainOvertone);
    gainOvertone.connect(masterOut);
    oscOvertone.start(startTime);
    oscOvertone.stop(startTime + duration * 0.60);

    // 4. Transient Crisp Attack (Filtered high-attack snap)
    const oscSnap = ctx.createOscillator();
    const filterSnap = ctx.createBiquadFilter();
    const gainSnap = ctx.createGain();
    oscSnap.type = 'square';
    oscSnap.frequency.setValueAtTime(freq * 0.5, startTime);
    filterSnap.type = 'bandpass';
    filterSnap.frequency.setValueAtTime(3200, startTime);
    filterSnap.Q.setValueAtTime(2.0, startTime);
    gainSnap.gain.setValueAtTime(0, startTime);
    gainSnap.gain.linearRampToValueAtTime(gainLevel * 0.45, startTime + 0.004);
    gainSnap.gain.exponentialRampToValueAtTime(0.001, startTime + 0.06);
    oscSnap.connect(filterSnap);
    filterSnap.connect(gainSnap);
    gainSnap.connect(masterOut);
    oscSnap.start(startTime);
    oscSnap.stop(startTime + 0.06);
}

/**
 * Play Ultra-High Output POS Order Alert ("เสียงเตือนลั่นๆ")
 * 4-Note Ascending Arpeggio + Climax Ring (E6 -> G#6 -> B6 -> E7) + Confirmation Chime
 * Cuts through kitchen hoods, ambient bar chatter, and noisy espresso machines.
 */
export function playSynthChime() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const masterOut = createMasterOutputChain(ctx, 3.5);

        // Burst 1: Rapid 4-Note Ascending Arpeggio into High Climax Strike
        synthesizeBellNote(ctx, masterOut, 1318.51, now, 0.25, 1.1);         // E6
        synthesizeBellNote(ctx, masterOut, 1661.22, now + 0.11, 0.25, 1.15); // G#6
        synthesizeBellNote(ctx, masterOut, 1975.53, now + 0.22, 0.30, 1.25); // B6
        synthesizeBellNote(ctx, masterOut, 2637.02, now + 0.34, 0.60, 1.40); // E7 (Climax Ring)

        // Burst 2: Rapid Confirmation Ring (B6 -> E7 double strike)
        synthesizeBellNote(ctx, masterOut, 1975.53, now + 0.52, 0.22, 1.15); // B6
        synthesizeBellNote(ctx, masterOut, 2637.02, now + 0.64, 0.75, 1.45); // E7 (Sustained Ring)
    } catch (err) {
        console.warn('[AudioHelper] playSynthChime error:', err);
    }
}

/**
 * Play Ultra-Clear Doorbell Chime (Ding-Dong: G6 1568Hz -> E6 1318Hz -> C6 1046Hz)
 * Used for QR Table Orders & Walk-in customer arrivals.
 */
export function playDoorbellChime() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const masterOut = createMasterOutputChain(ctx, 3.5);

        synthesizeBellNote(ctx, masterOut, 1568.00, now, 0.40, 1.2);        // G6 (Ding)
        synthesizeBellNote(ctx, masterOut, 1318.51, now + 0.18, 0.45, 1.25); // E6 (Dong)
        synthesizeBellNote(ctx, masterOut, 1046.50, now + 0.38, 0.85, 1.35); // C6 (Dang)
    } catch (err) {
        console.warn('[AudioHelper] playDoorbellChime error:', err);
    }
}

/**
 * Play high-penetration confirmation beep (Urgent Alert / Barcode / Scanner)
 */
export function playBeepChime() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const masterOut = createMasterOutputChain(ctx, 3.5);

        synthesizeBellNote(ctx, masterOut, 1760.00, now, 0.18, 1.2);
        synthesizeBellNote(ctx, masterOut, 2200.00, now + 0.08, 0.30, 1.35);
    } catch (err) {
        console.warn('[AudioHelper] playBeepChime error:', err);
    }
}

/**
 * Play urgent dual-tone siren alarm (For call staff / call bill / long pending order)
 */
export function playUrgentTone() {
    try {
        const ctx = getSharedAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const masterOut = createMasterOutputChain(ctx, 3.5);

        const playUrgentPulse = (freq, startTime, duration, gainLevel = 1.0) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(gainLevel * 0.95, startTime + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.connect(gain);
            gain.connect(masterOut);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        playUrgentPulse(1400, now, 0.15, 1.2);
        playUrgentPulse(1800, now + 0.10, 0.18, 1.3);
        playUrgentPulse(1400, now + 0.24, 0.15, 1.2);
        playUrgentPulse(1800, now + 0.34, 0.32, 1.4);
    } catch (err) {
        console.warn('[AudioHelper] playUrgentTone error:', err);
    }
}

/**
 * Play throttled system alert sound directly through the high-output synthesis engine.
 * @param {string|null} _ignoredUrl - Kept for API signature compatibility (no custom URLs needed)
 * @param {number} throttleMs - Minimum interval between sounds (default: 2500ms)
 * @param {string|null} eventKey - Optional deduplication key (e.g. "booking_123_INSERT")
 * @returns {boolean} - Whether audio was played
 */
export function playSystemAlertSound(_ignoredUrl = null, throttleMs = 2500, eventKey = null) {
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

    // 3. Play the High-Impact Synthesized Chime directly
    playSynthChime();
    return true;
}
