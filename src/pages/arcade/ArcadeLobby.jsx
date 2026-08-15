/* Hallmark · component: ArcadeLobby · genre: modern-minimal · theme: Atelier (Dieter Rams + Thai Modern OKLCH)
 * states: default · hover · focus · active · loading · error · success
 * contrast: pass (APCA / WCAG compliant)
 */
import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { getAppOrigin } from '../../utils/urlHelper';
import FlappyCatGame from './FlappyCatGame';
import TaiPlaMiniGame from './game/TaiPlaMiniGame';
import { 
  Gamepad2, Music, Tag, Trophy, Award, X, MapPin, CheckCircle, 
  ShieldAlert, RefreshCw, LogIn, Gift, Copy, ArrowLeft, Utensils,
  Volume2, VolumeX, Sparkles, Play, Pause, ChevronRight,
  Headphones, Compass, Flame, Map, Waves, Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

export default function ArcadeLobby() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryTableId = searchParams.get('tableId');
  const [activeTableId, setActiveTableId] = useState(null);
  const [activeTableName, setActiveTableName] = useState('');

  const [leaderboard, setLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState('game'); // 'game' | 'sator_chill'
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

  // --- Sator Chill Audio & Headphone Guidance States ---
  const [chillPlaying, setChillPlaying] = useState(false);
  const [chillVolume, setChillVolume] = useState(0.5);
  const [chillPreset, setChillPreset] = useState('sunset'); // 'sunset' | 'rain' | 'riverside'
  const [hasHeadphonesConfirmed, setHasHeadphonesConfirmed] = useState(false);
  const [showHeadphonePrompt, setShowHeadphonePrompt] = useState(false);

  const audioCtxRef = useRef(null);
  const noiseNodeRef = useRef(null);
  const synthIntervalRef = useRef(null);

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
      
      let tableQuery = supabase.from('tables_layout').select('id, table_name');
      if (isDigits) {
        tableQuery = tableQuery.or(`id.eq.${parseInt(cleanParam)},table_name.ilike.${cleanParam}`);
      } else {
        tableQuery = tableQuery.ilike('table_name', cleanParam);
      }

      tableQuery.maybeSingle().then(async ({ data }) => {
        if (data) {
          const display = data.table_name || `Table ${data.id}`;
          
          // If not explicitly provided in URL params, verify if there is an active booking
          if (!queryTableId) {
            try {
              const { data: activeBookings } = await supabase
                .from('bookings')
                .select('id, status')
                .eq('table_id', data.id)
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

          setActiveTableId(data.id.toString());
          setActiveTableName(display);
          localStorage.setItem('active_customer_table_id', data.id.toString());
          localStorage.setItem('active_customer_table_name', display);
        } else if (queryTableId) {
          setActiveTableId(cleanParam);
          if (!savedName) setActiveTableName(`Table ${cleanParam}`);
        } else {
          setActiveTableId(null);
          setActiveTableName('');
        }
      });
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

  // --- Sator Chill Web Audio Synthesizer ---
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

      // River / Ambient Pink Noise Buffer
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
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = chillPreset === 'rain' ? 1200 : 420;

      const gain = ctx.createGain();
      gain.gain.value = chillVolume * 0.32;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();

      noiseNodeRef.current = { noise, gain, filter };

      // Chime / Mellow Lo-Fi Chords
      const chords = [
        [261.63, 329.63, 392.00, 493.88], // Cmaj7
        [220.00, 261.63, 329.63, 392.00], // Am7
        [174.61, 220.00, 261.63, 329.63], // Fmaj7
        [196.00, 246.94, 293.66, 349.23]  // G7
      ];
      let chordIndex = 0;

      const playChordNote = (freq, delay = 0) => {
        if (!audioCtxRef.current) return;
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

        noteGain.gain.setValueAtTime(0, ctx.currentTime + delay);
        noteGain.gain.linearRampToValueAtTime(chillVolume * 0.08, ctx.currentTime + delay + 0.1);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 2.8);

        osc.connect(noteGain);
        noteGain.connect(ctx.destination);

        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 3.0);
      };

      synthIntervalRef.current = setInterval(() => {
        const currentChord = chords[chordIndex % chords.length];
        currentChord.forEach((freq, idx) => {
          playChordNote(freq, idx * 0.18);
        });
        chordIndex++;
      }, 3600);

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

  useEffect(() => {
    return () => {
      stopChillAudio();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div id="arcade-lobby-root" className="min-h-screen flex flex-col relative select-none font-sans">
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

      {/* Return to Customer Table Navigation Bar */}
      {activeTableId && (
        <div className="w-full bg-[oklch(52%_0.16_28)] text-white py-2.5 px-6 flex items-center justify-between border-b border-[oklch(45%_0.16_28)] shadow-md sticky top-0 z-50">
          <div className="flex items-center gap-2.5 font-mono text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-bold uppercase tracking-wider">
              🎮 เล่นเกมรออาหาร โต๊ะ {activeTableName || `Table ${activeTableId}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/table/${activeTableId}/status`)}
              className="btn-action px-3.5 py-1.5 rounded bg-white text-[oklch(18%_0.012_28)] hover:bg-[#F2F2EC] text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[oklch(52%_0.16_28)]" />
              <span>กลับไปที่โต๊ะ ({activeTableName || `Table ${activeTableId}`})</span>
            </button>
            <button
              onClick={() => {
                setActiveTableId(null);
                setActiveTableName('');
                localStorage.removeItem('active_customer_table_id');
                localStorage.removeItem('active_customer_table_name');
              }}
              title="ปิดแถบแจ้งเตือนโต๊ะ"
              className="p-1.5 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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

        {/* Mode Navigation tabs */}
        <div className="flex bg-[var(--color-paper-3)] p-0.5 rounded-[4px] border border-[var(--color-rule)] gap-1">
          <button
            onClick={() => setActiveTab('game')}
            className={`btn-tab px-3.5 py-1.5 rounded-[3px] text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'game' 
                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] shadow-sm' 
                : 'text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'
            }`}
          >
            <Gamepad2 className="w-3 h-3" />
            <span>FLAPPY CAT</span>
          </button>

          <button
            onClick={() => setActiveTab('sator_chill')}
            className={`btn-tab px-3.5 py-1.5 rounded-[3px] text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'sator_chill' 
                ? 'bg-[oklch(52%_0.16_28)] text-white shadow-sm' 
                : 'text-[var(--color-ink-2)] hover:text-[var(--color-ink)]'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>TAI-PLA CHILL (น้องไตปลา)</span>
          </button>
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
              className="btn-action flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-accent)] hover:bg-[oklch(58%_0.16_35)] text-white text-[9px] font-mono font-bold uppercase tracking-wider rounded-[4px] border border-[oklch(52%_0.16_35)] shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 border border-red-700 animate-pulse shadow-[0_0_3px_red]"></span>
              <span>LINE CONNECT</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Console Grid */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 z-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-start">
          
          {/* Column 1: Game Cabinet / Sator Chill (Left Column, spans 7 on lg) */}
          <div className={`lg:col-span-7 flex flex-col bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg p-5 sm:p-6 relative shadow-sm transition-all duration-200 ${isGameFullscreen ? 'z-[999]' : 'overflow-hidden'}`}>
            
            {/* Mode 1: Flappy Cat Game */}
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

                  <button
                    onClick={() => setActiveTab('sator_chill')}
                    className="flex items-center gap-1 text-[10px] text-[oklch(52%_0.16_28)] hover:underline font-mono font-bold cursor-pointer"
                  >
                    <span>ลอง TAI-PLA CHILL</span>
                    <ChevronRight size={12} />
                  </button>
                </div>

                <div className="mt-4 text-center text-[10px] text-[var(--color-ink-2)] font-mono leading-relaxed max-w-sm border-t border-dashed border-[var(--color-rule)] w-full pt-3">
                  <span className="text-[var(--color-accent)] font-bold">// INSTRUCTION:</span> แตะหน้าจอช่วยแมวส้มบินเพื่อสะสมแต้มแลกเหรียญ xhaus และตั๋วสุ่มรายสัปดาห์!
                </div>
              </div>
            )}

            {/* Mode 2: Sator & Tai-Pla Chill (Nakhon Phanom x Southern Thai Fusion) */}
            {activeTab === 'sator_chill' && (
              <div className="w-full flex flex-col gap-6">
                
                {/* Header Lounge Banner (Clean Light Style) */}
                <div className="bg-white border border-[var(--color-rule)] p-5 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] font-bold text-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10 px-2 py-0.5 rounded-sm border border-[oklch(52%_0.16_28)]/20">
                        NAKHON PHANOM x SOUTH FUSION
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    </div>
                    <h2 className="text-xl font-bold font-mono uppercase tracking-tight text-[oklch(18%_0.012_28)] mt-1">
                      น้องไตปลา แมวเปรอะริมโขง
                    </h2>
                    <p className="text-xs text-[oklch(45%_0.010_28)] font-sans mt-0.5">
                      เรื่องราวของ "น้องไตปลา" แมวเปรอะปักษ์ใต้ พลัดถิ่นมาเปิดร้านอาหารริมแม่น้ำโขงนครพนม
                    </p>
                  </div>
                </div>

                {/* Playable Mini-Game Prototype (Clean & Fullscreen Capable) */}
                <TaiPlaMiniGame 
                  session={session}
                  onClaimScore={handleClaimScore}
                  onRequireLogin={handleRequireLogin}
                  onCoinEarned={(coinAmount) => {
                    if (session?.user) {
                      fetchUserStats(session.user.id);
                      fetchUserProfile(session.user.id);
                    }
                  }}
                />

                {/* Headphone Recommended Banner */}
                <div className="bg-[oklch(94%_0.02_28)] border border-[oklch(82%_0.08_28)] rounded-md p-4 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[oklch(52%_0.16_28)]/15 text-[oklch(52%_0.16_28)] flex items-center justify-center shrink-0">
                      <Headphones size={20} />
                    </div>
                    <div>
                      <h4 className="font-mono text-xs font-bold text-[oklch(18%_0.012_28)] uppercase">
                        🎧 แนะนำให้ใส่หูฟังเพื่อมิติเสียงที่ดีที่สุด
                      </h4>
                      <p className="text-[11px] text-[oklch(42%_0.010_28)] font-sans">
                        ระบบเสียงสังเคราะห์ Binaural Ambient คลื่นน้ำริมฝั่งโขงและคอร์ด Lo-Fi ชิลล์ๆ
                      </p>
                    </div>
                  </div>
                  {hasHeadphonesConfirmed && (
                    <span className="font-mono text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-bold shrink-0">
                      HEADPHONES READY
                    </span>
                  )}
                </div>

                {/* Lo-Fi Ambient Synthesizer Box */}
                <div className="bg-white border border-[var(--color-rule)] rounded-md p-5 flex flex-col gap-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-3">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-[oklch(52%_0.16_28)]" />
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                        Lo-Fi Ambient Sound Generator
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[var(--color-muted)] font-bold">
                      {chillPlaying ? '● PLAYING LIVE' : '○ MUTED'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                      onClick={handlePlayClick}
                      className={`w-full sm:w-auto px-5 py-2.5 rounded-sm font-mono text-xs font-bold uppercase flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all ${
                        chillPlaying 
                          ? 'bg-[oklch(18%_0.012_28)] text-white' 
                          : 'bg-[oklch(52%_0.16_28)] text-white hover:bg-[oklch(45%_0.16_28)]'
                      }`}
                    >
                      {chillPlaying ? <Pause size={14} /> : <Play size={14} />}
                      <span>{chillPlaying ? 'PAUSE AMBIENT' : 'PLAY LO-FI AMBIENT'}</span>
                    </button>

                    {/* Sound Preset Switcher */}
                    <div className="flex bg-[var(--color-paper-2)] p-1 rounded-sm border border-[var(--color-rule)] font-mono text-[10px] gap-1 w-full sm:w-auto justify-center">
                      <button
                        onClick={() => { setChillPreset('sunset'); if (chillPlaying) { stopChillAudio(); setTimeout(startChillAudio, 50); } }}
                        className={`px-3 py-1 rounded-sm font-bold uppercase transition-all ${chillPreset === 'sunset' ? 'bg-white text-[oklch(18%_0.012_28)] shadow-2xs' : 'text-zinc-500'}`}
                      >
                        ริมโขงนครพนม (Sunset)
                      </button>
                      <button
                        onClick={() => { setChillPreset('rain'); if (chillPlaying) { stopChillAudio(); setTimeout(startChillAudio, 50); } }}
                        className={`px-3 py-1 rounded-sm font-bold uppercase transition-all ${chillPreset === 'rain' ? 'bg-white text-[oklch(18%_0.012_28)] shadow-2xs' : 'text-zinc-500'}`}
                      >
                        สายฝนริมน้ำ (Rain)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Storyline & Game Modes Plan (Clean Light Style) */}
                <div className="bg-white border border-[var(--color-rule)] p-6 rounded-lg flex flex-col gap-4 shadow-2xs">
                  <div className="border-b border-[var(--color-rule)] pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[oklch(52%_0.16_28)]" />
                      <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[oklch(18%_0.012_28)]">
                        STORYLINE // น้องไตปลา แมวเปรอะผจญภัย
                      </h3>
                    </div>
                    <span className="font-mono text-[9px] text-[oklch(45%_0.010_28)] bg-[var(--color-paper-2)] px-2 py-0.5 rounded border border-[var(--color-rule)] font-bold">
                      ARCADE ROADMAP
                    </span>
                  </div>

                  <p className="text-xs text-[oklch(35%_0.010_28)] font-sans leading-relaxed">
                    <strong>"น้องไตปลา"</strong> แมวเปรอะสามสีจากแดนใต้ ผู้มีกลิ่นหอมพริกแกงไตปลาและใบสะตอติดตัวมาตั้งแต่เด็ก ได้ยินเสียงลือเลื่องถึงความงดงามของแม่น้ำโขง จึงออกเดินทางขึ้นเหนือสู่ <strong>จังหวัดนครพนม</strong> เพื่อเปิดร้านอาหารและตามหาวัตถุดิบล้ำค่าตามแลนด์มาร์คริมฝั่งโขง
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[10px] mt-2">
                    <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-3.5 rounded flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-[oklch(52%_0.16_28)] font-bold">
                        <Flame size={13} className="text-red-500" />
                        <span>ไตปลารัน (ถนนคนเดิน)</span>
                      </div>
                      <p className="text-[oklch(45%_0.010_28)] font-sans text-[11px] leading-relaxed">
                        วิ่งเก็บสะตอ & ปลาทูย่าง หลบปีศาจพริกแกงตามถนนคนเดินริมโขง
                      </p>
                    </div>

                    <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-3.5 rounded flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-sky-700 font-bold">
                        <Waves size={13} className="text-sky-600" />
                        <span>นาคาสลาลอม (พญาศรีสัตตฯ)</span>
                      </div>
                      <p className="text-[oklch(45%_0.010_28)] font-sans text-[11px] leading-relaxed">
                        พายเรือยาวลัดเลาะแม่น้ำโขง หลบแก่งหินหน้าองค์พญาศรีสัตตนาคราช
                      </p>
                    </div>

                    <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-3.5 rounded flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                        <Sparkles size={13} className="text-amber-600" />
                        <span>ชาชักริมโขง (ลานคนเมือง)</span>
                      </div>
                      <p className="text-[oklch(45%_0.010_28)] font-sans text-[11px] leading-relaxed">
                        ชักชาใต้รสเข้มจับจังหวะดนตรีลูกทุ่งอีสาน x เรกเก้ปักษ์ใต้
                      </p>
                    </div>
                  </div>
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

            {/* Panel 2: Live Leaderboard */}
            <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg p-5 flex flex-col gap-3 shadow-sm">
              <div className="border-b border-[var(--color-rule)] pb-2 flex justify-between items-center select-none">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  <h2 className="text-[10px] font-bold font-mono tracking-widest text-[var(--color-ink)] uppercase">
                    WEEKLY TOP 10 LEADERBOARD
                  </h2>
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
                        {index < 3 && <Award className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
                        <span className="truncate max-w-[130px] uppercase">{entry.display_name}</span>
                      </div>
                      <span className="font-bold">{entry.score.toString().padStart(3, '0')} PTS</span>
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
        IN THE HAUS © {new Date().getFullYear()} — ARCADE & SATOR CHILL // MODEL IH-FC-01
      </footer>

      {/* Headphone Recommendation Prompt Modal */}
      {showHeadphonePrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-[fadeIn_0.15s_ease-out]">
          <div className="w-full max-w-sm bg-white border border-[var(--color-rule)] rounded-md p-6 shadow-xl text-center relative">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <Headphones size={24} />
            </div>
            <h3 className="font-mono text-sm font-bold uppercase tracking-tight text-[var(--color-ink)] mb-1">
              แนะนำให้ใส่หูฟัง
            </h3>
            <p className="text-xs text-zinc-600 font-sans leading-relaxed mb-5">
              เพื่อมิติเสียงสังเคราะห์คลื่นน้ำริมแม่น้ำโขงและคอร์ดเพลง Lo-Fi ที่สมจริง แนะนำให้เสียบหรือเชื่อมต่อหูฟังก่อนเริ่มฟังครับ
            </p>
            <div className="flex gap-2 font-mono text-xs">
              <button
                onClick={confirmHeadphonesAndPlay}
                className="flex-1 py-2.5 bg-[oklch(52%_0.16_28)] text-white font-bold uppercase rounded cursor-pointer hover:bg-[oklch(45%_0.16_28)] shadow-sm"
              >
                พร้อมฟังแล้ว
              </button>
              <button
                onClick={() => setShowHeadphonePrompt(false)}
                className="px-3 py-2.5 bg-zinc-100 text-zinc-700 font-bold uppercase rounded cursor-pointer hover:bg-zinc-200"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Score Modal Overlay (Rams Mechanical Box style) */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-[fadeIn_0.15s_ease-out]">
          <div className="w-full max-w-md bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-md p-6 sm:p-8 shadow-xl text-left relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-brand)] rounded-t-md" />

            <button 
              onClick={() => setShowClaimModal(false)}
              className="absolute top-5 right-5 text-[var(--color-ink-2)] hover:text-[var(--color-ink)] transition-colors duration-200 cursor-pointer font-mono text-[9px]"
            >
              [ CLOSE ]
            </button>

            {/* View: User not logged in (Supports LINE Connect or Guest Submit) */}
            {!session && (
              <div className="flex flex-col gap-4 mt-2 font-mono text-xs">
                <div className="w-8 h-8 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-[3px] flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-[var(--color-accent)]" />
                </div>
                <div>
                  <h2 className="text-[10px] font-bold tracking-widest text-[var(--color-accent)] uppercase mb-1">
                    // SCORE RECORDING & REWARDS
                  </h2>
                  <h3 className="text-[14px] font-bold text-[var(--color-ink)] mb-1 font-sans">
                    คุณเล่นได้ทั้งหมด {claimScore} แต้ม!
                  </h3>
                  <p className="text-[10px] text-[var(--color-ink-2)] leading-relaxed font-sans">
                    เข้าสู่ระบบ LINE เพื่อรับเหรียญ xhaus และตั๋วสุ่มรายสัปดาห์ หรือใส่ชื่อเพื่อบันทึกสถิติลง Leaderboard ทันที
                  </p>
                </div>

                <button
                  onClick={handleLineLogin}
                  className="btn-action w-full bg-[#06C755] hover:bg-[#05b04b] text-white font-bold py-2.5 rounded-[4px] flex items-center justify-center gap-2 cursor-pointer font-mono text-[10px] uppercase shadow-sm border border-[#05b04b]"
                >
                  <LogIn size={13} />
                  <span>เข้าสู่ระบบด้วย LINE เพื่อรับเหรียญ xhaus</span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-[var(--color-rule)]"></div>
                  <span className="flex-shrink mx-3 text-[9px] text-[var(--color-muted)] uppercase">หรือบันทึกในฐานะ Guest</span>
                  <div className="flex-grow border-t border-[var(--color-rule)]"></div>
                </div>

                <form onSubmit={handleGuestSubmit} className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="ใส่ชื่อหรือชื่อเล่น..."
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    maxLength={15}
                    className="flex-1 bg-white border border-[var(--color-rule)] px-3 py-2 text-xs font-mono rounded-sm outline-none focus:border-[var(--color-ink)]"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingGuest}
                    className="px-4 py-2 bg-[var(--color-ink)] text-white text-[10px] font-bold uppercase rounded-sm cursor-pointer hover:bg-black transition-all"
                  >
                    {isSubmittingGuest ? 'บันทึก...' : 'บันทึกบอร์ด'}
                  </button>
                </form>
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
                  <h3 className="text-[14px] font-bold text-[var(--color-ink)] mb-1 font-sans">
                    ยืนยันบันทึกคะแนน {claimScore} แต้ม
                  </h3>
                  <p className="text-[10px] text-[var(--color-ink-2)] leading-relaxed font-sans">
                    ยืนยันพิกัด GPS เพื่อรับเหรียญ xhaus และบันทึกสถิติของคุณเข้าบอร์ดประจำสัปดาห์
                  </p>
                </div>
                <button
                  onClick={processClaimScore}
                  className="btn-action w-full bg-[var(--color-accent)] text-white font-bold py-2.5 rounded-[4px] cursor-pointer font-mono text-[10px] uppercase border border-[oklch(55%_0.16_35)] shadow-sm"
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
                  <h3 className="text-[14px] font-bold text-[var(--color-ink)] mb-2 font-sans">
                    บันทึกสถิติของคุณเรียบร้อยแล้ว!
                  </h3>
                  <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-[4px] py-3 px-4 w-full my-2 flex justify-between items-center">
                    <span className="text-[var(--color-ink-2)] text-[10px]">RECORDED SCORE</span>
                    <span className="text-sm font-bold text-[var(--color-accent)]">{claimScore} PTS</span>
                  </div>
                  {claimResultMessage && (
                    <div className="bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[4px] py-3 px-4 w-full text-center text-[10px] font-bold text-[var(--color-ink)] my-3 leading-relaxed">
                      {claimResultMessage}
                    </div>
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
                    className="btn-action flex-1 bg-[var(--color-accent)] text-white font-bold py-2.5 rounded-[4px] cursor-pointer font-mono text-[10px] uppercase text-center border border-[oklch(55%_0.16_35)]"
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
