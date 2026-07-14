/* Hallmark · component: ArcadeLobby · genre: modern-minimal · theme: custom · vibe: "Dieter Rams industrial console, xhaus integration"
 * states: default · hover · focus · active · loading · error · success
 * contrast: pass (APCA / WCAG compliant)
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import FlappyCatGame from './FlappyCatGame';
import { Gamepad2, Music, Tag, Trophy, Award, X, MapPin, CheckCircle, ShieldAlert, RefreshCw, LogIn, Gift, Copy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

export default function ArcadeLobby() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState('game'); // 'game' | 'music'
  const [loading, setLoading] = useState(true);

  // Authentication & Claiming states
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userStats, setUserStats] = useState({
    weeklyTotal: 0,
    todayPipe20: false,
    todayPipe35: false,
    todayRaffle40: false
  });
  const [rewards, setRewards] = useState([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimScore, setClaimScore] = useState(0);
  const [claimStatus, setClaimStatus] = useState('idle'); // 'idle' | 'checking_gps' | 'saving' | 'success' | 'error'
  const [claimError, setClaimError] = useState('');
  const [distance, setDistance] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [isGameFullscreen, setIsGameFullscreen] = useState(false);
  const [claimResultMessage, setClaimResultMessage] = useState('');

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

  // Fetch user profile info
  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('xhaus_balance, nickname, display_name')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  // Fetch rewards catalog
  const fetchRewards = async () => {
    setRewardsLoading(true);
    try {
      const { data, error } = await supabase
        .from('xhaus_rewards')
        .select('*')
        .eq('is_active', true)
        .order('xhaus_cost', { ascending: true });
      if (!error && data) {
        setRewards(data);
      }
    } catch (err) {
      console.error('Failed to fetch rewards:', err);
    } finally {
      setRewardsLoading(false);
    }
  };

  // Fetch user milestone status and weekly coin stats
  const fetchUserStats = async (userId) => {
    try {
      const now = new Date();
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const bangkokNow = new Date(utcTime + (7 * 3600000));
      
      // Start of Today (Bangkok)
      const bkkToday = new Date(bangkokNow);
      bkkToday.setHours(0, 0, 0, 0);
      const utcToday = new Date(bkkToday.getTime() - (7 * 3600000));
      const todayStartISO = utcToday.toISOString();

      // Start of Week (Monday) in Bangkok
      const bkkWeek = new Date(bangkokNow);
      const day = bkkWeek.getDay();
      const diff = bkkWeek.getDate() - day + (day === 0 ? -6 : 1);
      bkkWeek.setDate(diff);
      bkkWeek.setHours(0, 0, 0, 0);
      const utcWeek = new Date(bkkWeek.getTime() - (7 * 3600000));
      const weekStartISO = utcWeek.toISOString();

      // Fetch weekly coin rewards (pipe_20, pipe_35)
      const { data: weeklyLogs, error: weeklyError } = await supabase
        .from('arcade_rewards_log')
        .select('xhaus_rewarded')
        .eq('profile_id', userId)
        .in('reward_type', ['pipe_20', 'pipe_35'])
        .gte('created_at', weekStartISO);

      // Fetch today's logs
      const { data: todayLogs, error: todayError } = await supabase
        .from('arcade_rewards_log')
        .select('reward_type')
        .eq('profile_id', userId)
        .gte('created_at', todayStartISO);

      if (!weeklyError && !todayError) {
        const weeklyTotal = (weeklyLogs || []).reduce((sum, log) => sum + parseFloat(log.xhaus_rewarded || 0), 0);
        const todayPipe20 = (todayLogs || []).some(log => log.reward_type === 'pipe_20');
        const todayPipe35 = (todayLogs || []).some(log => log.reward_type === 'pipe_35');
        const todayRaffle40 = (todayLogs || []).some(log => log.reward_type === 'raffle_40');

        setUserStats({
          weeklyTotal,
          todayPipe20,
          todayPipe35,
          todayRaffle40
        });
      }
    } catch (err) {
      console.error('Failed to fetch user stats:', err);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    fetchRewards();
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchUserProfile(session.user.id);
      fetchUserStats(session.user.id);
    } else {
      setProfile(null);
      setUserStats({
        weeklyTotal: 0,
        todayPipe20: false,
        todayPipe35: false,
        todayRaffle40: false
      });
    }
  }, [session]);

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
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, nickname')
        .eq('id', session.user.id)
        .single();

      if (profileError) throw profileError;

      const nameToDisplay = profileData.nickname || profileData.display_name || 'MEMBER';

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

      // Call RPC to securely claim P2E rewards
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('claim_arcade_rewards', { p_score: claimScore });

      if (rpcError) throw rpcError;

      const message = rpcData?.message || 'สะสมประวัติคะแนนของท่านสำเร็จ!';
      setClaimResultMessage(message);

      // Confetti celebration
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#E05315', '#06C755', '#222222', '#F2F2EC']
      });

      setClaimStatus('success');
      // Refresh high score leaderboard
      fetchLeaderboard();
      // Refresh user balance and logs
      if (session?.user) {
        fetchUserProfile(session.user.id);
        fetchUserStats(session.user.id);
      }
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
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');

        html, body {
          overflow-x: clip !important;
        }

        #arcade-lobby-root {
          --color-paper: oklch(96% 0.003 80);      /* Braun light-grey casing */
          --color-paper-2: oklch(92% 0.004 80);    /* Slightly darker gray for inset panels */
          --color-paper-3: oklch(88% 0.005 80);    /* Secondary card elevation */
          --color-ink: oklch(20% 0.003 80);        /* Deep charcoal for dials & typography */
          --color-ink-2: oklch(40% 0.004 80);      /* Muted lettering */
          --color-muted: oklch(55% 0.004 80);      /* Disabled text */
          --color-rule: oklch(82% 0.004 80);       /* Hairline layout divisions */
          --color-accent: oklch(62% 0.16 35);      /* Braun Dial Orange Accent */
          --color-accent-ink: oklch(98% 0 0);      /* White text for orange buttons */
          --color-focus: oklch(62% 0.16 35);
          
          --font-display: 'Space Mono', monospace;
          --font-body: 'IBM Plex Sans Thai', 'Inter', sans-serif;
          
          --dur-short: 180ms;
          --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
          
          background-color: var(--color-paper);
          color: var(--color-ink);
          font-family: var(--font-body);
        }

        #arcade-lobby-root .btn-tab {
          transition: background-color var(--dur-short) var(--ease-out), color var(--dur-short) var(--ease-out);
        }
        #arcade-lobby-root .btn-tab:focus-visible {
          outline: 2px solid var(--color-focus);
        }
        
        #arcade-lobby-root .btn-action {
          transition: background-color var(--dur-short) var(--ease-out), color var(--dur-short) var(--ease-out), transform var(--dur-short) var(--ease-out);
        }
        #arcade-lobby-root .btn-action:hover:not(:disabled) {
          filter: brightness(0.95);
        }
        #arcade-lobby-root .btn-action:active:not(:disabled) {
          transform: scale(0.98);
        }
        #arcade-lobby-root .btn-action:focus-visible {
          outline: 2px solid var(--color-focus);
          outline-offset: 2px;
        }

        /* Braun physical dial styling */
        #arcade-lobby-root .braun-dial {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, var(--color-paper-3) 0%, var(--color-rule) 50%, var(--color-paper-3) 100%);
          border: 1.5px solid var(--color-rule);
          box-shadow: inset 0 1px 2px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.1);
          position: relative;
        }
        #arcade-lobby-root .braun-dial::after {
          content: '';
          position: absolute;
          width: 2px;
          height: 10px;
          background: var(--color-ink);
          top: 3px;
          left: 50%;
          transform: translateX(-50%);
          border-radius: 1px;
        }
      `}</style>

      {/* Dieter Rams Masthead / Tuning strip */}
      <header className="w-full border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
        {/* Brand block */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--color-ink)] flex items-center justify-center p-1 rounded-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <img 
              src="/logo-secondary.png" 
              alt="ในบ้าน" 
              className="h-5 w-auto object-contain brightness-0 invert" 
            />
          </div>
          <div>
            <h1 className="text-[10px] font-bold font-mono tracking-widest text-[var(--color-ink)] uppercase">
              HAUS ARCADE SYSTEM
            </h1>
            <p className="text-[8px] text-[var(--color-ink-2)] font-mono uppercase tracking-wider">
              MODEL T-2026 // LINE INTEGRATION
            </p>
          </div>
        </div>

        {/* Navigation sliders */}
        <div className="flex bg-[var(--color-paper-3)] p-0.5 rounded-[4px] border border-[var(--color-rule)]">
          <button
            onClick={() => setActiveTab('game')}
            className={`btn-tab px-4 py-1.5 rounded-[3px] text-[9px] font-bold font-mono uppercase tracking-wider ${
              activeTab === 'game' 
                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] shadow-sm' 
                : 'text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'
            }`}
          >
            PLAY GAME / เล่นเกม
          </button>
          
          <Link
            to="/song"
            className="btn-tab px-4 py-1.5 rounded-[3px] text-[9px] font-bold font-mono uppercase tracking-wider text-[var(--color-ink-2)] hover:text-[var(--color-ink)] flex items-center gap-1.5"
          >
            <Music className="w-2.5 h-2.5" />
            <span>MUSIC / ขอเพลง</span>
          </Link>
        </div>

        {/* User LED Status Indicator */}
        <div className="flex items-center gap-2">
          {session ? (
            <div className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-mono text-[var(--color-ink)] bg-white border border-[var(--color-rule)] rounded-[4px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse border border-emerald-700 shadow-[0_0_3px_#10b981]"></span>
              <span className="font-bold uppercase tracking-wider">CONNECTED // {profile?.nickname || profile?.display_name || 'MEMBER'}</span>
            </div>
          ) : (
            <button
              onClick={handleRequireLogin}
              className="btn-action flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-accent)] hover:bg-[oklch(58% 0.16 35)] text-white text-[9px] font-mono font-bold uppercase tracking-wider rounded-[4px] border border-[oklch(52% 0.16 35)] shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 border border-red-700 animate-pulse shadow-[0_0_3px_red]"></span>
              <span>LINE CONNECT</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Console Grid */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-10 z-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-start">
          
          {/* Column 1: Game Cabinet (Left Column, spans 7 on lg) */}
          <div className={`lg:col-span-7 flex flex-col bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg p-6 relative shadow-sm transition-all duration-200 ${isGameFullscreen ? 'z-[999]' : 'overflow-hidden'}`}>
            {activeTab === 'game' && (
              <div className="w-full flex flex-col items-center">
                {/* Physical bezel frame around screen */}
                <div className="w-full bg-[#1b1c1e] p-3 rounded-md border border-[#2d2e30] shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)]">
                  <div className="w-full aspect-[6/7] max-w-[480px] mx-auto bg-black rounded-sm overflow-hidden">
                    <FlappyCatGame 
                      onGameOver={handleGameOver} 
                      leaderboard={leaderboard} 
                      onClaimScore={handleClaimScore} 
                      session={session} 
                      onRequireLogin={handleRequireLogin} 
                      isFullscreen={isGameFullscreen}
                      setIsFullscreen={setIsGameFullscreen}
                    />
                  </div>
                </div>

                {/* Cabinet control deck indicators */}
                <div className="flex items-center justify-between w-full border-t border-[var(--color-rule)] pt-4 mt-5 font-mono text-[9px] text-[var(--color-ink-2)]">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 border border-red-700 shadow-[0_0_4px_red]"></span>
                      <span className="font-bold">SYS PWR</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${distance !== null && distance <= MAX_RADIUS_KM ? 'bg-emerald-500 border-emerald-700 shadow-[0_0_4px_emerald]' : 'bg-neutral-300 border-neutral-400'}`}></span>
                      <span className="font-bold">GPS LOCK</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse border border-amber-700 shadow-[0_0_4px_amber]"></span>
                      <span className="font-bold">CON STBY</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="braun-dial" title="SYSTEM VOLUME"></div>
                    <div className="braun-dial" title="CONSOLE TUNER"></div>
                  </div>
                </div>

                <div className="mt-4 text-center text-[10px] text-[var(--color-ink-2)] font-mono leading-relaxed max-w-sm border-t border-dashed border-[var(--color-rule)] w-full pt-3">
                  <span className="text-[var(--color-accent)] font-bold">// INSTRUCTION:</span> แตะหน้าจอช่วยแมวส้มบินเพื่อสะสมแต้มแลกเหรียญ xhaus!
                </div>
              </div>
            )}
          </div>

          {/* Column 2: Braun Instrument Panels (Right Column, spans 5 on lg) */}
          <div className="lg:col-span-5 flex flex-col gap-6 w-full">
            
            {/* Panel 1: xhaus Wallet & Progress Dashboard */}
            <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg p-5 flex flex-col gap-4 shadow-sm">
              <div className="border-b border-[var(--color-rule)] pb-2 flex justify-between items-center select-none">
                <h2 className="text-[10px] font-bold font-mono tracking-widest text-[var(--color-ink)] uppercase">// COIN STATUS</h2>
                <span className="text-[8px] font-mono text-[var(--color-muted)]">SYSTEM V.2026</span>
              </div>

              {/* LCD digital screen display */}
              <div className="bg-[#e2e7df] border border-[#cfd6cb] rounded-[4px] p-4 flex flex-col items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] relative overflow-hidden">
                <span className="text-[8px] font-mono uppercase text-[#5a6353] tracking-widest block mb-1">XHAUS COIN BALANCE</span>
                <span className="font-mono text-3xl font-bold text-[#2a3026] tracking-tight">
                  {session ? parseFloat(profile?.xhaus_balance || 0).toFixed(2) : "0.00"} <span className="text-sm font-normal">XH</span>
                </span>
                {!session && (
                  <span className="text-[8px] font-mono text-red-700/80 font-bold tracking-wider mt-2 animate-pulse uppercase">
                    [ GUEST MODE - CONNECT LINE ]
                  </span>
                )}
              </div>

              {/* Daily quests */}
              <div className="flex flex-col gap-2">
                <h3 className="text-[9px] font-bold font-mono text-[var(--color-ink-2)] uppercase tracking-wider">DAILY ACHIEVEMENTS / ภารกิจรับเหรียญวันนี้</h3>
                <div className="flex flex-col gap-1.5 font-mono text-[9px]">
                  
                  {/* Milestone 20 */}
                  <div className="flex items-center justify-between py-2 px-3 bg-white border border-[var(--color-rule)] rounded-[3px]">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${session && userStats.todayPipe20 ? 'bg-emerald-500 border-emerald-700 shadow-[0_0_3px_#10b981]' : 'bg-neutral-200 border-neutral-300'}`}></span>
                      <span>บินผ่าน 20 ท่อ (ความสำเร็จเริ่มต้น)</span>
                    </div>
                    <span className="font-bold text-[var(--color-accent)]">+1.00 XH</span>
                  </div>

                  {/* Milestone 35 */}
                  <div className="flex items-center justify-between py-2 px-3 bg-white border border-[var(--color-rule)] rounded-[3px]">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${session && userStats.todayPipe35 ? 'bg-emerald-500 border-emerald-700 shadow-[0_0_3px_#10b981]' : 'bg-neutral-200 border-neutral-300'}`}></span>
                      <span>บินผ่าน 35 ท่อ (ความสำเร็จขั้นสูง)</span>
                    </div>
                    <span className="font-bold text-[var(--color-accent)]">+1.00 XH</span>
                  </div>

                  {/* Milestone 40 */}
                  <div className="flex items-center justify-between py-2 px-3 bg-white border border-[var(--color-rule)] rounded-[3px]">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${session && userStats.todayRaffle40 ? 'bg-emerald-500 border-emerald-700 shadow-[0_0_3px_#10b981]' : 'bg-neutral-200 border-neutral-300'}`}></span>
                      <span>บินผ่าน 40 ท่อ (ตั๋วสุ่มจับรางวัลประจำสัปดาห์)</span>
                    </div>
                    <span className="font-bold text-sky-600">1 TICKET</span>
                  </div>

                </div>
              </div>

              {/* Weekly progress bar */}
              <div className="flex flex-col gap-1 border-t border-[var(--color-rule)] pt-3">
                <div className="flex justify-between text-[9px] font-mono text-[var(--color-ink-2)]">
                  <span>WEEKLY ARCADE COINS / ขีดจำกัดเหรียญรายสัปดาห์</span>
                  <span>{session ? userStats.weeklyTotal.toFixed(2) : "0.00"} / 5.00 XH</span>
                </div>
                <div className="flex gap-0.5 h-2 w-full bg-[var(--color-paper-3)] border border-[var(--color-rule)] p-0.5 rounded-[2px]">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const filled = session && (userStats.weeklyTotal / 5.00) * 10 >= (i + 1);
                    return (
                      <div 
                        key={i} 
                        className={`flex-1 rounded-[1px] transition-colors duration-200 ${
                          filled ? 'bg-[var(--color-accent)]' : 'bg-neutral-300/40'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Panel 2: xhaus Rewards Shop */}
            <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg p-5 flex flex-col gap-4 shadow-sm">
              <div className="border-b border-[var(--color-rule)] pb-2 flex justify-between items-center select-none">
                <h2 className="text-[10px] font-bold font-mono tracking-widest text-[var(--color-ink)] uppercase">// REWARD REDEMPTION</h2>
                <span className="text-[8px] font-mono text-[var(--color-muted)]">XHAUS SHOP</span>
              </div>

              {rewardsLoading ? (
                <div className="py-6 text-center text-[var(--color-muted)] font-mono text-[9px] animate-pulse">
                  LOADING CATALOG...
                </div>
              ) : rewards.length === 0 ? (
                <div className="py-6 text-center text-[var(--color-muted)] font-mono text-[9px] bg-white border border-[var(--color-rule)] rounded-[4px]">
                  ยังไม่มีรายการของรางวัลสำหรับแลกในระบบขณะนี้
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
                  {rewards.map(reward => {
                    const userBalance = parseFloat(profile?.xhaus_balance || 0);
                    const cost = parseFloat(reward.xhaus_cost);
                    const isOutOfStock = reward.usage_limit && (reward.used_count || 0) >= reward.usage_limit;
                    const canRedeem = session && userBalance >= cost && !isOutOfStock;
                    const needed = cost - userBalance;

                    return (
                      <div 
                        key={reward.id} 
                        className={`p-3 bg-white border rounded-[4px] flex flex-col gap-2 text-xs transition-all ${
                          isOutOfStock
                            ? 'border-red-200 opacity-60'
                            : canRedeem 
                                ? 'border-emerald-500/60' 
                                : 'border-[var(--color-rule)]'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h4 className="font-bold text-[var(--color-ink)] text-[11px]">{reward.title}</h4>
                            {reward.description && (
                              <p className="text-[9px] text-[var(--color-ink-2)] leading-tight mt-0.5">{reward.description}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="bg-[var(--color-paper-3)] border border-[var(--color-rule)] font-mono text-[9px] font-bold px-2 py-0.5 rounded-[3px] text-[var(--color-ink)]">
                              {cost.toFixed(0)} XH
                            </span>
                            <span className={`font-mono text-[7px] font-bold px-1 py-0.5 rounded-[3px] border ${
                                reward.usage_limit 
                                    ? (isOutOfStock 
                                        ? 'bg-red-50 text-red-750 border-red-200' 
                                        : 'bg-zinc-50 text-zinc-650 border-zinc-200')
                                    : 'bg-blue-50 text-blue-750 border-blue-205'
                            }`}>
                                {reward.usage_limit 
                                    ? `คงเหลือ: ${Math.max(0, reward.usage_limit - (reward.used_count || 0))}/${reward.usage_limit}`
                                    : 'คงเหลือ: ไม่จำกัด'}
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-dashed border-[var(--color-rule)] pt-2 mt-1 flex justify-between items-center">
                          {isOutOfStock ? (
                            <div className="flex items-center gap-1 text-red-500 text-[9px] w-full font-mono font-bold">
                              <span>🚫</span>
                              <span>สิทธิ์หมดแล้ว (Fully Redeemed / Out of Stock)</span>
                            </div>
                          ) : canRedeem ? (
                            <div className="flex justify-between items-center w-full">
                              <div className="font-mono">
                                <span className="text-[7px] text-[var(--color-muted)] block uppercase leading-none mb-0.5">รหัสคูปองแสดงพนักงาน</span>
                                <span className="text-[11px] font-bold text-emerald-600 tracking-wider select-all leading-none">{reward.claim_code}</span>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(reward.claim_code);
                                  toast.success("คัดลอกรหัสสำเร็จ!");
                                }}
                                className="px-2 py-1 text-[8px] font-mono font-bold bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[3px] uppercase cursor-pointer transition-all active:scale-[0.96] flex items-center gap-1 text-[var(--color-ink)]"
                              >
                                <Copy className="w-2 h-2" />
                                <span>Copy</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[var(--color-muted)] text-[9px] w-full font-mono">
                              <span>🔒</span>
                              {session ? (
                                <span>สะสมเพิ่มอีก <strong className="text-[var(--color-ink)] font-bold">{needed.toFixed(2)} XH</strong> เพื่อปลดล็อก</span>
                              ) : (
                                <span>เชื่อมต่อ LINE เพื่อตรวจสอบแต้มสะสม</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Panel 3: Leaderboard (Hall of Fame) */}
            <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg p-5 flex flex-col gap-4 shadow-sm">
              <div className="border-b border-[var(--color-rule)] pb-2 flex justify-between items-center select-none">
                <div className="flex items-center gap-1.5 text-[var(--color-ink)]">
                  <Trophy className="w-3.5 h-3.5" />
                  <h2 className="text-[10px] font-bold font-mono tracking-widest uppercase">// LEADERBOARD</h2>
                </div>
                <button 
                  onClick={fetchLeaderboard}
                  className="px-2 py-0.5 text-[8px] text-[var(--color-ink-2)] hover:text-[var(--color-ink)] font-mono bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[3px] transition-all cursor-pointer"
                >
                  REFRESH
                </button>
              </div>

              {loading ? (
                <div className="py-8 text-center text-[var(--color-muted)] font-mono text-[9px] animate-pulse">
                  LOADING HIGH SCORES...
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="py-8 text-center text-[var(--color-muted)] font-mono text-[9px] bg-white border border-[var(--color-rule)] rounded-[4px]">
                  NO RECORDED SCORES YET
                </div>
              ) : (
                <div className="flex flex-col font-mono text-[9px] bg-white border border-[var(--color-rule)] p-2 rounded-[3px] max-h-60 overflow-y-auto">
                  {leaderboard.map((entry, index) => (
                    <div 
                      key={entry.id || index}
                      className={`flex items-center justify-between py-1.5 px-2 border-b border-dashed border-[var(--color-rule)] last:border-0 hover:bg-[var(--color-paper-2)] transition-colors ${
                        index === 0 ? 'text-[var(--color-accent)] font-bold bg-[var(--color-accent)]/5' : 'text-[var(--color-ink-2)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-left font-bold text-[var(--color-muted)]">
                          {(index + 1).toString().padStart(2, '0')}
                        </span>
                        {index < 3 && <Award className="w-3.5 h-3.5 shrink-0" />}
                        <span className="truncate max-w-[130px] uppercase">{entry.display_name}</span>
                      </div>
                      <span>{entry.score.toString().padStart(3, '0')} PTS</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </main>

      {/* Dieter Rams Brand Footer */}
      <footer className="w-full py-6 border-t border-[var(--color-rule)] text-center text-[9px] text-[var(--color-muted)] font-mono select-none bg-[var(--color-paper-2)]">
        IN THE HAUS © {new Date().getFullYear()} — SYSTEM MODEL IH-FC-01 // BANGKOK THAILAND
      </footer>

      {/* Claim Score Modal Overlay (Rams Mechanical Box style) */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-[fadeIn_0.15s_ease-out]">
          <div className="w-full max-w-md bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-md p-6 sm:p-8 shadow-xl text-left relative">
            {/* Minimal orange highlight strip */}
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-brand)] rounded-t-md" />

            <button 
              onClick={() => setShowClaimModal(false)}
              className="absolute top-5 right-5 text-[var(--color-ink-2)] hover:text-[var(--color-ink)] transition-colors duration-200 cursor-pointer font-mono text-[9px]"
            >
              [ CLOSE ]
            </button>

            {/* View: User not logged in */}
            {!session && (
              <div className="flex flex-col gap-4 mt-2 font-mono text-xs">
                <div className="w-8 h-8 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-[3px] flex items-center justify-center">
                  <LogIn className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[10px] font-bold tracking-widest text-[var(--color-accent)] uppercase mb-1">
                    // ACCESS DIRECTIVE REQUIRED
                  </h2>
                  <h3 className="text-[13px] font-bold text-[var(--color-ink)] mb-2 font-sans">คุณเล่นได้ทั้งหมด {claimScore} แต้ม!</h3>
                  <p className="text-[10px] text-[var(--color-ink-2)] leading-relaxed font-sans">
                    กรุณาเชื่อมต่อบัญชีสมาชิก LINE เพื่อบันทึกคะแนนสะสมลงในระบบและคำนวณเหรียญ xhaus ที่ได้รับจากการเล่น
                  </p>
                </div>
                <button
                  onClick={handleLineLogin}
                  className="btn-action w-full bg-[#06C755] hover:bg-[#05b04b] text-white font-bold py-2.5 rounded-[4px] flex items-center justify-center gap-2 cursor-pointer font-mono text-[10px] uppercase shadow-sm border border-[#05b04b]"
                >
                  เข้าสู่ระบบด้วย LINE เพื่อบันทึกแต้ม
                </button>
              </div>
            )}

            {/* View: Idle (User logged in, ready to claim) */}
            {session && claimStatus === 'idle' && (
              <div className="flex flex-col gap-4 mt-2 font-mono text-xs">
                <div className="w-8 h-8 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-[3px] flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[10px] font-bold tracking-widest text-[var(--color-accent)] uppercase mb-1">
                    // GPS LOCK VERIFICATION
                  </h2>
                  <h3 className="text-[13px] font-bold text-[var(--color-ink)] mb-2 font-sans">ยืนยันบันทึกคะแนน {claimScore} แต้ม</h3>
                  <p className="text-[10px] text-[var(--color-ink-2)] leading-relaxed font-sans">
                    เพื่อความโปร่งใสและตรวจสอบความปลอดภัย กรุณายืนยันตำแหน่ง GPS ของคุณว่าอยู่ในพื้นที่ร้านในการเคลมรับสิทธิ์
                  </p>
                </div>
                <button
                  onClick={processClaimScore}
                  className="btn-action w-full bg-[var(--color-accent)] text-white font-bold py-2.5 rounded-[4px] cursor-pointer font-mono text-[10px] uppercase border border-[oklch(55% 0.16 35)] shadow-sm"
                >
                  ยืนยันตำแหน่ง GPS และบันทึกคะแนน
                </button>
              </div>
            )}

            {/* View: Checking GPS */}
            {claimStatus === 'checking_gps' && (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-7 h-7 text-[var(--color-accent)] animate-spin" />
                <p className="text-[10px] text-[var(--color-ink-2)] font-mono animate-pulse">VERIFYING GPS COORD LOCK…</p>
              </div>
            )}

            {/* View: Saving to Database */}
            {claimStatus === 'saving' && (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-7 h-7 text-[var(--color-accent)] animate-spin" />
                <p className="text-[10px] text-[var(--color-ink-2)] font-mono animate-pulse">WRITING DATA TO LEDGER…</p>
              </div>
            )}

            {/* View: Success */}
            {claimStatus === 'success' && (
              <div className="flex flex-col gap-4 mt-2 font-mono text-xs">
                <div className="w-8 h-8 bg-emerald-500/10 text-emerald-600 rounded-[3px] flex items-center justify-center">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase mb-1">
                    // CLAIM GRANTED SUCCESS
                  </h2>
                  <h3 className="text-[13px] font-bold text-[var(--color-ink)] mb-2 font-sans">บันทึกสถิติของคุณเข้าคลังข้อมูลสำเร็จ!</h3>
                  <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-[4px] py-3 px-4 w-full my-2 flex justify-between items-center">
                    <span className="text-[var(--color-ink-2)] text-[10px]">RECORDED SCORE</span>
                    <span className="text-sm font-bold text-[var(--color-accent)]">{claimScore} PTS</span>
                  </div>
                  {claimResultMessage && (
                    <div className="bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[4px] py-3 px-4 w-full text-center text-[10px] font-bold text-[var(--color-ink)] my-3 leading-relaxed">
                      {claimResultMessage}
                    </div>
                  )}
                  {distance && (
                    <p className="text-[8px] text-[var(--color-muted)] uppercase">
                      verified at {(distance * 1000).toFixed(0)} meters from base station
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowClaimModal(false)}
                  className="btn-action w-full bg-[var(--color-ink)] hover:bg-[var(--color-ink-2)] text-[var(--color-paper)] font-bold py-2.5 rounded-[4px] cursor-pointer font-mono text-[10px] uppercase shadow-sm"
                >
                  DISMISS PANEL
                </button>
              </div>
            )}

            {/* View: Error */}
            {claimStatus === 'error' && (
              <div className="flex flex-col gap-4 mt-2 font-mono text-xs">
                <div className="w-8 h-8 bg-red-500/10 text-red-500 rounded-[3px] flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[10px] font-bold tracking-widest text-red-500 uppercase mb-1">
                    // TRANSACTION REJECTED
                  </h2>
                  <h3 className="text-[13px] font-bold text-[var(--color-ink)] mb-1 font-sans">การบันทึกสถิติล้มเหลว</h3>
                  <p className="text-[10px] text-red-600/90 leading-relaxed font-sans">
                    {claimError}
                  </p>
                </div>
                <div className="flex w-full gap-3 mt-2">
                  <button
                    onClick={session ? processClaimScore : handleLineLogin}
                    className="btn-action flex-1 bg-[var(--color-accent)] text-white font-bold py-2.5 rounded-[4px] cursor-pointer font-mono text-[10px] uppercase text-center border border-[oklch(55% 0.16 35)]"
                  >
                    RETRY
                  </button>
                  <button
                    onClick={() => setShowClaimModal(false)}
                    className="btn-action flex-1 bg-[var(--color-paper-3)] hover:bg-[var(--color-rule)] text-[var(--color-ink)] font-bold py-2.5 rounded-[4px] text-[10px] uppercase text-center border border-[var(--color-rule)] cursor-pointer"
                  >
                    CANCEL
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
