const mongoose = require('mongoose');

// ============ 스키마 정의 ============

// 팀 결과 스키마 (이벤트 내 임베디드)
const TeamResultSchema = new mongoose.Schema({
  teamId: { type: Number, required: true },
  name: { type: String, required: true },
  topic: { type: String, required: true },
  totalInvestment: { type: Number, default: 0 },
  rank: { type: Number },
  feedbacks: [{
    evaluator: String,
    content: String
  }]
});

// 평가자 스키마 (이벤트 내 임베디드)
const EvaluatorResultSchema = new mongoose.Schema({
  name: { type: String, required: true },
  evaluations: [{
    teamId: Number,
    investment: Number,
    feedback: String
  }],
  submittedAt: { type: Date }
});

// 이벤트 스키마 (메인)
const EventSchema = new mongoose.Schema({
  // 이벤트 기본 정보
  name: { type: String, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  status: {
    type: String,
    enum: ['active', 'completed', 'archived'],
    default: 'active'
  },

  // 설정
  presentationOrder: [Number],
  totalBudgetPerEvaluator: { type: Number, default: 20 },

  // 결과 데이터
  teams: [TeamResultSchema],
  evaluators: [EvaluatorResultSchema],

  // 통계
  stats: {
    totalEvaluators: { type: Number, default: 0 },
    totalInvestment: { type: Number, default: 0 }
  }
});

// 인덱스 설정
EventSchema.index({ createdAt: -1 });
EventSchema.index({ status: 1, createdAt: -1 });

// ============ 모델 생성 ============
const Event = mongoose.model('Event', EventSchema);

// ============ DB 연결 함수 ============
async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.log('[DB] MONGODB_URI not set - running in memory-only mode');
    return false;
  }

  try {
    await mongoose.connect(mongoUri, {
      // mongoose 8.x에서는 대부분 옵션이 기본값으로 설정됨
    });
    console.log('[DB] MongoDB 연결 성공');
    return true;
  } catch (error) {
    console.error('[DB] MongoDB 연결 실패:', error.message);
    return false;
  }
}

// ============ 이벤트 저장 함수 ============
async function saveEvent(eventData) {
  if (!mongoose.connection.readyState) {
    console.log('[DB] DB 연결 없음 - 저장 건너뜀');
    return null;
  }

  try {
    const event = new Event(eventData);
    await event.save();
    console.log(`[DB] 이벤트 저장 완료: ${event._id}`);
    return event;
  } catch (error) {
    console.error('[DB] 이벤트 저장 실패:', error.message);
    return null;
  }
}

// ============ 이벤트 조회 함수 ============
async function getEvents(filter = {}, options = {}) {
  if (!mongoose.connection.readyState) {
    return [];
  }

  try {
    const { limit = 20, skip = 0, sort = { createdAt: -1 } } = options;
    const events = await Event.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    return events;
  } catch (error) {
    console.error('[DB] 이벤트 조회 실패:', error.message);
    return [];
  }
}

// ============ 단일 이벤트 조회 ============
async function getEventById(eventId) {
  if (!mongoose.connection.readyState) {
    return null;
  }

  try {
    const event = await Event.findById(eventId).lean();
    return event;
  } catch (error) {
    console.error('[DB] 이벤트 조회 실패:', error.message);
    return null;
  }
}

// ============ 이벤트 삭제 ============
async function deleteEvent(eventId) {
  if (!mongoose.connection.readyState) {
    return false;
  }

  try {
    await Event.findByIdAndDelete(eventId);
    console.log(`[DB] 이벤트 삭제 완료: ${eventId}`);
    return true;
  } catch (error) {
    console.error('[DB] 이벤트 삭제 실패:', error.message);
    return false;
  }
}

// ============ 현재 이벤트 저장 (세션 종료 시) ============
async function saveCurrentSession(state, eventName = null) {
  if (!mongoose.connection.readyState) {
    return null;
  }

  // 평가자가 없으면 저장하지 않음
  if (state.evaluatedCount === 0) {
    console.log('[DB] 평가 데이터 없음 - 저장 건너뜀');
    return null;
  }

  // 팀 순위 계산
  const rankedTeams = [...state.teams]
    .sort((a, b) => b.totalInvestment - a.totalInvestment)
    .map((team, index) => ({
      teamId: team.id,
      name: team.name,
      topic: team.topic,
      totalInvestment: team.totalInvestment,
      rank: index + 1,
      feedbacks: team.feedbacks
    }));

  // 평가자 데이터 변환
  const evaluatorResults = Array.from(state.evaluators.values())
    .filter(e => e.evaluated)
    .map(e => ({
      name: e.name,
      evaluations: e.evaluations,
      submittedAt: new Date()
    }));

  // 총 투자금 계산
  const totalInvestment = state.teams.reduce((sum, t) => sum + t.totalInvestment, 0);

  const eventData = {
    name: eventName || `Investment Day ${new Date().toLocaleDateString('ko-KR')}`,
    description: `${state.evaluatedCount}명 평가 완료`,
    completedAt: new Date(),
    status: 'completed',
    presentationOrder: state.presentationOrder,
    teams: rankedTeams,
    evaluators: evaluatorResults,
    stats: {
      totalEvaluators: state.evaluatedCount,
      totalInvestment
    }
  };

  return await saveEvent(eventData);
}

module.exports = {
  connectDB,
  Event,
  saveEvent,
  getEvents,
  getEventById,
  deleteEvent,
  saveCurrentSession
};
