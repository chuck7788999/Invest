// ============ 사운드 매니저 ============
// Howler.js 기반 사운드 시스템

const SoundManager = {
  // 마스터 볼륨 (0.0 ~ 1.0)
  masterVolume: 0.7,

  // 음소거 상태
  isMuted: false,

  // 현재 재생 중인 BGM
  currentBGM: null,

  // 사운드 인스턴스 저장
  sounds: {},

  // BGM 목록 (루프 재생) - 효과음의 70% 볼륨
  bgmList: {
    // 대기/QR 화면/평가 중 - Futile - The Grey Room | Golden Palms
    waiting: {
      src: '/sounds/bgm-waiting.mp3',
      volume: 0.45, // 효과음(0.5)의 70%
      loop: true
    },
    // 평가 진행 중 - 같은 BGM 유지
    evaluating: {
      src: '/sounds/bgm-waiting.mp3',
      volume: 0.45,
      loop: true
    },
    // 결과 발표 진행 - At The Game - Max McFerren
    presenting: {
      src: '/sounds/bgm-presenting.mp3',
      volume: 0.45,
      loop: true
    },
    // 최종 결과/승리 - 같은 BGM 유지
    victory: {
      src: '/sounds/bgm-presenting.mp3',
      volume: 0.45,
      loop: true
    },
    // 클로징 - 같은 BGM 유지
    closing: {
      src: '/sounds/bgm-presenting.mp3',
      volume: 0.45,
      loop: true
    }
  },

  // 효과음 목록 (한번 재생)
  sfxList: {
    // 드럼롤 - 오프닝
    drumroll: {
      src: 'https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3',
      volume: 0.7
    },
    // 코인 떨어지는 소리
    coinDrop: {
      src: 'https://assets.mixkit.co/active_storage/sfx/888/888-preview.mp3',
      volume: 0.5
    },
    // 코인 쌓이는 소리 (연속) - 로컬 코인 효과음
    coinStack: {
      src: '/sounds/coin-257878.mp3',
      volume: 0.5,
      loop: true
    },
    // 짧은 팡파레 (3,4위)
    fanfareShort: {
      src: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
      volume: 0.6
    },
    // 승리 팡파레 (1위)
    fanfareWin: {
      src: 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3',
      volume: 0.7
    },
    // 환호성
    cheering: {
      src: 'https://assets.mixkit.co/active_storage/sfx/2194/2194-preview.mp3',
      volume: 0.5
    },
    // 심장박동 (데드히트)
    heartbeat: {
      src: 'https://assets.mixkit.co/active_storage/sfx/2840/2840-preview.mp3',
      volume: 0.6,
      loop: true
    },
    // 긴장감 효과음 (데드히트)
    tension: {
      src: 'https://assets.mixkit.co/active_storage/sfx/2850/2850-preview.mp3',
      volume: 0.5
    },
    // 검 부딪히는 소리 (박빙의 승부)
    swordClash: {
      src: 'https://assets.mixkit.co/active_storage/sfx/2789/2789-preview.mp3',
      volume: 0.6
    },
    // 평가자 접속 알림
    notification: {
      src: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
      volume: 0.4
    },
    // 평가 제출 완료 - 로컬 코인 효과음
    submitComplete: {
      src: '/sounds/coin-257878.mp3',
      volume: 0.6
    },
    // 우승 발표 두둥!
    reveal: {
      src: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
      volume: 0.7
    },
    // 축하 환호 (최종 결과 이모티콘)
    battleCrowd: {
      src: '/sounds/battle-crowd-celebrate.mp3',
      volume: 0.7
    }
  },

  // 초기화
  init() {
    // localStorage에서 볼륨 설정 불러오기
    const savedVolume = localStorage.getItem('kt_sound_volume');
    if (savedVolume !== null) {
      this.masterVolume = parseFloat(savedVolume);
    }

    const savedMuted = localStorage.getItem('kt_sound_muted');
    if (savedMuted !== null) {
      this.isMuted = savedMuted === 'true';
    }

    // Howler 전역 볼륨 설정
    if (typeof Howler !== 'undefined') {
      Howler.volume(this.isMuted ? 0 : this.masterVolume);
    }

    console.log('[SoundManager] 초기화 완료, 볼륨:', this.masterVolume);
  },

  // 사운드 프리로드
  preload(type, name) {
    const config = type === 'bgm' ? this.bgmList[name] : this.sfxList[name];
    if (!config) return null;

    const key = `${type}_${name}`;
    if (!this.sounds[key]) {
      this.sounds[key] = new Howl({
        src: [config.src],
        volume: config.volume * this.masterVolume,
        loop: config.loop || false,
        html5: type === 'bgm', // BGM은 스트리밍으로
        preload: true
      });
    }
    return this.sounds[key];
  },

  // BGM 재생 (크로스페이드 지원)
  playBGM(name, fadeIn = true, crossfadeDuration = 2000) {
    if (this.isMuted) return;

    const config = this.bgmList[name];
    if (!config) {
      console.warn(`[SoundManager] BGM not found: ${name}`);
      return;
    }

    // 이미 같은 BGM이 재생 중이면 무시
    if (this.currentBGM === name && this.sounds[`bgm_${name}`]?.playing()) {
      return;
    }

    // 새 BGM 로드 및 재생 (크로스페이드: 이전 BGM과 동시에)
    const sound = this.preload('bgm', name);
    if (sound) {
      // 이전 BGM 페이드아웃 (동시에 진행)
      if (this.currentBGM && this.sounds[`bgm_${this.currentBGM}`]) {
        const oldSound = this.sounds[`bgm_${this.currentBGM}`];
        const oldName = this.currentBGM;
        oldSound.fade(oldSound.volume(), 0, crossfadeDuration);
        setTimeout(() => {
          oldSound.stop();
          console.log(`[SoundManager] BGM 정지: ${oldName}`);
        }, crossfadeDuration);
      }

      this.currentBGM = name;

      if (fadeIn) {
        sound.volume(0);
        sound.play();
        sound.fade(0, config.volume * this.masterVolume, crossfadeDuration);
      } else {
        sound.volume(config.volume * this.masterVolume);
        sound.play();
      }

      console.log(`[SoundManager] BGM 재생 (크로스페이드): ${name}`);
    }
  },

  // BGM 정지
  stopBGM(fadeOut = true) {
    if (this.currentBGM && this.sounds[`bgm_${this.currentBGM}`]) {
      const sound = this.sounds[`bgm_${this.currentBGM}`];

      if (fadeOut) {
        sound.fade(sound.volume(), 0, 1000);
        setTimeout(() => {
          sound.stop();
          this.currentBGM = null;
        }, 1000);
      } else {
        sound.stop();
        this.currentBGM = null;
      }

      console.log('[SoundManager] BGM 정지');
    }
  },

  // 효과음 재생
  playSFX(name) {
    if (this.isMuted) return null;

    const config = this.sfxList[name];
    if (!config) {
      console.warn(`[SoundManager] SFX not found: ${name}`);
      return null;
    }

    const sound = this.preload('sfx', name);
    if (sound) {
      // 루프 효과음이 아니면 매번 새로 재생
      if (!config.loop) {
        sound.stop();
      }
      sound.play();
      console.log(`[SoundManager] SFX 재생: ${name}`);
    }
    return sound;
  },

  // 효과음 정지
  stopSFX(name) {
    const key = `sfx_${name}`;
    if (this.sounds[key]) {
      this.sounds[key].stop();
    }
  },

  // 모든 사운드 정지
  stopAll() {
    Object.values(this.sounds).forEach(sound => {
      sound.stop();
    });
    this.currentBGM = null;
    console.log('[SoundManager] 모든 사운드 정지');
  },

  // 마스터 볼륨 설정
  setVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('kt_sound_volume', this.masterVolume.toString());

    if (typeof Howler !== 'undefined') {
      Howler.volume(this.isMuted ? 0 : this.masterVolume);
    }

    // 현재 재생 중인 사운드 볼륨 업데이트
    Object.entries(this.sounds).forEach(([key, sound]) => {
      const [type, name] = key.split('_');
      const config = type === 'bgm' ? this.bgmList[name] : this.sfxList[name];
      if (config && sound.playing()) {
        sound.volume(config.volume * this.masterVolume);
      }
    });

    console.log(`[SoundManager] 볼륨 설정: ${Math.round(this.masterVolume * 100)}%`);
  },

  // 음소거 토글
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('kt_sound_muted', this.isMuted.toString());

    if (typeof Howler !== 'undefined') {
      Howler.volume(this.isMuted ? 0 : this.masterVolume);
    }

    console.log(`[SoundManager] 음소거: ${this.isMuted}`);
    return this.isMuted;
  },

  // 음소거 설정
  setMute(muted) {
    this.isMuted = muted;
    localStorage.setItem('kt_sound_muted', this.isMuted.toString());

    if (typeof Howler !== 'undefined') {
      Howler.volume(this.isMuted ? 0 : this.masterVolume);
    }
  }
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  SoundManager.init();
});
