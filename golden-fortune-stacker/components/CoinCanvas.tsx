
import React, { useRef, useEffect, useCallback } from 'react';
import { COLUMN_COUNT, GRAVITY, COIN_THICKNESS, COIN_RADIUS } from '../constants';

interface CoinParticle {
  id: string;
  x: number;
  y: number;
  vy: number;
  vx: number;
  rotation: number;
  rotationSpeed: number;
  columnIndex: number;
}

interface CoinCanvasProps {
  onLand: (columnIndex: number) => void;
  stacks: number[];
  addCoinTrigger: { id: string; colIndex?: number } | null;
}

const CoinCanvas: React.FC<CoinCanvasProps> = ({ onLand, stacks, addCoinTrigger }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coinsRef = useRef<CoinParticle[]>([]);
  const requestRef = useRef<number>(null);

  // 새로운 코인 생성 로직
  useEffect(() => {
    if (addCoinTrigger) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const colIndex = addCoinTrigger.colIndex ?? Math.floor(Math.random() * COLUMN_COUNT);
      const colWidth = canvas.width / COLUMN_COUNT;
      const x = colIndex * colWidth + colWidth / 2;

      coinsRef.current.push({
        id: addCoinTrigger.id,
        x,
        y: -50,
        vy: 2 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 1, // 미세한 수평 흔들림
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        columnIndex: colIndex,
      });
    }
  }, [addCoinTrigger]);

  const drawCoin = (ctx: CanvasRenderingContext2D, coin: CoinParticle) => {
    ctx.save();
    ctx.translate(coin.x, coin.y);
    ctx.rotate(coin.rotation);
    
    // 코인 그림자
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(184, 134, 11, 0.5)';

    // 코인 본체 (황금 그라데이션)
    const grad = ctx.createLinearGradient(-COIN_RADIUS, -COIN_RADIUS, COIN_RADIUS, COIN_RADIUS);
    grad.addColorStop(0, '#FFD700');
    grad.addColorStop(0.5, '#B8860B');
    grad.addColorStop(1, '#DAA520');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, COIN_RADIUS, COIN_RADIUS * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFACD';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 코인 내부 기호 ($)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 16px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0);

    ctx.restore();
  };

  const animate = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const coins = coinsRef.current;
    for (let i = coins.length - 1; i >= 0; i--) {
      const coin = coins[i];
      
      // 물리 연산
      coin.vy += GRAVITY;
      coin.y += coin.vy;
      coin.x += coin.vx;
      coin.rotation += coin.rotationSpeed;

      // 바닥(스택 상단) 판정
      const targetY = canvas.height - (stacks[coin.columnIndex] * COIN_THICKNESS) - 10;
      
      if (coin.y >= targetY) {
        // 착지
        onLand(coin.columnIndex);
        coins.splice(i, 1);
      } else {
        drawCoin(ctx, coin);
      }
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [onLand, stacks]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // 창 크기 대응
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        if (parent) {
          canvasRef.current.width = parent.clientWidth;
          canvasRef.current.height = parent.clientHeight;
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-50"
      style={{ filter: 'drop-shadow(0 0 5px rgba(255, 215, 0, 0.3))' }}
    />
  );
};

export default CoinCanvas;
