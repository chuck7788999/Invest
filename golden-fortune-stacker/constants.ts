
export const COLORS = {
  GOLD_PRIMARY: '#FFD700',
  GOLD_SECONDARY: '#DAA520',
  GOLD_DARK: '#B8860B',
  GOLD_LIGHT: '#FFFACD',
  BACKGROUND: '#0c0a09',
};

export const MAX_STACK_HEIGHT = 200; // 최대 코인 개수
export const COLUMN_COUNT = 8;
export const COIN_THICKNESS = 4; // 스택 쌓이는 높이 감각 최적화
export const GRAVITY = 0.6; // 중력 가속도
export const COIN_RADIUS = 20; // 코인 크기
// FALL_DURATION added to fix the export error in Coin.tsx
export const FALL_DURATION = 0.6; // 코인 낙하 속도 (초)
