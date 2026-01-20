# kt cloud 2026 신입사원 투자 집계 시스템

## 서비스 개요

kt cloud 신입사원 '비즈니스 아키텍트' 발표회를 위한 실시간 투자 평가 및 순위 발표 시스템입니다. 평가자들이 모바일로 각 조에 투자금을 배분하고, MC가 드라마틱한 순위 발표를 진행할 수 있도록 설계되었습니다.

---

## 팀 정보 (기본값)

| 조 | 주제 |
|---|---|
| 1조 | kt cloud 상품문의 여정의 동반자, Journey |
| 2조 | 세일즈 에이전트, Briefy |
| 3조 | 효율화를 위한 Jira 자동화 서비스, Ji-Key-Ra |
| 4조 | 출장품의 프로세스 효율화, TripON |

## 발표 순서

**2조 → 4조 → 3조 → 1조**

> 설정 변경은 `config/app-config.json` 파일에서 가능합니다.

### 주요 특징
- **실시간 동기화**: WebSocket 기반 즉시 상태 반영
- **세션 유지**: 모바일 브라우저 새로고침 시에도 평가 상태 유지
- **MC 컨트롤**: 발표 진행을 위한 통합 관리 패널
- **데모 모드**: 실제 평가자 없이도 테스트 가능

---

## 시스템 구조

```
invest/
├── server.js              # Express + Socket.IO 백엔드 서버
├── package.json           # 프로젝트 의존성
└── public/
    ├── index.html         # 메인 디스플레이 (MC용)
    ├── mobile.html        # 모바일 평가자 화면
    └── admin.html         # 독립 관리자 패널 (선택적)
```

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Node.js, Express.js |
| Real-time | Socket.IO |
| Frontend | Vanilla JavaScript, CSS3 Animations |
| QR Code | qrcodejs |
| Session | localStorage + UUID |

---

## 화면 구성

### 1. 메인 디스플레이 (`/`)
MC가 프로젝터/대형 화면에 띄워 진행하는 메인 화면

#### Phase 1: 대기/평가 화면
- QR 코드 표시 (평가자 접속용)
- 실시간 접속자 수 및 평가 현황
- 4개 조 정보 카드

#### Phase 2: 순위 발표 화면
- **Step 1**: 오프닝 (드럼롤 효과)
- **Step 2**: 4위 발표 (코인 레인 애니메이션)
- **Step 3**: 3위 발표
- **Step 4**: 1,2위 데드히트 (긴장감 연출)
- **Step 5**: 최종 우승팀 발표 (황금 코인 레인)

#### MC 컨트롤 패널 (우측 상단)
- 데모 평가자 추가
- 데모 평가 추가
- 평가 시작/강제 마감
- 발표 시작/다음 단계
- 시스템 리셋

### 2. 모바일 평가 화면 (`/mobile`)
평가자가 QR 코드로 접속하여 사용하는 화면

#### 화면 흐름
1. **로그인**: 이름 입력
2. **대기**: 평가 시작 대기
3. **평가**: 각 조별 투자금(0-10억) 및 피드백 입력
4. **완료**: 제출 확인

### 3. 관리자 패널 (`/admin`)
독립적인 관리자 전용 화면 (메인 화면에 통합되어 있어 선택적 사용)

---

## 데이터 구조

### 서버 상태 (State)
```javascript
{
  phase: 'waiting',        // waiting | evaluating | results | presenting
  presentationStep: 0,     // 0-5 (발표 단계)
  teams: [
    {
      id: 1,
      name: '1조',
      topic: 'AI 기반 클라우드 비용 최적화 솔루션',
      totalInvestment: 0,
      feedbacks: []
    },
    // ... 4개 조
  ],
  evaluators: Map(),       // sessionId -> { name, connected, evaluated, evaluations }
  totalEvaluators: 12,
  connectedCount: 0,
  evaluatedCount: 0
}
```

### 평가 데이터
```javascript
{
  teamId: 1,
  investment: 5,           // 0-10억
  feedback: '혁신적인 아이디어입니다!'
}
```

---

## Socket.IO 이벤트

### 클라이언트 → 서버

