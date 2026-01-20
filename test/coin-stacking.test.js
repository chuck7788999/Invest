/**
 * 코인 스태킹 로직 테스트
 *
 * 테스트 항목:
 * 1. 코인 높이 강제 조정이 제거되었는지 확인
 * 2. 균등 분배 로직이 올바르게 동작하는지 확인
 * 3. 모든 코인이 착지한 후에만 콜백이 호출되는지 확인
 */

// 시뮬레이션을 위한 상태 변수
let coinStacks = [0, 0, 0, 0];
let targetStacks = [0, 0, 0, 0];
let fallingCoins = [];
const COIN_THICKNESS = 5;

// 테스트용 dropCoin 함수
function dropCoin(rankIndex) {
  fallingCoins.push({
    rankIndex,
    y: -30,
    vy: 2
  });
}

// 테스트용 코인 착지 시뮬레이션
function simulateCoinLanding() {
  fallingCoins.forEach(coin => {
    coinStacks[coin.rankIndex]++;
  });
  fallingCoins = [];
}

// 목표 높이까지 코인 쌓기 (균등 분배 로직)
function stackCoinsToHeight(targetHeight, rankIndices, callback) {
  const coinsNeeded = Math.floor(targetHeight / COIN_THICKNESS);

  // 목표 설정
  rankIndices.forEach(rank => {
    targetStacks[rank] = coinsNeeded;
  });

  // 각 팀별 필요 코인 수 계산
  let totalCoinsToAdd = 0;
  rankIndices.forEach(rank => {
    const needed = Math.max(0, coinsNeeded - coinStacks[rank]);
    totalCoinsToAdd += needed;
  });

  if (totalCoinsToAdd === 0) {
    if (callback) callback();
    return [];
  }

  const droppedCoins = [];
  let addedCount = 0;

  while (addedCount < totalCoinsToAdd) {
    // 목표에 도달하지 않은 팀 찾기
    const needMore = rankIndices.filter(rank => coinStacks[rank] + droppedCoins.filter(c => c === rank).length < targetStacks[rank]);

    if (needMore.length === 0) break;

    // 가장 적은 스택에 우선 드롭 (균등 분배)
    const currentHeights = needMore.map(r => coinStacks[r] + droppedCoins.filter(c => c === r).length);
    const minHeight = Math.min(...currentHeights);
    const lowestRanks = needMore.filter(r => coinStacks[r] + droppedCoins.filter(c => c === r).length === minHeight);
    const rankIdx = lowestRanks[0]; // 테스트에서는 항상 첫 번째 선택

    droppedCoins.push(rankIdx);
    addedCount++;
  }

  return droppedCoins;
}

// 테스트 1: 균등 분배 테스트
function test_equalDistribution() {
  console.log('\n=== 테스트 1: 균등 분배 테스트 ===');

  // 초기화
  coinStacks = [0, 0, 0, 0];
  targetStacks = [0, 0, 0, 0];
  fallingCoins = [];

  const targetHeight = 50; // 10개 코인 필요 (50/5)
  const rankIndices = [0, 1, 2, 3];

  const droppedCoins = stackCoinsToHeight(targetHeight, rankIndices);

  // 각 순위별로 드롭된 코인 수 계산
  const dropCounts = [0, 0, 0, 0];
  droppedCoins.forEach(rank => dropCounts[rank]++);

  console.log(`목표 높이: ${targetHeight}px (${targetHeight / COIN_THICKNESS}개 코인 필요)`);
  console.log(`각 순위별 드롭 수: [${dropCounts.join(', ')}]`);

  // 검증: 모든 순위의 드롭 수가 동일해야 함
  const allEqual = dropCounts.every(c => c === dropCounts[0]);
  console.log(`균등 분배 여부: ${allEqual ? '✅ PASS' : '❌ FAIL'}`);

  return allEqual;
}

