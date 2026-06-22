/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
/* Hallmark · macrostructure: Bento Grid · N5 Floating Nav Pill · Ft2 Inline footer
 * theme: custom · vibe: "late-night cyber game lobby" · paper: oklch(14% 0.015 110) · accent: oklch(88% 0.16 110)
 * display: Space Grotesk · body: Geist · axes: dark / geometric-sans / chromatic-other (green-yellow ~110°)
 * studied: no · context: inferred · v1.1.0
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import FlappyCatGame from './FlappyCatGame';
import { Gamepad2, Music, Tag, Trophy, Award, X, MapPin, CheckCircle, ShieldAlert, RefreshCw, LogIn } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ArcadeLobby() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState('game'); // 'game' | 'music' | 'promo'
  const [loading, setLoading] = useState(true);

  // Authentication & Claiming states
  const [session, setSession] = useState(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimScore, setClaimScore] = useState(0);
  const [claimStatus, setClaimStatus] = useState('idle'); // 'idle' | 'checking_gps' | 'saving' | 'success' | 'error'
  const [claimError, setClaimError] = useState('');
  const [distance, setDistance] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const SHOP_LAT = 17.39008981227407;
  const SHOP_LNG = 104.79292770946343;
  const MAX_RADIUS_KM = 1.0; // Allowed radius limit (1 km)

  function getDistanceInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Fetch session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Restore pending claim score if they had to log in via LINE
  useEffect(() => {
    if (session) {
      const pendingScore = localStorage.getItem('pending_claim_score');
      const pendingTs = localStorage.getItem('pending_claim_ts');
      if (pendingScore && pendingTs) {
        const elapsed = Date.now() - parseInt(pendingTs);
        if (elapsed < 300000) { // 5 minutes validity
          setClaimScore(parseInt(pendingScore));
          setShowClaimModal(true);
          setClaimStatus('idle');
        }
        localStorage.removeItem('pending_claim_score');
        localStorage.removeItem('pending_claim_ts');
      }
    }
  }, [session]);

  // Fetch real-time top scores from Supabase leaderboard
  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      // Fetch top 10 scores
      const { data, error } = await supabase
        .from('leaderboard')
        .select(`
          id,
          score,
          created_at,
          display_name,
          profiles (
            display_name,
            nickname
          )
        `)
        .order('score', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Map display_name / profiles display_name/nickname to entry for easier Phaser usage
      const formatted = (data || []).map(entry => ({
        id: entry.id,
        score: entry.score,
        display_name: entry.display_name || entry.profiles?.nickname || entry.profiles?.display_name || 'GUEST'
      }));

      setLeaderboard(formatted);
    } catch (e) {
      console.error('Failed to fetch leaderboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Callback triggered when the Phaser game ends
  const handleGameOver = (score) => {
    console.log(`Game Over! Score achieved: ${score}`);
    fetchLeaderboard();
  };

  const handleClaimScore = (score) => {
    setClaimScore(score);
    setShowClaimModal(true);
    setClaimStatus('idle');
    setClaimError('');
    setDistance(null);
  };

  const handleLineLogin = async () => {
    try {
      setGpsLoading(true);
      // Save pending score before redirecting
      localStorage.setItem('pending_claim_score', claimScore.toString());
      localStorage.setItem('pending_claim_ts', Date.now().toString());

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'line',
        options: {
          redirectTo: window.location.href
        }
      });
      if (error) throw error;
    } catch (e) {
      setGpsLoading(false);
      alert('เข้าสู่ระบบ LINE ล้มเหลว กรุณาลองใหม่อีกครั้ง');
    }
  };

  const processClaimScore = () => {
    if (!navigator.geolocation) {
      setClaimError('เบราว์เซอร์ของคุณไม่รองรับการระบุพิกัด GPS');
      setClaimStatus('error');
      return;
    }

    setClaimStatus('checking_gps');
    setGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const clientLat = position.coords.latitude;
        const clientLng = position.coords.longitude;
        
        const dist = getDistanceInKm(clientLat, clientLng, SHOP_LAT, SHOP_LNG);
        setDistance(dist);
        setGpsLoading(false);

        if (dist > MAX_RADIUS_KM) {
          setClaimError(`คุณอยู่นอกพื้นที่ร้าน! ระยะห่างปัจจุบันคือ ${dist.toFixed(2)} กม. (อนุญาตไม่เกิน ${MAX_RADIUS_KM} กม.)`);
          setClaimStatus('error');
        } else {
          // Success location, save score to DB
          await saveScoreToDatabase();
        }
      },
      (error) => {
        setGpsLoading(false);
        console.error('GPS permission error:', error);
        setClaimError('กรุณาอนุญาตสิทธิ์เข้าถึงตำแหน่งที่ตั้ง (GPS) เพื่อยืนยันว่าคุณเล่นอยู่ในร้านจริง');
        setClaimStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const saveScoreToDatabase = async () => {
    try {
      setClaimStatus('saving');
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, nickname')
        .eq('id', session.user.id)
        .single();

      if (profileError) throw profileError;

      const nameToDisplay = profile.nickname || profile.display_name || 'MEMBER';

      // Check if there is an existing score for this user
      const { data: existingLeaderboard, error: selectError } = await supabase
        .from('leaderboard')
        .select('id, score')
        .eq('profile_id', session.user.id)
        .maybeSingle();

      if (selectError) throw selectError;

      if (existingLeaderboard) {
        // Only update if the new score is higher than the existing high score
        if (claimScore > existingLeaderboard.score) {
          const { error: updateError } = await supabase
            .from('leaderboard')
            .update({
              score: claimScore,
              display_name: nameToDisplay,
              created_at: new Date().toISOString()
            })
            .eq('id', existingLeaderboard.id);

          if (updateError) throw updateError;
        }
      } else {
        // Insert new score if none exists
        const { error: insertError } = await supabase
          .from('leaderboard')
          .insert({
            profile_id: session.user.id,
            display_name: nameToDisplay,
            score: claimScore
          });

        if (insertError) throw insertError;
      }

      // Confetti celebration
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#DFFF00', '#FF00FF', '#00FFFF', '#FFFFFF']
      });

      setClaimStatus('success');
      // Refresh the high score leaderboard
      fetchLeaderboard();
    } catch (e) {
      console.error('Failed to submit score:', e);
      setClaimError('ไม่สามารถบันทึกคะแนน กรุณาลองใหม่อีกครั้ง');
      setClaimStatus('error');
    }
  };

  const handleRequireLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'line',
        options: {
          redirectTo: window.location.origin + '/arcade'
        }
      });
      if (error) throw error;
    } catch (e) {
      alert('เข้าสู่ระบบ LINE ล้มเหลว กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <div id="arcade-lobby-root" className="min-h-screen flex flex-col relative select-none">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Geist:wght@300;400;500;600&display=swap');

        html, body {
          overflow-x: clip !important;
        }

        #arcade-lobby-root {
          --color-paper: oklch(14% 0.015 110);
          --color-paper-2: oklch(18% 0.018 110);
          --color-paper-3: oklch(22% 0.018 110);
          --color-ink: oklch(96% 0.008 110);
          --color-ink-2: oklch(76% 0.008 110);
          --color-rule: oklch(28% 0.012 110);
          --color-muted: oklch(58% 0.010 110);
          --color-accent: oklch(88% 0.16 110);
          --color-accent-ink: oklch(10% 0.015 110);
          --color-focus: oklch(88% 0.20 110);
          
          --dur-short: 200ms;
          --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
          
          background-color: var(--color-paper);
          color: var(--color-ink);
          font-family: 'Geist', sans-serif;
        }

        #arcade-lobby-root .display-font {
          font-family: 'Space Grotesk', sans-serif;
          letter-spacing: -0.03em;
        }

        #arcade-lobby-root .btn-tab {
          transition: background-color var(--dur-short) var(--ease-out), color var(--dur-short) var(--ease-out), box-shadow var(--dur-short) var(--ease-out);
        }
        #arcade-lobby-root .btn-tab:focus-visible {
          outline: 2px solid var(--color-focus);
          outline-offset: 1px;
        }
        
        #arcade-lobby-root .btn-action {
          transition: background-color var(--dur-short) var(--ease-out), color var(--dur-short) var(--ease-out), transform var(--dur-short) var(--ease-out);
        }
        #arcade-lobby-root .btn-action:hover:not(:disabled) {
          filter: brightness(1.1);
        }
        #arcade-lobby-root .btn-action:active:not(:disabled) {
          transform: scale(0.98);
        }
        #arcade-lobby-root .btn-action:focus-visible {
          outline: 2px solid var(--color-focus);
          outline-offset: 2px;
        }

        #arcade-lobby-root .glow-bg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 384px;
          background: radial-gradient(circle at top, oklch(88% 0.16 110 / 0.06) 0%, transparent 70%);
          pointer-events: none;
          filter: blur(40px);
        }

        #arcade-lobby-root .grid-bg {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(to bottom, rgba(255, 255, 255, 0.015) 1px, transparent 1px),
            linear-gradient(to right, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }
      `}</style>

      {/* Sleek Modern Dark Grid Decoration & Radial Glow */}
      <div className="grid-bg" />
      <div className="glow-bg" />

      {/* Floating Header (N5 Floating Pill style) */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-3 p-1.5 bg-[#141416]/80 backdrop-blur-md border border-neutral-800 rounded-full shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] w-[calc(100%-2rem)] max-w-2xl select-none">
        {/* Brand Wordmark */}
        <div className="flex items-center gap-2 pl-3.5">
          <img 
            src="/logo-secondary.png" 
            alt="ในบ้าน" 
            className="h-5 w-auto object-contain brightness-0 invert" 
          />
          <div className="border-l border-neutral-800/80 pl-2.5 hidden sm:block">
            <h1 className="text-[10px] font-bold font-mono tracking-widest text-neutral-400 display-font">
              PLAYGROUND
            </h1>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-[#0A0A0C]/50 p-0.5 rounded-full border border-neutral-800/60">
          <button
            onClick={() => setActiveTab('game')}
            className={`btn-tab flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider display-font ${
              activeTab === 'game' 
                ? 'bg-[#DFFF00] text-black font-extrabold shadow-[0_2px_8px_rgba(223,255,0,0.15)]' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-3 h-3" />
            <span>เล่นเกม</span>
          </button>
          
          <Link
            to="/song"
            className="btn-tab flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider text-neutral-400 hover:text-white display-font"
          >
            <Music className="w-3 h-3" />
            <span>ขอเพลง</span>
          </Link>
        </div>

        {/* Login Status */}
        <div className="pr-1.5">
          {session ? (
            <div className="flex items-center gap-1 px-3 py-1.5 text-[8px] font-mono text-[#DFFF00] bg-[#DFFF00]/10 rounded-full border border-[#DFFF00]/20">
              <CheckCircle className="w-2.5 h-2.5 text-[#06C755]" />
              <span className="font-semibold uppercase tracking-wider">Logged In</span>
            </div>
          ) : (
            <button
              onClick={handleRequireLogin}
              className="btn-action flex items-center gap-1 px-3 py-1.5 bg-[#06C755] text-white text-[8px] font-bold font-mono uppercase tracking-wider rounded-full cursor-pointer"
            >
              <LogIn className="w-2.5 h-2.5" />
              <span>LINE Login</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Lobby Container — Bento Grid Layout */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 pt-24 pb-16 z-10 flex flex-col justify-center">
        
        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
          
          {/* Cell 1: Phaser Game (Hero block, spans 7 columns on lg) */}
          <div className="lg:col-span-7 flex flex-col bg-[#141416]/60 border border-neutral-800/80 rounded-3xl p-4 sm:p-6 backdrop-blur-sm relative overflow-hidden shadow-2xl">
            {activeTab === 'game' && (
              <div className="w-full flex flex-col items-center">
                <div className="w-full aspect-[6/7] max-w-[500px]">
                  <FlappyCatGame 
                    onGameOver={handleGameOver} 
                    leaderboard={leaderboard} 
                    onClaimScore={handleClaimScore} 
                    session={session} 
                    onRequireLogin={handleRequireLogin} 
                  />
                </div>
                <div className="mt-4 text-center text-[11px] text-neutral-400 font-mono leading-relaxed max-w-sm">
                  <span className="text-[#DFFF00] font-bold">⚡ TIP:</span> แตะหน้าจอช่วยแมวส้มหลบหลีกอุปสรรคและมีดครัวบินเพื่อเก็บแต้ม!
                </div>
              </div>
            )}
          </div>

          {/* Right Column Group: Leaderboard & Info (Spans 5 columns on lg) */}
          <div className="lg:col-span-5 flex flex-col gap-6 w-full">
            
            {/* Cell 2: Leaderboard (Hall of Fame) */}
            <div className="bg-[#141416]/60 border border-neutral-800/80 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
              <div className="flex items-center justify-between mb-5 border-b border-neutral-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#DFFF00]" />
                  <h2 className="text-sm font-bold font-mono tracking-widest text-[#DFFF00] uppercase display-font">Hall of Fame</h2>
                </div>
                <button 
                  onClick={fetchLeaderboard}
                  className="btn-action text-[10px] text-neutral-300 hover:text-white font-mono bg-neutral-800/85 px-2.5 py-1 rounded transition-colors duration-200"
                >
                  REFRESH
                </button>
              </div>

              {loading ? (
                <div className="py-10 text-center text-neutral-500 font-mono text-xs animate-pulse">
                  LOADING SCORES…
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="py-10 text-center text-neutral-500 font-mono text-xs">
                  NO RECORDED SCORES YET. BE THE FIRST!
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 font-mono text-xs">
                  {leaderboard.map((entry, index) => {
                    const isTop3 = index < 3;
                    return (
                      <div 
                        key={entry.id || index}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg border border-transparent transition-colors duration-200 ${
                          index === 0 ? 'bg-yellow-500/5 text-yellow-400/90 font-semibold' :
                          index === 1 ? 'bg-slate-300/5 text-slate-300/90 font-semibold' :
                          index === 2 ? 'bg-amber-600/5 text-amber-500/90 font-semibold' :
                          'text-neutral-400 hover:bg-neutral-900/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-4 text-center text-[10px] font-bold text-neutral-500">
                            {index + 1}
                          </span>
                          {isTop3 && <Award className="w-3.5 h-3.5 opacity-90" />}
                          <span className="truncate max-w-[160px]">{entry.display_name}</span>
                        </div>
                        <span className="font-bold text-[#DFFF00]">{entry.score} pts</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cell 3: Rules & Info Board */}
            <div className="bg-[#141416]/60 border border-neutral-800/80 rounded-3xl p-6 backdrop-blur-sm shadow-xl flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-neutral-800/60 pb-3">
                <Tag className="w-4 h-4 text-[#DFFF00]" />
                <h3 className="text-xs font-bold font-mono tracking-widest text-[#DFFF00] uppercase display-font">Rules & Rewards</h3>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                ช่วยเหลือเจ้าแมวส้มหลบหลีกอุปสรรคเพื่อเก็บแต้มสูงสุด! เมื่อเกมจบลง คุณสามารถกดปุ่ม <strong className="text-white">SAVE SCORE / บันทึกแต้ม</strong> เพื่อบันทึกสถิติของคุณลงในตารางผู้นำ และมีสิทธิ์รับของรางวัลพิเศษประจำสัปดาห์จากทางร้าน
              </p>
              <div className="text-[10px] text-neutral-500 font-mono leading-relaxed border-t border-neutral-800/40 pt-3">
                * พิกัด GPS ของอุปกรณ์ต้องอยู่ภายในรัศมีร้าน ในบ้าน (<span className="text-[#DFFF00]">{MAX_RADIUS_KM} กม.</span>) เพื่อยืนยันความถูกต้องของการบันทึกคะแนน
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Minimal Footer Signature (Ft2 Inline style) */}
      <footer className="w-full py-6 border-t border-neutral-800/60 text-center text-[10px] text-neutral-500 font-mono select-none">
        IN THE HAUS © {new Date().getFullYear()} — IN-STORE ARCADE CONSOLE
      </footer>

      {/* Claim Score Modal Overlay */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-md bg-[#141416] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-[0_12px_48px_rgba(0,0,0,0.8)] text-left relative overflow-hidden">
            {/* Glow line top */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#DFFF00]" />

            <button 
              onClick={() => setShowClaimModal(false)}
              className="absolute top-5 right-5 text-neutral-500 hover:text-white transition-colors duration-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* View: User not logged in */}
            {!session && (
              <div className="flex flex-col gap-4 mt-2">
                <div className="w-10 h-10 bg-[#06C755]/10 text-[#06C755] rounded-xl flex items-center justify-center">
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold font-mono tracking-widest text-[#DFFF00] uppercase display-font mb-1">
                    LINE ACCOUNT REQUIRED
                  </h2>
                  <h3 className="text-base font-bold font-sans text-white mb-2">คุณทำคะแนนได้ {claimScore} แต้ม!</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                    กรุณาเข้าสู่ระบบด้วยบัญชี LINE เพื่อบันทึกคะแนนของคุณลงในตารางผู้นำและรับสิทธิ์ของรางวัลสะสม
                  </p>
                </div>
                <button
                  onClick={handleLineLogin}
                  className="btn-action w-full bg-[#06C755] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-xs display-font"
                >
                  เข้าสู่ระบบด้วย LINE เพื่อบันทึกแต้ม
                </button>
              </div>
            )}

            {/* View: Idle (User logged in, ready to claim) */}
            {session && claimStatus === 'idle' && (
              <div className="flex flex-col gap-4 mt-2">
                <div className="w-10 h-10 bg-[#DFFF00]/10 text-[#DFFF00] rounded-xl flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold font-mono tracking-widest text-[#DFFF00] uppercase display-font mb-1">
                    GPS VERIFICATION
                  </h2>
                  <h3 className="text-base font-bold font-sans text-white mb-2">บันทึกคะแนน {claimScore} แต้ม</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                    เพื่อความโปร่งใสในการเล่นเกมนอกสถานที่ กรุณาตรวจสอบพิกัดตำแหน่ง (GPS) ยืนยันว่าคุณกำลังอยู่ในเขตร้าน
                  </p>
                </div>
                <button
                  onClick={processClaimScore}
                  className="btn-action w-full bg-[#DFFF00] text-black font-extrabold py-3 rounded-xl cursor-pointer text-xs display-font"
                >
                  ยืนยันตำแหน่ง GPS และบันทึกคะแนน
                </button>
              </div>
            )}

            {/* View: Checking GPS */}
            {claimStatus === 'checking_gps' && (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-[#DFFF00] animate-spin" />
                <p className="text-xs text-neutral-400 font-mono animate-pulse">กำลังตรวจสอบตำแหน่งพิกัด GPS…</p>
              </div>
            )}

            {/* View: Saving to Database */}
            {claimStatus === 'saving' && (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-[#DFFF00] animate-spin" />
                <p className="text-xs text-neutral-400 font-mono animate-pulse">กำลังบันทึกข้อมูลคะแนนสะสม…</p>
              </div>
            )}

            {/* View: Success */}
            {claimStatus === 'success' && (
              <div className="flex flex-col gap-4 mt-2">
                <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xs font-bold font-mono tracking-widest text-emerald-400 uppercase display-font mb-1">
                    SUCCESS
                  </h2>
                  <h3 className="text-base font-bold font-sans text-white mb-2">บันทึกคะแนนสำเร็จ!</h3>
                  <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-2xl py-3.5 px-5 w-full my-2 flex justify-between items-center font-mono">
                    <span className="text-neutral-400 text-xs">คะแนนที่บันทึก</span>
                    <span className="text-lg font-bold text-[#DFFF00]">{claimScore} แต้ม</span>
                  </div>
                  {distance && (
                    <p className="text-[10px] text-neutral-500 font-mono">
                      ยืนยันพิกัดเรียบร้อย (ระยะห่างจากร้าน: {(distance * 1000).toFixed(0)} เมตร)
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowClaimModal(false)}
                  className="btn-action w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3 rounded-xl cursor-pointer text-xs display-font"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            )}

            {/* View: Error */}
            {claimStatus === 'error' && (
              <div className="flex flex-col gap-4 mt-2">
                <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold font-mono tracking-widest text-red-500 uppercase display-font mb-1">
                    VERIFICATION FAILED
                  </h2>
                  <h3 className="text-base font-bold font-sans text-white mb-1">ไม่สามารถบันทึกคะแนนได้</h3>
                  <p className="text-xs text-red-400/90 leading-relaxed font-sans">
                    {claimError}
                  </p>
                </div>
                <div className="flex w-full gap-3 mt-2">
                  <button
                    onClick={session ? processClaimScore : handleLineLogin}
                    className="btn-action flex-1 bg-[#DFFF00] text-black font-extrabold py-3 rounded-xl cursor-pointer text-xs display-font text-center"
                  >
                    ลองใหม่ดูอีกครั้ง
                  </button>
                  <button
                    onClick={() => setShowClaimModal(false)}
                    className="btn-action flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-3 rounded-xl text-xs display-font text-center"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
