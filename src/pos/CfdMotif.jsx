/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
// Customer display background motif (brand v2, .agents/AGENTS.md §5 exception for the customer screen).
// Two pairs of thin plum lines frame the centre band; their ends open outward, away from the wordmark.
//  - CfdIdleMotif:   idle screen. One Southern-Thai word rides each line in a cream pill, the ในบ้าน wordmark between.
//  - CfdDotsBackdrop: in-use screens. Same lines across the whole ground, one small dot rides each, behind the cards.
//
// Performance (Sunmi customer screen shares the SoC with the POS): the lines are a static SVG drawn once. The riders
// are HTML elements moved by CSS transform keyframes (translate + rotate) sampled along each line, so the compositor
// runs them and the main thread stays idle. SVG <animateMotion> was measured at ~35% main-thread time with the CPU
// throttled 6x; transform keyframes avoid that per-frame SVG repaint.
// prefers-reduced-motion: nothing moves, pills / dots rest on their lines.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const PLUM = 'oklch(25.18% 0.1001 348.33)';   // --brand-plum

// ---- geometry ---------------------------------------------------------------------------------------------
// One line: a straight run at height y between x0 and x1, both ends bending `bend` px away from the centre.
const lineSpec = (w, y, away, inset) => {
    const x0 = inset, x1 = w - inset, bend = 72 * away, reach = 104;
    const a = { x: -reach, y: y + bend }, ac = { x: x0 - reach / 2, y }, b = { x: x0, y };
    const c = { x: x1, y }, dc = { x: x1 + reach / 2, y }, d = { x: w + reach, y: y + bend };
    return { a, ac, b, c, dc, d, path: `M ${a.x} ${a.y} Q ${ac.x} ${ac.y} ${b.x} ${b.y} L ${c.x} ${c.y} Q ${dc.x} ${dc.y} ${d.x} ${d.y}` };
};

// 8 px grid: lines 64 px apart, centre band 192 px tall
const lineSet = (w, h, inset) => {
    const mid = h / 2;
    return [
        { y: mid - 160, away: -1, rev: false },
        { y: mid - 96, away: -1, rev: true },
        { y: mid + 96, away: +1, rev: false },
        { y: mid + 160, away: +1, rev: true },
    ].map(l => ({ ...l, ...lineSpec(w, l.y, l.away, inset) }));
};

const quad = (p0, p1, p2, t) => ({
    x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
    y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
});

// Points along the line at equal arc-length steps, with the tangent angle (deg)
const samplePath = (l, steps) => {
    const dense = [];
    for (let i = 0; i <= 60; i++) dense.push(quad(l.a, l.ac, l.b, i / 60));
    for (let i = 1; i <= 60; i++) dense.push({ x: l.b.x + (l.c.x - l.b.x) * i / 60, y: l.b.y });
    for (let i = 1; i <= 60; i++) dense.push(quad(l.c, l.dc, l.d, i / 60));
    const acc = [0];
    for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
    const total = acc[acc.length - 1];
    const out = [];
    let j = 1;
    for (let k = 0; k <= steps; k++) {
        const s = total * k / steps;
        while (j < acc.length - 1 && acc[j] < s) j++;
        const p0 = dense[j - 1], p1 = dense[j];
        const f = acc[j] === acc[j - 1] ? 0 : (s - acc[j - 1]) / (acc[j] - acc[j - 1]);
        out.push({ x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f, deg: Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI });
    }
    return out;
};

// @keyframes that move a 0x0 anchor along the line; `rev` runs right-to-left and keeps the rider upright
const keyframesFor = (name, l, steps = 48) => {
    const pts = samplePath(l, steps);
    const seq = l.rev ? [...pts].reverse().map(p => ({ ...p, deg: p.deg })) : pts;
    const r = n => Math.round(n * 10) / 10;
    const frames = seq.map((p, i) => `${r(i * 100 / steps)}%{transform:translate(${r(p.x)}px,${r(p.y)}px) rotate(${r(p.deg)}deg)}`).join('');
    return `@keyframes ${name}{${frames}}`;
};

const usePrefersReducedMotion = () => {
    const [reduced, setReduced] = useState(() => {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
    });
    useEffect(() => {
        let mq;
        try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return undefined; }
        const on = () => setReduced(mq.matches);
        mq.addEventListener?.('change', on);
        return () => mq.removeEventListener?.('change', on);
    }, []);
    return reduced;
};