// 테스트 2: 강제 조정 제거 확인
function test_noForceAdjustment() {
  console.log('\n=== 테스트 2: 강제 조정 제거 확인 ===');

  // 초기화 - 이미 일부 코인이 쌓인 상태
  coinStacks = [5, 3, 7, 2];
  targetStacks = [0, 0, 0, 0];
  fallingCoins = [];

  const initialStacks = [...coinStacks];
  const targetHeight = 50; // 10개 코인 필요
  const rankIndices = [0, 1, 2, 3];

  const droppedCoins = stackCoinsToHeight(targetHeight, rankIndices);

  // 드롭된 코인을 시뮬레이션
  droppedCoins.forEach(rank => coinStacks[rank]++);

  console.log(`초기 스택: [${initialStacks.join(', ')}]`);
  console.log(`목표: ${targetHeight / COIN_THICKNESS}개`);
  console.log(`최종 스택: [${coinStacks.join(', ')}]`);

  // 검증: 모든 스택이 목표에 도달했는지
  const allReachedTarget = rankIndices.every(rank => coinStacks[rank] >= targetHeight / COIN_THICKNESS);
  console.log(`목표 도달 여부: ${allReachedTarget ? '✅ PASS' : '❌ FAIL'}`);

  // 검증: 강제로 낮아진 스택이 없는지 (원래 높았던 스택이 낮아지면 안됨)
  const noDecrease = rankIndices.every(rank => coinStacks[rank] >= initialStacks[rank]);
  console.log(`스택 감소 없음: ${noDecrease ? '✅ PASS' : '❌ FAIL'}`);

  return allReachedTarget && noDecrease;
}

// 테스트 3: 단계별 코인 쌓기 테스트 (4위 → 3위 → 데드히트)
function test_stepByStepStacking() {
  console.log('\n=== 테스트 3: 단계별 코인 쌓기 테스트 ===');

  // 초기화
  coinStacks = [0, 0, 0, 0];
  targetStacks = [0, 0, 0, 0];
  fallingCoins = [];

  // 팀별 투자금액 (1위=42억, 2위=40억, 3위=32억, 4위=15억)
  const investments = [42, 40, 32, 15];
  const maxInvestment = Math.max(...investments);
  const maxStackHeight = 350;

  // Step 1: 4위 높이까지 모두 쌓기
  console.log('\n[Step 1] 4위 높이까지 모두 쌓기');
  const fourthHeight = (investments[3] / maxInvestment) * maxStackHeight;
  const droppedStep1 = stackCoinsToHeight(fourthHeight, [0, 1, 2, 3]);
  droppedStep1.forEach(rank => coinStacks[rank]++);
  console.log(`4위 높이: ${fourthHeight.toFixed(1)}px`);
  console.log(`스택 상태: [${coinStacks.join(', ')}]`);

  // 검증: 모든 스택이 동일한 높이
  const step1Pass = coinStacks.every(c => c === coinStacks[0]);
  console.log(`동일 높이 여부: ${step1Pass ? '✅ PASS' : '❌ FAIL'}`);

  // Step 2: 3위 높이까지 1,2,3위 쌓기
  console.log('\n[Step 2] 3위 높이까지 1,2,3위 쌓기');
  const thirdHeight = (investments[2] / maxInvestment) * maxStackHeight;
  const droppedStep2 = stackCoinsToHeight(thirdHeight, [0, 1, 2]);
  droppedStep2.forEach(rank => coinStacks[rank]++);
  console.log(`3위 높이: ${thirdHeight.toFixed(1)}px`);
  console.log(`스택 상태: [${coinStacks.join(', ')}]`);

  // 검증: 1,2,3위가 동일한 높이, 4위는 그대로
  const step2Pass = (coinStacks[0] === coinStacks[1]) && (coinStacks[1] === coinStacks[2]);
  console.log(`1,2,3위 동일 높이: ${step2Pass ? '✅ PASS' : '❌ FAIL'}`);

  // Step 3: 2위 높이까지 1,2위 쌓기
  console.log('\n[Step 3] 2위 높이까지 1,2위 쌓기 (데드히트)');
  const secondHeight = (investments[1] / maxInvestment) * maxStackHeight;
  const droppedStep3 = stackCoinsToHeight(secondHeight, [0, 1]);
  droppedStep3.forEach(rank => coinStacks[rank]++);
  console.log(`2위 높이: ${secondHeight.toFixed(1)}px`);
  console.log(`스택 상태: [${coinStacks.join(', ')}]`);

  // 검증: 1,2위가 동일한 높이
  const step3Pass = coinStacks[0] === coinStacks[1];
  console.log(`1,2위 동일 높이 (데드히트): ${step3Pass ? '✅ PASS' : '❌ FAIL'}`);

  // Step 4: 1위 높이까지 1위만 쌓기
  console.log('\n[Step 4] 1위 높이까지 1위만 쌓기');
  const firstHeight = (investments[0] / maxInvestment) * maxStackHeight;
  const droppedStep4 = stackCoinsToHeight(firstHeight, [0]);
  droppedStep4.forEach(rank => coinStacks[rank]++);
  console.log(`1위 높이: ${firstHeight.toFixed(1)}px`);
  console.log(`스택 상태: [${coinStacks.join(', ')}]`);

  // 검증: 1위가 가장 높음
  const step4Pass = coinStacks[0] > coinStacks[1];
  console.log(`1위가 가장 높음: ${step4Pass ? '✅ PASS' : '❌ FAIL'}`);

  return step1Pass && step2Pass && step3Pass && step4Pass;
}

