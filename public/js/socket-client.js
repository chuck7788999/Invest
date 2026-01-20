/**
 * Socket.IO 클라이언트 모듈
 * - 소켓 연결 관리
 * - 공통 이벤트 핸들러
 */

// ============ Socket.IO 초기화 ============
function createSocket(options = {}) {
  const defaultOptions = {
    transports: ['polling', 'websocket'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  };

  return io({ ...defaultOptions, ...options });
}

// ============ 소켓 이벤트 등록 유틸 ============
function registerSocketEvents(socket, handlers) {
  Object.entries(handlers).forEach(([event, handler]) => {
    socket.on(event, handler);
  });
}

// ============ 연결 상태 표시 ============
function setupConnectionStatus(socket, statusElementId) {
  const statusEl = document.getElementById(statusElementId);
  if (!statusEl) return;

  socket.on('connect', () => {
    statusEl.textContent = '연결됨';
    statusEl.className = 'status connected';
  });

  socket.on('disconnect', () => {
    statusEl.textContent = '연결 끊김';
    statusEl.className = 'status disconnected';
  });

  socket.on('reconnecting', () => {
    statusEl.textContent = '재연결 중...';
    statusEl.className = 'status reconnecting';
  });
}

// ============ 공통 이벤트 핸들러 팩토리 ============
const SocketHandlers = {
  // 시스템 리셋 핸들러
  createResetHandler(storageKeys, redirectUrl = null) {
    return () => {
      storageKeys.forEach(key => localStorage.removeItem(key));
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        window.location.reload();
      }
    };
  },

  // 상태 업데이트 핸들러
  createStateUpdateHandler(callback) {
    return (state) => {
      if (typeof callback === 'function') {
        callback(state);
      }
    };
  },

  // 에러 핸들러
  createErrorHandler(showError = true) {
    return (error) => {
      console.error('Socket error:', error);
      if (showError && typeof showToast === 'function') {
        showToast('연결 오류가 발생했습니다.');
      }
    };
  }
};

// ============ 내보내기 (모듈 사용 시) ============
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createSocket,
    registerSocketEvents,
    setupConnectionStatus,
    SocketHandlers
  };
}
