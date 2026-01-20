/**
 * 공통 유틸리티 함수 모듈
 * - 화면 전환
 * - 토스트 알림
 * - 에러 처리
 * - 파티클 생성
 * - 로컬스토리지 유틸
 */

// ============ 설정 상수 ============
const APP_CONFIG = {
  STORAGE_KEYS: {
    SESSION: 'kt_eval_session',
    NAME: 'kt_eval_name',
    DATA: 'kt_eval_data'
  },
  EVALUATION: {
    TOTAL_BUDGET: 10,
    MIN_FEEDBACK_LENGTH: 10
  },
  DEBOUNCE_DELAY: 300
};

// ============ 화면 전환 ============
function showScreen(screenId, screens = ['login-screen', 'waiting-screen', 'evaluation-screen', 'complete-screen']) {
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = id === screenId ? 'flex' : 'none';
    }
  });
}

// ============ 토스트 알림 ============
function showToast(message, duration = 3000) {
  // 토스트 컨테이너 확인/생성
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // 토스트 생성
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  // 자동 제거
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============ 에러 팝업 ============
function showErrorPopup(title, message, icon = '⚠️') {
  const overlay = document.getElementById('error-popup-overlay');
  const titleEl = document.getElementById('error-popup-title');
  const messageEl = document.getElementById('error-popup-message');
  const iconEl = document.getElementById('error-popup-icon');

  if (overlay && titleEl && messageEl) {
    titleEl.textContent = title;
    messageEl.innerHTML = message;
    if (iconEl) iconEl.textContent = icon;
    overlay.classList.add('active');
  }
}

function closeErrorPopup(event) {
  if (event && event.target !== event.currentTarget) return;
  const overlay = document.getElementById('error-popup-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

// ============ 모달 유틸 ============
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }
});

// ============ 파티클 생성 ============
function createParticles(containerId = 'particles-container', count = 50) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';

    const size = Math.random() * 8 + 2;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 15 + 's';
    particle.style.animationDuration = (Math.random() * 10 + 10) + 's';

    fragment.appendChild(particle);
  }

  container.appendChild(fragment);
}

// ============ 로컬스토리지 유틸 ============
const StorageUtil = {
  get(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return localStorage.getItem(key);
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) {
      console.error('localStorage set error:', e);
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  clear(keys) {
    keys.forEach(key => localStorage.removeItem(key));
  }
};

// ============ Debounce 유틸 ============
function debounce(func, delay = APP_CONFIG.DEBOUNCE_DELAY) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// ============ 날짜 포맷 ============
function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Date(date).toLocaleDateString('ko-KR', { ...defaultOptions, ...options });
}

// ============ 숫자 포맷 ============
function formatNumber(num) {
  return new Intl.NumberFormat('ko-KR').format(num);
}

// ============ API 유틸 ============
const ApiUtil = {
  async get(url) {
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('API GET error:', error);
      return { success: false, error: error.message };
    }
  },

  async post(url, data) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('API POST error:', error);
      return { success: false, error: error.message };
    }
  },

  async delete(url) {
    try {
      const response = await fetch(url, { method: 'DELETE' });
      return await response.json();
    } catch (error) {
      console.error('API DELETE error:', error);
      return { success: false, error: error.message };
    }
  }
};

// ============ DOM 유틸 ============
function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return document.querySelectorAll(selector);
}

function createElement(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  return el;
}

// ============ 내보내기 (모듈 사용 시) ============
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    APP_CONFIG,
    showScreen,
    showToast,
    showErrorPopup,
    closeErrorPopup,
    openModal,
    closeModal,
    createParticles,
    StorageUtil,
    debounce,
    formatDate,
    formatNumber,
    ApiUtil
  };
}
