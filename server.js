require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { connectDB, getEvents, getEventById, deleteEvent, saveCurrentSession } = require('./db/models');
const appConfig = require('./config/app-config.json');

const app = express();
const server = http.createServer(app);

// CORS 설정: 환경에 따라 허용 origin 결정
const corsOrigins = process.env.NODE_ENV === 'production'
  ? appConfig.server.corsOrigins
  : '*';

const io = new Server(server, {
  cors: { origin: corsOrigins }
});

app.use(express.json());

// ============ 라우트 (static보다 먼저 선언) ============
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.get('/main', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/coin_test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'coin_test.html'));
});

app.get('/history', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-history.html'));
});

// static 파일은 라우트 이후에 처리
app.use(express.static('public'));

// ============ 앱 상태 관리 ============
// config에서 팀 정보 로드
const initialTeams = appConfig.teams.map(team => ({
  id: team.id,
  name: team.name,
  topic: team.topic,
  totalInvestment: 0,
  feedbacks: []
}));

const state = {
  phase: 'waiting', // waiting, evaluating, results, presenting
  presentationStep: 0, // 0: 대기, 1: 오프닝, 2: 4위, 3: 3위, 4: 1/2위 데드히트, 5: 최종
  teams: initialTeams,
  presentationOrder: appConfig.presentation.order,
  evaluators: new Map(), // sessionId -> { name, connected, evaluated, evaluations }
  totalEvaluators: 0,  // 평가 시작 시 connectedCount로 설정됨
  connectedCount: 0,
  evaluatedCount: 0
};

// ============ 세션 관리 ============
const sessions = new Map(); // sessionId -> socketId
const socketToSession = new Map(); // socketId -> sessionId

// API: 현재 상태 조회
app.get('/api/state', (req, res) => {
  res.json(getPublicState());
});

// API: 세션 복구
app.get('/api/session/:sessionId', (req, res) => {
  const evaluator = state.evaluators.get(req.params.sessionId);
  if (evaluator) {
    res.json({ success: true, evaluator });
  } else {
    res.json({ success: false });
  }
});

