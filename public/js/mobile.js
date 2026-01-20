    // ============ 상태 관리 ============
    const socket = io({
      transports: ['polling', 'websocket'],  // 폴링 우선, 웹소켓 업그레이드 (Vercel 호환)
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    let sessionId = localStorage.getItem('kt_eval_session');
    let evaluatorName = localStorage.getItem('kt_eval_name');
    let currentState = null;
    let evaluations = {};
    let isSubmitted = false;

    // ============ 화면 전환 ============
    function showScreen(screenId) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('waiting-screen').style.display = 'none';
      document.getElementById('evaluation-screen').style.display = 'none';
      document.getElementById('complete-screen').style.display = 'none';

      if (screenId) {
        document.getElementById(screenId).style.display = 'block';
      }
    }

    function showError(message) {
      const el = document.getElementById('error-message');
      el.textContent = message;
      el.style.display = 'block';
      setTimeout(() => el.style.display = 'none', 5000);
    }

    // ============ 로그인 ============
    function joinEvaluation() {
      const nameInput = document.getElementById('evaluator-name');
      const name = nameInput.value.trim();

      if (!name) {
        showError('성함을 입력해주세요');
        return;
      }

      const btn = document.getElementById('join-btn');
      btn.innerHTML = '<span class="loading"></span>접속 중...';
      btn.disabled = true;

      evaluatorName = name;
      localStorage.setItem('kt_eval_name', name);

      socket.emit('evaluator:join', { sessionId, name });
    }

    // ============ 팀 카드 렌더링 ============
    function renderTeamCards(teams) {
      const container = document.getElementById('teams-container');

      // 발표 순서에 따라 팀 정렬
      let orderedTeams = teams;
      if (currentState && currentState.presentationOrder) {
        orderedTeams = currentState.presentationOrder.map(id => teams.find(t => t.id === id)).filter(t => t);
      }

      container.innerHTML = orderedTeams.map(team => {
        const savedEval = evaluations[team.id] || { investment: 0, feedback: '' };
        const feedbackLen = savedEval.feedback.length;
        const counterClass = feedbackLen >= 10 ? 'ok' : 'error';
        return `
          <div class="team-evaluation" id="team-${team.id}">
            <div class="team-header">
              <span class="team-number">${team.name}</span>
              <span class="team-topic">${team.topic}</span>
            </div>

            <div class="investment-section">
              <div class="investment-label">
                <span>투자 금액</span>
                <span class="investment-value" id="value-${team.id}">${savedEval.investment}억원</span>
              </div>
              <input type="range" class="investment-slider" id="slider-${team.id}"
                     min="0" max="10" step="1" value="${savedEval.investment}"
                     oninput="updateInvestment(${team.id}, this.value)">
            </div>

            <div class="feedback-section">
              <div class="feedback-label">💬 한줄 피드백 (필수, 10자 이상)</div>
              <textarea class="feedback-input ${feedbackLen < 10 && feedbackLen > 0 ? 'error' : ''}" id="feedback-${team.id}"
                        placeholder="이 팀에 대한 의견을 10자 이상 남겨주세요"
                        oninput="updateFeedback(${team.id}, this.value)">${savedEval.feedback}</textarea>
              <div class="feedback-counter ${counterClass}" id="feedback-counter-${team.id}">${feedbackLen}/10자</div>
            </div>
          </div>
        `;
      }).join('');

      updateTotalAmount();
    }

    // ============ 투자금 업데이트 ============
    function updateInvestment(teamId, value) {
      if (isSubmitted) return;  // 제출 완료 시 차단
      value = parseInt(value);
      evaluations[teamId] = evaluations[teamId] || { investment: 0, feedback: '' };
      evaluations[teamId].investment = value;

      document.getElementById(`value-${teamId}`).textContent = value + '억원';
      document.getElementById(`slider-${teamId}`).value = value;

      // 버튼 활성화 상태 업데이트
      document.querySelectorAll(`#team-${teamId} .investment-btn`).forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.textContent) === value) {
          btn.classList.add('active');
        }
      });

      updateTotalAmount();
      saveToLocalStorage();
    }

    function setInvestment(teamId, value) {
      updateInvestment(teamId, value);
    }

    function updateFeedback(teamId, value) {
      if (isSubmitted) return;  // 제출 완료 시 차단
      evaluations[teamId] = evaluations[teamId] || { investment: 0, feedback: '' };
      evaluations[teamId].feedback = value;

      // 글자 수 카운터 업데이트
      const counter = document.getElementById(`feedback-counter-${teamId}`);
      const textarea = document.getElementById(`feedback-${teamId}`);
      const len = value.length;

      counter.textContent = `${len}/10자`;
      counter.className = 'feedback-counter ' + (len >= 10 ? 'ok' : 'error');
      textarea.className = 'feedback-input ' + (len > 0 && len < 10 ? 'error' : '');

      saveToLocalStorage();
    }

    function updateTotalAmount() {
      const total = Object.values(evaluations).reduce((sum, e) => sum + (e.investment || 0), 0);
      document.getElementById('total-amount').textContent = total;

      // 예산 상태 표시
      const box = document.getElementById('total-investment-box');
      const statusEl = document.getElementById('budget-status');

      box.classList.remove('budget-ok', 'budget-over');
      statusEl.className = 'budget-status';

      if (total === 10) {
        box.classList.add('budget-ok');
        statusEl.className = 'budget-status ok';
        statusEl.textContent = '✅ 예산 배분 완료!';
      } else if (total > 10) {
        box.classList.add('budget-over');
        statusEl.className = 'budget-status over';
        statusEl.textContent = `❌ 예산 초과! (${total - 10}억원 초과)`;
      } else {
        statusEl.className = 'budget-status under';
        statusEl.textContent = `💡 ${10 - total}억원 더 배분하세요`;
      }

      // 진행 상황 표시
      const filledCount = Object.values(evaluations).filter(e => e.investment > 0).length;
      const progress = (filledCount / 4) * 100;
      document.getElementById('eval-progress-fill').style.width = progress + '%';
    }

    // ============ 에러 팝업 ============
    function showErrorPopup(title, message, icon = '⚠️') {
      document.getElementById('error-popup-icon').textContent = icon;
      document.getElementById('error-popup-title').textContent = title;
      document.getElementById('error-popup-message').innerHTML = message;
      document.getElementById('error-popup-overlay').style.display = 'flex';
    }

    function closeErrorPopup(event) {
      if (event && event.target !== event.currentTarget) return;
      document.getElementById('error-popup-overlay').style.display = 'none';
    }

    // ============ 제출 ============
    function submitEvaluation() {
      // 유효성 검사
      const total = Object.values(evaluations).reduce((sum, e) => sum + (e.investment || 0), 0);

      // 1. 예산이 정확히 10억인지 확인
      if (total !== 10) {
        if (total > 10) {
          showErrorPopup(
            '예산 초과',
            `총 투자 금액이 <strong style="color:#ff5757">${total}억원</strong>입니다.<br>정확히 <strong>10억원</strong>을 배분해주세요.<br><br><small>${total - 10}억원을 줄여주세요.</small>`,
            '💸'
          );
        } else {
          showErrorPopup(
            '잔여 예산 발생',
            `총 투자 금액이 <strong style="color:#ffd700">${total}억원</strong>입니다.<br>정확히 <strong>10억원</strong>을 배분해주세요.<br><br><small>${10 - total}억원을 더 배분해주세요.</small>`,
            '💰'
          );
        }
        return;
      }

      // 2. 모든 팀에 피드백이 10자 이상인지 확인
      const missingFeedbacks = [];
      currentState.teams.forEach(team => {
        const feedback = evaluations[team.id]?.feedback || '';
        if (feedback.length < 10) {
          missingFeedbacks.push({
            name: team.name,
            length: feedback.length
          });
        }
      });

      if (missingFeedbacks.length > 0) {
        const feedbackList = missingFeedbacks.map(t =>
          `<strong>${t.name}</strong>: ${t.length}자 (${10 - t.length}자 부족)`
        ).join('<br>');

        showErrorPopup(
          '피드백 부족',
          `모든 팀에 10자 이상의 피드백을 작성해주세요.<br><br>${feedbackList}`,
          '✏️'
        );
        return;
      }

      // 제출 데이터 생성
      const submitData = currentState.teams.map(team => ({
        teamId: team.id,
        investment: evaluations[team.id]?.investment || 0,
        feedback: evaluations[team.id]?.feedback || ''
      }));

      const btn = document.getElementById('submit-btn');
      btn.innerHTML = '<span class="loading"></span>제출 중...';
      btn.disabled = true;

      // 제출 타임아웃 처리 (10초)
      const submitTimeout = setTimeout(() => {
        if (!isSubmitted) {
          btn.innerHTML = '평가 제출하기';
          btn.disabled = false;
          showErrorPopup(
            '제출 시간 초과',
            '서버 응답이 없습니다. 다시 시도해주세요.',
            '⏱️'
          );
        }
      }, 10000);

      // 타임아웃 ID를 저장하여 성공 시 취소
      window._submitTimeout = submitTimeout;

      socket.emit('evaluator:submit', { sessionId, evaluations: submitData });
    }

    // ============ 로컬 스토리지 ============
    let saveTimeout = null;
    function saveToLocalStorage() {
      // Debounce: 300ms 내 연속 호출 시 마지막만 실행
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        localStorage.setItem('kt_eval_data', JSON.stringify(evaluations));
      }, 300);
    }

    function loadFromLocalStorage() {
      const saved = localStorage.getItem('kt_eval_data');
      if (saved) {
        evaluations = JSON.parse(saved);
      }
    }

    // ============ Socket 이벤트 ============
    socket.on('evaluator:joined', ({ sessionId: newSessionId, state }) => {
      sessionId = newSessionId;
      localStorage.setItem('kt_eval_session', sessionId);
      currentState = state;

      document.getElementById('display-name').textContent = evaluatorName;

      if (state.phase === 'waiting') {
        showScreen('waiting-screen');
      } else if (state.phase === 'evaluating') {
        showScreen('evaluation-screen');
        renderTeamCards(state.teams);
      }
    });

    socket.on('evaluator:restored', ({ sessionId: restoredId, evaluator, state }) => {
      sessionId = restoredId;
      evaluatorName = evaluator.name;
      currentState = state;

      document.getElementById('display-name').textContent = evaluatorName;

      if (evaluator.evaluated) {
        isSubmitted = true;
        showCompleteSummary(evaluator.evaluations);
        showScreen('complete-screen');
      } else if (state.phase === 'waiting') {
        showScreen('waiting-screen');
      } else if (state.phase === 'evaluating' || state.phase === 'results') {
        loadFromLocalStorage();
        showScreen('evaluation-screen');
        renderTeamCards(state.teams);
      }
    });

    socket.on('evaluation:started', () => {
      if (currentState) {
        showScreen('evaluation-screen');
        renderTeamCards(currentState.teams);
      }
    });

    socket.on('state:update', (state) => {
      const prevPhase = currentState?.phase;
      currentState = state;

      // phase 변경 감지하여 화면 전환 (evaluation:started 이벤트 미수신 대비)
      if (prevPhase === 'waiting' && state.phase === 'evaluating' && !isSubmitted) {
        showScreen('evaluation-screen');
        renderTeamCards(state.teams);
      }
    });

    socket.on('evaluator:submitted', ({ success }) => {
      // 타임아웃 취소
      if (window._submitTimeout) {
        clearTimeout(window._submitTimeout);
        window._submitTimeout = null;
      }

      if (success) {
        isSubmitted = true;
        const savedData = currentState.teams.map(team => ({
          teamId: team.id,
          teamName: team.name,
          investment: evaluations[team.id]?.investment || 0
        }));
        disableEvaluationInputs();
        showCompleteSummary(savedData);
        showScreen('complete-screen');
        localStorage.removeItem('kt_eval_data');
      } else {
        // 제출 실패 시 버튼 복구
        const btn = document.getElementById('submit-btn');
        btn.innerHTML = '평가 제출하기';
        btn.disabled = false;
        showErrorPopup(
          '제출 실패',
          '제출에 실패했습니다. 다시 시도해주세요.',
          '❌'
        );
      }
    });

    socket.on('system:reset', () => {
      localStorage.removeItem('kt_eval_session');
      localStorage.removeItem('kt_eval_name');
      localStorage.removeItem('kt_eval_data');
      location.reload();
    });

    // ============ 완료 요약 표시 ============
    function showCompleteSummary(data) {
      const list = document.getElementById('summary-list');
      if (Array.isArray(data)) {
        list.innerHTML = data.map(item => {
          const team = currentState?.teams?.find(t => t.id === item.teamId);
          const teamName = team?.name || item.teamName || `팀 ${item.teamId}`;
          const teamTopic = team?.topic || '';
          return `
            <div class="summary-item">
              <span class="summary-team">${teamName}${teamTopic ? ` - ${teamTopic}` : ''}</span>
              <span class="summary-amount">${item.investment}억원</span>
            </div>
          `;
        }).join('');
      }
    }

    // ============ 로그아웃 ============
    function logout() {
      localStorage.removeItem('kt_eval_session');
      localStorage.removeItem('kt_eval_name');
      localStorage.removeItem('kt_eval_data');
      sessionId = null;
      evaluatorName = null;
      showScreen('login-screen');
      document.getElementById('evaluator-name').value = '';
      document.getElementById('join-btn').innerHTML = '평가 참여하기';
      document.getElementById('join-btn').disabled = false;
    }

    // ============ 제출 후 스크롤/입력 비활성화 ============
    function disableEvaluationInputs() {
      document.querySelectorAll('.team-evaluation').forEach(el => {
        el.classList.add('disabled');
      });
      document.querySelectorAll('.investment-slider').forEach(el => {
        el.disabled = true;
      });
      document.querySelectorAll('.feedback-input').forEach(el => {
        el.disabled = true;
      });
    }

    // ============ 초기화 ============
    loadFromLocalStorage();

    // 저장된 세션이 있으면 자동 재접속
    if (sessionId && evaluatorName) {
      socket.emit('evaluator:join', { sessionId, name: evaluatorName });
    }

    // Enter 키로 로그인
    document.getElementById('evaluator-name').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') joinEvaluation();
    });
