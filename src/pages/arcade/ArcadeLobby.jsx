import React, { useEffect, useState } from 'react';
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
          profiles (
            display_name,
            nickname
          )
        `)
        .order('score', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Map profiles display_name/nickname to entry for easier Phaser usage
      const formatted = (data || []).map(entry => ({
        id: entry.id,
        score: entry.score,
        display_name: entry.profiles?.nickname || entry.profiles?.display_name || 'GUEST'
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

      const { error: insertError } = await supabase
        .from('leaderboard')
        .insert({
          profile_id: session.user.id,
          display_name: nameToDisplay,
          score: claimScore
        });

      if (insertError) throw insertError;

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

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white flex flex-col font-sans overflow-x-hidden relative select-none">
      {/* Sleek Modern Dark Grid Decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-[#DFFF00]/5 to-transparent pointer-events-none blur-3xl" />

      {/* Modern Minimalist Header */}
      <header className="w-full py-6 px-8 z-10 border-b border-neutral-800/80 bg-neutral-950/40 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img 
            src="/logo-secondary.png" 
            alt="ในบ้าน" 
            className="h-10 w-auto object-contain" 
            style={{ filter: 'brightness(0) invert(1)' }} 
          />
          <div className="border-l border-neutral-800 pl-4">
            <h1 className="text-sm font-bold font-mono tracking-widest text-neutral-400">
              PLAYGROUND
            </h1>
            <p className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">In-store Console</p>
          </div>
        </div>

        {/* Tab Navigation (Modern Flat Styling) */}
        <div className="flex bg-neutral-900 p-1 rounded-full border border-neutral-800">
          <button
            onClick={() => setActiveTab('game')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold font-mono uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'game' 
                ? 'bg-[#DFFF00] text-black font-extrabold shadow-[0_2px_10px_rgba(223,255,0,0.2)]' 
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            ตะลุยแดนสตอ
          </button>
          
          <button
            onClick={() => setActiveTab('music')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold font-mono uppercase tracking-wider transition-all duration-300 relative ${
              activeTab === 'music' 
                ? 'bg-[#DFFF00] text-black' 
                : 'text-neutral-600 cursor-not-allowed opacity-50'
            }`}
            disabled={activeTab !== 'music'}
          >
            <Music className="w-4 h-4" />
            Request Song
            <span className="absolute -top-2 -right-2 bg-neutral-800 border border-neutral-700 text-[8px] text-neutral-400 px-1.5 py-0.5 rounded font-mono normal-case tracking-normal">SOON</span>
          </button>

          <button
            onClick={() => setActiveTab('promo')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold font-mono uppercase tracking-wider transition-all duration-300 relative ${
              activeTab === 'promo' 
                ? 'bg-[#DFFF00] text-black' 
                : 'text-neutral-600 cursor-not-allowed opacity-50'
            }`}
            disabled={activeTab !== 'promo'}
          >
            <Tag className="w-4 h-4" />
            Deals
            <span className="absolute -top-2 -right-2 bg-neutral-800 border border-neutral-700 text-[8px] text-neutral-400 px-1.5 py-0.5 rounded font-mono normal-case tracking-normal">SOON</span>
          </button>
        </div>
      </header>

      {/* Main Lobby Container */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center p-6 sm:p-10 gap-10 z-10 max-w-7xl mx-auto w-full">
        {/* Left Column: Phaser Game View */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {activeTab === 'game' && (
            <div className="w-full max-w-[450px] sm:max-w-[600px] aspect-[6/7]">
              <FlappyCatGame onGameOver={handleGameOver} leaderboard={leaderboard} onClaimScore={handleClaimScore} />
              <div className="mt-4 text-center text-xs text-neutral-500 font-mono">
                💡 TIP: แตะหน้าจอเพื่อช่วยแมวส้มหลบสิ่งกีดขวางและมีดครัวบิน!
              </div>
            </div>
          )}
        </div>

        {/* Right Column: High Score Panel & Info */}
        <div className="w-full lg:w-[400px] flex flex-col gap-6">
          {/* Modern Leaderboard Container */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-6 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between mb-6 border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#DFFF00]" />
                <h2 className="text-lg font-bold font-mono tracking-widest text-[#DFFF00]">HALL OF FAME</h2>
              </div>
              <button 
                onClick={fetchLeaderboard}
                className="text-xs text-neutral-300 hover:text-white font-mono bg-neutral-800 hover:bg-neutral-700 px-3 py-1 rounded-md transition-colors"
              >
                REFRESH
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-neutral-500 font-mono text-sm">
                LOADING SCORES...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 font-mono text-sm">
                NO RECORDED SCORES YET. BE THE FIRST!
              </div>
            ) : (
              <div className="flex flex-col gap-3 font-mono">
                {leaderboard.map((entry, index) => {
                  const rankColors = [
                    'text-yellow-400 font-bold border-yellow-400/20 bg-yellow-400/5',
                    'text-slate-355 font-bold border-slate-300/20 bg-slate-300/5',
                    'text-amber-650 font-bold border-amber-605/20 bg-amber-600/5'
                  ];
                  const isTop3 = index < 3;
                  
                  return (
                    <div 
                      key={entry.id || index}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        isTop3 
                          ? index === 0 ? 'text-yellow-400 border-yellow-400/20 bg-yellow-400/5' : index === 1 ? 'text-slate-300 border-slate-300/20 bg-slate-300/5' : 'text-amber-650 border-amber-600/20 bg-amber-600/5' 
                          : 'text-neutral-300 border-neutral-800 bg-black/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-center font-bold">{index + 1}</span>
                        {isTop3 && <Award className="w-4 h-4" />}
                        <span className="truncate max-w-[150px]">{entry.display_name}</span>
                      </div>
                      <span className="font-bold text-[#DFFF00]">{entry.score} pts</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reward Info Board */}
          <div className="bg-gradient-to-r from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
            <h3 className="text-sm font-bold font-mono tracking-wider text-[#DFFF00] mb-2 uppercase">🎁 กติการับรางวัลพิเศษ!</h3>
            <p className="text-xs text-neutral-400 leading-relaxed mb-3 font-sans">
              เล่นเกมช่วยเหลือเจ้าแมวส้มหลบสิ่งกีดขวาง! เมื่อเล่นจบ สามารถกดปุ่ม **SAVE SCORE / บันทึกแต้ม** บนหน้าจอเพื่อเคลมคะแนนบันทึกสถิติและรับรางวัลของร้านได้ทันที
            </p>
            <div className="text-[10px] text-neutral-500 font-mono">
              * หมายเหตุ: บันทึกคะแนนได้เฉพาะเมื่ออุปกรณ์ของท่านอยู่ภายในเขตรัศมีของร้านอินเดอะเฮาส์ (ไม่เกิน 1 กม.) เท่านั้น
            </div>
          </div>
        </div>
      </main>

      {/* Claim Score Modal Overlay */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-[0_12px_48px_rgba(0,0,0,0.8)] text-center relative overflow-hidden">
            {/* Glow line top */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-[#DFFF00]" />

            <button 
              onClick={() => setShowClaimModal(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xs font-bold font-mono tracking-widest text-[#DFFF00] mb-6 uppercase">
              บันทึกคะแนนสะสม
            </h2>

            {/* View: User not logged in */}
            {!session && (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-[#06C755]/10 text-[#06C755] rounded-full flex items-center justify-center mb-6">
                  <LogIn className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-2">คุณทำคะแนนได้ {claimScore} แต้ม!</h3>
                <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
                  กรุณาเข้าสู่ระบบด้วยบัญชี LINE สมาชิกของร้านเพื่อยืนยันตัวตนและสะสมบันทึกคะแนน
                </p>
                <button
                  onClick={handleLineLogin}
                  className="w-full bg-[#06C755] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer text-xs"
                >
                  เข้าสู่ระบบด้วย LINE เพื่อดำเนินการต่อ
                </button>
              </div>
            )}

            {/* View: Idle (User logged in, ready to claim) */}
            {session && claimStatus === 'idle' && (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-[#DFFF00]/10 text-[#DFFF00] rounded-full flex items-center justify-center mb-6 animate-bounce">
                  <MapPin className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-1">บันทึกคะแนน {claimScore} แต้ม</h3>
                <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
                  กดปุ่มด้านล่างเพื่อตรวจสอบพิกัดตำแหน่ง (GPS) ยืนยันว่าคุณกำลังอยู่ในเขตร้าน
                </p>
                <button
                  onClick={processClaimScore}
                  className="w-full bg-[#DFFF00] text-black font-extrabold py-3.5 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer text-xs"
                >
                  ยืนยันตำแหน่ง GPS และบันทึกคะแนน
                </button>
              </div>
            )}

            {/* View: Checking GPS */}
            {claimStatus === 'checking_gps' && (
              <div className="py-8 flex flex-col items-center">
                <RefreshCw className="w-10 h-10 text-[#DFFF00] animate-spin mb-4" />
                <p className="text-sm text-neutral-400 font-mono animate-pulse">กำลังตรวจสอบตำแหน่งพิกัด GPS...</p>
              </div>
            )}

            {/* View: Saving to Database */}
            {claimStatus === 'saving' && (
              <div className="py-8 flex flex-col items-center">
                <RefreshCw className="w-10 h-10 text-[#DFFF00] animate-spin mb-4" />
                <p className="text-sm text-neutral-400 font-mono animate-pulse">กำลังบันทึกข้อมูลคะแนน...</p>
              </div>
            )}

            {/* View: Success */}
            {claimStatus === 'success' && (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-[#39FF14]/10 text-[#39FF14] rounded-full flex items-center justify-center mb-6">
                  <CheckCircle className="w-9 h-9" />
                </div>
                <h3 className="text-lg font-bold mb-1 text-[#39FF14]">บันทึกคะแนนสะสมสำเร็จ!</h3>
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl py-4 px-6 w-full my-4 flex justify-between items-center">
                  <span className="text-neutral-400 text-xs font-mono">คะแนนที่บันทึก</span>
                  <span className="text-xl font-bold font-mono text-[#DFFF00]">{claimScore} แต้ม</span>
                </div>
                {distance && (
                  <p className="text-[10px] text-neutral-500 mb-6 font-mono">
                    ยืนยันพิกัดเรียบร้อย (ระยะห่างจากร้าน: {(distance * 1000).toFixed(0)} เมตร)
                  </p>
                )}
                <button
                  onClick={() => setShowClaimModal(false)}
                  className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer text-xs"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            )}

            {/* View: Error */}
            {claimStatus === 'error' && (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold mb-2 text-red-500">บันทึกคะแนนไม่สำเร็จ</h3>
                <p className="text-xs text-red-400 mb-8 leading-relaxed px-2">
                  {claimError}
                </p>
                <div className="flex w-full gap-3">
                  <button
                    onClick={session ? processClaimScore : handleLineLogin}
                    className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3 rounded-xl transition-all cursor-pointer text-xs"
                  >
                    ลองใหม่อีกครั้ง
                  </button>
                  <button
                    onClick={() => setShowClaimModal(false)}
                    className="flex-1 bg-black/40 border border-neutral-800 text-neutral-400 hover:text-white py-3 rounded-xl transition-all text-xs"
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