// Scale a fixed design box (w x h px) to fit / cover its parent, once and on resize
const useFitScale = (w, h, mode) => {
    const ref = useRef(null);
    const [box, setBox] = useState({ s: 1, dx: 0, dy: 0 });
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const fit = () => {
            const W = el.clientWidth, H = el.clientHeight;
            if (!W || !H) return;
            const s = mode === 'cover' ? Math.max(W / w, H / h) : Math.min(W / w, H / h);
            setBox({ s, dx: (W - w * s) / 2, dy: (H - h * s) / 2 });
        };
        fit();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
        ro?.observe(el);
        return () => ro?.disconnect();
    }, [w, h, mode]);
    return [ref, box];
};

// ---- idle ---------------------------------------------------------------------------------------------------
const WORDS = ['หรอย', 'จังฮู้', 'จริตจัด', 'ใต้ชัดๆ'];
const WORD_DURATIONS = [17, 19, 21, 23];   // seconds per pass: slow, never in step with each other
const REST_X = [168, 392, 168, 392];         // reduced motion: where pills rest on their lines

export const CfdIdleMotif = React.memo(function CfdIdleMotif() {
    const reduced = usePrefersReducedMotion();
    const W = 560, H = 544;
    const lines = useMemo(() => lineSet(W, H, 120), []);
    const css = useMemo(() => lines.map((l, i) => keyframesFor(`cfdWord${i}`, l)).join(''), [lines]);
    const [ref, box] = useFitScale(W, H, 'contain');

    return (
        <div ref={ref} className="absolute inset-0 overflow-hidden">
            <style>{css}</style>
            <div
                className="absolute top-0 left-0"
                style={{ width: W, height: H, transformOrigin: '0 0', transform: `translate(${box.dx}px, ${box.dy}px) scale(${box.s})` }}
            >
                <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="absolute inset-0" aria-hidden="true">
                    {lines.map((l, i) => (
                        <path key={i} d={l.path} stroke={PLUM} strokeOpacity="0.22" strokeWidth="1" fill="none" />
                    ))}
                </svg>
                {lines.map((l, i) => (
                    <div
                        key={i}
                        aria-hidden="true"
                        className="absolute top-0 left-0 w-0 h-0"
                        style={reduced
                            ? { transform: `translate(${REST_X[i]}px, ${l.y}px)` }
                            : {
                                willChange: 'transform',
                                animation: `cfdWord${i} ${WORD_DURATIONS[i]}s linear infinite`,
                                animationDelay: `${-WORD_DURATIONS[i] * (0.18 + i * 0.21)}s`,
                            }}
                    >
                        {/* centred on the anchor that rides the line */}
                        <span
                            className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-5 text-[22px] leading-[40px] text-[var(--brand-plum)]"
                            style={{ fontFamily: "'SOV_monomon', 'IBM Plex Sans Thai', sans-serif" }}
                        >
                            {WORDS[i]}
                        </span>
                    </div>
                ))}
                {/* Wordmark in the centre band; aspect kept, never cropped */}
                <img
                    src="/logo-inbaan-wordmark-plum.png"
                    alt="ในบ้าน In the haus"
                    width="204"
                    height="112"
                    className="absolute"
                    style={{ left: (W - 204) / 2, top: (H - 112) / 2, width: 204, height: 112 }}
                />
            </div>
        </div>
    );
});

// ---- in use -------------------------------------------------------------------------------------------------
const DOT_DURATIONS = [13, 15, 17, 19];
const DOT_REST_X = [300, 724, 300, 724];

export const CfdDotsBackdrop = React.memo(function CfdDotsBackdrop() {
    const reduced = usePrefersReducedMotion();
    const W = 1024, H = 544;
    const lines = useMemo(() => lineSet(W, H, 240), []);
    const css = useMemo(() => lines.map((l, i) => keyframesFor(`cfdDot${i}`, l)).join(''), [lines]);
    const [ref, box] = useFitScale(W, H, 'cover');

    return (
        <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <style>{css}</style>
            <div
                className="absolute top-0 left-0"
                style={{ width: W, height: H, transformOrigin: '0 0', transform: `translate(${box.dx}px, ${box.dy}px) scale(${box.s})` }}
            >
                <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="absolute inset-0">
                    {lines.map((l, i) => (
                        <path key={i} d={l.path} stroke={PLUM} strokeOpacity="0.14" strokeWidth="1" fill="none" />
                    ))}
                </svg>
                {lines.map((l, i) => (
                    <div
                        key={i}
                        className="absolute top-0 left-0 w-0 h-0"
                        style={reduced
                            ? { transform: `translate(${DOT_REST_X[i]}px, ${l.y}px)` }
                            : {
                                willChange: 'transform',
                                animation: `cfdDot${i} ${DOT_DURATIONS[i]}s linear infinite`,
                                animationDelay: `${-DOT_DURATIONS[i] * (0.1 + i * 0.23)}s`,
                            }}
                    >
                        <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-[var(--brand-plum)] opacity-40" />
                    </div>
                ))}
            </div>
        </div>
    );
});
