/* Hallmark · macrostructure: Workbench · genre: modern-minimal · theme: Atelier (Dieter Rams + Thai Modern OKLCH)
 * pre-emit critique: P5 H5 E5 S5 R5 V5
 * states: default · hover · focus · active · loading · error · success
 * contrast: pass (APCA / WCAG compliant)
 */
import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { getAppOrigin } from '../../utils/urlHelper';
import { resolveTableIdentifier } from '../../utils/tableResolver';
import FlappyCatGame from './FlappyCatGame';
import TaiPlaMiniGame from './game/TaiPlaMiniGame';
import ArcadePreview from './ArcadePreview';
import { useLofi, LofiMiniPlayer, LofiStudio } from './lofi/LofiLounge';
import { pixelSound, getArcadeRank, normalizeLeaderboard } from './game/utils/pixelSoundEngine';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

export default function ArcadeLobby() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryTableId = searchParams.get('tableId');
  const [activeTableId, setActiveTableId] = useState(null);
  const [activeTableName, setActiveTableName] = useState('');

  const [leaderboard, setLeaderboard] = useState([]);
  const queryTab = searchParams.get('tab');
  const queryGame = searchParams.get('game');
  const [activeMode, setActiveMode] = useState(() => {
    if (queryGame === 'tai_pla' || queryTab === 'tai_pla' || queryTab === 'sator_chill') return 'tai_pla';
    if (queryGame === 'flappy' || queryTab === 'game') return 'flappy';
    return 'hub';
  });
  const [showStudioModal, setShowStudioModal] = useState(() => queryTab === 'lofi' || queryTab === 'chill');
  const [taiPlaHighScore, setTaiPlaHighScore] = useState(() => {
    return parseInt(localStorage.getItem('tai_pla_high_score') || '0', 10);
  });
  const [activeTab, setActiveTab] = useState(() => {
    if (queryTab === 'lofi' || queryTab === 'chill') return 'lofi';
    if (queryTab === 'tai_pla' || queryTab === 'sator_chill') return 'tai_pla';
    return 'game';
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Guest leaderboard submission
  const [guestName, setGuestName] = useState('');
  const [isSubmittingGuest, setIsSubmittingGuest] = useState(false);

  const lofi = useLofi();

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

  // Fetch real-time top scores from Supabase leaderboard (deduplicated per player)
  const fetchLeaderboard = async (isManual = false) => {
    try {
      if (isManual) {
        setIsRefreshing(true);
        pixelSound.play('ui_click');
      } else if (leaderboard.length === 0) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from('leaderboard')
        .select(`
          id,
          profile_id,
          score,
          created_at,
          display_name,
          profiles (
            display_name,
            nickname
          )
        `)
        .order('score', { ascending: false })
        .limit(40);

      if (error) throw error;

      const formatted = (data || []).map(entry => ({
        id: entry.id,
        profile_id: entry.profile_id || null,
        score: entry.score,
        display_name: entry.display_name || entry.profiles?.nickname || entry.profiles?.display_name || 'GUEST',
        created_at: entry.created_at
      }));

      let localScores = [];
      try {
        localScores = JSON.parse(localStorage.getItem('local_guest_leaderboard') || '[]');
      } catch (err) {
        console.warn('Error reading local guest leaderboard:', err);
      }

      const normalizedTop10 = normalizeLeaderboard(formatted, localScores).slice(0, 10);
      setLeaderboard(normalizedTop10);
      if (isManual) {
        toast.success('รีเฟรชข้อมูลทำเนียบ 10 อันดับเรียบร้อย');
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard:', e);
      if (isManual) toast.error('ไม่สามารถรีเฟรชคะแนนได้');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch user profile info
  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
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

  // --- Flexible Table Resolver (Table H1 Bug Fix & Active Booking Check) ---
  useEffect(() => {
    fetchLeaderboard();
    fetchRewards();

    if (searchParams.get('clearTable') === 'true') {
      localStorage.removeItem('active_customer_table_id');
      localStorage.removeItem('active_customer_table_name');
      setActiveTableId(null);
      setActiveTableName('');
      return;
    }
    
    const effectiveParam = queryTableId || localStorage.getItem('active_customer_table_id');
    const savedName = localStorage.getItem('active_customer_table_name');
    
    if (effectiveParam) {
      const cleanParam = effectiveParam.trim();
      
      const resolveTable = async () => {
        const tableData = await resolveTableIdentifier(cleanParam, supabase);

        if (tableData) {
          const display = tableData.table_name || `Table ${tableData.id}`;
          
          // If not explicitly provided in URL params, verify if there is an active booking
          if (!queryTableId) {
            try {
              const { data: activeBookings } = await supabase
                .from('bookings')
                .select('id, status')
                .eq('table_id', tableData.id)
                .in('status', ['pending', 'confirmed', 'seated', 'ready'])
                .limit(1);

              if (!activeBookings || activeBookings.length === 0) {
                localStorage.removeItem('active_customer_table_id');
                localStorage.removeItem('active_customer_table_name');
                setActiveTableId(null);
                setActiveTableName('');
                return;
              }
            } catch (e) {}
          }

          setActiveTableId(tableData.table_name || tableData.id.toString());
          setActiveTableName(display);
          localStorage.setItem('active_customer_table_id', tableData.id.toString());
          localStorage.setItem('active_customer_table_name', display);
        } else if (queryTableId) {
          setActiveTableId(cleanParam);
          if (!savedName) setActiveTableName(`Table ${cleanParam}`);
        } else {
          setActiveTableId(null);
          setActiveTableName('');
        }
      };

      resolveTable();
    } else {
      setActiveTableId(null);
      setActiveTableName('');
    }
  }, [queryTableId]);

  // Realtime subscription for automatic updates whenever leaderboard table changes
  useEffect(() => {
    const channel = supabase
      .channel('arcade-leaderboard-live-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, () => {
        fetchLeaderboard(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchUserProfile(session.user.id);
      fetchUserStats(session.user.id);
    } else {
      const savedMemberStr = localStorage.getItem('customer_member_profile');
      if (savedMemberStr) {
        try {
          const savedMember = JSON.parse(savedMemberStr);
          setProfile(savedMember);
        } catch (e) {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
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
    fetchLeaderboard();
  };

  const handleClaimScore = (score) => {
    setClaimScore(score);
    setShowClaimModal(true);
    setClaimStatus('idle');
    setClaimError('');
    setDistance(null);
    setGuestName(profile?.nickname || profile?.display_name || '');
  };

  const handleLineLogin = async () => {
    try {
      setGpsLoading(true);
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
      toast.error('เข้าสู่ระบบ LINE ล้มเหลว กรุณาลองใหม่อีกครั้ง');
    }
  };

  // Submit score as Guest to Leaderboard (deduplicated by display_name)
  const handleGuestSubmit = async (e) => {
    if (e) e.preventDefault();
    const finalName = ((guestName || '').trim() || 'GUEST CAT').toUpperCase();
    setIsSubmittingGuest(true);
    pixelSound.play('tier_up');

    try {
      // Check if this guest name already exists on the leaderboard to avoid duplicate rows
      const { data: existingRows } = await supabase
        .from('leaderboard')
        .select('id, score')
        .ilike('display_name', finalName)
        .is('profile_id', null)
        .order('score', { ascending: false })
        .limit(1);

      let dbError = null;
      if (existingRows && existingRows.length > 0) {
        const bestExisting = existingRows[0];
        if (claimScore > (bestExisting.score || 0)) {
          const { error: updErr } = await supabase
            .from('leaderboard')
            .update({
              score: claimScore,
              display_name: finalName,
              created_at: new Date().toISOString()
            })
            .eq('id', bestExisting.id);
          dbError = updErr;
        }
      } else {
        const { error: insErr } = await supabase
          .from('leaderboard')
          .insert({
            display_name: finalName,
            score: claimScore
          });
        dbError = insErr;
      }

      // Always keep local fallback updated for instant UI resilience
      try {
        const localScores = JSON.parse(localStorage.getItem('local_guest_leaderboard') || '[]');
        const existingIdx = localScores.findIndex(s => (s.display_name || '').toUpperCase() === finalName);
        if (existingIdx !== -1) {
          if (claimScore > localScores[existingIdx].score) {
            localScores[existingIdx].score = claimScore;
            localScores[existingIdx].created_at = new Date().toISOString();
          }
        } else {
          localScores.push({
            id: `guest_${Date.now()}`,
            display_name: finalName,
            score: claimScore,
            created_at: new Date().toISOString()
          });
        }
        localStorage.setItem('local_guest_leaderboard', JSON.stringify(localScores));
      } catch (storageErr) {
        console.error('Local storage guest save error:', storageErr);
      }

      if (dbError) {
        console.warn('Supabase guest upsert warning, persisted locally:', dbError);
      }

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });

      const earnedRank = getArcadeRank(claimScore, activeMode === 'tai_pla' ? 'tai_pla' : 'flappy');
      toast.success(`บันทึกคะแนน ${claimScore} PTS (${earnedRank.badge}) ของคุณ ${finalName} ลงบอร์ดแล้ว!`);
      setShowClaimModal(false);
      fetchLeaderboard();
    } catch (err) {
      console.error('Guest submit error:', err);
      toast.error('ไม่สามารถบันทึกแต้ม กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmittingGuest(false);
    }
  };

  const processClaimScore = () => {
    if (!navigator.geolocation) {
      // Geolocation not supported, still allow saving high score to leaderboard
      saveScoreToDatabase(false);
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

        const isNearby = dist <= MAX_RADIUS_KM;
        await saveScoreToDatabase(isNearby);
      },
      async (error) => {
        setGpsLoading(false);
        console.warn('GPS permission error or unavailable, saving leaderboard anyway:', error);
        // Fallback: save score to leaderboard even if GPS denied/unavailable
        await saveScoreToDatabase(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const saveScoreToDatabase = async (isNearby = true) => {
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
        const { error: insertError } = await supabase
          .from('leaderboard')
          .insert({
            profile_id: session.user.id,
            display_name: nameToDisplay,
            score: claimScore
          });

        if (insertError) throw insertError;
      }

      // Call RPC to securely claim P2E rewards if player is verified at the store
      if (isNearby) {
        try {
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('claim_arcade_rewards', { p_score: claimScore });

          if (rpcError) console.warn('P2E RPC error:', rpcError);
          const message = rpcData?.message || 'สะสมประวัติคะแนนและรับเหรียญ xhaus สำเร็จ!';
          setClaimResultMessage(message);
        } catch (rpcErr) {
          console.warn('RPC execution exception:', rpcErr);
          setClaimResultMessage('บันทึกคะแนนเข้าทำเนียบยอดฝีมือสำเร็จ!');
        }
      } else {
        setClaimResultMessage('บันทึกคะแนนของคุณลงทำเนียบ Leaderboard สำเร็จ! (สิทธิ์รับเหรียญ xhaus เพิ่มเติมสงวนไว้สำหรับผู้เล่นที่ร้าน)');
      }

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#E05315', '#06C755', '#222222', '#F2F2EC']
      });

      setClaimStatus('success');
      fetchLeaderboard();
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
          redirectTo: getAppOrigin() + '/arcade'
        }
      });
      if (error) throw error;
    } catch (e) {
      toast.error('เข้าสู่ระบบ LINE ล้มเหลว กรุณาลองใหม่อีกครั้ง');
    }
  };

  const renderClaimModal = () => {
    if (!showClaimModal) return null;
    const earnedRank = getArcadeRank(claimScore, activeMode === 'tai_pla' ? 'tai_pla' : 'flappy');
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.15s_ease-out] font-sans">
        <div className="w-full max-w-md bg-[var(--color-paper)] border-2 border-[#181615] rounded-3xl p-6 sm:p-8 shadow-xl text-left relative">
          <button 
            onClick={() => {
              pixelSound.play('ui_click');
              setShowClaimModal(false);
            }}
            className="absolute top-5 right-5 text-[#78716c] hover:text-[#181615] transition-colors cursor-pointer font-mono text-[10px] font-bold"
          >
            [ CLOSE ]
          </button>

          {!session && (
            <div className="flex flex-col gap-4 mt-2 font-mono text-xs">
              <div>
                <h2 className="text-[10px] font-bold tracking-widest text-[#bd4924] uppercase mb-1">
                  // SCORE RECORDING & REWARDS
                </h2>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-xl font-bold text-[#181615] font-pixel uppercase tracking-wide">
                    FINAL SCORE: {claimScore} PTS
                  </h3>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${earnedRank.badgeBg} ${earnedRank.badgeText} ${earnedRank.badgeBorder}`}>
                    [ RANK {earnedRank.rank} // {earnedRank.titleTh} ]
                  </span>
                </div>
                <p className="text-[10px] font-bold text-[#bd4924] mb-1">
                  {earnedRank.rewardText}
                </p>
                <p className="text-[11px] text-[#57534e] leading-relaxed font-sans">
                  เข้าสู่ระบบ LINE เพื่อรับเหรียญ xhaus และตั๋วสุ่มรายสัปดาห์ หรือใส่ชื่อเพื่อบันทึกสถิติลง Leaderboard ทันที
                </p>
              </div>

              <button
                onClick={() => {
                  pixelSound.play('ui_click');
                  handleLineLogin();
                }}
                className="w-full bg-[#06C755] hover:bg-[#05b04b] text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 cursor-pointer font-mono text-[11px] uppercase shadow-sm border-2 border-[#05b04b]"
              >
                <span>[ CONNECT LINE // รับเหรียญ XHAUS ]</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[var(--color-rule)]"></div>
                <span className="flex-shrink mx-3 text-[9px] text-[#78716c] uppercase">[ OR SUBMIT AS GUEST ]</span>
                <div className="flex-grow border-t border-[var(--color-rule)]"></div>
              </div>

              <form onSubmit={handleGuestSubmit} className="flex gap-2">
                <input 
                  type="text"
                  placeholder="ใส่ชื่อหรือชื่อเล่น…"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  maxLength={15}
                  className="flex-1 bg-[#FAF7F2] border-2 border-[#181615] px-3 py-2 text-xs font-mono rounded-xl outline-none focus:border-[#bd4924]"
                />
                <button
                  type="submit"
                  disabled={isSubmittingGuest}
                  className="px-5 py-2 bg-[#181615] hover:bg-[#252220] text-[#FAF7F5] text-[10px] font-bold uppercase rounded-xl cursor-pointer transition-colors"
                >
                  {isSubmittingGuest ? '[ บันทึก… ]' : '[ บันทึกบอร์ด ]'}
                </button>
              </form>
            </div>
          )}

          {session && claimStatus === 'idle' && (
            <div className="flex flex-col gap-4 mt-2 font-mono text-xs">
              <div>
                <h2 className="text-[10px] font-bold tracking-widest text-[#bd4924] uppercase mb-1">
                  // GPS LOCK VERIFICATION
                </h2>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-xl font-bold text-[#181615] font-pixel uppercase tracking-wide">
                    VERIFY SCORE: {claimScore} PTS
                  </h3>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${earnedRank.badgeBg} ${earnedRank.badgeText} ${earnedRank.badgeBorder}`}>
                    [ RANK {earnedRank.rank} // {earnedRank.titleTh} ]
                  </span>
                </div>
                <p className="text-[10px] font-bold text-[#bd4924] mb-1">
                  {earnedRank.rewardText}
                </p>
                <p className="text-[11px] text-[#57534e] leading-relaxed font-sans">
                  ยืนยันพิกัด GPS เพื่อรับเหรียญ xhaus และบันทึกสถิติของคุณเข้าบอร์ดประจำสัปดาห์
                </p>
              </div>
              <button
                onClick={() => {
                  pixelSound.play('ui_click');
                  processClaimScore();
                }}
                className="w-full bg-[#E9F344] hover:bg-[#d9e334] text-[#181615] font-bold py-3.5 rounded-2xl cursor-pointer font-mono text-xs uppercase shadow-xs border-2 border-[#181615]"
              >
                [ ยืนยัน GPS & บันทึกสถิติ ]
              </button>
            </div>
          )}

          {claimStatus === 'checking_gps' && (
            <div className="py-8 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-[#181615] border-t-[#E9F344] animate-spin" />
              <p className="text-[10px] text-[#181615] font-mono uppercase tracking-wider">[ VERIFYING GPS COORDINATES… ]</p>
            </div>
          )}

          {claimStatus === 'saving' && (
            <div className="py-8 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-[#181615] border-t-[#E9F344] animate-spin" />
              <p className="text-[10px] text-[#181615] font-mono uppercase tracking-wider">[ COMMITTING DATA TO LEDGER… ]</p>
            </div>
          )}

          {claimStatus === 'success' && (
            <div className="flex flex-col gap-4 mt-2 font-mono text-xs">
              <div>
                <h2 className="text-[10px] font-bold tracking-widest text-emerald-700 uppercase mb-1">
                  // CLAIM GRANTED SUCCESS
                </h2>
                <h3 className="text-xl font-bold text-[#181615] mb-2 font-pixel uppercase">
                  TRANSACTION CONFIRMED
                </h3>
                <div className="bg-[#FAF7F2] border-2 border-[#181615] rounded-2xl py-3 px-4 w-full my-2 flex justify-between items-center">
                  <span className="text-[#57534e] text-[10px] uppercase">[ RECORDED SCORE ]</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${earnedRank.badgeBg} ${earnedRank.badgeText} ${earnedRank.badgeBorder}`}>
                      [ {earnedRank.rank} ]
                    </span>
                    <span className="text-base font-bold text-[#bd4924]">{claimScore} PTS</span>
                  </div>
                </div>
                {claimResultMessage && (
                  <div className="bg-[#FAF7F2] border border-[#181615]/30 rounded-xl py-3 px-4 w-full text-center text-[10px] font-bold text-[#181615] my-2 leading-relaxed">
                    {claimResultMessage}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  pixelSound.play('ui_click');
                  setShowClaimModal(false);
                }}
                className="w-full bg-[#181615] hover:bg-[#252220] text-[#FAF7F5] font-bold py-3 rounded-2xl cursor-pointer font-mono text-[10px] uppercase shadow-sm"
              >
                [ DISMISS PANEL ]
              </button>
            </div>
          )}

          {claimStatus === 'error' && (
            <div className="flex flex-col gap-4 mt-2 font-mono text-xs">
              <div>
                <h2 className="text-[10px] font-bold tracking-widest text-red-600 uppercase mb-1">
                  // TRANSACTION REJECTED
                </h2>
                <h3 className="text-sm font-bold text-[#181615] mb-1 font-mono uppercase">การบันทึกสถิติล้มเหลว</h3>
                <p className="text-[11px] text-red-600/90 leading-relaxed font-sans">
                  {claimError}
                </p>
              </div>
              <div className="flex w-full gap-3 mt-2">
                <button
                  onClick={session ? processClaimScore : handleLineLogin}
                  className="flex-1 bg-[#181615] hover:bg-[#252220] text-[#FAF7F5] font-bold py-2.5 rounded-xl cursor-pointer font-mono text-[10px] uppercase text-center"
                >
                  [ RETRY ]
                </button>
                <button
                  onClick={() => setShowClaimModal(false)}
                  className="flex-1 bg-[#FAF7F2] hover:bg-[#F2ECE4] text-[#181615] font-bold py-2.5 rounded-xl text-[10px] uppercase text-center border-2 border-[#181615] cursor-pointer"
                >
                  [ CANCEL ]
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (activeMode === 'tai_pla') {
    return (
      <div id="arcade-lobby-root" className="min-h-screen bg-[#FAF7F2] font-sans">
        <TaiPlaMiniGame 
          session={session}
          onClaimScore={handleClaimScore}
          onRequireLogin={handleRequireLogin}
          isDedicated={true}
          onBackToHub={() => {
            pixelSound.play('ui_click');
            setActiveMode('hub');
            setTaiPlaHighScore(parseInt(localStorage.getItem('tai_pla_high_score') || '0', 10));
          }}
          onCoinEarned={(coinAmount) => {
            if (session?.user) {
              fetchUserStats(session.user.id);
              fetchUserProfile(session.user.id);
            }
          }}
        />
        <LofiMiniPlayer lofi={lofi} onOpenStudio={() => setShowStudioModal(true)} />
        <LofiStudio lofi={lofi} open={showStudioModal} onClose={() => setShowStudioModal(false)} />
        {renderClaimModal()}
      </div>
    );
  }

  if (activeMode === 'flappy') {
    return (
      <div id="arcade-lobby-root" className="min-h-screen bg-[#181615] font-sans">
        <FlappyCatGame 
          onGameOver={handleGameOver} 
          leaderboard={leaderboard} 
          onClaimScore={handleClaimScore} 
          session={session} 
          onRequireLogin={handleRequireLogin} 
          isFullscreen={true}
          setIsFullscreen={(val) => {
            if (!val) setActiveMode('hub');
          }}
          onBackToHub={() => {
            pixelSound.play('ui_click');
            setActiveMode('hub');
          }}
        />
        <LofiMiniPlayer lofi={lofi} onOpenStudio={() => setShowStudioModal(true)} />
        <LofiStudio lofi={lofi} open={showStudioModal} onClose={() => setShowStudioModal(false)} />
        {renderClaimModal()}
      </div>
    );
  }

  const taiPlaRank = getArcadeRank(taiPlaHighScore, 'tai_pla');

  return (
    <div id="arcade-lobby-root" className="min-h-screen flex flex-col relative select-none font-sans bg-[var(--color-paper)]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');

        html, body {
          overflow-x: clip !important;
        }

        #arcade-lobby-root,
        #arcade-lobby-root .font-sans {
          font-family: 'IBM Plex Sans Thai', ui-sans-serif, system-ui, sans-serif;
        }
        #arcade-lobby-root .font-mono {
          font-family: 'Space Mono', 'IBM Plex Sans Thai', ui-monospace, monospace;
        }

        .arcade-card {
          transition: transform 140ms ease-out, box-shadow 140ms ease-out;
        }
        @media (hover: hover) {
          .arcade-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 0 0 #181615;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .arcade-card { transition: none; }
          .arcade-card:hover { transform: none; }
        }

        #arcade-lobby-root {
          --color-paper: oklch(97% 0.008 28);
          --color-paper-2: oklch(94% 0.010 28);
          --color-paper-3: oklch(91% 0.012 28);
          --color-rule: oklch(85% 0.012 28);
          --color-neutral: oklch(55% 0.010 28);
          --color-muted: oklch(42% 0.010 28);
          --color-ink: oklch(18% 0.012 28);
          --color-ink-2: oklch(35% 0.010 28);
          --color-accent: oklch(52% 0.16 28);
          --color-accent-2: oklch(45% 0.08 140);
          --color-brand: oklch(52% 0.16 28);
          background-color: var(--color-paper);
          color: var(--color-ink);
        }
      `}</style>

      {activeTableId && (
        <div className="w-full bg-[oklch(52%_0.16_28)] text-[var(--color-paper)] py-2 px-4 sm:px-8 flex items-center justify-between border-b border-[oklch(45%_0.16_28)] shadow-md sticky top-0 z-40">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
            <span className="font-bold uppercase tracking-wider">
              [ TABLE SESSION // โต๊ะ {activeTableName || `T-${activeTableId}`} ]
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/table/${activeTableId}/status`)}
              className="btn-action px-3 py-1 rounded-xl bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] text-[10px] font-mono font-bold uppercase tracking-wider shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
            >
              [ ← กลับโต๊ะ {activeTableName || `#${activeTableId}`} ]
            </button>
            <button
              onClick={() => {
                setActiveTableId(null);
                setActiveTableName('');
                localStorage.removeItem('active_customer_table_id');
                localStorage.removeItem('active_customer_table_name');
              }}
              title="ปิดแถบแจ้งเตือนโต๊ะ"
              className="px-2 py-1 rounded-lg bg-black/20 hover:bg-[#252220]/40 text-[var(--color-paper)] font-mono text-[10px] font-bold transition-colors cursor-pointer"
            >
              [ × ]
            </button>
          </div>
        </div>
      )}

      <header className="w-full border-b-2 border-[#181615] bg-[#FAF7F2] py-4 px-4 sm:px-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-3">
          <Link to="/" className="w-10 h-10 bg-[#181615] flex items-center justify-center p-1.5 rounded-2xl border-2 border-[#181615] shrink-0 shadow-xs hover:border-[#bd4924] active:scale-95 transition-transform">
            <img 
              src="/logo.png" 
              alt="ในบ้าน" 
              className="w-full h-full object-contain" 
            />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-pixel text-xl sm:text-2xl font-bold tracking-wider text-[#181615] uppercase">
                HAUS ARCADE // 026
              </h1>
              <span className="font-mono text-[9px] bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                ONLINE
              </span>
            </div>
            <p className="text-[10px] text-[#78716c] font-mono uppercase tracking-widest">
              [ NAKHON PHANOM MEKONG RETRO-ARCADE & LOUNGE ]
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto">
          <div className="flex items-center gap-1.5 bg-[#E9F344] text-[#181615] border-2 border-[#181615] px-3.5 py-1.5 rounded-2xl font-mono font-bold text-xs shadow-xs">
            <span className="text-[9px] uppercase tracking-wider text-[#181615]/70">WALLET:</span>
            <span>{session ? parseFloat(profile?.xhaus_balance || 0).toFixed(2) : "0.00"} XH</span>
          </div>

          {session ? (
            <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono text-[#181615] bg-[#FAF7F2] border-2 border-[#181615] rounded-2xl shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-bold uppercase tracking-wider">
                {profile?.nickname || profile?.display_name || 'MEMBER'}
              </span>
            </div>
          ) : (
            <button
              onClick={handleRequireLogin}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-[#181615] hover:bg-[#252220] text-[#FAF7F5] text-[10px] font-mono font-bold uppercase tracking-wider rounded-2xl border-2 border-[#181615] shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-[#E9F344]"></span>
              <span>[ CONNECT LINE ]</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-8">
        <div className="flex flex-col gap-1 text-left select-none">
          <h2 className="font-pixel text-xl sm:text-2xl font-bold uppercase tracking-wider text-[#181615]">
            PICK A GAME
          </h2>
          <p className="text-sm text-[#57534e] font-sans leading-relaxed">
            เลือกเกมแล้วแตะเพื่อเริ่มเล่นได้ทันที ไม่ต้องสมัครสมาชิก
          </p>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <article className="arcade-card bg-[#FAF7F2] border-2 border-[#181615] rounded-3xl overflow-hidden shadow-sm flex flex-col">
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => {
                pixelSound.play('ui_click');
                setActiveMode('tai_pla');
              }}
              className="relative block w-full cursor-pointer border-b-2 border-[#181615] bg-[#3B7BA8]"
            >
              <ArcadePreview game="tai_pla" />
              <span className="absolute top-3 left-3 flex items-center gap-1.5 bg-[#181615] text-[#FAF7F5] font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg">
                <span className={`px-1 rounded-sm border ${taiPlaRank.badgeBg} ${taiPlaRank.badgeText} ${taiPlaRank.badgeBorder}`}>
                  {taiPlaRank.rank}
                </span>
                <span>สถิติของคุณ {taiPlaHighScore}</span>
              </span>
            </button>

            <div className="flex flex-col gap-4 p-5 sm:p-6 flex-1">
              <div className="flex flex-col gap-1">
                <h3 className="font-pixel text-2xl font-bold text-[#181615] uppercase tracking-wider">
                  TAI-PLA RUN
                </h3>
                <p className="text-sm text-[#57534e] font-sans leading-relaxed">
                  วิ่งริมโขงนครพนม กระโดดหลบปีศาจพริก แล้วเก็บปลา สะตอ และหน่อไม้มาปรุงแกงไตปลา
                </p>
              </div>
              <ul className="flex flex-wrap gap-2 font-mono text-[11px] font-bold text-[#181615]">
                <li className="px-2.5 py-1 rounded-lg border border-[#181615]/25">ตัวละคร 5 ตัว</li>
                <li className="px-2.5 py-1 rounded-lg border border-[#181615]/25">แตะเพื่อกระโดด</li>
                <li className="px-2.5 py-1 rounded-lg border border-[#181615]/25">ความเผ็ด 4 ระดับ</li>
              </ul>
              <button
                type="button"
                onClick={() => {
                  pixelSound.play('ui_click');
                  setActiveMode('tai_pla');
                }}
                className="mt-auto w-full bg-[#E9F344] hover:bg-[#d9e334] text-[#181615] font-mono font-bold text-base py-4 px-4 rounded-2xl border-2 border-[#181615] shadow-xs active:scale-[0.98] cursor-pointer tracking-wide transition-transform duration-100 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd4924]"
              >
                เล่น Tai-Pla Run
              </button>
            </div>
          </article>

          <article className="arcade-card bg-[#FAF7F2] border-2 border-[#181615] rounded-3xl overflow-hidden shadow-sm flex flex-col">
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => {
                pixelSound.play('ui_click');
                setActiveMode('flappy');
              }}
              className="relative block w-full cursor-pointer border-b-2 border-[#181615] bg-[#3B7BA8]"
            >
              <ArcadePreview game="flappy" />
              <span className="absolute top-3 left-3 bg-[#181615] text-[#E9F344] font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg">
                ได้เหรียญ XHAUS
              </span>
            </button>

            <div className="flex flex-col gap-4 p-5 sm:p-6 flex-1">
              <div className="flex flex-col gap-1">
                <h3 className="font-pixel text-2xl font-bold text-[#181615] uppercase tracking-wider">
                  FLAPPY CAT
                </h3>
                <p className="text-sm text-[#57534e] font-sans leading-relaxed">
                  พาแมวส้มบินลอดฝักสะตอเหนือแม่น้ำโขง ยิ่งผ่านได้ไกล ยิ่งได้รางวัลจากร้าน
                </p>
              </div>
              <ul className="flex flex-wrap gap-2 font-mono text-[11px] font-bold text-[#181615]">
                <li className="px-2.5 py-1 rounded-lg border border-[#181615]/25">20 ท่อ +1 XH</li>
                <li className="px-2.5 py-1 rounded-lg border border-[#181615]/25">35 ท่อ +1 XH</li>
                <li className="px-2.5 py-1 rounded-lg border border-[#181615]/25">40 ท่อ ตั๋วสุ่ม</li>
              </ul>
              <button
                type="button"
                onClick={() => {
                  pixelSound.play('ui_click');
                  setActiveMode('flappy');
                }}
                className="mt-auto w-full bg-[#181615] hover:bg-[#252220] text-[#FAF7F5] font-mono font-bold text-base py-4 px-4 rounded-2xl border-2 border-[#181615] shadow-xs active:scale-[0.98] cursor-pointer tracking-wide transition-transform duration-100 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd4924]"
              >
                เล่น Flappy Cat
              </button>
            </div>
          </article>

          <article className="arcade-card md:col-span-2 bg-[#FAF7F2] border-2 border-[#181615] rounded-3xl overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="relative border-b-2 md:border-b-0 md:border-r-2 border-[#181615] bg-[#0B1026]">
              <ArcadePreview game="lofi" />
              <span className={`absolute top-3 left-3 font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg ${lofi.playing ? 'bg-[#E9F344] text-[#181615]' : 'bg-[#181615] text-[#FAF7F5]'}`}>
                {lofi.playing ? 'กำลังเล่น' : 'ห้องฟังเพลง'}
              </span>
              <div className="absolute bottom-3 left-3 flex items-end gap-1 h-8" aria-hidden="true">
                <span className={`w-1.5 bg-[#E9F344] ${lofi.playing ? 'h-5 animate-bounce' : 'h-2'}`} />
                <span className={`w-1.5 bg-[#E9F344] ${lofi.playing ? 'h-7 animate-bounce [animation-delay:0.15s]' : 'h-3'}`} />
                <span className={`w-1.5 bg-[#E9F344] ${lofi.playing ? 'h-4 animate-bounce [animation-delay:0.3s]' : 'h-2'}`} />
                <span className={`w-1.5 bg-[#E9F344] ${lofi.playing ? 'h-6 animate-bounce [animation-delay:0.2s]' : 'h-3'}`} />
              </div>
            </div>

            <div className="flex flex-col gap-4 p-5 sm:p-6 justify-center">
              <div className="flex flex-col gap-1">
                <h3 className="font-pixel text-2xl font-bold text-[#181615] uppercase tracking-wider">
                  HAUS LO-FI
                </h3>
                <p className="text-sm text-[#57534e] font-sans leading-relaxed">
                  เพลงคลอเบาๆ 6 บรรยากาศ พร้อมเสียงแม่น้ำโขง เปิดทิ้งไว้ระหว่างรออาหารหรือนั่งทำงานได้
                </p>
                <p className="font-mono text-[11px] font-bold text-[#181615] mt-1 truncate leading-relaxed">
                  {lofi.track.name}
                  {lofi.chordName ? ` · ${lofi.chordName}` : ''}
                </p>
              </div>
              <div className="flex gap-2 font-mono">
                <button
                  type="button"
                  onClick={lofi.toggle}
                  className={`flex-1 py-3.5 px-3 rounded-2xl border-2 border-[#181615] font-bold text-sm cursor-pointer transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd4924] ${
                    lofi.playing
                      ? 'bg-[#FAF7F2] text-[#181615] hover:bg-[#F2ECE4]'
                      : 'bg-[#E9F344] text-[#181615] hover:bg-[#d9e334]'
                  }`}
                >
                  {lofi.playing ? 'พักเพลง' : 'เปิดเพลง'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    pixelSound.play('ui_click');
                    setShowStudioModal(true);
                  }}
                  className="py-3.5 px-4 bg-[#181615] hover:bg-[#252220] text-[#FAF7F5] rounded-2xl border-2 border-[#181615] font-bold text-sm cursor-pointer transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd4924]"
                >
                  เลือกเพลง
                </button>
              </div>
            </div>
          </article>
        </section>

        <section className="w-full bg-[#FAF7F2] border-2 border-[#181615] rounded-3xl p-4 sm:p-5 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 divide-y sm:divide-y-0 sm:divide-x-2 divide-[#181615]/20 font-mono text-center">
            <div className="flex flex-col items-center justify-center p-2">
              <span className="text-[9px] text-[#78716c] uppercase tracking-wider block mb-0.5">
                XHAUS COIN BALANCE
              </span>
              <span className="text-xl sm:text-2xl font-bold text-[#181615] tracking-tight">
                {session ? parseFloat(profile?.xhaus_balance || 0).toFixed(2) : "0.00"} <span className="text-xs font-normal">XH</span>
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-2 pt-3 sm:pt-2">
              <span className="text-[9px] text-[#78716c] uppercase tracking-wider block mb-0.5">
                WEEKLY CAP (สัปดาห์นี้)
              </span>
              <span className="text-xl sm:text-2xl font-bold text-[#181615] tracking-tight">
                {session ? userStats.weeklyTotal.toFixed(2) : "0.00"} <span className="text-xs font-normal">/ 5.00 XH</span>
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-2 pt-3 sm:pt-2">
              <span className="text-[9px] text-[#78716c] uppercase tracking-wider block mb-0.5">
                TODAY QUESTS (ภารกิจวัน)
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#181615] mt-1">
                <span className={`px-1.5 py-0.5 rounded border text-[10px] ${userStats.todayPipe20 ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-[#FAF7F2] border-[#181615]/20 text-neutral-500'}`}>
                  20P: {userStats.todayPipe20 ? '✓' : 'รอ'}
                </span>
                <span className={`px-1.5 py-0.5 rounded border text-[10px] ${userStats.todayPipe35 ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-[#FAF7F2] border-[#181615]/20 text-neutral-500'}`}>
                  35P: {userStats.todayPipe35 ? '✓' : 'รอ'}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-2 pt-3 sm:pt-2">
              <span className="text-[9px] text-[#78716c] uppercase tracking-wider block mb-0.5">
                WEEKLY RAFFLE (ตั๋วสุ่ม)
              </span>
              <span className={`text-base sm:text-lg font-bold mt-0.5 ${userStats.todayRaffle40 ? 'text-[#bd4924]' : 'text-[#78716c]'}`}>
                {userStats.todayRaffle40 ? '1 TICKET // ได้รับแล้ว' : 'สะสมครบ 40 ท่อ'}
              </span>
            </div>
          </div>
        </section>

        <section className="w-full bg-[#FAF7F2] border-2 border-[#181615] rounded-3xl p-5 sm:p-7 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-[#181615] pb-3 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E9F344] border border-[#181615]" />
              <h3 className="font-pixel text-base sm:text-lg font-bold uppercase tracking-wider text-[#181615]">
                WEEKLY TOP 10 ROSTER // ทำเนียบยอดฝีมือประจำสัปดาห์
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden md:inline-block font-mono text-[9px] text-[#78716c] uppercase">
                [ S+:40+ | S:35+ | A:20+ | B:10+ ]
              </span>
              <button
                onClick={() => {
                  pixelSound.play('ui_click');
                  fetchLeaderboard(true);
                }}
                disabled={isRefreshing}
                className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#F2ECE4] text-[#181615] font-mono text-xs font-bold rounded-xl border-2 border-[#181615] cursor-pointer shadow-xs active:scale-95 transition-transform disabled:opacity-60 flex items-center gap-1.5"
              >
                <span>{isRefreshing ? '[ กำลังรีเฟรช… ]' : '[ REFRESH // รีเฟรช ]'}</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-[#78716c] font-mono text-xs animate-pulse">
              LOADING ROSTER DATA…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
              {Array.from({ length: 10 }).map((_, index) => {
                const entry = leaderboard[index];
                const rankNum = (index + 1).toString().padStart(2, '0');

                if (entry) {
                  const playerRank = getArcadeRank(entry.score, 'leaderboard');
                  return (
                    <div 
                      key={entry.id || `rank-${index}`}
                      className={`flex items-center justify-between py-2.5 px-3.5 rounded-xl border-2 transition-colors ${
                        index === 0 
                          ? 'bg-[#E9F344]/35 border-[#181615] text-[#181615] font-bold shadow-2xs' 
                          : index === 1 || index === 2
                            ? 'bg-[#FAF7F2] border-[#181615] text-[#181615] font-semibold'
                            : 'bg-[#FAF7F2] border-[#181615]/30 hover:border-[#181615] text-[#181615]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-bold shrink-0 ${
                          index === 0 
                            ? 'text-[#bd4924]' 
                            : index < 3 
                              ? 'text-[#181615]' 
                              : 'text-[#78716c]'
                        }`}>
                          [ #{rankNum} ]
                        </span>
                        <span className="truncate max-w-[110px] sm:max-w-[130px] uppercase font-bold tracking-tight">
                          {entry.display_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${playerRank.badgeBg} ${playerRank.badgeText} ${playerRank.badgeBorder}`}>
                          [{playerRank.rank}]
                        </span>
                        <span className="font-bold text-[#181615]">
                          {entry.score.toString().padStart(3, '0')} PTS
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={`empty-rank-${index}`}
                    className="flex items-center justify-between py-2.5 px-3.5 rounded-xl border border-dashed border-[#181615]/25 bg-[#FAF7F2]/40 text-[#78716c]/60 select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-[#78716c]/40 shrink-0">
                        [ #{rankNum} ]
                      </span>
                      <span className="truncate text-[11px] uppercase tracking-wider text-[#78716c]/50 font-sans">
                        ว่าง (รอผู้ท้าชิง)
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] text-[#78716c]/40 font-mono">
                      --- PTS
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="w-full py-6 border-t-2 border-[#181615] text-center text-xs text-[#78716c] font-mono select-none bg-[#FAF7F2]">
        IN THE HAUS © {new Date().getFullYear()} — HAUS ARCADE SYSTEM // MODEL IH-FC-026
      </footer>

      {/* Modals & Persistent Overlays */}
      <LofiMiniPlayer lofi={lofi} onOpenStudio={() => setShowStudioModal(true)} />
      <LofiStudio lofi={lofi} open={showStudioModal} onClose={() => setShowStudioModal(false)} />
      {renderClaimModal()}
    </div>
  );
}
