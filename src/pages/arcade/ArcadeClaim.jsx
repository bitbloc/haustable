import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { generateScoreHash } from './game/scenes/GameOverScene';
import confetti from 'canvas-confetti';
import { ShieldAlert, MapPin, Award, CheckCircle, LogIn, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

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
  const [claimResultMessage, setClaimResultMessage] = useState('');

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
      const newScore = parseInt(score);

      // Check if there is an existing score for this user
      const { data: existingLeaderboard, error: selectError } = await supabase
        .from('leaderboard')
        .select('id, score')
        .eq('profile_id', session.user.id)
        .maybeSingle();

      if (selectError) throw selectError;

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

      // Call RPC to securely claim P2E rewards
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('claim_arcade_rewards', { p_score: newScore });

      if (rpcError) throw rpcError;

      const message = rpcData?.message || 'สะสมประวัติคะแนนของท่านสำเร็จ!';
      setClaimResultMessage(message);

      // Lock token locally
      localStorage.setItem(`claimed_${hash}`, 'true');

      // Trigger Confetti Celebration!
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#E05315', '#06C755', '#222222', '#F2F2EC']
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
    <div id="arcade-claim-root" className="min-h-screen flex flex-col items-center justify-center p-6 relative select-none">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');

        html, body {
          overflow-x: clip !important;
        }

        #arcade-claim-root {
          --color-paper: oklch(96% 0.003 80);      /* Braun light-grey casing */
          --color-paper-2: oklch(92% 0.004 80);    /* Secondary elevation card */
          --color-ink: oklch(20% 0.003 80);        /* Deep charcoal */
          --color-ink-2: oklch(40% 0.004 80);      /* Muted lettering */
          --color-muted: oklch(55% 0.004 80);
          --color-rule: oklch(82% 0.004 80);       /* Hairline dividers */
          --color-brand: oklch(62% 0.16 35);      /* Braun Dial Orange Accent */
          
          --font-display: 'Space Mono', monospace;
          --font-body: 'IBM Plex Sans Thai', 'Inter', sans-serif;
          
          --dur-short: 180ms;
          --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
          
          background-color: var(--color-paper);
          color: var(--color-ink);
          font-family: var(--font-body);
        }

        #arcade-claim-root .btn-action {
          transition: background-color var(--dur-short) var(--ease-out), color var(--dur-short) var(--ease-out), transform var(--dur-short) var(--ease-out);
        }
        #arcade-claim-root .btn-action:hover:not(:disabled) {
          filter: brightness(0.95);
        }
        #arcade-claim-root .btn-action:active:not(:disabled) {
          transform: scale(0.98);
        }
        #arcade-claim-root .btn-action:focus-visible {
          outline: 2px solid var(--color-brand);
          outline-offset: 2px;
        }
      `}</style>
      
      <div className="w-full max-w-md bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-md p-8 shadow-sm text-center relative">
        {/* Minimal orange highlight strip */}
        <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-brand)] rounded-t-md" />

        <h1 className="text-xs font-bold font-mono tracking-widest text-[var(--color-brand)] mb-8 uppercase">
          // HAUS ARCADE RECEIPT CLAIM
        </h1>

        {/* View: Auth / Login Required */}
        {status === 'login_required' && (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-[#06C755]/10 text-[#06C755] rounded-[3px] flex items-center justify-center mb-6">
              <LogIn className="w-6 h-6" />
            </div>
            <h2 className="text-[13px] font-bold mb-2 font-mono uppercase tracking-tight">ยินดีด้วย! คุณทำคะแนนได้ {score} แต้ม</h2>
            <p className="text-[10px] text-[var(--color-ink-2)] mb-6 leading-relaxed">
              กรุณาเข้าสู่ระบบผ่านสมาชิก LINE เพื่อบันทึกคะแนนสะสมลงในระบบและลุ้นรับเหรียญ xhaus
            </p>
            <button
              onClick={handleLineLogin}
              className="btn-action w-full bg-[#06C755] text-white font-mono font-bold py-2.5 rounded-[4px] flex items-center justify-center gap-2 cursor-pointer text-xs uppercase border border-[#05b04b] shadow-sm"
            >
              เข้าสู่ระบบด้วย LINE
            </button>
          </div>
        )}

        {/* View: Loading / Verifying */}
        {status === 'verifying' && (
          <div className="py-12 flex flex-col items-center">
            <RefreshCw className="w-8 h-8 text-[var(--color-brand)] animate-spin mb-4" />
            <p className="text-[10px] text-[var(--color-ink-2)] font-mono animate-pulse">VERIFYING RECEIPT TOKEN…</p>
          </div>
        )}

        {/* View: GPS Request */}
        {status === 'gps_required' && (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-[var(--color-brand)]/10 text-[var(--color-brand)] rounded-[3px] flex items-center justify-center mb-6">
              <MapPin className="w-6 h-6 animate-bounce" />
            </div>
            <h2 className="text-[13px] font-bold mb-2 font-mono uppercase tracking-tight">ตรวจสอบพิกัดตำแหน่งร้าน</h2>
            <p className="text-[10px] text-[var(--color-ink-2)] mb-6 leading-relaxed">
              กรุณาอนุญาตสิทธิ์เข้าถึงพิกัดที่ตั้ง (GPS) เพื่อยืนยันว่าสแกนรับสิทธิ์ภายในเขตพื้นที่ของร้านอินเดอะเฮาส์
            </p>
            <button
              onClick={requestGpsLocation}
              disabled={gpsLoading}
              className="btn-action w-full bg-[var(--color-brand)] text-white font-mono font-bold py-2.5 rounded-[4px] disabled:opacity-50 cursor-pointer text-xs uppercase border border-[oklch(52% 0.16 35)] shadow-sm"
            >
              {gpsLoading ? 'กำลังดึงพิกัดตำแหน่ง...' : 'ยืนยันตำแหน่ง GPS'}
            </button>
          </div>
        )}

        {/* View: Saving DB */}
        {status === 'saving' && (
          <div className="py-12 flex flex-col items-center">
            <RefreshCw className="w-8 h-8 text-[var(--color-brand)] animate-spin mb-4" />
            <p className="text-[10px] text-[var(--color-ink-2)] font-mono animate-pulse">WRITING DATA TO SYSTEM LEDGER…</p>
          </div>
        )}

        {/* View: Success */}
        {status === 'success' && (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-[3px] flex items-center justify-center mb-6">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h2 className="text-[13px] font-bold text-emerald-600 font-mono uppercase tracking-tight mb-2">// CLAIM GRANTED SUCCESS</h2>
            
            <div className="bg-white border border-[var(--color-rule)] rounded-[4px] py-3.5 px-5 w-full my-4 flex justify-between items-center font-mono text-[10px]">
              <span className="text-[var(--color-ink-2)]">CLEARED SCORE</span>
              <span className="text-sm font-bold text-[var(--color-brand)]">{score} PTS</span>
            </div>

            {claimResultMessage && (
              <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[4px] py-3 px-4 w-full text-center text-[10px] font-bold text-[var(--color-ink)] mb-4 font-mono leading-relaxed">
                {claimResultMessage}
              </div>
            )}
            
            <p className="text-[8px] text-[var(--color-muted)] mb-6 font-mono uppercase leading-relaxed">
              {distance && `verified lock at ${(distance * 1000).toFixed(0)} meters from base station`}
            </p>
            
            <button
              onClick={() => navigate('/arcade')}
              className="btn-action w-full bg-[var(--color-ink)] hover:bg-[var(--color-ink-2)] text-[var(--color-paper)] font-mono font-bold py-2.5 rounded-[4px] cursor-pointer text-xs uppercase shadow-sm"
            >
              GO TO HALL OF FAME
            </button>
          </div>
        )}

        {/* View: Error / Failed */}
        {status === 'error' && (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-[3px] flex items-center justify-center mb-6">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-[13px] font-bold text-red-500 font-mono uppercase tracking-tight mb-2">// TRANSACTION REJECTED</h2>
            <p className="text-[10px] text-red-600/90 mb-8 leading-relaxed px-2 font-mono">
              {errorMessage}
            </p>
            <div className="flex flex-col w-full gap-3">
              <button
                onClick={validateAndProcessClaim}
                className="btn-action w-full bg-[var(--color-brand)] text-white font-mono font-bold py-2.5 rounded-[4px] cursor-pointer text-xs uppercase border border-[oklch(52% 0.16 35)] shadow-sm"
              >
                RETRY TRANSACTION
              </button>
              <button
                onClick={() => navigate('/')}
                className="btn-action w-full bg-white hover:bg-[var(--color-paper)] text-[var(--color-ink-2)] font-mono py-2.5 rounded-[4px] border border-[var(--color-rule)] text-xs uppercase transition-all cursor-pointer"
              >
                RETURN TO STORE FRONT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