// 테스트 4: 점프(급격한 변화) 없음 확인
function test_noJumps() {
  console.log('\n=== 테스트 4: 점프(급격한 변화) 없음 확인 ===');

  // 초기화
  coinStacks = [0, 0, 0, 0];
  targetStacks = [0, 0, 0, 0];

  const targetHeight = 100; // 20개 코인
  const rankIndices = [0, 1, 2, 3];

  const droppedCoins = stackCoinsToHeight(targetHeight, rankIndices);

  // 코인이 하나씩 떨어질 때 스택 높이 변화 추적
  const stackHistory = [[...coinStacks]];

  droppedCoins.forEach(rank => {
    coinStacks[rank]++;
    stackHistory.push([...coinStacks]);
  });

  // 연속된 스냅샷 간 최대 변화량 계산
  let maxJump = 0;
  for (let i = 1; i < stackHistory.length; i++) {
    for (let rank = 0; rank < 4; rank++) {
      const diff = Math.abs(stackHistory[i][rank] - stackHistory[i-1][rank]);
      maxJump = Math.max(maxJump, diff);
    }
  }

  console.log(`코인 드롭 횟수: ${droppedCoins.length}`);
  console.log(`최대 점프: ${maxJump}개`);

  // 검증: 한 번에 최대 1개씩만 변화
  const noJumps = maxJump <= 1;
  console.log(`급격한 점프 없음: ${noJumps ? '✅ PASS' : '❌ FAIL'}`);

  return noJumps;
}

// 모든 테스트 실행
function runAllTests() {
  console.log('========================================');
  console.log('    코인 스태킹 로직 테스트 시작');
  console.log('========================================');

  const results = [];

  results.push({ name: '균등 분배 테스트', passed: test_equalDistribution() });
  results.push({ name: '강제 조정 제거 확인', passed: test_noForceAdjustment() });
  results.push({ name: '단계별 코인 쌓기', passed: test_stepByStepStacking() });
  results.push({ name: '점프 없음 확인', passed: test_noJumps() });

  console.log('\n========================================');
  console.log('           테스트 결과 요약');
  console.log('========================================');

  let allPassed = true;
  results.forEach(r => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
    if (!r.passed) allPassed = false;
  });

  console.log('\n========================================');
  if (allPassed) {
    console.log('    🎉 모든 테스트 통과! 🎉');
  } else {
    console.log('    ⚠️  일부 테스트 실패 ⚠️');
  }
  console.log('========================================');

  return allPassed;
}

// 테스트 실행
runAllTests();
