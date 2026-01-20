
import React from 'react';
import { motion } from 'framer-motion';
import { FALL_DURATION } from '../constants';

interface CoinProps {
  id: string;
  onLand: (id: string, colIndex: number) => void;
  columnIndex: number;
  targetY: number;
  startX: number;
}

const Coin: React.FC<CoinProps> = ({ id, onLand, columnIndex, targetY, startX }) => {
  return (
    <motion.div
      initial={{ y: -100, x: startX, opacity: 1, rotateY: 0, scale: 1 }}
      animate={{ 
        y: targetY, 
        rotateY: 720,
        rotateX: [0, 20, 0],
        scale: [1, 1.1, 1]
      }}
      transition={{ 
        duration: FALL_DURATION, 
        ease: "easeIn" 
      }}
      onAnimationComplete={() => onLand(id, columnIndex)}
      className="absolute w-12 h-12 pointer-events-none"
      style={{ zIndex: 50 }}
    >
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-800 shadow-[0_4px_10px_rgba(0,0,0,0.5),inset_0_-2px_4px_rgba(0,0,0,0.5)] border-2 border-yellow-200 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border border-yellow-300/50 flex items-center justify-center">
          <span className="text-yellow-100 font-black text-xl select-none">$</span>
        </div>
        {/* Shine effect */}
        <div className="absolute top-1 left-2 w-3 h-1 bg-white/40 rounded-full rotate-[-45deg]"></div>
      </div>
    </motion.div>
  );
};

export default Coin;
