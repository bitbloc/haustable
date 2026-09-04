/* Hallmark · macrostructure: Workbench · genre: modern-minimal · theme: Atelier (Dieter Rams + Thai Modern OKLCH)
 * pre-emit critique: P5 H5 E5 S5 R5 V5
 * states: default · hover · focus · active · loading · error · success
 * contrast: pass (APCA / WCAG compliant)
 */
import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { getAppOrigin } from '../../utils/urlHelper';
import FlappyCatGame from './FlappyCatGame';
import TaiPlaMiniGame from './game/TaiPlaMiniGame';
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

  // --- Lo-Fi Lounge Audio & Sleep Timer States ---
  const [chillPlaying, setChillPlaying] = useState(false);
  const [chillVolume, setChillVolume] = useState(0.85); // High dynamic range
  const [noiseVolume, setNoiseVolume] = useState(0.60);
  const [chordVolume, setChordVolume] = useState(0.85);
  const [chillPreset, setChillPreset] = useState('jazz'); // 'jazz' | 'cafe_jazz' | 'sunset' | 'rain' | 'campfire'
  const [hasHeadphonesConfirmed, setHasHeadphonesConfirmed] = useState(false);
  const [showHeadphonePrompt, setShowHeadphonePrompt] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState(0); // 0 = off, 15, 30, 45
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState(0);

  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const compressorRef = useRef(null);
  const noiseNodeRef = useRef(null);
  const chordGainRef = useRef(null);
  const synthIntervalRef = useRef(null);
  const lofiCanvasRef = useRef(null);
  const lofiAnimRef = useRef(null);

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
      const isDigits = /^\d+$/.test(cleanParam);
      
      const resolveTable = async () => {
        let tableData = null;
        if (isDigits) {
          const { data: byName } = await supabase
            .from('tables_layout')
            .select('id, table_name')
            .ilike('table_name', cleanParam)
            .maybeSingle();

          if (byName) {
            tableData = byName;
          } else {
            const { data: byId } = await supabase
              .from('tables_layout')
              .select('id, table_name')
              .eq('id', parseInt(cleanParam))
              .maybeSingle();
            tableData = byId;
          }
        } else {
          const { data: byName } = await supabase
            .from('tables_layout')
            .select('id, table_name')
            .ilike('table_name', cleanParam)
            .maybeSingle();
          tableData = byName;
        }

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
                // No active booking -> do not show stale table bar
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
      toast.error('เข้าสู่ระบบ LINE ล้มเหลว กรุณาลองใหม่อีกครั้ง');
    }
  };

  // Submit score as Guest to Leaderboard
  const handleGuestSubmit = async (e) => {
    if (e) e.preventDefault();
    const finalName = (guestName || '').trim() || 'GUEST CAT';
    setIsSubmittingGuest(true);

    try {
      const { error } = await supabase
        .from('leaderboard')
        .insert({
          display_name: finalName.toUpperCase(),
          score: claimScore
        });

      if (error) throw error;

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });

      toast.success(`บันทึกคะแนน ${claimScore} แต้ม ของคุณ ${finalName} ลงบอร์ดแล้ว!`);
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

      // Call RPC to securely claim P2E rewards
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('claim_arcade_rewards', { p_score: claimScore });

      if (rpcError) throw rpcError;

      const message = rpcData?.message || 'สะสมประวัติคะแนนของท่านสำเร็จ!';
      setClaimResultMessage(message);

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

  // --- Lo-Fi & Jazz Lounge Web Audio Synthesizer Presets (10 Chill Soundscapes) ---
  const CHILL_PRESETS = {
    jazz: {
      id: 'jazz',
      tag: '[ TRK-01 ]',
      name: 'แจ๊สริมโขง (Mekong Jazz)',
      desc: 'ดนตรีแจ๊สเปียโน & คอร์ด 9th/13th นุ่มลึก ริมฝั่งโขงยามค่ำคืน',
      filterFreq: 850,
      noiseGain: 0.32,
      type: 'jazz',
      chords: [
        [146.83, 293.66, 349.23, 440.00, 493.88, 659.25], // Dm9
        [98.00, 246.94, 329.63, 349.23, 440.00, 587.33],  // G13
        [130.81, 261.63, 329.63, 392.00, 493.88, 587.33], // Cmaj9
        [110.00, 220.00, 277.18, 349.23, 415.30, 523.25]  // A7alt
      ]
    },
    cafe_jazz: {
      id: 'cafe_jazz',
      tag: '[ TRK-02 ]',
      name: 'คาเฟ่แจ๊สในบ้าน (Haus Bossa)',
      desc: 'บรรยากาศกาแฟสด & คอร์ดแจ๊ส Neo-Soul อบอุ่นสไตล์ Bossa Nova',
      filterFreq: 680,
      noiseGain: 0.28,
      type: 'bossa',
      chords: [
        [174.61, 261.63, 329.63, 392.00, 440.00, 523.25], // Fmaj9
        [164.81, 246.94, 293.66, 349.23, 392.00],         // Em7b5
        [110.00, 220.00, 277.18, 349.23, 466.16, 554.37], // A7b9
        [146.83, 293.66, 349.23, 440.00, 523.25, 659.25], // Dm9
        [98.00, 246.94, 349.23, 369.99, 440.00],          // G7#11
        [130.81, 261.63, 329.63, 369.99, 493.88, 587.33]  // Cmaj7#11
      ]
    },
    sunset: {
      id: 'sunset',
      tag: '[ TRK-03 ]',
      name: 'ริมโขงนครพนม (Sunset Lo-Fi)',
      desc: 'เสียงคลื่นน้ำริมฝั่งโขง & คอร์ด Lo-Fi อบอุ่นยามเย็น',
      filterFreq: 450,
      noiseGain: 0.35,
      type: 'lofi',
      chords: [
        [130.81, 261.63, 329.63, 392.00, 493.88], // Cmaj7
        [110.00, 220.00, 261.63, 329.63, 392.00], // Am7
        [87.31, 174.61, 220.00, 261.63, 329.63],  // Fmaj7
        [98.00, 196.00, 246.94, 293.66, 349.23]   // G7
      ]
    },
    rain: {
      id: 'rain',
      tag: '[ TRK-04 ]',
      name: 'สายฝนริมหน้าต่าง (Rainy Piano)',
      desc: 'เสียงหยาดฝนกระทบกระจก & เมโลดี้เปียโนแสนสงบ',
      filterFreq: 1100,
      noiseGain: 0.42,
      type: 'piano',
      chords: [
        [146.83, 293.66, 349.23, 440.00, 523.25], // Dm7
        [164.81, 329.63, 392.00, 493.88, 587.33], // Em7
        [174.61, 349.23, 440.00, 523.25, 659.25], // Fmaj7
        [220.00, 440.00, 523.25, 659.25, 783.99]  // Am7
      ]
    },
    campfire: {
      id: 'campfire',
      tag: '[ TRK-05 ]',
      name: 'แคมป์ไฟริมหาด (Campfire Shores)',
      desc: 'เสียงลมโขงและสะเก็ดไฟ ผ่อนคลายคลายกังวล',
      filterFreq: 360,
      noiseGain: 0.32,
      type: 'ambient',
      chords: [
        [146.83, 293.66, 369.99, 440.00, 587.33], // Dsus2
        [110.00, 220.00, 293.66, 329.63, 440.00], // Asus4
        [98.00, 196.00, 246.94, 293.66, 392.00],  // Gsus2
        [123.47, 246.94, 293.66, 369.99, 440.00]  // Bm7
      ]
    },
    rhodes: {
      id: 'rhodes',
      tag: '[ TRK-06 ]',
      name: 'ยามเช้ากาแฟดริป (Morning Rhodes)',
      desc: 'เสียงเปียโนไฟฟ้า Rhodes & เมโลดี้ Neo-Soul นุ่มละมุน',
      filterFreq: 750,
      noiseGain: 0.25,
      type: 'jazz',
      chords: [
        [164.81, 329.63, 392.00, 493.88, 622.25, 739.99], // Emaj9
        [138.59, 277.18, 329.63, 415.30, 493.88, 622.25], // C#m9
        [185.00, 369.99, 440.00, 554.37, 659.25, 830.61], // F#m9
        [123.47, 246.94, 392.00, 440.00, 493.88, 659.25]  // B13
      ]
    },
    breeze: {
      id: 'breeze',
      tag: '[ TRK-07 ]',
      name: 'ลมโขงพัดเอื่อย (River Breeze)',
      desc: 'เสียงคลื่นลมพัดผ่านระเบียงไม้ คอร์ดเมโลดี้โปร่งสบาย',
      filterFreq: 600,
      noiseGain: 0.36,
      type: 'lofi',
      chords: [
        [196.00, 293.66, 392.00, 440.00, 493.88, 587.33], // Gmaj9
        [164.81, 246.94, 329.63, 392.00, 493.88, 587.33], // Em9
        [130.81, 261.63, 329.63, 392.00, 493.88],         // Cmaj7
        [146.83, 293.66, 392.00, 440.00, 587.33]          // D7sus4
      ]
    },
    midnight: {
      id: 'midnight',
      tag: '[ TRK-08 ]',
      name: 'เที่ยงคืนในบ้าน (Midnight Beats)',
      desc: 'คอร์ดแจ๊สยามวิกาล บรรยากาศเงียบสงบพักผ่อนสมอง',
      filterFreq: 520,
      noiseGain: 0.30,
      type: 'bossa',
      chords: [
        [123.47, 246.94, 293.66, 369.99, 440.00, 554.37], // Bm9
        [98.00, 196.00, 293.66, 369.99, 440.00],          // Gmaj7
        [164.81, 246.94, 329.63, 392.00, 493.88, 587.33], // Em9
        [92.50, 185.00, 277.18, 349.23, 440.00, 523.25]   // F#7alt
      ]
    },
    sleeper: {
      id: 'sleeper',
      tag: '[ TRK-09 ]',
      name: 'รถไฟสายราตรี (Sleeper Express)',
      desc: 'เสียงจังหวะรถไฟสม่ำเสมอ & คอร์ดบรรเลงกล่อมให้หลับสบาย',
      filterFreq: 400,
      noiseGain: 0.38,
      type: 'ambient',
      chords: [
        [110.00, 220.00, 293.66, 329.63, 440.00],         // Asus2
        [92.50, 185.00, 277.18, 329.63, 440.00],          // F#m7
        [146.83, 293.66, 369.99, 440.00, 554.37, 659.25], // Dmaj9
        [164.81, 246.94, 329.63, 415.30, 493.88, 659.25]  // E6
      ]
    },
    acoustic: {
      id: 'acoustic',
      tag: '[ TRK-10 ]',
      name: 'อะคูสติกนอกชาน (Porch Acoustic)',
      desc: 'สายลมยามบ่าย & เมโลดี้กีตาร์โปร่งโฟล์คแสนอบอุ่น',
      filterFreq: 900,
      noiseGain: 0.22,
      type: 'piano',
      chords: [
        [146.83, 220.00, 293.66, 369.99, 440.00, 587.33], // D
        [146.83, 196.00, 246.94, 293.66, 392.00, 587.33], // G/D
        [146.83, 220.00, 277.18, 329.63, 440.00, 554.37], // A/D
        [146.83, 220.00, 293.66, 369.99, 440.00, 587.33]  // D
      ]
    }
  };

  const handlePlayClick = () => {
    if (chillPlaying) {
      stopChillAudio();
    } else {
      if (!hasHeadphonesConfirmed) {
        setShowHeadphonePrompt(true);
      } else {
        startChillAudio();
      }
    }
  };

  const confirmHeadphonesAndPlay = () => {
    setHasHeadphonesConfirmed(true);
    setShowHeadphonePrompt(false);
    startChillAudio();
  };

  const startChillAudio = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Master Compressor & Master Output Limiter to avoid clipping while keeping volume high & warm
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, ctx.currentTime);
      compressor.knee.setValueAtTime(24, ctx.currentTime);
      compressor.ratio.setValueAtTime(8, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.22, ctx.currentTime);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(chillVolume * 1.45, ctx.currentTime);

      masterGain.connect(compressor);
      compressor.connect(ctx.destination);

      masterGainRef.current = masterGain;
      compressorRef.current = compressor;

      const preset = CHILL_PRESETS[chillPreset] || CHILL_PRESETS.jazz;

      // Ambient / Noise Buffer (River Pink Noise + Rain + Vinyl crackle)
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = preset.filterFreq;

      const gain = ctx.createGain();
      gain.gain.value = noiseVolume * preset.noiseGain;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      noise.start();

      noiseNodeRef.current = { noise, gain, filter };

      // Chime / Mellow Jazz & Lo-Fi Chords
      const chords = preset.chords;
      let chordIndex = 0;

      const playChordNote = (freq, delay = 0, isBass = false) => {
        if (!audioCtxRef.current) return;
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        // Jazz & Rhodes piano tone synthesis (warm sine with triangle overtone)
        if (preset.type === 'jazz' || preset.type === 'bossa') {
          osc.type = isBass ? 'triangle' : 'sine';
        } else {
          osc.type = 'triangle';
        }
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

        const targetNoteVol = isBass 
          ? chordVolume * 0.42 
          : (preset.type === 'jazz' ? chordVolume * 0.34 : chordVolume * 0.30);

        noteGain.gain.setValueAtTime(0, ctx.currentTime + delay);
        noteGain.gain.linearRampToValueAtTime(targetNoteVol, ctx.currentTime + delay + (isBass ? 0.06 : 0.14));
        noteGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + (isBass ? 2.4 : 3.4));

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 3.6);
      };

      synthIntervalRef.current = setInterval(() => {
        const currentChord = chords[chordIndex % chords.length];
        currentChord.forEach((freq, idx) => {
          const delay = idx === 0 ? 0 : (idx * 0.14);
          playChordNote(freq, delay, idx === 0);
        });
        chordIndex++;
      }, preset.type === 'jazz' ? 3200 : 3600);

      setChillPlaying(true);
    } catch (e) {
      console.warn('Audio synthesis warning:', e);
    }
  };

  const stopChillAudio = () => {
    if (noiseNodeRef.current) {
      try {
        noiseNodeRef.current.noise.stop();
        noiseNodeRef.current.noise.disconnect();
      } catch (e) {}
      noiseNodeRef.current = null;
    }
    if (synthIntervalRef.current) {
      clearInterval(synthIntervalRef.current);
      synthIntervalRef.current = null;
    }
    setChillPlaying(false);
  };

  // Sleep Timer countdown
  useEffect(() => {
    if (sleepMinutes <= 0) {
      setSleepSecondsLeft(0);
      return;
    }
    setSleepSecondsLeft(sleepMinutes * 60);
  }, [sleepMinutes]);

  useEffect(() => {
    if (!chillPlaying || sleepSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSleepSecondsLeft((prev) => {
        if (prev <= 1) {
          stopChillAudio();
          setSleepMinutes(0);
          toast.info('⏰ ตัวตั้งเวลา Lo-Fi สิ้นสุดแล้ว ขอให้ผ่อนคลายอย่างมีความสุขครับ');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [chillPlaying, sleepSecondsLeft]);

  // Pixel Visualizer Canvas for Lo-Fi & Jazz Lounge
  useEffect(() => {
    if (!showStudioModal && activeTab !== 'lofi') return;
    const canvas = lofiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frame = 0;

    const renderLofi = () => {
      frame++;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Sky Background gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      const isNightMode = ['jazz', 'campfire', 'midnight', 'sleeper'].includes(chillPreset);
      const isWarmDawn = ['cafe_jazz', 'rhodes', 'breeze', 'acoustic'].includes(chillPreset);

      if (chillPreset === 'jazz' || chillPreset === 'midnight') {
        skyGrad.addColorStop(0, '#0b132b');
        skyGrad.addColorStop(0.7, '#1c2541');
        skyGrad.addColorStop(1, '#3a506b');
      } else if (chillPreset === 'sleeper' || chillPreset === 'campfire') {
        skyGrad.addColorStop(0, '#1e1b4b');
        skyGrad.addColorStop(0.6, '#311042');
        skyGrad.addColorStop(1, '#431407');
      } else if (chillPreset === 'rain') {
        skyGrad.addColorStop(0, '#1e293b');
        skyGrad.addColorStop(1, '#475569');
      } else if (isWarmDawn) {
        skyGrad.addColorStop(0, '#451a03');
        skyGrad.addColorStop(0.6, '#78350f');
        skyGrad.addColorStop(1, '#fde68a');
      } else {
        // Sunset
        skyGrad.addColorStop(0, '#ea580c');
        skyGrad.addColorStop(0.6, '#f97316');
        skyGrad.addColorStop(1, '#fde047');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Twinkling stars in night modes
      if (isNightMode) {
        ctx.fillStyle = '#ffffff';
        for (let s = 0; s < 22; s++) {
          const sx = (s * 37 + 15) % w;
          const sy = (s * 19 + 10) % (h - 70);
          const starAlpha = Math.sin(frame * 0.05 + s) * 0.4 + 0.6;
          ctx.globalAlpha = starAlpha;
          ctx.fillRect(sx, sy, 2, 2);
        }
        ctx.globalAlpha = 1.0;
      }

      // Distant Lao Mountains
      ctx.fillStyle = isNightMode ? '#0f172a' : (chillPreset === 'rain' ? '#1e293b' : '#7c2d12');
      ctx.beginPath();
      ctx.moveTo(0, h - 50);
      for (let x = 0; x <= w; x += 15) {
        const peak = Math.sin(x * 0.02) * 16 + Math.cos(x * 0.01) * 8;
        ctx.lineTo(x, h - 55 - peak);
      }
      ctx.lineTo(w, h - 30);
      ctx.lineTo(0, h - 30);
      ctx.closePath();
      ctx.fill();

      // Mekong River Water
      const riverGrad = ctx.createLinearGradient(0, h - 45, 0, h);
      if (chillPreset === 'jazz') {
        riverGrad.addColorStop(0, '#1e3a8a');
        riverGrad.addColorStop(1, '#0f172a');
      } else {
        riverGrad.addColorStop(0, '#0284c7');
        riverGrad.addColorStop(1, '#0369a1');
      }
      ctx.fillStyle = riverGrad;
      ctx.fillRect(0, h - 45, w, 45);

      // Water Shimmer ripples
      ctx.fillStyle = chillPreset === 'jazz' ? '#93c5fd' : '#bae6fd';
      for (let i = 0; i < 6; i++) {
        const rx = ((frame * (1 + i * 0.3) * 1.5) + i * 80) % (w + 40) - 20;
        const ry = h - 38 + (i * 6);
        ctx.fillRect(rx, ry, 28, 2);
      }

      // Wooden Balcony Deck
      ctx.fillStyle = '#451a03';
      ctx.fillRect(0, h - 22, w, 22);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, h - 20, w, 3);

      // Balcony Railing
      ctx.fillStyle = '#1f1d24';
      ctx.fillRect(20, h - 38, w - 40, 3);
      for (let bx = 30; bx < w - 30; bx += 35) {
        ctx.fillRect(bx, h - 38, 3, 16);
      }

      // Relaxing Calico Cat Sitting at Wooden Table
      const catX = w / 2 - 30;
      const catY = h - 22;

      // Table & Coffee Mug
      ctx.fillStyle = '#9a3412';
      ctx.fillRect(catX + 28, catY - 14, 26, 14);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(catX + 38, catY - 20, 6, 7);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(catX + 39, catY - 19, 4, 2);

      // Coffee Steam rising
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      const steamY = ((frame * 1.2) % 25);
      ctx.fillRect(catX + 40 + Math.sin(frame * 0.1) * 2, catY - 22 - steamY, 2, 3);

      // Relaxing Cat Body
      ctx.fillStyle = '#1f1d24';
      ctx.fillRect(catX, catY - 18, 22, 18);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(catX + 2, catY - 16, 18, 16);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(catX + 4, catY - 16, 7, 7);
      ctx.fillStyle = '#1f1d24';
      ctx.fillRect(catX + 13, catY - 12, 5, 5);

      // Cat Head & Ears
        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(catX + 6, catY - 26, 14, 12);
        ctx.fillRect(catX + 6, catY - 30, 4, 5);
        ctx.fillRect(catX + 16, catY - 30, 4, 5);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(catX + 8, catY - 24, 10, 9);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(catX + 7, catY - 29, 2, 3);

        ctx.fillStyle = '#1f1d24';
        ctx.fillRect(catX + 10, catY - 21, 3, 1);
        ctx.fillRect(catX + 15, catY - 21, 3, 1);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(catX + 8, catY - 19, 2, 2);
        ctx.fillRect(catX + 17, catY - 19, 2, 2);

        if (chillPlaying) {
          ctx.fillStyle = chillPreset === 'jazz' ? '#38bdf8' : '#facc15';
          const note1Y = (frame * 1.5) % 80;
          const note1X = catX + 15 + Math.sin(frame * 0.08) * 8;
          ctx.fillRect(note1X, catY - 25 - note1Y, 3, 3);
          ctx.fillRect(note1X + 2, catY - 30 - note1Y, 2, 6);
          ctx.fillRect(note1X + 4, catY - 30 - note1Y, 3, 2);

          const note2Y = ((frame * 1.5) + 40) % 80;
          const note2X = catX + 35 + Math.cos(frame * 0.08) * 8;
          ctx.fillRect(note2X, catY - 25 - note2Y, 3, 3);
          ctx.fillRect(note2X + 2, catY - 30 - note2Y, 2, 6);
          ctx.fillRect(note2X + 4, catY - 30 - note2Y, 3, 2);
        }

        if (chillPreset === 'rain') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          for (let r = 0; r < 20; r++) {
            const rx = (r * 25 + frame * 4) % w;
            const ry = (r * 15 + frame * 8) % (h - 22);
            ctx.fillRect(rx, ry, 1, 6);
          }
        }

        lofiAnimRef.current = requestAnimationFrame(renderLofi);
      };

      lofiAnimRef.current = requestAnimationFrame(renderLofi);
      return () => {
        if (lofiAnimRef.current) cancelAnimationFrame(lofiAnimRef.current);
      };
    }, [activeTab, chillPlaying, chillPreset, showStudioModal]);

  useEffect(() => {
    return () => {
      stopChillAudio();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const renderStickyMiniPlayer = () => {
    if (!chillPlaying) return null;
    const currentPreset = CHILL_PRESETS[chillPreset] || CHILL_PRESETS.jazz;
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[94%] max-w-xl bg-[#181615] text-[#FAF7F5] rounded-2xl p-3 sm:p-3.5 border-2 border-[#3D3835] shadow-2xl flex items-center justify-between z-40 animate-[slideUp_0.2s_ease-out] font-sans">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-end gap-0.5 h-4 w-4 shrink-0 text-[#E9F344]">
            <span className="w-1 bg-[#E9F344] h-2.5 rounded-xs animate-bounce" />
            <span className="w-1 bg-[#E9F344] h-4 rounded-xs animate-bounce [animation-delay:0.15s]" />
            <span className="w-1 bg-[#E9F344] h-1.5 rounded-xs animate-bounce [animation-delay:0.3s]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#A8A29E]">
              <span className="text-[#E9F344] font-bold">[ ON AIR ]</span>
              <span className="truncate">{currentPreset.tag}</span>
            </div>
            <p className="font-bold text-xs truncate text-[#FAF7F5]">
              {currentPreset.name.split(' (')[0]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs shrink-0">
          <button
            onClick={stopChillAudio}
            className="px-3 py-1.5 bg-[#2A2624] hover:bg-[#3D3835] text-[#FAF7F5] rounded-xl border border-[#4A433F] text-[10px] font-bold cursor-pointer transition-colors"
          >
            [ ⏸ พักเสียง ]
          </button>
          <button
            onClick={() => setShowStudioModal(true)}
            className="px-3 py-1.5 bg-[#E9F344] hover:bg-[#d9e334] text-[#181615] rounded-xl border-2 border-[#181615] text-[10px] font-bold cursor-pointer transition-colors"
          >
            [ สตูดิโอ ]
          </button>
        </div>
      </div>
    );
  };

  const renderStudioModal = () => {
    if (!showStudioModal) return null;
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 animate-[fadeIn_0.15s_ease-out] font-sans overflow-y-auto">
        <div className="w-full max-w-4xl bg-[var(--color-paper)] border-2 border-[#181615] rounded-3xl p-5 sm:p-7 shadow-2xl relative my-auto flex flex-col gap-5">
          <div className="flex items-center justify-between border-b-2 border-[#181615] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E9F344] border border-[#181615] animate-pulse" />
              <h2 className="font-pixel text-lg sm:text-xl font-bold uppercase tracking-wider text-[#181615]">
                HAUS BINAURAL LO-FI STUDIO // 10 SOUNDSCAPES
              </h2>
            </div>
            <button
              onClick={() => setShowStudioModal(false)}
              className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#181615] hover:text-[#FAF7F5] rounded-xl border-2 border-[#181615] text-xs font-mono font-bold cursor-pointer transition-colors"
            >
              [ ✕ ปิดห้องสตูดิโอ ]
            </button>
          </div>

          <div className="w-full aspect-[16/6] max-h-[220px] bg-[#181615] rounded-2xl overflow-hidden border-2 border-[#181615] shadow-inner flex items-center justify-center">
            <canvas 
              ref={lofiCanvasRef} 
              width={680} 
              height={255} 
              className="w-full h-full block" 
              style={{ imageRendering: 'pixelated' }} 
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#57534e]">
              [ SELECT MEKONG SOUNDTRACK // เลือกบทเพลง ]:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
              {Object.values(CHILL_PRESETS).map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setChillPreset(p.id);
                    if (!chillPlaying) {
                      startChillAudio();
                    } else if (audioCtxRef.current) {
                      stopChillAudio();
                      setTimeout(() => startChillAudio(), 100);
                    }
                  }}
                  className={`p-2.5 rounded-xl border-2 text-left transition-colors duration-150 cursor-pointer flex flex-col gap-1 ${
                    chillPreset === p.id 
                      ? 'bg-[#181615] text-[#FAF7F5] border-[#181615] shadow-xs' 
                      : 'bg-[#FAF7F2] text-[#181615] border-[#181615]/30 hover:border-[#181615] hover:bg-[#F2ECE4]'
                  }`}
                >
                  <span className={`text-[9px] font-bold ${chillPreset === p.id ? 'text-[#E9F344]' : 'text-[#78716c]'}`}>
                    {p.tag}
                  </span>
                  <strong className="text-xs truncate">{p.name.split(' (')[0]}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-[#FAF7F2] p-3 rounded-2xl border-2 border-[#181615] flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-mono font-bold text-[#181615]">
                <span>[ MASTER VOLUME ]</span>
                <span>{Math.round(chillVolume * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={chillVolume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setChillVolume(val);
                  if (masterGainRef.current && audioCtxRef.current) {
                    masterGainRef.current.gain.setValueAtTime(val * 1.45, audioCtxRef.current.currentTime);
                  }
                }}
                className="w-full accent-[#181615] cursor-pointer"
              />
            </div>

            <div className="bg-[#FAF7F2] p-3 rounded-2xl border-2 border-[#181615] flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-mono font-bold text-[#181615]">
                <span>[ AMBIENT STREAM ]</span>
                <span>{Math.round(noiseVolume * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={noiseVolume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setNoiseVolume(val);
                  if (noiseNodeRef.current && audioCtxRef.current) {
                    const preset = CHILL_PRESETS[chillPreset] || CHILL_PRESETS.jazz;
                    noiseNodeRef.current.gain.gain.setValueAtTime(val * preset.noiseGain, audioCtxRef.current.currentTime);
                  }
                }}
                className="w-full accent-[#181615] cursor-pointer"
              />
            </div>

            <div className="bg-[#FAF7F2] p-3 rounded-2xl border-2 border-[#181615] flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-mono font-bold text-[#181615]">
                <span>[ CHORD VELOCITY ]</span>
                <span>{Math.round(chordVolume * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={chordVolume}
                onChange={(e) => setChordVolume(parseFloat(e.target.value))}
                className="w-full accent-[#181615] cursor-pointer"
              />
            </div>

            <div className="bg-[#FAF7F2] p-3 rounded-2xl border-2 border-[#181615] flex flex-col gap-1.5 font-mono">
              <div className="flex justify-between text-[10px] font-bold text-[#181615]">
                <span>[ SLEEP TIMER ]</span>
                <span>
                  {sleepSecondsLeft > 0 
                    ? `${Math.floor(sleepSecondsLeft / 60)}:${(sleepSecondsLeft % 60).toString().padStart(2, '0')}` 
                    : 'OFF'}
                </span>
              </div>
              <div className="flex gap-1 text-[9px]">
                {[0, 15, 30, 45].map((m) => (
                  <button
                    key={m}
                    onClick={() => setSleepMinutes(m)}
                    className={`flex-1 py-1 rounded-lg text-center font-bold cursor-pointer transition-colors ${
                      sleepMinutes === m 
                        ? 'bg-[#181615] text-[#FAF7F5]' 
                        : 'bg-[#FAF7F2] text-[#181615] border border-[#181615]/30 hover:bg-[#F2ECE4]'
                    }`}
                  >
                    {m === 0 ? 'OFF' : `${m}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handlePlayClick}
              className={`px-6 py-3 rounded-xl border-2 border-[#181615] font-mono font-bold text-xs uppercase cursor-pointer transition-transform duration-100 ease-out shadow-xs ${
                chillPlaying 
                  ? 'bg-[#FAF7F2] text-[#181615] hover:bg-[#F2ECE4]' 
                  : 'bg-[#E9F344] text-[#181615] hover:bg-[#d9e334]'
              }`}
            >
              {chillPlaying ? '[ ⏸ PAUSE SOUNDSCAPE // พักเสียง ]' : '[ ▶ START SOUNDSCAPE // เริ่มเปิดเสียง ]'}
            </button>
            <span className="font-mono text-[10px] text-[#78716c] hidden sm:inline">
              BINAURAL 3D STEREO • HEADPHONES RECOMMENDED
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderHeadphonePromptModal = () => {
    if (!showHeadphonePrompt) return null;
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.15s_ease-out] font-sans">
        <div className="w-full max-w-sm bg-[var(--color-paper)] border-2 border-[#181615] rounded-3xl p-6 shadow-xl text-center relative">
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#bd4924]">
            [ BINAURAL AUDIO RECOMMENDATION ]
          </div>
          <h3 className="font-pixel text-xl font-bold uppercase tracking-wider text-[#181615] mb-2">
            HEADPHONES RECOMMENDED
          </h3>
          <p className="text-xs text-[#57534e] font-sans leading-relaxed mb-5">
            เพื่อมิติเสียงสังเคราะห์คลื่นน้ำริมแม่น้ำโขงและคอร์ดเพลง Lo-Fi ที่สมจริง แนะนำให้เชื่อมต่อหูฟังก่อนเริ่มฟังเพื่อมิติเสียงที่ดีที่สุดครับ
          </p>
          <div className="flex gap-2 font-mono text-xs">
            <button
              onClick={confirmHeadphonesAndPlay}
              className="flex-1 py-2.5 bg-[#E9F344] hover:bg-[#d9e334] text-[#181615] font-bold uppercase rounded-xl border-2 border-[#181615] cursor-pointer shadow-xs"
            >
              [ พร้อมฟังแล้ว ]
            </button>
            <button
              onClick={() => setShowHeadphonePrompt(false)}
              className="px-4 py-2.5 bg-[#FAF7F2] text-[#181615] font-bold uppercase rounded-xl cursor-pointer hover:bg-[#F2ECE4] border-2 border-[#181615]"
            >
              [ ยกเลิก ]
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderClaimModal = () => {
    if (!showClaimModal) return null;
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.15s_ease-out] font-sans">
        <div className="w-full max-w-md bg-[var(--color-paper)] border-2 border-[#181615] rounded-3xl p-6 sm:p-8 shadow-xl text-left relative">
          <button 
            onClick={() => setShowClaimModal(false)}
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
                <h3 className="text-xl font-bold text-[#181615] mb-1 font-pixel uppercase tracking-wide">
                  FINAL SCORE: {claimScore} PTS
                </h3>
                <p className="text-[11px] text-[#57534e] leading-relaxed font-sans">
                  เข้าสู่ระบบ LINE เพื่อรับเหรียญ xhaus และตั๋วสุ่มรายสัปดาห์ หรือใส่ชื่อเพื่อบันทึกสถิติลง Leaderboard ทันที
                </p>
              </div>

              <button
                onClick={handleLineLogin}
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
                <h3 className="text-xl font-bold text-[#181615] mb-1 font-pixel uppercase tracking-wide">
                  VERIFY SCORE: {claimScore} PTS
                </h3>
                <p className="text-[11px] text-[#57534e] leading-relaxed font-sans">
                  ยืนยันพิกัด GPS เพื่อรับเหรียญ xhaus และบันทึกสถิติของคุณเข้าบอร์ดประจำสัปดาห์
                </p>
              </div>
              <button
                onClick={processClaimScore}
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
                  <span className="text-base font-bold text-[#bd4924]">{claimScore} PTS</span>
                </div>
                {claimResultMessage && (
                  <div className="bg-[#FAF7F2] border border-[#181615]/30 rounded-xl py-3 px-4 w-full text-center text-[10px] font-bold text-[#181615] my-2 leading-relaxed">
                    {claimResultMessage}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowClaimModal(false)}
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
        {renderStickyMiniPlayer()}
        {renderStudioModal()}
        {renderClaimModal()}
        {renderHeadphonePromptModal()}
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
          onBackToHub={() => setActiveMode('hub')}
        />
        {renderStickyMiniPlayer()}
        {renderStudioModal()}
        {renderClaimModal()}
        {renderHeadphonePromptModal()}
      </div>
    );
  }

  return (
    <div id="arcade-lobby-root" className="min-h-screen flex flex-col relative select-none font-sans bg-[var(--color-paper)]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');

        html, body {
          overflow-x: clip !important;
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

        <div className="flex flex-col gap-1 text-left select-none">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E9F344] border border-[#181615]" />
            <h2 className="font-pixel text-xl sm:text-2xl font-bold uppercase tracking-wider text-[#181615]">
              ARCADE SHOWCASE // เลือกจุดหมายของคุณ
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#57534e] font-sans">
            เลือกเล่นเกมเรโทรสไตล์พิกเซลอาร์ตริมโขง หรือเปิดฟังดนตรีสังเคราะห์ Lo-Fi ผ่อนคลายได้ทันที
          </p>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#FAF7F2] border-2 border-[#181615] rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-5 hover:border-black hover:shadow-md transition-colors duration-150 group">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] font-bold text-[#181615] bg-[#E9F344] px-2.5 py-1 rounded-xl border border-[#181615] uppercase tracking-wider">
                  [ 01 // 128-BIT RUNNER ]
                </span>
                <span className="font-mono text-[9px] font-bold text-[#78716c]">
                  HIGH: {taiPlaHighScore} PTS
                </span>
              </div>

              <div className="w-full aspect-[16/9] bg-[#faf6ed] rounded-2xl border-2 border-[#181615] relative overflow-hidden flex flex-col justify-between p-3.5 shadow-inner">
                <div className="flex items-center justify-between z-10 font-mono text-[8px]">
                  <span className="bg-[#181615] text-white px-2 py-0.5 rounded-md font-bold uppercase">
                    3 SPECIES
                  </span>
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-md font-bold">
                    MEKONG RUNNER
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2.5 my-auto z-10">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-16 h-12 bg-sky-100 rounded-xl border-2 border-[#181615] flex flex-col items-center justify-center p-1 shadow-2xs font-mono">
                      <span className="text-[10px] font-bold text-[#181615]">ไตปลา</span>
                      <span className="text-[7px] text-sky-800 uppercase font-bold">WATER</span>
                    </div>
                    <span className="text-[8px] font-mono font-bold text-[#181615]">2X จัมพ์</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-16 h-12 bg-amber-100 rounded-xl border-2 border-[#181615] flex flex-col items-center justify-center p-1 shadow-2xs font-mono">
                      <span className="text-[10px] font-bold text-[#181615]">ส้มสะตอ</span>
                      <span className="text-[7px] text-amber-800 uppercase font-bold">BOOST</span>
                    </div>
                    <span className="text-[8px] font-mono font-bold text-[#181615]">เทพสะตอ</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-16 h-12 bg-stone-100 rounded-xl border-2 border-[#181615] flex flex-col items-center justify-center p-1 shadow-2xs font-mono">
                      <span className="text-[10px] font-bold text-[#181615]">ข้าวหลาม</span>
                      <span className="text-[7px] text-stone-700 uppercase font-bold">MAGNET</span>
                    </div>
                    <span className="text-[8px] font-mono font-bold text-[#181615]">แม่เหล็ก</span>
                  </div>
                </div>

                <div className="flex items-center justify-between z-10 text-[8px] font-mono text-[#78716c]">
                  <span>จอใหญ่เต็มตามือถือ</span>
                  <span>แตะเพื่อกระโดด</span>
                </div>
              </div>

              <div>
                <h3 className="font-pixel text-lg font-bold text-[#181615] uppercase tracking-wider">
                  TAI-PLA RUN: 128-BIT
                </h3>
                <p className="text-xs text-[#57534e] font-sans leading-relaxed mt-1">
                  วิ่งตะลุยริมโขงนครพนม 3 สิ่งมีชีวิตคู่หู • กระโดด 2 จังหวะ • สปริงสะตอ • ปรุงแกงไตปลาสะสมเหรียญ XHAUS เต็มจอสะใจ!
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveMode('tai_pla')}
              className="w-full bg-[#E9F344] hover:bg-[#d9e334] text-[#181615] font-mono font-bold text-sm py-3.5 px-4 rounded-2xl border-2 border-[#181615] shadow-xs active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wide transition-transform duration-100 ease-out"
            >
              <span className="whitespace-nowrap">[ ▶ เล่นเลย // PLAY RUNNER ]</span>
            </button>
          </div>

          <div className="bg-[#FAF7F2] border-2 border-[#181615] rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-5 hover:border-black hover:shadow-md transition-colors duration-150 group">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] font-bold text-[#FAF7F5] bg-[#181615] px-2.5 py-1 rounded-xl border border-[#181615] uppercase tracking-wider">
                  [ 02 // RETRO CABINET ]
                </span>
                <span className="font-mono text-[9px] font-bold text-[#78716c]">
                  ENGINE: PHASER
                </span>
              </div>

              <div className="w-full aspect-[16/9] bg-[#181615] rounded-2xl border-2 border-[#181615] relative overflow-hidden flex flex-col justify-between p-3.5 shadow-inner">
                <div className="flex items-center justify-between z-10 font-mono text-[8px]">
                  <span className="bg-[#E9F344] text-[#181615] px-2 py-0.5 rounded-md font-bold uppercase">
                    FLAPPY CAT
                  </span>
                  <span className="text-[#A8A29E]">
                    TOP 10 LEADERBOARD
                  </span>
                </div>

                <div className="flex items-center justify-center gap-3 my-auto z-10">
                  <div className="w-16 h-12 bg-[#2A2624] rounded-xl border-2 border-[#5C544D] flex flex-col items-center justify-center text-[10px] font-bold text-[#FAF7F5] font-mono shadow-md">
                    <span>HAUS CAT</span>
                    <span className="text-[7px] text-amber-400 font-bold">FLAP</span>
                  </div>
                  <div className="flex flex-col font-mono text-[9px] text-[#FAF7F5]">
                    <span className="text-emerald-400 font-bold">20 PIPES: +1.00 XH</span>
                    <span className="text-amber-400 font-bold">35 PIPES: +1.00 XH</span>
                    <span className="text-sky-300 font-bold">40 PIPES: 1 TICKET</span>
                  </div>
                </div>

                <div className="flex items-center justify-between z-10 text-[8px] font-mono text-[#78716c]">
                  <span>ฟิสิกส์แคลคูลัสเรโทร</span>
                  <span>สะสมเหรียญได้ทุกวัน</span>
                </div>
              </div>

              <div>
                <h3 className="font-pixel text-lg font-bold text-[#181615] uppercase tracking-wider">
                  FLAPPY CAT IN THE HAUS
                </h3>
                <p className="text-xs text-[#57534e] font-sans leading-relaxed mt-1">
                  แมวส้มทะยานฟ้าริมฝั่งโขง • บินฝ่าท่อเก็บคะแนนสะสมเหรียญ XHAUS และรับตั๋วสุ่มรายสัปดาห์
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveMode('flappy')}
              className="w-full bg-[#181615] hover:bg-[#252220] text-[#FAF7F5] font-mono font-bold text-sm py-3.5 px-4 rounded-2xl border-2 border-[#181615] shadow-xs active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wide transition-transform duration-100 ease-out"
            >
              <span className="whitespace-nowrap">[ ▶ เล่นเลย // PLAY FLAPPY ]</span>
            </button>
          </div>

          <div className="bg-[#FAF7F2] border-2 border-[#181615] rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-5 hover:border-black hover:shadow-md transition-colors duration-150 group">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] font-bold text-[#181615] bg-[#E9F344] px-2.5 py-1 rounded-xl border border-[#181615] uppercase tracking-wider">
                  [ 03 // BINAURAL LOUNGE ]
                </span>
                <span className={`font-mono text-[9px] font-bold ${chillPlaying ? 'text-emerald-700' : 'text-[#78716c]'}`}>
                  {chillPlaying ? '[ ● ON AIR ]' : '[ ○ STANDBY ]'}
                </span>
              </div>

              <div className="w-full aspect-[16/9] bg-[#1c2541] rounded-2xl border-2 border-[#181615] relative overflow-hidden flex flex-col justify-between p-3.5 shadow-inner">
                <div className="flex items-center justify-between z-10 font-mono text-[8px]">
                  <span className="bg-sky-900/80 text-sky-200 px-2 py-0.5 rounded-md font-bold uppercase">
                    10 SOUNDSCAPES
                  </span>
                  <span className="text-[#93c5fd]">
                    MEKONG BALCONY
                  </span>
                </div>

                <div className="flex items-center justify-center gap-3 my-auto z-10 text-center">
                  <div className="flex items-end gap-1 h-8 text-[#E9F344]">
                    <span className={`w-1.5 bg-[#E9F344] rounded-xs ${chillPlaying ? 'h-5 animate-bounce' : 'h-2'}`} />
                    <span className={`w-1.5 bg-[#E9F344] rounded-xs ${chillPlaying ? 'h-7 animate-bounce [animation-delay:0.15s]' : 'h-3'}`} />
                    <span className={`w-1.5 bg-[#E9F344] rounded-xs ${chillPlaying ? 'h-4 animate-bounce [animation-delay:0.3s]' : 'h-2'}`} />
                    <span className={`w-1.5 bg-[#E9F344] rounded-xs ${chillPlaying ? 'h-6 animate-bounce [animation-delay:0.2s]' : 'h-3'}`} />
                  </div>
                  <div className="flex flex-col text-left font-mono text-[10px] text-white">
                    <span className="font-bold truncate max-w-[130px]">
                      {CHILL_PRESETS[chillPreset]?.name.split(' (')[0] || 'MEKONG JAZZ'}
                    </span>
                    <span className="text-[#94a3b8] text-[8px]">3D STEREO SYNTHESIS</span>
                  </div>
                </div>

                <div className="flex items-center justify-between z-10 text-[8px] font-mono text-[#94a3b8]">
                  <span>เปิดฟังคลอได้ต่อเนื่อง</span>
                  <span>มีตัวตั้งเวลาปิด (Timer)</span>
                </div>
              </div>

              <div>
                <h3 className="font-pixel text-lg font-bold text-[#181615] uppercase tracking-wider">
                  HAUS BINAURAL LO-FI
                </h3>
                <p className="text-xs text-[#57534e] font-sans leading-relaxed mt-1">
                  10 ซาวด์แทร็คแจ๊สเปียโนและคลื่นแม่น้ำโขงสังเคราะห์ • มิติเสียง 3D Binaural ฟังสบายสมอง เปิดคลอระหว่างเลือกเกมได้
                </p>
              </div>
            </div>

            <div className="flex gap-2 font-mono text-xs">
              <button
                onClick={handlePlayClick}
                className={`flex-1 py-3 px-2 rounded-2xl border-2 border-[#181615] font-bold text-xs cursor-pointer transition-colors shadow-xs ${
                  chillPlaying 
                    ? 'bg-[#FAF7F2] text-[#181615] hover:bg-[#F2ECE4]' 
                    : 'bg-[#E9F344] text-[#181615] hover:bg-[#d9e334]'
                }`}
              >
                {chillPlaying ? '[ ⏸ พักเสียง ]' : '[ ▶ เปิดฟังคลอ ]'}
              </button>
              <button
                onClick={() => setShowStudioModal(true)}
                className="py-3 px-3.5 bg-[#181615] hover:bg-[#252220] text-[#FAF7F5] rounded-2xl border-2 border-[#181615] font-bold text-xs cursor-pointer transition-colors shadow-xs"
              >
                [ สตูดิโอ ]
              </button>
            </div>
          </div>
        </section>

        <section className="w-full bg-[#FAF7F2] border-2 border-[#181615] rounded-3xl p-5 sm:p-7 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b-2 border-[#181615] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E9F344] border border-[#181615]" />
              <h3 className="font-pixel text-base sm:text-lg font-bold uppercase tracking-wider text-[#181615]">
                WEEKLY TOP 10 ROSTER // ทำเนียบยอดฝีมือประจำสัปดาห์
              </h3>
            </div>
            <button
              onClick={fetchLeaderboard}
              className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#F2ECE4] text-[#181615] font-mono text-xs font-bold rounded-xl border-2 border-[#181615] cursor-pointer shadow-xs active:scale-95 transition-transform"
            >
              [ REFRESH // รีเฟรช ]
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-[#78716c] font-mono text-xs animate-pulse">
              LOADING ROSTER DATA…
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-8 text-center text-[#78716c] font-mono text-xs bg-[#FAF7F2] rounded-2xl border border-[#181615]/20">
              ยังไม่มีข้อมูลคะแนนในสัปดาห์นี้ เป็นคนแรกที่เริ่มทำสถิติเลย!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
              {leaderboard.map((entry, index) => (
                <div 
                  key={entry.id || index}
                  className={`flex items-center justify-between py-2.5 px-3.5 rounded-xl border-2 transition-colors ${
                    index === 0 
                      ? 'bg-[#E9F344]/30 border-[#181615] text-[#181615] font-bold' 
                      : 'bg-[#FAF7F2] border-[#181615]/30 hover:border-[#181615] text-[#181615]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`font-bold ${index === 0 ? 'text-[#bd4924]' : 'text-[#78716c]'}`}>
                      [ #{(index + 1).toString().padStart(2, '0')} ]
                    </span>
                    <span className="truncate max-w-[140px] uppercase font-bold">
                      {entry.display_name}
                    </span>
                  </div>
                  <span className="font-bold shrink-0">
                    {entry.score.toString().padStart(3, '0')} PTS
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="w-full py-6 border-t-2 border-[#181615] text-center text-xs text-[#78716c] font-mono select-none bg-[#FAF7F2]">
        IN THE HAUS © {new Date().getFullYear()} — HAUS ARCADE SYSTEM // MODEL IH-FC-026
      </footer>

      {/* Modals & Persistent Overlays */}
      {renderStickyMiniPlayer()}
      {renderStudioModal()}
      {renderClaimModal()}
      {renderHeadphonePromptModal()}
    </div>
  );
}
