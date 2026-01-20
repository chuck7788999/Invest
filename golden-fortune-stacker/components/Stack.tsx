
import React from 'react';
import { COIN_THICKNESS } from '../constants';

interface StackProps {
  count: number;
  index: number;
}

const Stack: React.FC<StackProps> = ({ count, index }) => {
  const stackHeight = count * COIN_THICKNESS;

  return (
    <div className="relative flex flex-col items-center justify-end h-full w-16 mx-1 group">
      {/* 바닥 베이스 반사광 */}
      <div className="absolute bottom-0 w-20 h-4 bg-yellow-500/10 blur-xl rounded-full"></div>

      {/* 스택 본체 */}
      <div 
        className="relative w-10 bg-gradient-to-r from-yellow-700 via-yellow-500 to-yellow-800 border-x border-yellow-400/20 shadow-lg rounded-t-sm transition-all duration-300 ease-out"
        style={{ height: `${stackHeight}px` }}
      >
        {/* 가로 줄무늬 (코인 층 표현) - 성능을 위해 CSS 패턴 사용 */}
        <div className="absolute inset-0 w-full h-full opacity-30" 
             style={{ 
               backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent ${COIN_THICKNESS - 1}px, rgba(0,0,0,0.5) ${COIN_THICKNESS}px)`,
               backgroundSize: `100% ${COIN_THICKNESS}px`
             }} 
        />
        
        {/* 수직 하이라이트 */}
        <div className="absolute inset-y-0 left-1/3 w-px bg-white/20 blur-[1px]"></div>
      </div>

      {/* 최상단 캡 (입체감) */}
      {count > 0 && (
        <div
          className="absolute w-10 h-4 rounded-full bg-gradient-to-b from-yellow-200 to-yellow-500 border border-yellow-200/50 shadow-inner"
          style={{ bottom: `${stackHeight - 2}px` }}
        >
          <div className="absolute inset-1 rounded-full border border-yellow-100/30"></div>
        </div>
      )}

      {/* 카운트 레이블 */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-yellow-500 font-black text-sm opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm whitespace-nowrap">
        {count}
      </div>
    </div>
  );
};

export default Stack;
