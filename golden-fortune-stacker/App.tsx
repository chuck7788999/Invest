
import React, { useState, useCallback, useEffect } from 'react';
import { COLUMN_COUNT } from './constants';
import Stack from './components/Stack';
import CoinCanvas from './components/CoinCanvas';
import { Coins, Trash2, Play, Pause, Trophy } from 'lucide-react';

const App: React.FC = () => {
  const [stacks, setStacks] = useState<number[]>(new Array(COLUMN_COUNT).fill(0));
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [lastAddTrigger, setLastAddTrigger] = useState<{ id: string; colIndex?: number } | null>(null);

  const addCoin = useCallback((colIndex?: number) => {
    setLastAddTrigger({
      id: Math.random().toString(36).substring(7),
      colIndex
    });
  }, []);

  const handleLand = useCallback((colIndex: number) => {
    setStacks(prev => {
      const next = [...prev];
      next[colIndex] += 1;
      return next;
    });
  }, []);

  const resetStacks = () => {
    setStacks(new Array(COLUMN_COUNT).fill(0));
    setLastAddTrigger(null);
  };

  useEffect(() => {
    let interval: any;
    if (isAutoPlaying) {
      interval = setInterval(() => {
        addCoin();
      }, 100); // 더 빠른 연사속도에도 끄떡없음
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, addCoin]);

  const totalCoins = stacks.reduce((a, b) => a + b, 0);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0c0a09] flex flex-col items-center justify-center p-4">
      {/* 배경 장식 (GPU 가속 활용) */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-full h-full bg-yellow-600/10 blur-[150px] animate-pulse"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-yellow-900/20 blur-[150px]"></div>
      </div>

      {/* 헤더 */}
      <div className="z-20 mb-10 text-center select-none">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Trophy className="text-yellow-500 w-8 h-8 drop-shadow-[0_0_10px_#FFD700]" />
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-800 tracking-tighter uppercase italic drop-shadow-2xl">
            Golden Fortune
          </h1>
        </div>
        <div className="inline-flex items-center gap-4 bg-stone-900/80 border border-white/10 px-8 py-3 rounded-full backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-3">
            <Coins className="text-yellow-400 w-6 h-6 animate-bounce" />
            <span className="text-3xl font-black text-yellow-100 tabular-nums">
              {totalCoins.toLocaleString()}
            </span>
          </div>
          <div className="h-6 w-px bg-white/20"></div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-yellow-500 font-black">Accumulated Wealth</span>
        </div>
      </div>

      {/* 메인 캔버스 및 스택 영역 */}
      <div className="relative w-full max-w-5xl h-[55vh] flex items-end justify-between px-4 border-b-2 border-yellow-900/30">
        
        {/* 최적화된 코인 캔버스 */}
        <CoinCanvas 
          onLand={handleLand} 
          stacks={stacks} 
          addCoinTrigger={lastAddTrigger} 
        />

        {/* 스택 레이어 */}
        {stacks.map((count, i) => (
          <Stack key={i} index={i} count={count} />
        ))}

        {/* 바닥 발광 효과 */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500/40 shadow-[0_0_25px_5px_rgba(255,215,0,0.3)]"></div>
      </div>

      {/* 컨트롤 버튼 */}
      <div className="mt-14 flex flex-wrap justify-center gap-5 z-20">
        <button
          onClick={() => addCoin()}
          className="group relative px-10 py-5 bg-gradient-to-b from-yellow-300 to-yellow-700 hover:from-yellow-200 hover:to-yellow-600 rounded-2xl shadow-[0_0_40px_rgba(184,134,11,0.3)] transition-all active:scale-95 overflow-hidden"
        >
          <div className="absolute inset-0 shimmer opacity-30"></div>
          <div className="flex items-center gap-3 relative z-10">
            <Coins className="text-white w-7 h-7 group-hover:rotate-12 transition-transform" />
            <span className="text-white font-black text-2xl uppercase italic tracking-tight">Drop Coin</span>
          </div>
        </button>

        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className={`px-10 py-5 rounded-2xl border-2 transition-all flex items-center gap-3 shadow-xl ${
            isAutoPlaying 
              ? 'bg-red-500/10 border-red-500/40 text-red-500' 
              : 'bg-yellow-500/5 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10'
          }`}
        >
          {isAutoPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7" />}
          <span className="font-black text-2xl uppercase italic">{isAutoPlaying ? 'Stop Auto' : 'Auto Drop'}</span>
        </button>

        <button
          onClick={resetStacks}
          className="px-10 py-5 bg-stone-900 border border-stone-800 text-stone-500 hover:text-red-400 hover:border-red-400/40 transition-all rounded-2xl flex items-center gap-3 shadow-xl"
        >
          <Trash2 className="w-7 h-7" />
          <span className="font-black text-2xl uppercase italic">Clear</span>
        </button>
      </div>

      {/* 하단 팁 */}
      <div className="mt-10 text-stone-700 text-xs font-black tracking-[0.3em] uppercase animate-pulse">
        Optimized high-speed coin stacking engine active
      </div>

      {/* 인터랙티브 오버레이 (클릭 시 해당 열에 코인 드랍) */}
      <div className="absolute bottom-[45vh] inset-x-0 top-0 flex pointer-events-none">
        {new Array(COLUMN_COUNT).fill(null).map((_, i) => (
          <div 
            key={`drop-zone-${i}`}
            onClick={() => addCoin(i)}
            className="flex-1 cursor-crosshair pointer-events-auto hover:bg-white/5 transition-colors duration-200 border-x border-white/0 hover:border-white/5"
          ></div>
        ))}
      </div>
    </div>
  );
};

export default App;