// API: 이벤트 이력 조회
app.get('/api/events', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;
    const events = await getEvents({}, { limit, skip });
    res.json({ success: true, events });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// API: 단일 이벤트 조회
app.get('/api/events/:eventId', async (req, res) => {
  try {
    const event = await getEventById(req.params.eventId);
    if (event) {
      res.json({ success: true, event });
    } else {
      res.json({ success: false, error: 'Event not found' });
    }
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// API: 이벤트 삭제
app.delete('/api/events/:eventId', async (req, res) => {
  try {
    const result = await deleteEvent(req.params.eventId);
    res.json({ success: result });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// API: 현재 세션 저장
app.post('/api/events/save', async (req, res) => {
  try {
    const { name } = req.body;
    const event = await saveCurrentSession(state, name);
    if (event) {
      res.json({ success: true, eventId: event._id });
    } else {
      res.json({ success: false, error: 'No data to save or DB not connected' });
    }
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ============ 유틸 함수 ============
function getPublicState() {
  return {
    phase: state.phase,
    presentationStep: state.presentationStep,
    teams: state.teams,
    presentationOrder: state.presentationOrder,
    connectedCount: state.connectedCount,
    evaluatedCount: state.evaluatedCount,
    totalEvaluators: state.totalEvaluators
  };
}

function getRankedTeams() {
  return [...state.teams].sort((a, b) => b.totalInvestment - a.totalInvestment);
}

function broadcastState() {
  io.emit('state:update', getPublicState());
}

// ============ Socket.IO 이벤트 ============
io.on('connection', (socket) => {
  console.log(`[연결] ${socket.id}`);

  // 메인 디스플레이 연결
  socket.on('display:join', () => {
    socket.join('display');
    socket.emit('state:update', getPublicState());
    console.log('[메인 디스플레이 연결]');
  });

  // 관리자 연결
  socket.on('admin:join', () => {
    socket.join('admin');
    socket.emit('state:update', getPublicState());
    socket.emit('admin:evaluators', Array.from(state.evaluators.values()));
    console.log('[관리자 연결]');
  });

  // 평가자 접속 (세션 복구 지원)
  socket.on('evaluator:join', ({ sessionId, name }) => {
    let evalSessionId = sessionId;
    let isReconnect = false;

    // 기존 세션 복구
    if (evalSessionId && state.evaluators.has(evalSessionId)) {
      isReconnect = true;
      const evaluator = state.evaluators.get(evalSessionId);
      evaluator.connected = true;
      sessions.set(evalSessionId, socket.id);
      socketToSession.set(socket.id, evalSessionId);
      socket.join('evaluators');

      socket.emit('evaluator:restored', {
        sessionId: evalSessionId,
        evaluator,
        state: getPublicState()
      });

      io.to('display').emit('evaluator:reconnected', { name: evaluator.name });
      console.log(`[평가자 재접속] ${evaluator.name}`);
    } else {
      // 새 세션 생성
      evalSessionId = uuidv4();
      const evaluator = {
        sessionId: evalSessionId,
        name,
        connected: true,
        evaluated: false,
        evaluations: null
      };

      state.evaluators.set(evalSessionId, evaluator);
      state.connectedCount++;
      // 대기 중에는 totalEvaluators를 connectedCount와 동기화
      if (state.phase === 'waiting') {
        state.totalEvaluators = state.connectedCount;
      }
      sessions.set(evalSessionId, socket.id);
      socketToSession.set(socket.id, evalSessionId);
      socket.join('evaluators');

      socket.emit('evaluator:joined', {
        sessionId: evalSessionId,
        state: getPublicState()
      });

      io.to('display').emit('evaluator:connected', { name, count: state.connectedCount });
      io.to('admin').emit('admin:evaluators', Array.from(state.evaluators.values()));
      console.log(`[평가자 접속] ${name} (${state.connectedCount}/${state.totalEvaluators})`);
    }

    broadcastState();
  });

  // 평가 제출
  socket.on('evaluator:submit', ({ sessionId, evaluations }) => {
    const evaluator = state.evaluators.get(sessionId);
    if (!evaluator || evaluator.evaluated) return;

    evaluator.evaluated = true;
    evaluator.evaluations = evaluations;
    state.evaluatedCount++;

    // 투자금 및 피드백 집계
    evaluations.forEach(({ teamId, investment, feedback }) => {
      const team = state.teams.find(t => t.id === teamId);
      if (team) {
        team.totalInvestment += investment;
        if (feedback && feedback.trim()) {
          team.feedbacks.push({
            evaluator: evaluator.name,
            content: feedback
          });
        }
      }
    });

    socket.emit('evaluator:submitted', { success: true });
    io.to('display').emit('evaluation:completed', {
      name: evaluator.name,
      evaluatedCount: state.evaluatedCount,
      totalEvaluators: state.totalEvaluators
    });
    io.to('admin').emit('admin:evaluators', Array.from(state.evaluators.values()));

    // 모든 평가 완료 체크
    if (state.evaluatedCount >= state.totalEvaluators) {
      state.phase = 'results';
      io.to('display').emit('evaluation:allComplete');
      io.to('admin').emit('evaluation:allComplete');
    }

    broadcastState();
    console.log(`[평가 제출] ${evaluator.name} (${state.evaluatedCount}/${state.totalEvaluators})`);
  });

  // 관리자: 평가 시작
  socket.on('admin:startEvaluation', () => {
    state.phase = 'evaluating';
    // 평가 시작 시 totalEvaluators를 현재 접속자 수로 설정
    state.totalEvaluators = state.connectedCount;
    broadcastState();
    io.to('evaluators').emit('evaluation:started');
    console.log(`[관리자] 평가 시작 (평가자 수: ${state.totalEvaluators}명)`);
  });

  // 관리자: 평가자 수 설정
  socket.on('admin:setEvaluatorCount', (count) => {
    state.totalEvaluators = count;
    broadcastState();
    console.log(`[관리자] 평가자 수 설정: ${count}`);
  });

  // 관리자: 강제 마감
  socket.on('admin:forceClose', () => {
    state.phase = 'results';
    io.to('display').emit('evaluation:allComplete');
    io.to('admin').emit('evaluation:allComplete');
    broadcastState();
    console.log('[관리자] 강제 마감');
  });

  // 관리자: 결과 발표 시작
  socket.on('admin:startPresentation', () => {
    state.phase = 'presenting';
    state.presentationStep = 1; // 오프닝
    broadcastState();
    io.to('display').emit('presentation:step', {
      step: 1,
      rankedTeams: getRankedTeams()
    });
    console.log('[관리자] 발표 시작 - 오프닝');
  });

  // 관리자: 다음 발표 단계
  socket.on('admin:nextStep', () => {
    if (state.presentationStep < 7) {
      state.presentationStep++;
      const rankedTeams = getRankedTeams();

      io.to('display').emit('presentation:step', {
        step: state.presentationStep,
        rankedTeams
      });
      broadcastState();
      console.log(`[관리자] 발표 단계: ${state.presentationStep}`);
    }
  });

  // 관리자: 이전 발표 단계
  socket.on('admin:prevStep', () => {
    if (state.presentationStep > 1) {
      state.presentationStep--;
      const rankedTeams = getRankedTeams();

      io.to('display').emit('presentation:step', {
        step: state.presentationStep,
        rankedTeams
      });
      broadcastState();
      console.log(`[관리자] 발표 단계 (이전): ${state.presentationStep}`);
    }
  });

  // 관리자: 조 정보 수정
  socket.on('admin:updateTeam', ({ teamId, name, topic }) => {
    const team = state.teams.find(t => t.id === teamId);
    if (team) {
      if (name) team.name = name;
      if (topic) team.topic = topic;
      broadcastState();
      console.log(`[관리자] 조 정보 수정: ${teamId}`);
    }
  });

  // 관리자: 발표 순서 수정
  socket.on('admin:updatePresentationOrder', (order) => {
    if (Array.isArray(order) && order.length === 4) {
      state.presentationOrder = order;
      broadcastState();
      console.log(`[관리자] 발표 순서 수정: ${order.join(' -> ')}`);
    }
  });

  // 관리자: 리셋
  socket.on('admin:reset', () => {
    state.phase = 'waiting';
    state.presentationStep = 0;
    state.teams.forEach(team => {
      team.totalInvestment = 0;
      team.feedbacks = [];
    });
    state.evaluators.clear();
    state.connectedCount = 0;
    state.evaluatedCount = 0;
    sessions.clear();
    socketToSession.clear();

    broadcastState();
    io.emit('system:reset');
    console.log('[관리자] 시스템 리셋');
  });

  // 데모: 평가자 추가
  socket.on('demo:addEvaluator', ({ name }) => {
    const evalSessionId = uuidv4();
    const evaluator = {
      sessionId: evalSessionId,
      name,
      connected: true,
      evaluated: false,
      evaluations: null
    };

    state.evaluators.set(evalSessionId, evaluator);
    state.connectedCount++;
    // 대기 중에는 totalEvaluators를 connectedCount와 동기화
    if (state.phase === 'waiting') {
      state.totalEvaluators = state.connectedCount;
    }

    io.to('display').emit('evaluator:connected', { name, count: state.connectedCount });
    broadcastState();
    console.log(`[데모] 평가자 추가: ${name}`);
  });

  // 데모: 평가 추가
  socket.on('demo:addEvaluation', () => {
    // 아직 평가하지 않은 평가자 찾기
    let evaluator = null;
    for (const [sessionId, eval] of state.evaluators) {
      if (!eval.evaluated) {
        evaluator = eval;
        break;
      }
    }

    if (!evaluator) {
      console.log('[데모] 평가할 평가자가 없습니다');
      return;
    }

    evaluator.evaluated = true;
    state.evaluatedCount++;

    // 랜덤 투자금 생성
    const feedbacks = [
      '혁신적인 아이디어입니다!',
      '시장성이 높아 보입니다.',
      '기술적 완성도가 뛰어납니다.',
      '비즈니스 모델이 명확합니다.',
      '팀워크가 인상적이었습니다.',
      '실현 가능성이 높습니다.',
      '고객 가치 제안이 좋습니다.'
    ];

    state.teams.forEach(team => {
      const investment = Math.floor(Math.random() * 11); // 0~10억
      team.totalInvestment += investment;

      // 데모에서는 항상 피드백 추가
      team.feedbacks.push({
        evaluator: evaluator.name,
        content: feedbacks[Math.floor(Math.random() * feedbacks.length)]
      });
    });

    io.to('display').emit('evaluation:completed', {
      name: evaluator.name,
      evaluatedCount: state.evaluatedCount,
      totalEvaluators: state.totalEvaluators
    });

    // 모든 평가 완료 체크
    if (state.evaluatedCount >= state.connectedCount && state.connectedCount > 0) {
      state.phase = 'results';
      io.to('display').emit('evaluation:allComplete');
    }

    broadcastState();
    console.log(`[데모] 평가 추가: ${evaluator.name}`);
  });

  // 연결 해제
  socket.on('disconnect', () => {
    const sessionId = socketToSession.get(socket.id);
    if (sessionId) {
      const evaluator = state.evaluators.get(sessionId);
      if (evaluator) {
        evaluator.connected = false;
        io.to('display').emit('evaluator:disconnected', { name: evaluator.name });
        io.to('admin').emit('admin:evaluators', Array.from(state.evaluators.values()));
      }
      socketToSession.delete(socket.id);
    }
    console.log(`[연결 해제] ${socket.id}`);
  });
});

// ============ 서버 시작 ============
const PORT = process.env.PORT || appConfig.server.defaultPort;

async function startServer() {
  // MongoDB 연결 시도
  const dbConnected = await connectDB();

  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║     ${appConfig.app.name}                        ║
╠══════════════════════════════════════════════════════════════╣
║  랜딩 페이지:  http://localhost:${PORT}                        ║
║  메인 화면:    http://localhost:${PORT}/main                   ║
║  모바일 평가:  http://localhost:${PORT}/mobile                 ║
║  이벤트 이력:  http://localhost:${PORT}/history                ║
╠══════════════════════════════════════════════════════════════╣
║  DB 상태: ${dbConnected ? 'MongoDB 연결됨 ✓' : '메모리 모드 (DB 미연결)'}                      ║
╚══════════════════════════════════════════════════════════════╝
    `);
  });
}

startServer();