| 이벤트 | 설명 | 파라미터 |
|--------|------|----------|
| `display:join` | 메인 디스플레이 연결 | - |
| `admin:join` | 관리자 연결 | - |
| `evaluator:join` | 평가자 접속 | `{ sessionId?, name }` |
| `evaluator:submit` | 평가 제출 | `{ sessionId, evaluations[] }` |
| `admin:startEvaluation` | 평가 시작 | - |
| `admin:forceClose` | 강제 마감 | - |
| `admin:startPresentation` | 발표 시작 | - |
| `admin:nextStep` | 다음 발표 단계 | - |
| `admin:reset` | 시스템 리셋 | - |
| `demo:addEvaluator` | 데모 평가자 추가 | `{ name }` |
| `demo:addEvaluation` | 데모 평가 추가 | - |

### 서버 → 클라이언트

| 이벤트 | 설명 | 데이터 |
|--------|------|--------|
| `state:update` | 상태 업데이트 | `{ phase, teams, ... }` |
| `evaluator:joined` | 평가자 접속 완료 | `{ sessionId, state }` |
| `evaluator:restored` | 세션 복구 완료 | `{ sessionId, evaluator, state }` |
| `evaluation:started` | 평가 시작됨 | - |
| `evaluation:completed` | 평가 제출됨 | `{ name, evaluatedCount }` |
| `evaluation:allComplete` | 모든 평가 완료 | - |
| `presentation:step` | 발표 단계 변경 | `{ step, rankedTeams }` |
| `system:reset` | 시스템 리셋됨 | - |

---

## 실행 방법

### 1. 의존성 설치
```bash
cd /Users/changyoon.park/Downloads/invest
npm install
```

### 2. 서버 실행
```bash
npm start
```

### 3. 접속
- **메인 화면**: http://localhost:3000
- **모바일 평가**: http://localhost:3000/mobile
- **관리자**: http://localhost:3000/admin

---

## 데모 모드 사용법

실제 평가자 없이 시스템을 테스트할 수 있습니다.

1. 메인 화면 접속 후 우측 상단 **⚙️ MC 컨트롤** 클릭
2. **데모 평가자 추가** 버튼으로 가상 평가자 생성
3. **평가 시작** 버튼 클릭
4. **데모 평가 추가** 버튼으로 랜덤 평가 데이터 생성
5. 원하는 수만큼 반복 후 **강제 마감** 또는 자동 완료
6. **발표 시작** → **다음 단계** 버튼으로 순위 발표 진행

---

## 발표 진행 가이드

### Phase 1: 평가 수집
1. 메인 화면의 QR 코드를 프로젝터에 표시
2. 평가자들이 모바일로 접속 및 로그인
3. MC 컨트롤에서 **평가 시작** 클릭
4. 실시간으로 평가 현황 모니터링
5. 모든 평가 완료 시 자동으로 Phase 2 전환 (또는 **강제 마감**)

### Phase 2: 순위 발표
1. **발표 시작** 클릭 → 오프닝 화면
2. **다음 단계** (또는 스페이스바/→키) → 4위 발표
3. **다음 단계** → 3위 발표
4. **다음 단계** → 1,2위 데드히트 연출
5. **다음 단계** → 최종 우승팀 발표

### 키보드 단축키
- `Space` / `→` / `Enter`: 다음 발표 단계

---

## 커스터마이징

### 조 정보 수정
`server.js`의 `state.teams` 배열 수정:
```javascript
teams: [
  { id: 1, name: '1조', topic: '주제1', totalInvestment: 0, feedbacks: [] },
  { id: 2, name: '2조', topic: '주제2', totalInvestment: 0, feedbacks: [] },
  // ...
]
```

### 평가자 수 변경
`server.js`의 `state.totalEvaluators` 값 수정:
```javascript
totalEvaluators: 20  // 기본값: 12
```

### 스타일 커스터마이징
각 HTML 파일의 `<style>` 섹션에서 색상, 애니메이션 등 수정 가능

---

## 트러블슈팅

### QR 코드가 표시되지 않음
- 브라우저 콘솔에서 qrcodejs 로드 오류 확인
- CDN URL 접근 가능 여부 확인

### 모바일에서 접속 불가
- 서버와 모바일이 같은 네트워크에 있는지 확인
- 방화벽 설정 확인 (포트 3000)
- localhost 대신 서버 IP 주소 사용

### 세션 복구 실패
- 브라우저 localStorage 지원 확인
- 시크릿/프라이빗 모드에서는 세션 유지 불가

---

## 라이선스

이 프로젝트는 kt cloud 내부 행사용으로 제작되었습니다.
