import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import FlappyCatGame from './FlappyCatGame';
import { Gamepad2, Music, Tag, Trophy, Award } from 'lucide-react';

export default function ArcadeLobby() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState('game'); // 'game' | 'music' | 'promo'
  const [loading, setLoading] = useState(true);

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
    // Refetch the leaderboard to update high scores shown in the main menu
    fetchLeaderboard();
  };

  return (
    <div className="min-h-screen bg-[#080018] text-white flex flex-col font-sans overflow-x-hidden relative select-none">
      {/* Retrowave Neon grid background grid decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(139,0,255,0.05)_1px,transparent_1px),linear-gradient(to_right,rgba(139,0,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-[#8b00ff]/10 to-transparent pointer-events-none blur-3xl" />

      {/* Retro Arcade Header */}
      <header className="w-full py-6 px-8 z-10 border-b border-purple-500/20 bg-black/40 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Gamepad2 className="w-8 h-8 text-[#DFFF00] animate-pulse" />
          <div>
            <h1 className="text-xl font-bold font-mono tracking-widest text-[#DFFF00] drop-shadow-[0_0_10px_rgba(223,255,0,0.5)]">
              HAUS PLAYGROUND
            </h1>
            <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider">In-store iPad Console</p>
          </div>
        </div>

        {/* Tab Navigation (Future expansion: Song Request, Promotions) */}
        <div className="flex bg-[#12002b] p-1 rounded-full border border-purple-500/30">
          <button
            onClick={() => setActiveTab('game')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold font-mono uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'game' 
                ? 'bg-[#DFFF00] text-black shadow-[0_0_15px_rgba(223,255,0,0.4)]' 
                : 'text-purple-300 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            Flappy Cat
          </button>
          
          <button
            onClick={() => setActiveTab('music')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold font-mono uppercase tracking-wider transition-all duration-300 relative ${
              activeTab === 'music' 
                ? 'bg-[#DFFF00] text-black' 
                : 'text-purple-500 cursor-not-allowed opacity-50'
            }`}
            disabled={activeTab !== 'music'}
          >
            <Music className="w-4 h-4" />
            Request Song
            <span className="absolute -top-2 -right-2 bg-pink-500 text-[9px] text-white px-1.5 py-0.5 rounded font-sans normal-case">SOON</span>
          </button>

          <button
            onClick={() => setActiveTab('promo')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold font-mono uppercase tracking-wider transition-all duration-300 relative ${
              activeTab === 'promo' 
                ? 'bg-[#DFFF00] text-black' 
                : 'text-purple-500 cursor-not-allowed opacity-50'
            }`}
            disabled={activeTab !== 'promo'}
          >
            <Tag className="w-4 h-4" />
            Deals
            <span className="absolute -top-2 -right-2 bg-pink-500 text-[9px] text-white px-1.5 py-0.5 rounded font-sans normal-case">SOON</span>
          </button>
        </div>
      </header>

      {/* Main Lobby Container */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center p-6 sm:p-10 gap-10 z-10 max-w-7xl mx-auto w-full">
        {/* Left Column: Phaser Game View */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {activeTab === 'game' && (
            <div className="w-full max-w-[600px]">
              <FlappyCatGame onGameOver={handleGameOver} leaderboard={leaderboard} />
              <div className="mt-4 text-center text-xs text-purple-400 font-mono">
                💡 TIP: แตะหน้าจอเพื่อช่วยแมวส้มกระพือปีกหลบสะตอยักษ์!
              </div>
            </div>
          )}
        </div>

        {/* Right Column: High Score Panel & Info */}
        <div className="w-full lg:w-[400px] flex flex-col gap-6">
          {/* Neon Leaderboard Container */}
          <div className="bg-[#12002b]/70 border border-purple-500/30 rounded-3xl p-6 backdrop-blur-md shadow-[0_0_30px_rgba(139,0,255,0.1)]">
            <div className="flex items-center justify-between mb-6 border-b border-purple-500/20 pb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#DFFF00]" />
                <h2 className="text-lg font-bold font-mono tracking-widest text-[#DFFF00]">HALL OF FAME</h2>
              </div>
              <button 
                onClick={fetchLeaderboard}
                className="text-xs text-purple-300 hover:text-white font-mono bg-purple-500/20 hover:bg-purple-500/30 px-3 py-1 rounded-md transition-colors"
              >
                REFRESH
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-purple-400 font-mono text-sm">
                LOADING SCORES...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-12 text-center text-purple-400 font-mono text-sm">
                NO RECORDED SCORES YET. BE THE FIRST!
              </div>
            ) : (
              <div className="flex flex-col gap-3 font-mono">
                {leaderboard.map((entry, index) => {
                  const rankColors = [
                    'text-yellow-400 font-bold border-yellow-400/20',
                    'text-slate-300 font-bold border-slate-300/20',
                    'text-amber-600 font-bold border-amber-600/20'
                  ];
                  const isTop3 = index < 3;
                  
                  return (
                    <div 
                      key={entry.id || index}
                      className={`flex items-center justify-between p-3 rounded-xl border bg-black/20 ${
                        isTop3 ? rankColors[index] : 'text-purple-200 border-purple-500/10'
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
          <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-3xl p-6">
            <h3 className="text-sm font-bold font-mono tracking-wider text-pink-400 mb-2 uppercase">🎁 กติการับรางวัลพิเศษ!</h3>
            <p className="text-xs text-purple-200 leading-relaxed mb-3">
              สะสมคะแนนจากการเล่นช่วยเจ้าแมวส้มกวนบุกป่าสะตอ! เมื่อเล่นจบ ให้ใช้กล้องโทรศัพท์สแกน **QR Code บนหน้าจอ** เพื่อเคลมแต้มเข้าบัญชีสมาชิก LINE ของร้านทันที
            </p>
            <div className="text-[10px] text-pink-300/80 font-mono">
              * หมายเหตุ: สามารถรับคะแนนและเคลมรางวัลได้เมื่ออยู่ในรัศมีระยะทางของร้าน (ไม่เกิน 1 กม.) เท่านั้น
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
