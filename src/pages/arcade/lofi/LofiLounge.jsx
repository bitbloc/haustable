/* Hallmark · component: LofiLounge · genre: modern-minimal · theme: Atelier (Dieter Rams + Thai Modern OKLCH)
 * pre-emit critique: P5 H5 E5 S5 R5 V5
 * states: default · hover · focus · active · playing
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { LofiEngine, LOFI_TRACKS } from './lofiEngine';
import ArcadePreview from '../ArcadePreview';

const MIXER = [
  { id: 'master', label: 'เสียงรวม' },
  { id: 'keys', label: 'เปียโนและเบส' },
  { id: 'drums', label: 'กลอง' },
  { id: 'ambience', label: 'เสียงบรรยากาศ' }
];

const SLEEP_OPTIONS = [0, 15, 30, 45];

/**
 * Owns the audio engine and all listening state. The lobby reads `playing`,
 * `track` and `chordName` and calls `toggle`.
 */
export function useLofi() {
  const engineRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [trackId, setTrackId] = useState(LOFI_TRACKS[0].id);
  const [chordName, setChordName] = useState('');
  const [volumes, setVolumes] = useState({ master: 0.8, keys: 0.8, drums: 0.7, ambience: 0.5 });
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new LofiEngine();
      engineRef.current.onChord = (name) => setChordName(name);
    }
    return engineRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (engineRef.current) engineRef.current.dispose();
    };
  }, []);

  const play = useCallback(
    (id) => {
      const next = id || trackId;
      const engine = getEngine();
      Object.entries(volumes).forEach(([name, value]) => {
        engine.volumes[name] = value;
      });
      engine.applyVolumes(0);
      engine.start(next);
      setTrackId(next);
      setPlaying(true);
    },
    [getEngine, trackId, volumes]
  );

  const pause = useCallback(() => {
    if (engineRef.current) engineRef.current.stop();
    setPlaying(false);
    setChordName('');
  }, []);

  const toggle = useCallback(() => {
    if (playing) pause();
    else play();
  }, [playing, pause, play]);

  const nextTrack = useCallback(() => {
    const index = LOFI_TRACKS.findIndex((t) => t.id === trackId);
    play(LOFI_TRACKS[(index + 1) % LOFI_TRACKS.length].id);
  }, [trackId, play]);

  const setVolume = useCallback((name, value) => {
    setVolumes((prev) => ({ ...prev, [name]: value }));
    if (engineRef.current) engineRef.current.setVolume(name, value);
  }, []);

  // Sleep timer
  useEffect(() => {
    setSleepLeft(sleepMinutes * 60);
  }, [sleepMinutes]);

  useEffect(() => {
    if (!playing || sleepLeft <= 0) return undefined;
    const id = setTimeout(() => {
      if (sleepLeft <= 1) {
        pause();
        setSleepMinutes(0);
        toast.info('ครบเวลาที่ตั้งไว้ ปิดเพลงให้แล้ว');
      } else {
        setSleepLeft(sleepLeft - 1);
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [playing, sleepLeft, pause]);

  const track = LOFI_TRACKS.find((t) => t.id === trackId) || LOFI_TRACKS[0];

  return {
    playing,
    track,
    trackId,
    chordName,
    volumes,
    sleepMinutes,
    sleepLeft,
    play,
    pause,
    toggle,
    nextTrack,
    setVolume,
    setSleepMinutes,
    getAnalyser: () => (engineRef.current ? engineRef.current.analyser : null)
  };
}

// Level bars driven by the real output signal
function LevelBars({ lofi, bars = 14, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const children = Array.from(el.children);
    const rest = () => children.forEach((child) => { child.style.height = '12%'; });
    if (!lofi.playing) {
      rest();
      return undefined;
    }
    let raf = null;
    const data = new Uint8Array(32);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const analyser = lofi.getAnalyser();
      if (!analyser) return;
      analyser.getByteFrequencyData(data);
      children.forEach((child, i) => {
        const value = data[Math.min(31, Math.floor((i / bars) * 22))] / 255;
        child.style.height = `${Math.max(12, Math.round(value * 100))}%`;
      });
    };
    raf = requestAnimationFrame(draw);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [lofi.playing, bars]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className={`flex items-end gap-1 ${className}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className="flex-1 bg-[#E9F344]" style={{ height: '12%' }} />
      ))}
    </div>
  );
}

export function LofiMiniPlayer({ lofi, onOpenStudio }) {
  if (!lofi.playing) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl bg-[#181615] text-[#FAF7F5] rounded-2xl p-3 border-2 border-[#3D3835] shadow-2xl flex items-center gap-3 z-40">
      <LevelBars lofi={lofi} bars={5} className="h-8 w-8 shrink-0" />
      <button type="button" onClick={onOpenStudio} className="min-w-0 flex-1 text-left cursor-pointer">
        <span className="block font-bold text-sm leading-normal truncate">{lofi.track.name}</span>
        <span className="block font-mono text-[11px] text-[#A8A29E] truncate">
          {lofi.track.bpm} BPM{lofi.chordName ? ` · ${lofi.chordName}` : ''}
        </span>
      </button>
      <div className="flex items-center gap-2 font-mono text-xs font-bold shrink-0">
        <button
          type="button"
          onClick={lofi.nextTrack}
          className="px-3 py-2 bg-[#2A2624] hover:bg-[#3D3835] rounded-xl border border-[#4A433F] cursor-pointer transition-colors"
        >
          ถัดไป
        </button>
        <button
          type="button"
          onClick={lofi.pause}
          className="px-3 py-2 bg-[#E9F344] hover:bg-[#d9e334] text-[#181615] rounded-xl border-2 border-[#181615] cursor-pointer transition-colors"
        >
          พัก
        </button>
      </div>
    </div>
  );
}

export function LofiStudio({ lofi, open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sleepLabel =
    lofi.sleepLeft > 0
      ? `เหลือ ${Math.floor(lofi.sleepLeft / 60)}:${String(lofi.sleepLeft % 60).padStart(2, '0')}`
      : 'ไม่ได้ตั้งเวลา';

  return (
    <div
      className="fixed inset-0 bg-[#181615]/75 flex items-start sm:items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Haus Lo-Fi"
    >
      <div className="w-full max-w-3xl bg-[#FAF7F2] border-2 border-[#181615] rounded-3xl overflow-hidden shadow-2xl my-auto">
        {/* Scene with what is playing */}
        <div className="relative bg-[#0B1026] border-b-2 border-[#181615]">
          <ArcadePreview game="lofi" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 px-3 py-2 bg-[#FAF7F2] hover:bg-[#E9F344] text-[#181615] rounded-xl border-2 border-[#181615] font-mono text-xs font-bold cursor-pointer transition-colors"
          >
            ปิด
          </button>
          <div className="absolute left-0 right-0 bottom-0 p-4 flex items-end justify-between gap-4 bg-[#0B1026]/70">
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-bold text-[#E9F344] uppercase tracking-wider">
                {lofi.playing ? 'กำลังเล่น' : 'พร้อมเล่น'} · {lofi.track.bpm} BPM
                {lofi.chordName ? ` · ${lofi.chordName}` : ''}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-[#FAF7F5] leading-normal truncate">
                {lofi.track.name}
              </h2>
            </div>
            <LevelBars lofi={lofi} bars={14} className="h-10 w-28 sm:w-40 shrink-0" />
          </div>
        </div>

        <div className="p-4 sm:p-6 flex flex-col gap-6">
          <button
            type="button"
            onClick={lofi.toggle}
            className={`w-full py-4 rounded-2xl border-2 border-[#181615] font-mono font-bold text-base cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd4924] ${
              lofi.playing ? 'bg-[#FAF7F2] text-[#181615] hover:bg-[#F2ECE4]' : 'bg-[#E9F344] text-[#181615] hover:bg-[#d9e334]'
            }`}
          >
            {lofi.playing ? 'พักเพลง' : 'เล่นเพลง'}
          </button>

          <section className="flex flex-col gap-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#57534e]">เลือกบรรยากาศ</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {LOFI_TRACKS.map((t, i) => {
                const active = t.id === lofi.trackId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => lofi.play(t.id)}
                    aria-pressed={active}
                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#181615] text-[#FAF7F5] border-[#181615]'
                        : 'bg-[#FAF7F2] text-[#181615] border-[#181615]/25 hover:border-[#181615]'
                    }`}
                  >
                    <span className={`font-mono text-xs font-bold w-6 shrink-0 ${active ? 'text-[#E9F344]' : 'text-[#78716c]'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-sm leading-normal truncate">{t.name}</span>
                      <span className={`block text-xs leading-normal truncate ${active ? 'text-[#D9D2CB]' : 'text-[#57534e]'}`}>
                        {t.mood}
                      </span>
                    </span>
                    <span className={`font-mono text-[11px] shrink-0 ${active ? 'text-[#E9F344]' : 'text-[#78716c]'}`}>
                      {t.bpm}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <h3 className="sm:col-span-2 font-mono text-xs font-bold uppercase tracking-wider text-[#57534e]">ปรับเสียง</h3>
            {MIXER.map((m) => (
              <label key={m.id} className="flex flex-col gap-1">
                <span className="flex justify-between text-sm text-[#181615] leading-normal">
                  <span>{m.label}</span>
                  <span className="font-mono text-xs text-[#57534e]">{Math.round(lofi.volumes[m.id] * 100)}</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={lofi.volumes[m.id]}
                  onChange={(e) => lofi.setVolume(m.id, parseFloat(e.target.value))}
                  className="w-full accent-[#181615] cursor-pointer"
                />
              </label>
            ))}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#57534e]">ตั้งเวลาปิดเพลง</h3>
              <span className="font-mono text-xs text-[#57534e]">{sleepLabel}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 font-mono text-sm font-bold">
              {SLEEP_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => lofi.setSleepMinutes(m)}
                  aria-pressed={lofi.sleepMinutes === m}
                  className={`py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    lofi.sleepMinutes === m
                      ? 'bg-[#181615] text-[#FAF7F5] border-[#181615]'
                      : 'bg-[#FAF7F2] text-[#181615] border-[#181615]/25 hover:border-[#181615]'
                  }`}
                >
                  {m === 0 ? 'ปิด' : `${m} นาที`}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
