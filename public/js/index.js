    // ============ 상태 관리 ============
    const socket = io({
      transports: ['polling', 'websocket'],  // 폴링 우선, 웹소켓 업그레이드 (Render 호환)
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    let currentState = null;
    let rankedTeams = [];
    let presentationStep = 0;

    // ============ 사운드 컨트롤 함수 ============
    function setVolume(value) {
      const volume = parseInt(value) / 100;
      SoundManager.setVolume(volume);
      document.getElementById('volume-value').textContent = value + '%';
    }

    function toggleMute() {
      const muted = SoundManager.toggleMute();
      document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
    }

    function testSound(type) {
      if (type === 'bgm') {
        SoundManager.playBGM('waiting');
        setTimeout(() => SoundManager.stopBGM(), 5000);
      } else {
        SoundManager.playSFX('fanfareShort');
      }
    }

    // 초기 볼륨 설정 UI 반영
    function initVolumeUI() {
      const slider = document.getElementById('volume-slider');
      const valueEl = document.getElementById('volume-value');
      const muteBtn = document.getElementById('mute-btn');

      if (slider && valueEl && muteBtn) {
        const volume = Math.round(SoundManager.masterVolume * 100);
        slider.value = volume;
        valueEl.textContent = volume + '%';
        muteBtn.textContent = SoundManager.isMuted ? '🔇' : '🔊';
      }
    }

    const stepDescriptions = {
      0: '준비 중',
      1: '🎉 오프닝',
      2: '4️⃣ 4위 발표',
      3: '3️⃣ 3위 발표',
      4: '🔥 1/2위 데드히트',
      5: '📊 1/2위 점수 공개',
      6: '👑 1위 하이라이트',
      7: '🏆 최종 결과'
    };

    // ============ 관리자 패널 ============
    function toggleAdmin() {
      document.getElementById('admin-controls').classList.toggle('show');
    }

    function updateAdminUI() {
      if (!currentState) return;

      document.getElementById('admin-connected').textContent = currentState.connectedCount;
      document.getElementById('admin-evaluated').textContent = currentState.evaluatedCount;

      // Phase별 상태 표시
      const phaseNames = {
        'waiting': '대기 중',
        'evaluating': '평가 진행 중',
        'results': '집계 완료',
        'presenting': '결과 발표 중'
      };
      document.getElementById('admin-phase').textContent = phaseNames[currentState.phase] || currentState.phase;

      // 컨트롤 버튼 표시/숨김
      document.getElementById('waiting-controls').style.display = currentState.phase === 'waiting' ? 'block' : 'none';
      document.getElementById('eval-controls').style.display = currentState.phase === 'evaluating' ? 'block' : 'none';
      document.getElementById('results-controls').style.display = currentState.phase === 'results' ? 'block' : 'none';
      document.getElementById('presentation-controls').style.display = currentState.phase === 'presenting' ? 'block' : 'none';
      document.getElementById('step-section').style.display = currentState.phase === 'presenting' ? 'block' : 'none';
      document.getElementById('admin-nav-buttons').style.display = currentState.phase === 'presenting' ? 'flex' : 'none';

      if (currentState.phase === 'presenting') {
        document.getElementById('current-step').textContent = presentationStep;
        document.getElementById('step-desc').textContent = stepDescriptions[presentationStep];
        document.getElementById('next-btn').disabled = presentationStep >= 5;
      }
    }

    // ============ 관리자 액션 ============
    function startEvaluation() {
      socket.emit('admin:startEvaluation');
      showToast('평가가 시작되었습니다!');
    }

    function forceClose() {
      socket.emit('admin:forceClose');
      showToast('평가가 강제 마감되었습니다');
    }

    function startPresentation() {
      socket.emit('admin:startPresentation');
    }

    function nextStep() {
      socket.emit('admin:nextStep');
    }

    function prevStep() {
      socket.emit('admin:prevStep');
    }

    function resetSystem() {
      if (confirm('전체 시스템을 리셋하시겠습니까?')) {
        socket.emit('admin:reset');
      }
    }

    async function saveSession() {
      const name = prompt('이벤트 이름을 입력하세요:', `Investment Day ${new Date().toLocaleDateString('ko-KR')}`);
      if (!name) return;

      try {
        const response = await fetch('/api/events/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await response.json();

        if (data.success) {
          alert('결과가 저장되었습니다.');
        } else {
          alert('저장 실패: ' + (data.error || 'DB 연결이 필요합니다.'));
        }
      } catch (error) {
        alert('저장 중 오류가 발생했습니다.');
      }
    }

    // ============ 조 정보 수정 ============
    function toggleTeamEdit() {
      const panel = document.getElementById('team-edit-panel');
      if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        // 현재 데이터 로드
        if (currentState && currentState.teams) {
          currentState.teams.forEach(team => {
            document.getElementById(`team-name-${team.id}`).value = team.name;
            document.getElementById(`team-topic-${team.id}`).value = team.topic;
          });
        }
      } else {
        panel.style.display = 'none';
      }
    }

    function saveTeamInfo() {
      for (let i = 1; i <= 4; i++) {
        const name = document.getElementById(`team-name-${i}`).value.trim();
        const topic = document.getElementById(`team-topic-${i}`).value.trim();
        if (name || topic) {
          socket.emit('admin:updateTeam', { teamId: i, name, topic });
        }
      }
      showToast('✅ 조 정보가 저장되었습니다');
      document.getElementById('team-edit-panel').style.display = 'none';
    }

    // ============ 발표 순서 수정 ============
    let currentPresentationOrder = [2, 4, 3, 1];

    function toggleOrderEdit() {
      const panel = document.getElementById('order-edit-panel');
      if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        // 현재 순서 로드
        if (currentState && currentState.presentationOrder) {
          currentPresentationOrder = currentState.presentationOrder;
        }
        for (let i = 1; i <= 4; i++) {
          document.getElementById(`order-${i}`).value = currentPresentationOrder[i - 1];
        }
      } else {
        panel.style.display = 'none';
      }
    }

    function saveOrder() {
      const order = [];
      for (let i = 1; i <= 4; i++) {
        order.push(parseInt(document.getElementById(`order-${i}`).value));
      }
      // 중복 체크
      const unique = new Set(order);
      if (unique.size !== 4) {
        showToast('⚠️ 중복된 조가 있습니다. 다시 선택해주세요.');
        return;
      }
      socket.emit('admin:updatePresentationOrder', order);
      currentPresentationOrder = order;
      updateOrderDisplay();
      showToast('✅ 발표 순서가 저장되었습니다');
      document.getElementById('order-edit-panel').style.display = 'none';
    }

    function updateOrderDisplay() {
      const display = document.getElementById('presentation-order-display');
      if (display && currentPresentationOrder) {
        display.textContent = currentPresentationOrder.map(id => `${id}조`).join(' → ');
      }
    }

    // 데모 평가자 추가
    function addDemoEvaluators() {
      const demoNames = ['김대표', '이전무', '박상무', '최이사', '정부장', '한차장'];
      demoNames.forEach((name, i) => {
        setTimeout(() => {
          socket.emit('demo:addEvaluator', { name });
        }, i * 500);
      });
      showToast('데모 평가자 6명 추가 중...');
    }

    // 데모 평가 추가
    function addDemoEvaluation() {
      socket.emit('demo:addEvaluation');
      showToast('데모 평가 1건 추가');
    }

    // ============ 파티클 생성 ============
    function createParticles() {
      const container = document.getElementById('particles-container');
      for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.width = Math.random() * 10 + 5 + 'px';
        particle.style.height = particle.style.width;
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = Math.random() * 10 + 10 + 's';
        container.appendChild(particle);
      }
    }

    // ============ QR 코드 생성 ============
    function generateQR() {
      const url = `${window.location.origin}/mobile`;
      const qrContainer = document.getElementById('qr-code');
      qrContainer.innerHTML = '';
      new QRCode(qrContainer, {
        text: url,
        width: 250,
        height: 250,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    }

    // ============ UI 렌더링 ============
    function renderTeams(teams) {
      const panel = document.getElementById('teams-panel');
      panel.innerHTML = teams.map(team => `
        <div class="team-card">
          <div class="team-number">${team.name}</div>
          <div class="team-topic">${team.topic}</div>
        </div>
      `).join('');
    }

    function renderEvaluationTeams(teams) {
      const panel = document.getElementById('evaluation-teams');
      panel.innerHTML = teams.map(team => `
        <div class="eval-team-card">
          <div class="eval-team-name">${team.name}</div>
          <div class="eval-team-topic">${team.topic}</div>
        </div>
      `).join('');
    }

    function showToast(message) {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    function showScreen(screenId) {
      // 결과 화면을 벗어날 때 코인 애니메이션 정리
      const resultsScreen = document.getElementById('results-screen');
      const header = document.querySelector('.header');
      
      if (resultsScreen.style.display !== 'none' && screenId !== 'results-screen') {
        resetCoinStacks();
      }

      document.getElementById('waiting-screen').style.display = 'none';
      document.getElementById('evaluation-screen').style.display = 'none';
      resultsScreen.style.display = 'none';
      document.getElementById('final-result').style.display = 'none';

      // 결과 화면일 때 헤더 여백 증가 및 subtitle 숨기기
      if (screenId === 'results-screen') {
        if (header) {
          header.style.marginBottom = '40px';
          const subtitle = header.querySelector('.subtitle');
          if (subtitle) subtitle.style.display = 'none';
        }
      } else {
        if (header) {
          header.style.marginBottom = '30px';
          const subtitle = header.querySelector('.subtitle');
          if (subtitle) subtitle.style.display = '';
        }
      }

      if (screenId) {
        document.getElementById(screenId).style.display = 'flex';
      }
    }

    // ============ 동전 비 효과 ============
    function startCoinRain() {
      const container = document.getElementById('coin-rain');
      container.style.display = 'block';
      container.innerHTML = '';

      const coins = ['💰', '💵', '💴', '💶', '💷', '🪙', '💎'];

      for (let i = 0; i < 100; i++) {
        setTimeout(() => {
          const coin = document.createElement('div');
          coin.className = 'coin';
          coin.textContent = coins[Math.floor(Math.random() * coins.length)];
          coin.style.left = Math.random() * 100 + '%';
          coin.style.animationDuration = Math.random() * 2 + 2 + 's';
          container.appendChild(coin);
          setTimeout(() => coin.remove(), 4000);
        }, i * 30);
      }

      setTimeout(() => container.style.display = 'none', 5000);
    }

    // ============ 코인 스태킹 시스템 (완전 재설계) ============
    const COIN_CONFIG = {
      GRAVITY: 0.6,
      COIN_RADIUS: 22,
      COIN_THICKNESS: 5,
      STACK_WIDTH: 100,
      MAX_STACK_HEIGHT: 350,
      DROP_INTERVAL: 60,
      MAX_STACK_COINS: 75 // 최대 쌓이는 코인 수 (1위 금액 바로 아래까지)
    };

    // 상태 변수
    let fallingCoins = [];
    let coinStacks = [0, 0, 0, 0]; // 각 순위(0=1위, 1=2위, 2=3위, 3=4위)별 쌓인 코인 수
    let targetStacks = [0, 0, 0, 0]; // 각 순위별 목표 코인 수
    let stackCenterX = [0, 0, 0, 0]; // 각 순위별 캔버스 X 좌표
    let highlightedRanks = [0, 1, 2, 3]; // 하이라이트되는 순위 (0=1위, 1=2위, 2=3위, 3=4위)
    let coinAnimationId = null;
    let coinCanvas = null;
    let coinCtx = null;
    let isAnimating = false;
    let canvasBaseY = 0; // 캔버스 바닥 Y 좌표
    let activeDropIntervals = []; // 활성 드롭 인터벌 추적
    let coinSoundPlaying = false; // 코인 효과음 재생 상태

    // 캔버스 초기화 - DOM 요소 위치 기반
    function initCoinCanvas() {
      coinCanvas = document.getElementById('coin-canvas');
      if (!coinCanvas) return;

      const container = document.getElementById('results-screen');
      const rect = container.getBoundingClientRect();

      coinCanvas.width = rect.width;
      coinCanvas.height = rect.height;
      coinCtx = coinCanvas.getContext('2d');

      // 바닥 Y 위치 (스택 베이스 위치 기준)
      canvasBaseY = coinCanvas.height - 100;

      // 위치 계산 - DOM 요소 기반
      updateStackPositions();

      // 리사이즈 시 재계산
      window.addEventListener('resize', () => {
        if (coinCanvas && document.getElementById('results-screen').style.display !== 'none') {
          const newRect = container.getBoundingClientRect();
          coinCanvas.width = newRect.width;
          coinCanvas.height = newRect.height;
          canvasBaseY = coinCanvas.height - 100;
          updateStackPositions();
        }
      });
    }

    // DOM 요소 기반 스택 위치 업데이트
    function updateStackPositions() {
      // rank-container 내의 4개 wrapper 위치 가져오기
      // 화면 순서: 4위(왼쪽) - 3위 - 2위 - 1위(오른쪽)
      // 따라서 wrapper 순서: stack-wrapper-4, stack-wrapper-3, stack-wrapper-2, stack-wrapper-1
      const container = document.getElementById('rank-container');
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const resultsRect = document.getElementById('results-screen').getBoundingClientRect();

      // 각 순위별 스택 영역 위치 가져오기
      for (let rank = 1; rank <= 4; rank++) {
        const wrapper = document.getElementById(`stack-wrapper-${rank}`);
        if (wrapper) {
          const wrapperRect = wrapper.getBoundingClientRect();
          // results-screen 기준 상대 좌표로 변환
          const centerX = wrapperRect.left - resultsRect.left + wrapperRect.width / 2;
          // stackCenterX[순위-1] = 해당 순위의 X 좌표
          stackCenterX[rank - 1] = centerX;
        }
      }

      console.log('Stack positions updated:', stackCenterX);
    }

    // 코인 그리기 (떨어지는 코인)
    function drawCoin(ctx, x, y, rotation, isWinnerCoin = false) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      // 코인 크기는 동일하게 유지
      const radius = COIN_CONFIG.COIN_RADIUS;

      // 코인 그라데이션
      const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
      grad.addColorStop(0, '#FFD700');
      grad.addColorStop(0.3, '#FFF8DC');
      grad.addColorStop(0.5, '#FFD700');
      grad.addColorStop(0.7, '#B8860B');
      grad.addColorStop(1, '#DAA520');

      // 코인 외곽
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
      ctx.fill();

      // 내부 원
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.75, 0, Math.PI * 2);
      ctx.strokeStyle = '#B8860B';
      ctx.lineWidth = 2;
      ctx.stroke();

      // ₩ 심볼
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#8B6914';
      ctx.font = `bold ${radius * 0.9}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('₩', 0, 2);

      ctx.restore();
    }

    // 쌓인 코인 스택 그리기 (3D 레이어)
    function drawCoinStack(ctx, x, stackHeight, rankIndex) {
      const coinHeight = COIN_CONFIG.COIN_THICKNESS;
      const ellipseWidth = 55;
      const ellipseHeight = coinHeight * 1.8;

      // 하이라이트/Dimmed 적용
      const isHighlighted = highlightedRanks.includes(rankIndex);
      const opacity = isHighlighted ? 1.0 : 0.25;

      ctx.save();
      ctx.globalAlpha = opacity;

      // Dimmed 상태일 때 grayscale 효과를 위한 색상 조정
      const goldColor = isHighlighted ? '#FFD700' : '#888877';
      const midColor = isHighlighted ? '#FFC125' : '#777766';
      const darkColor = isHighlighted ? '#B8860B' : '#555544';

      for (let i = 0; i < stackHeight; i++) {
        const y = canvasBaseY - (i * coinHeight);

        // 코인 레이어 (3D 효과)
        const grad = ctx.createLinearGradient(x - ellipseWidth, y - coinHeight, x + ellipseWidth, y);
        grad.addColorStop(0, goldColor);
        grad.addColorStop(0.5, midColor);
        grad.addColorStop(1, darkColor);

        ctx.beginPath();
        ctx.ellipse(x, y, ellipseWidth, ellipseHeight, 0, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // 하이라이트
        ctx.beginPath();
        ctx.ellipse(x, y - 1, ellipseWidth * 0.85, coinHeight, 0, 0, Math.PI);
        ctx.fillStyle = isHighlighted ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
      }

      ctx.restore();
    }

    // 코인 애니메이션 루프
    function animateCoins() {
      if (!coinCtx || !coinCanvas) return;

      coinCtx.clearRect(0, 0, coinCanvas.width, coinCanvas.height);

      // 쌓인 코인 스택 그리기 (4개 순위)
      for (let rank = 0; rank < 4; rank++) {
        if (stackCenterX[rank] && coinStacks[rank] > 0) {
          drawCoinStack(coinCtx, stackCenterX[rank], coinStacks[rank], rank);
        }
      }

      // 떨어지는 코인 업데이트 및 그리기
      for (let i = fallingCoins.length - 1; i >= 0; i--) {
        const coin = fallingCoins[i];

        // 물리 업데이트
        coin.vy += COIN_CONFIG.GRAVITY;
        coin.y += coin.vy;
        coin.x += coin.vx;
        coin.rotation += coin.rotationSpeed;

        // 착지 체크 - 현재 스택 높이 기준
        const landingY = canvasBaseY - (coinStacks[coin.rankIndex] * COIN_CONFIG.COIN_THICKNESS);

        if (coin.y >= landingY) {
          // 최대 스택 높이 체크 - 높이 제한에 도달하면 코인은 쌓이지 않고 사라짐
          if (coinStacks[coin.rankIndex] < COIN_CONFIG.MAX_STACK_COINS) {
            coinStacks[coin.rankIndex]++;
          }
          // 코인은 항상 제거 (최대 높이 도달 후에도 떨어지는 효과는 유지)
          fallingCoins.splice(i, 1);
        } else {
          // 코인 그리기 (1위 코인은 더 화려하게)
          drawCoin(coinCtx, coin.x, coin.y, coin.rotation, coin.isWinnerCoin);
        }
      }

      // 애니메이션 계속 조건
      coinAnimationId = requestAnimationFrame(animateCoins);
    }

    // 애니메이션 시작
    function startCoinAnimation() {
      if (!coinAnimationId) {
        isAnimating = true;
        animateCoins();
      }
    }

    // 애니메이션 정지
    function stopCoinAnimation() {
      if (coinAnimationId) {
        cancelAnimationFrame(coinAnimationId);
        coinAnimationId = null;
      }
      isAnimating = false;

      // 모든 활성 인터벌 정리
      activeDropIntervals.forEach(id => clearInterval(id));
      activeDropIntervals = [];
    }

    // 코인 드롭 함수 (rankIndex: 0=1위, 1=2위, 2=3위, 3=4위)
    function dropCoin(rankIndex) {
      const x = stackCenterX[rankIndex];
      if (!x) return;

      const coin = {
        id: Date.now() + Math.random(),
        x: x + (Math.random() - 0.5) * 30,
        y: -30,
        vy: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 1.5,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        rankIndex
      };

      fallingCoins.push(coin);

      // 코인이 떨어지기 시작하면 효과음 재생
      startCoinSound();
    }

    // 코인 효과음 시작
    function startCoinSound() {
      if (!coinSoundPlaying) {
        coinSoundPlaying = true;
        SoundManager.playSFX('coinStack');
      }
    }

    // 코인 효과음 정지
    function stopCoinSound() {
      if (coinSoundPlaying) {
        coinSoundPlaying = false;
        SoundManager.stopSFX('coinStack');
      }
    }

    // 특정 순위에 떨어지는 중인 코인 수 계산
    function getFallingCoinsCount(rankIndex) {
      return fallingCoins.filter(c => c.rankIndex === rankIndex).length;
    }

    // 특정 순위의 총 코인 수 (착지 + 떨어지는 중)
    function getTotalCoinsForRank(rankIndex) {
      return coinStacks[rankIndex] + getFallingCoinsCount(rankIndex);
    }

    // 목표 높이까지 코인 쌓기 (동일 높이 보장 - 점진적 조정)
    function stackCoinsToHeight(targetHeight, duration, rankIndices, callback) {
      console.log(`stackCoinsToHeight: targetHeight=${targetHeight}, ranks=${rankIndices}`);

      const coinsNeeded = Math.floor(targetHeight / COIN_CONFIG.COIN_THICKNESS);

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

      console.log(`Total coins to add: ${totalCoinsToAdd}, current stacks:`, coinStacks);

      if (totalCoinsToAdd === 0) {
        // 이미 목표에 도달한 경우 - 강제 조정 없이 콜백만 호출
        if (callback) setTimeout(callback, 100);
        return;
      }

      // 애니메이션 시작
      startCoinAnimation();

      const dropInterval = Math.max(30, duration / totalCoinsToAdd);
      let addedCount = 0;

      const intervalId = setInterval(() => {
        // 떨어지는 코인까지 포함한 총 코인 수로 체크
        const needMore = rankIndices.filter(rank => getTotalCoinsForRank(rank) < targetStacks[rank]);

        if (needMore.length === 0 || addedCount >= totalCoinsToAdd) {
          clearInterval(intervalId);
          const idx = activeDropIntervals.indexOf(intervalId);
          if (idx > -1) activeDropIntervals.splice(idx, 1);

          // 모든 떨어지는 코인이 착지할 때까지 대기 후 콜백
          waitForCoinsToLand(() => {
            if (callback) callback();
          });
          return;
        }

        // 떨어지는 코인까지 포함해서 가장 적은 스택에 드롭 (균등 분배)
        const minStack = Math.min(...needMore.map(r => getTotalCoinsForRank(r)));
        const lowestRanks = needMore.filter(r => getTotalCoinsForRank(r) === minStack);
        const rankIdx = lowestRanks[Math.floor(Math.random() * lowestRanks.length)];
        dropCoin(rankIdx);
        addedCount++;
      }, dropInterval);

      activeDropIntervals.push(intervalId);
    }

    // 모든 떨어지는 코인이 착지할 때까지 대기
    function waitForCoinsToLand(callback) {
      const checkInterval = setInterval(() => {
        if (fallingCoins.length === 0) {
          clearInterval(checkInterval);
          // 코인이 모두 착지하면 효과음 정지
          stopCoinSound();
          if (callback) callback();
        }
      }, 50);

      // 최대 2초 대기 후 강제 진행
      setTimeout(() => {
        clearInterval(checkInterval);
        stopCoinSound();
        if (callback) callback();
      }, 2000);
    }

    // 특정 팀만 추가 코인 쌓기
    function addCoinsToRank(rankIndex, additionalHeight, duration, callback) {
      const additionalCoins = Math.floor(additionalHeight / COIN_CONFIG.COIN_THICKNESS);
      const newTarget = coinStacks[rankIndex] + additionalCoins;
      targetStacks[rankIndex] = newTarget;

      console.log(`addCoinsToRank: rank=${rankIndex}, additionalCoins=${additionalCoins}, newTarget=${newTarget}`);

      if (additionalCoins <= 0) {
        if (callback) setTimeout(callback, 100);
        return;
      }

      startCoinAnimation();

      const dropInterval = Math.max(40, duration / additionalCoins);
      let addedCount = 0;

      const intervalId = setInterval(() => {
        if (coinStacks[rankIndex] >= targetStacks[rankIndex] || addedCount >= additionalCoins) {
          clearInterval(intervalId);
          const idx = activeDropIntervals.indexOf(intervalId);
          if (idx > -1) activeDropIntervals.splice(idx, 1);

          setTimeout(() => {
            if (callback) callback();
          }, 600);
          return;
        }

        dropCoin(rankIndex);
        addedCount++;
      }, dropInterval);

      activeDropIntervals.push(intervalId);
    }

    // 코인 스택 완전 초기화
    function resetCoinStacks() {
      stopCoinAnimation();
      fallingCoins = [];
      coinStacks = [0, 0, 0, 0];
      targetStacks = [0, 0, 0, 0];

      if (coinCtx && coinCanvas) {
        coinCtx.clearRect(0, 0, coinCanvas.width, coinCanvas.height);
      }
    }

    // ============ 결과 발표 ============
    function renderCoinStacks(teams) {
      rankedTeams = teams;
      const container = document.getElementById('rank-container');
      const displayOrder = [3, 2, 1, 0]; // 화면에 4위, 3위, 2위, 1위 순서로 표시

      // 코인 스택 초기화
      resetCoinStacks();

      container.innerHTML = displayOrder.map((rankIdx, displayIdx) => {
        const team = teams[rankIdx];
        const rankNum = rankIdx + 1;

        return `
          <div class="coin-stack-wrapper" id="stack-wrapper-${rankNum}">
            <div class="rank-info" id="rank-info-${rankNum}">
              <div class="rank-position">${rankNum}위</div>
              <div class="rank-team-name">${team.name}</div>
              <div class="rank-amount">${team.totalInvestment}억원</div>
            </div>
            <div class="coin-stack-area" id="stack-area-${rankNum}"
                 onclick="showFeedback(${team.id}, '${team.name}', ${team.totalInvestment})">
              <div class="stack-base"></div>
            </div>
          </div>
        `;
      }).join('');

      // 캔버스 초기화 (DOM 렌더링 완료 후)
      setTimeout(() => {
        initCoinCanvas();
      }, 100);
    }

    function handlePresentationStep(step, teams) {
      presentationStep = step;
      rankedTeams = teams;
      updateAdminUI();

      // 단계 변경 시 피드백 패널 숨기기
      hideFeedbackPanel();

      // 사운드는 각 단계의 결과가 표시될 때 재생 (아래 switch문 내에서 처리)

      const maxInvestment = Math.max(...teams.map(t => t.totalInvestment));

      console.log(`=== Step ${step} ===`);
      console.log('Teams:', teams.map(t => `${t.name}: ${t.totalInvestment}억`));

      switch(step) {
        case 1: // 오프닝 - 모든 코인 스택이 4위 높이까지 랜덤으로 쌓임
          showScreen('results-screen');
          renderCoinStacks(teams);
          startCoinRain();

          // 오프닝 사운드: 드럼롤
          SoundManager.playSFX('drumroll');

          // 쌓이는 중: 모두 하이라이트
          highlightedRanks = [0, 1, 2, 3];

          // 4위 높이 계산 (4위 = teams[3])
          const fourthHeight = (teams[3].totalInvestment / maxInvestment) * COIN_CONFIG.MAX_STACK_HEIGHT;
          console.log(`Step 1: 4위 높이 = ${fourthHeight}px`);

          // DOM 렌더링 완료 후 위치 업데이트 및 코인 쌓기 시작
          setTimeout(() => {
            updateStackPositions();
            // 모든 팀(0=1위, 1=2위, 2=3위, 3=4위)이 4위 높이까지 쌓기
            // 코인 효과음은 dropCoin에서 자동 재생
            stackCoinsToHeight(fourthHeight, 8000, [0, 1, 2, 3]);
          }, 300);
          break;

        case 2: // 4위 하이라이트 (모두 같은 높이에서 4위 공개)
          // 코인 쌓이는 소리 정지 (혹시 남아있을 경우)
          stopCoinSound();
          // 4위(index 3)만 하이라이트, 나머지 dimmed
          highlightedRanks = [3];
          highlightStack(4, teams);
          // 4위 공개 시 효과음 (즉시 재생)
          SoundManager.playSFX('coinDrop');
          SoundManager.playSFX('fanfareShort');
          break;

        case 3: // 3위 발표: 1,2,3위 코인이 랜덤으로 쌓이다가 3위 높이에서 같아짐
          // 쌓이는 중: 1,2,3위 하이라이트 (index 0,1,2)
          highlightedRanks = [0, 1, 2];
          animateToThirdPlace(teams);
          break;

        case 4: // 데드히트: 1,2위 코인이 랜덤으로 쌓이다가 2위 높이에서 같아짐
          // 쌓이는 중: 1,2위 하이라이트 (index 0,1)
          highlightedRanks = [0, 1];
          animateToDeadheat(teams);
          break;

        case 5: // 1위만 코인 상승 + 점수 공개
          // 1위만 하이라이트 (index 0)
          highlightedRanks = [0];
          revealFirstPlace(teams);
          break;

        case 6: // 1위 하이라이트
          // 1위만 하이라이트
          highlightedRanks = [0];
          highlightWinner(teams);
          break;

        case 7: // 최종 결과 화면
          showFinalResult(teams[0], teams[1]);
          break;
      }
    }

    // 특정 순위 하이라이트
    function highlightStack(rank, teams) {
      // 모든 스택 dimmed
      for (let i = 1; i <= 4; i++) {
        const area = document.getElementById(`stack-area-${i}`);
        if (area) {
          area.classList.remove('highlighted');
          area.classList.add('dimmed');
        }
      }

      // 해당 순위만 하이라이트
      const area = document.getElementById(`stack-area-${rank}`);
      const info = document.getElementById(`rank-info-${rank}`);

      if (area) {
        area.classList.remove('dimmed');
        area.classList.add('highlighted');
      }

      if (info) {
        setTimeout(() => {
          info.classList.add('visible', 'revealed');
        }, 1000);
      }
    }

    // 3위 발표 애니메이션
    function animateToThirdPlace(teams) {
      const maxInvestment = Math.max(...teams.map(t => t.totalInvestment));
      const thirdHeight = (teams[2].totalInvestment / maxInvestment) * COIN_CONFIG.MAX_STACK_HEIGHT;

      console.log(`Step 3: 3위 높이 = ${thirdHeight}px, 현재 스택:`, coinStacks);

      // 4위 dimmed
      const area4 = document.getElementById('stack-area-4');
      if (area4) {
        area4.classList.add('dimmed');
        area4.classList.remove('highlighted');
      }

      // 1,2,3위 하이라이트
      for (let i = 1; i <= 3; i++) {
        const area = document.getElementById(`stack-area-${i}`);
        if (area) {
          area.classList.remove('dimmed');
          area.classList.add('highlighted');
        }
      }

      // 코인을 3위 높이까지 쌓기 (1위=0, 2위=1, 3위=2)
      // 코인 효과음은 dropCoin에서 자동 재생, waitForCoinsToLand에서 자동 정지
      stackCoinsToHeight(thirdHeight, 5000, [0, 1, 2], () => {
        // 3위만 하이라이트 (Canvas용)
        highlightedRanks = [2];
        // 3위 하이라이트
        setTimeout(() => {
          highlightStack(3, teams);
          // 3위 공개 시 효과음 (결과 표시 시점)
          SoundManager.playSFX('coinDrop');
          setTimeout(() => SoundManager.playSFX('fanfareShort'), 500);
          // 4위 정보도 표시
          const info4 = document.getElementById('rank-info-4');
          if (info4) info4.classList.add('visible');
        }, 500);
      });
    }

    // 데드히트 애니메이션 (1,2위가 같은 높이까지)
    function animateToDeadheat(teams) {
      const maxInvestment = Math.max(...teams.map(t => t.totalInvestment));
      const secondHeight = (teams[1].totalInvestment / maxInvestment) * COIN_CONFIG.MAX_STACK_HEIGHT;

      console.log(`Step 4: 2위 높이 = ${secondHeight}px, 현재 스택:`, coinStacks);

      // 3,4위 dimmed
      for (let i = 3; i <= 4; i++) {
        const area = document.getElementById(`stack-area-${i}`);
        const info = document.getElementById(`rank-info-${i}`);
        if (area) {
          area.classList.add('dimmed');
          area.classList.remove('highlighted');
        }
        if (info) info.classList.add('visible');
      }

      // 1,2위 하이라이트
      for (let i = 1; i <= 2; i++) {
        const area = document.getElementById(`stack-area-${i}`);
        const info = document.getElementById(`rank-info-${i}`);
        if (area) {
          area.classList.remove('dimmed');
          area.classList.add('highlighted');
        }
        if (info) {
          info.classList.remove('visible', 'revealed');
        }
      }

      // 코인을 2위 높이까지 쌓기 (1위=0, 2위=1)
      // 코인 효과음은 dropCoin에서 자동 재생, waitForCoinsToLand에서 자동 정지
      stackCoinsToHeight(secondHeight, 5000, [0, 1], () => {
        // 데드히트 - 1,2위 모두 하이라이트 유지
        highlightedRanks = [0, 1];
        // 오버레이 표시
        setTimeout(() => {
          // 현재 동점 금액 (2위 기준)
          const tiedAmount = teams[1].totalInvestment;
          // 남은 투자금 = 1위 - 2위 (아직 공개되지 않은 차이)
          const remainingAmount = teams[0].totalInvestment - teams[1].totalInvestment;

          // 실제 동점인지 확인 (1위와 2위가 완전 동점)
          if (remainingAmount === 0) {
            // 박빙의 승부 - 검 부딪히는 소리 + 긴장감 효과음
            SoundManager.playSFX('swordClash');
            SoundManager.playSFX('tension');
            // 박빙의 승부 화면 표시
            document.getElementById('tiebreaker-amount').textContent = `${tiedAmount}억원`;
            document.getElementById('tiebreaker-team1').textContent = teams[0].name;
            document.getElementById('tiebreaker-team2').textContent = teams[1].name;
            document.getElementById('tiebreaker-overlay').style.display = 'flex';
          } else {
            // 일반 데드히트 - 심장박동 + 긴장감 효과음
            SoundManager.playSFX('heartbeat');
            SoundManager.playSFX('tension');
            // 일반 데드히트 화면 표시
            document.getElementById('deadheat-amount').textContent = `${tiedAmount}억원`;
            document.getElementById('deadheat-team1').textContent = teams[0].name;
            document.getElementById('deadheat-team2').textContent = teams[1].name;
            document.getElementById('deadheat-remaining').textContent = `남은 투자금: ${remainingAmount}억원`;
            document.getElementById('deadheat-overlay').style.display = 'flex';
          }
        }, 800);
      });
    }

    // 1위 점수 공개 (1위만 코인 추가) - 과장된 효과
    function revealFirstPlace(teams) {
      document.getElementById('deadheat-overlay').style.display = 'none';
      document.getElementById('tiebreaker-overlay').style.display = 'none';

      // 심장박동 효과음 정지
      SoundManager.stopSFX('heartbeat');

      // 1위 공개 효과음
      SoundManager.playSFX('reveal');

      const maxInvestment = Math.max(...teams.map(t => t.totalInvestment));
      const firstHeight = (teams[0].totalInvestment / maxInvestment) * COIN_CONFIG.MAX_STACK_HEIGHT;
      const secondHeight = (teams[1].totalInvestment / maxInvestment) * COIN_CONFIG.MAX_STACK_HEIGHT;

      // 1위가 추가해야 할 높이 (현재 2위 높이에서 1위 높이까지)
      const actualDiff = firstHeight - secondHeight;
      // 과장된 높이: 최소 80px, 실제 차이의 3배, 최대 200px
      const exaggeratedHeight = Math.max(80, Math.min(actualDiff * 3, 200));

      console.log(`Step 5: 1위 높이 = ${firstHeight}px, 실제 차이 = ${actualDiff}px, 과장된 높이 = ${exaggeratedHeight}px`);

      // 3,4위 정보 표시
      for (let i = 3; i <= 4; i++) {
        const info = document.getElementById(`rank-info-${i}`);
        if (info) info.classList.add('visible');
      }

      // 1위만 하이라이트 (Canvas용) - 2위는 dimmed
      highlightedRanks = [0];

      // 1위만 DOM 하이라이트, 2위는 dimmed
      const area1 = document.getElementById('stack-area-1');
      const area2 = document.getElementById('stack-area-2');
      if (area1) {
        area1.classList.remove('dimmed');
        area1.classList.add('highlighted', 'winner-highlight');
      }
      if (area2) {
        area2.classList.remove('highlighted');
        area2.classList.add('dimmed');
      }

      // 코인 떨어지는 소리
      setTimeout(() => SoundManager.playSFX('coinDrop'), 300);

      // 1위에 과장된 코인 효과 (더 많은 코인, 더 빠른 속도)
      addCoinsToRankExaggerated(0, exaggeratedHeight, 5000, () => {
        // 1위 공개 완료 시 팡파레 + 환호성
        SoundManager.playSFX('fanfareWin');
        SoundManager.playSFX('cheering');
        // 1위, 2위 정보 표시
        setTimeout(() => {
          const info1 = document.getElementById('rank-info-1');
          const info2 = document.getElementById('rank-info-2');
          if (info1) info1.classList.add('visible', 'revealed');
          if (info2) info2.classList.add('visible', 'revealed');
        }, 500);
      });
    }

    // 1위 전용 과장된 코인 추가 함수 - 많은 코인이 쏟아지는 효과
    function addCoinsToRankExaggerated(rankIndex, additionalHeight, duration, callback) {
      // 최소 15개의 코인은 항상 추가 (동점일 때도 효과 표시)
      const additionalCoins = Math.max(15, Math.floor(additionalHeight / COIN_CONFIG.COIN_THICKNESS));
      const newTarget = coinStacks[rankIndex] + additionalCoins;
      targetStacks[rankIndex] = newTarget;

      console.log(`addCoinsToRankExaggerated: rank=${rankIndex}, additionalCoins=${additionalCoins}, newTarget=${newTarget}`);

      const stackX = stackCenterX[rankIndex];
      if (!stackX) {
        console.warn(`Stack position not found for rank ${rankIndex}`);
        if (callback) callback();
        return;
      }

      // 코인 효과음 시작
      startCoinSound();

      // 코인 개수를 3배로 늘려서 더 많이 떨어뜨림
      const totalCoinsToAdd = Math.max(50, additionalCoins * 3);
      // 더 빠른 간격으로 코인 생성 (더 많은 코인이 동시에 떨어지는 효과)
      const interval = Math.max(20, duration / totalCoinsToAdd);
      let coinsAdded = 0;

      const coinInterval = setInterval(() => {
        if (coinsAdded >= totalCoinsToAdd) {
          clearInterval(coinInterval);
          // 콜백은 모든 코인이 착지한 후
          setTimeout(() => {
            // 코인 효과음 정지
            stopCoinSound();
            if (callback) callback();
          }, 1500);
          return;
        }

        // 더 넓은 범위에서 코인 생성 (더 화려한 효과)
        const spreadRange = 150;
        const x = stackX + (Math.random() - 0.5) * spreadRange;

        fallingCoins.push({
          x: x,
          y: -50 - Math.random() * 150,
          vy: 3 + Math.random() * 5, // 빠른 초기 속도
          vx: (Math.random() - 0.5) * 4,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.3,
          rankIndex: rankIndex,
          isWinnerCoin: false // 일반 코인과 동일한 크기
        });

        coinsAdded++;
      }, interval);
    }

    // 1위 하이라이트
    function highlightWinner(teams) {
      // 승리 BGM으로 전환
      SoundManager.playBGM('victory');

      // 1위만 하이라이트, 나머지 dimmed
      for (let i = 2; i <= 4; i++) {
        const area = document.getElementById(`stack-area-${i}`);
        if (area) {
          area.classList.remove('highlighted');
          area.classList.add('dimmed');
        }
      }

      const area1 = document.getElementById('stack-area-1');
      if (area1) {
        area1.classList.add('highlighted');
        area1.classList.remove('dimmed');
      }

      startCoinRain();
    }


    function showFinalResult(winner, second) {
      document.getElementById('deadheat-overlay').style.display = 'none';
      document.getElementById('tiebreaker-overlay').style.display = 'none';

      // 결과 화면 숨기기
      document.getElementById('results-screen').style.display = 'none';

      // 승리 BGM 및 환호성
      SoundManager.playBGM('victory');
      SoundManager.playSFX('cheering');

      // 최종 결과 화면 표시
      setTimeout(() => {
        document.getElementById('winner-name').textContent = winner.name;
        document.getElementById('winner-amount').textContent = `총 ${winner.totalInvestment}억원 투자 유치!`;
        document.getElementById('winner-diff').textContent = `2위와의 차이: ${winner.totalInvestment - second.totalInvestment}억원`;

        // 클릭하여 세션 종료 안내
        const investmentDetails = document.getElementById('winner-investment-details');
        investmentDetails.innerHTML = `
          <div style="text-align: center; margin-top: 30px; font-size: 1.2rem; color: #ffd700; cursor: pointer;">
            👆 클릭하여 세션 종료
          </div>
        `;

        const feedbackList = document.getElementById('winner-feedback-list');
        // 1위의 모든 피드백 표시 (가로 롤링을 위해 2배로 복제)
        const winnerFeedbacks = winner.feedbacks || [];
        const feedbackItems = winnerFeedbacks.length > 0 ? winnerFeedbacks.map(fb => `
          <div class="winner-feedback-item">
            <div class="feedback-author">${fb.evaluator}</div>
            <div class="feedback-content">${fb.content}</div>
          </div>
        `).join('') : '<div class="winner-feedback-item">피드백이 없습니다.</div>';
        // 무한 롤링을 위해 콘텐츠 2배 복제
        feedbackList.innerHTML = feedbackItems + feedbackItems;

        document.getElementById('final-result').style.display = 'flex';
        startCoinRain();
      }, 500);
    }

    let currentFeedbackTeamId = null;

    function showFeedback(teamId, teamName, amount) {
      const feedbackOverlay = document.getElementById('feedback-overlay');
      const feedbackPanel = document.getElementById('feedback-panel');

      // 같은 막대를 다시 클릭하면 패널 닫기
      if (currentFeedbackTeamId === teamId && feedbackOverlay.classList.contains('show')) {
        hideFeedbackPanel();
        return;
      }

      const team = currentState.teams.find(t => t.id === teamId);
      if (!team || !team.feedbacks || !team.feedbacks.length) {
        showToast('피드백이 없습니다');
        return;
      }

      currentFeedbackTeamId = teamId;
      document.getElementById('popup-team-name').textContent = teamName;
      document.getElementById('popup-amount').textContent = `총 투자 유치: ${amount}억원`;
      document.getElementById('feedback-list').innerHTML = team.feedbacks.map(fb => `
        <div class="feedback-item">
          <div class="feedback-author">${fb.evaluator}</div>
          <div class="feedback-content">${fb.content}</div>
        </div>
      `).join('');
      feedbackOverlay.classList.add('show');
      feedbackPanel.classList.add('show');
    }

    function hideFeedbackPanel(event) {
      document.getElementById('feedback-overlay').classList.remove('show');
      document.getElementById('feedback-panel').classList.remove('show');
      currentFeedbackTeamId = null;
    }

    // 마지막 축하 페이지 표시
    function showClosingScreen() {
      document.getElementById('final-result').style.display = 'none';
      document.getElementById('closing-screen').classList.add('show');
      startCoinRain();

      // 클로징 BGM으로 전환
      SoundManager.playBGM('closing');

      // 축하 환호 효과음 4초 재생
      const celebrateSound = SoundManager.playSFX('battleCrowd');
      if (celebrateSound) {
        setTimeout(() => {
          celebrateSound.stop();
        }, 4000);
      }
    }

    // ============ Socket 이벤트 ============
    socket.emit('display:join');

    socket.on('state:update', (state) => {
      const prevPhase = currentState?.phase;
      currentState = state;

      document.getElementById('connected-count').textContent = state.connectedCount;
      document.getElementById('eval-count').textContent = state.evaluatedCount;
      document.getElementById('total-evaluators').textContent = state.totalEvaluators;

      const progress = (state.evaluatedCount / state.totalEvaluators) * 100;
      document.getElementById('progress-bar').style.width = progress + '%';

      // 발표 순서 업데이트
      if (state.presentationOrder) {
        currentPresentationOrder = state.presentationOrder;
        updateOrderDisplay();
      }

      renderTeams(state.teams);
      updateAdminUI();

      // Phase별 BGM 재생 (phase가 변경될 때만)
      if (prevPhase !== state.phase) {
        handlePhaseSound(state.phase);
      }

      if (state.phase === 'waiting') {
        showScreen('waiting-screen');
      } else if (state.phase === 'evaluating') {
        showScreen('evaluation-screen');
        renderEvaluationTeams(state.teams);
      } else if (state.phase === 'results') {
        showScreen('evaluation-screen');
      } else if (state.phase === 'presenting') {
        showScreen('results-screen');
      }
    });

    // Phase별 BGM 처리
    function handlePhaseSound(phase) {
      switch (phase) {
        case 'waiting':
          SoundManager.playBGM('waiting');
          // BGM 상태 저장
          sessionStorage.setItem('bgm_playing', 'true');
          sessionStorage.setItem('bgm_type', 'waiting');
          break;
        case 'evaluating':
          SoundManager.playBGM('evaluating');
          sessionStorage.setItem('bgm_playing', 'true');
          sessionStorage.setItem('bgm_type', 'evaluating');
          break;
        case 'results':
          // 집계 완료 시 짧은 효과음 (BGM 유지)
          SoundManager.playSFX('notification');
          break;
        case 'presenting':
          // 결과 발표 시작 시 waiting BGM 정지하고 presenting BGM으로 전환
          SoundManager.playBGM('presenting');
          sessionStorage.setItem('bgm_playing', 'true');
          sessionStorage.setItem('bgm_type', 'presenting');
          break;
      }
    }

    socket.on('evaluator:connected', ({ name, count }) => {
      showToast(`✅ ${name}님 접속 완료!`);
      SoundManager.playSFX('notification');
      const list = document.getElementById('connection-list');
      list.innerHTML += `<span class="connection-item">${name}</span>`;
    });

    socket.on('evaluator:reconnected', ({ name }) => {
      showToast(`🔄 ${name}님 재접속!`);
    });

    socket.on('evaluation:completed', ({ name, evaluatedCount, totalEvaluators }) => {
      showToast(`📝 ${name}님 평가 완료! (${evaluatedCount}/${totalEvaluators})`);
      SoundManager.playSFX('submitComplete');
      const remaining = totalEvaluators - evaluatedCount;
      document.getElementById('progress-detail').textContent =
        remaining > 0 ? `${remaining}명 평가 중...` : '모든 평가 완료!';
    });

    socket.on('evaluation:allComplete', () => {
      document.getElementById('progress-detail').textContent = '🎉 모든 평가가 완료되었습니다!';
      document.getElementById('start-presentation-btn').classList.add('show');
      showToast('모든 평가 완료! 결과 발표를 시작하세요');
      SoundManager.playSFX('fanfareShort');
    });

    socket.on('presentation:step', ({ step, rankedTeams: teams }) => {
      handlePresentationStep(step, teams);
    });

    socket.on('system:reset', () => {
      location.reload();
    });

    // ============ 키보드 단축키 ============
    document.addEventListener('keydown', (e) => {
      if (currentState?.phase === 'presenting') {
        if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault();
          nextStep();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prevStep();
        }
      }
    });

    // ============ 초기화 ============
    createParticles();
    generateQR();

    // 사운드 UI 초기화 및 대기 BGM 시작
    setTimeout(() => {
      initVolumeUI();
    }, 500);

    // 브라우저 자동재생 정책 대응: 사용자 인터랙션 감지 후 BGM 활성화
    let audioUnlocked = false;
    function unlockAudio() {
      if (audioUnlocked) return;
      audioUnlocked = true;

      // Howler unlock
      if (typeof Howler !== 'undefined') {
        Howler.ctx?.resume();
      }

      // 현재 phase에 맞는 BGM 시작 (playBGM 내부에서 같은 BGM 재생 중이면 무시됨)
      if (currentState?.phase) {
        handlePhaseSound(currentState.phase);
      }

      console.log('[Audio] Unlocked by user interaction');
    }

    // 다양한 인터랙션 이벤트로 오디오 잠금 해제
    ['click', 'touchstart', 'keydown'].forEach(event => {
      document.addEventListener(event, unlockAudio, { once: true });
    });
