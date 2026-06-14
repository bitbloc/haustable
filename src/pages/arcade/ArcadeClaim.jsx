import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { generateScoreHash } from './game/scenes/GameOverScene';
import confetti from 'canvas-confetti';
import { ShieldAlert, MapPin, Award, CheckCircle, LogIn, RefreshCw } from 'lucide-react';

const SHOP_LAT = 17.39008981227407;
const SHOP_LNG = 104.79292770946343;
const MAX_RADIUS_KM = 1.0; // Allowed radius limit (1 km)

// Haversine formula to calculate distance in km
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

export default function ArcadeClaim() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Claim Process States
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'gps_required' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [distance, setDistance] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // URL parameters
  const score = searchParams.get('score');
  const ts = searchParams.get('ts');
  const hash = searchParams.get('hash');

  // Verify auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Run validation checks when authenticated
  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setStatus('login_required');
      return;
    }
    
    validateAndProcessClaim();
  }, [session, authLoading]);

  const validateAndProcessClaim = async () => {
    // 1. Parameter presence check
    if (!score || !ts || !hash) {
      showError('ลิงก์ไม่ถูกต้อง กรุณาสแกนสิทธิ์จากหน้าจอ iPad ของร้าน');
      return;
    }

    // 2. Anti-replay double-claim check
    if (localStorage.getItem(`claimed_${hash}`)) {
      showError('คะแนนนี้ถูกเคลมสะสมไปเรียบร้อยแล้ว!');
      return;
    }

    // 3. Hash verification
    const expectedHash = generateScoreHash(parseInt(score), parseInt(ts));
    if (hash !== expectedHash) {
      showError('ลายเซ็นคะแนนไม่ถูกต้อง คะแนนนี้อาจถูกดัดแปลง!');
      return;
    }

    // 4. Expiration check (5 minutes = 300 seconds)
    const now = Math.floor(Date.now() / 1000);
    if (now - parseInt(ts) > 300) {
      showError('QR Code นี้หมดอายุแล้ว! (กรุณาสะสมสิทธิ์ภายใน 5 นาทีหลังเล่นเสร็จ)');
      return;
    }

    // 5. Request Geolocation
    requestGpsLocation();
  };

  const requestGpsLocation = () => {
    if (!navigator.geolocation) {
      showError('เบราว์เซอร์ของคุณไม่รองรับการระบุพิกัด GPS');
      return;
    }

    setStatus('gps_required');
    setGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const clientLat = position.coords.latitude;
        const clientLng = position.coords.longitude;
        
        const dist = getDistanceInKm(clientLat, clientLng, SHOP_LAT, SHOP_LNG);
        setDistance(dist);
        setGpsLoading(false);

        if (dist > MAX_RADIUS_KM) {
          showError(`คุณอยู่นอกพื้นที่ร้าน! ระยะห่างปัจจุบันคือ ${dist.toFixed(2)} กม. (อนุญาตไม่เกิน ${MAX_RADIUS_KM} กม.)`);
        } else {
          // Success! Location verified, write to database
          await saveScoreToDatabase();
        }
      },
      (error) => {
        setGpsLoading(false);
        console.error('GPS permission error:', error);
        showError('กรุณาอนุญาตสิทธิ์เข้าถึงตำแหน่งที่ตั้ง (GPS) เพื่อยืนยันว่าสแกนเล่นที่ร้านจริง');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const saveScoreToDatabase = async () => {
    try {
      setStatus('saving');
      
      // Fetch profile to get display_name
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

      const newScore = parseInt(score);

      if (existingLeaderboard) {
        // Only update if the new score is higher than the existing high score
        if (newScore > existingLeaderboard.score) {
          const { error: updateError } = await supabase
            .from('leaderboard')
            .update({
              score: newScore,
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
            score: newScore
          });

        if (insertError) throw insertError;
      }

      // Lock token locally
      localStorage.setItem(`claimed_${hash}`, 'true');

      // Trigger Confetti Celebration!
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#DFFF00', '#FF00FF', '#00FFFF', '#FFFFFF']
      });

      setStatus('success');
    } catch (e) {
      console.error('Failed to submit score:', e);
      showError('ไม่สามารถเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง');
    }
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setStatus('error');
  };

  const handleLineLogin = async () => {
    try {
      setGpsLoading(true);
      // OAuth sign in directly redirecting back to this exact URL
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

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white flex flex-col items-center justify-center p-6 relative font-sans select-none">
      {/* Sleek Modern Dark Grid Decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />
      
      <div className="w-full max-w-md bg-neutral-900/80 border border-neutral-850 rounded-3xl p-8 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-10 text-center relative overflow-hidden">
        
        {/* Glow accent line at top */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-[#DFFF00]" />

        <h1 className="text-xl font-bold font-mono tracking-widest text-[#DFFF00] mb-8">
          HAUS ARCADE CLAIM
        </h1>

        {/* View: Auth / Login Required */}
        {status === 'login_required' && (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="w-16 h-16 bg-[#06C755]/10 text-[#06C755] rounded-full flex items-center justify-center mb-6">
              <LogIn className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold mb-2">ยินดีด้วย! คุณทำคะแนนได้ {score} แต้ม</h2>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              กรุณาเข้าสู่ระบบผ่านสมาชิก LINE เพื่อบันทึกคะแนนลงในกระดานคะแนนและใช้สิทธิ์สะสมรางวัล
            </p>
            <button
              onClick={handleLineLogin}
              className="w-full bg-[#06C755] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
            >
              เข้าสู่ระบบด้วย LINE
            </button>
          </div>
        )}

        {/* View: Loading / Verifying */}
        {status === 'verifying' && (
          <div className="py-12 flex flex-col items-center">
            <RefreshCw className="w-10 h-10 text-[#DFFF00] animate-spin mb-4" />
            <p className="text-sm text-neutral-400 font-mono">กำลังตรวจสอบข้อมูลสิทธิ์คะแนน...</p>
          </div>
        )}

        {/* View: GPS Request */}
        {status === 'gps_required' && (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="w-16 h-16 bg-[#DFFF00]/10 text-[#DFFF00] rounded-full flex items-center justify-center mb-6 animate-bounce">
              <MapPin className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold mb-2">ตรวจสอบตำแหน่งพิกัดร้าน</h2>
            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              กรุณาอนุญาตสิทธิ์เข้าถึงพิกัดที่ตั้ง (GPS) เพื่อยืนยันว่าคุณสแกนรับสิทธิ์ภายในเขตพื้นที่ของร้านอินเดอะเฮาส์
            </p>
            <button
              onClick={requestGpsLocation}
              disabled={gpsLoading}
              className="w-full bg-[#DFFF00] text-black font-extrabold py-3.5 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {gpsLoading ? 'กำลังดึงพิกัดตำแหน่ง...' : 'ยืนยันตำแหน่ง GPS'}
            </button>
          </div>
        )}

        {/* View: Saving DB */}
        {status === 'saving' && (
          <div className="py-12 flex flex-col items-center">
            <RefreshCw className="w-10 h-10 text-[#DFFF00] animate-spin mb-4" />
            <p className="text-sm text-neutral-400 font-mono">กำลังบันทึกคะแนนสมาชิกของคุณ...</p>
          </div>
        )}

        {/* View: Success */}
        {status === 'success' && (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="w-16 h-16 bg-[#39FF14]/10 text-[#39FF14] rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-9 h-9" />
            </div>
            <h2 className="text-xl font-bold mb-1 text-[#39FF14]">สะสมคะแนนสำเร็จ!</h2>
            <div className="bg-black/40 border border-neutral-800 rounded-2xl py-4 px-6 w-full my-4 flex justify-between items-center">
              <span className="text-neutral-400 text-sm font-mono">คะแนนที่เคลมได้</span>
              <span className="text-2xl font-bold font-mono text-[#DFFF00]">{score} แต้ม</span>
            </div>
            <p className="text-xs text-neutral-500 mb-6 font-mono leading-relaxed">
              {distance && `พิกัดได้รับการตรวจสอบเรียบร้อย (ระยะห่าง: ${(distance * 1000).toFixed(0)} เมตร)`}
            </p>
            <button
              onClick={() => navigate('/arcade')}
              className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer"
            >
              ดูตารางอันดับ Hall of Fame
            </button>
          </div>
        )}

        {/* View: Error / Failed */}
        {status === 'error' && (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold mb-2">เกิดข้อผิดพลาดในการเคลมสิทธิ์</h2>
            <p className="text-sm text-red-400/90 mb-8 leading-relaxed px-2">
              {errorMessage}
            </p>
            <div className="flex flex-col w-full gap-3">
              <button
                onClick={validateAndProcessClaim}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer"
              >
                ลองใหม่อีกครั้ง
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full bg-black/40 border border-neutral-850 hover:text-white text-neutral-400 py-3.5 rounded-xl transition-all text-sm font-mono cursor-pointer"
              >
                กลับไปหน้าหลักของร้าน
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
