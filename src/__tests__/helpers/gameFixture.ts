import { vi } from 'vitest'
import { YouTubePlayerState, type QuizData, type YouTubePlayerManager } from '@/types'

export function quizFixture(settings: Partial<QuizData['settings']> = {}): QuizData {
  return {
    videoId: 'E5200yjbvj8',
    settings: {
      maxAttempts: 3,
      answerTimeLimit: 10,
      disableSeekbar: true,
      jumpToRevealPeriod: false,
      hideVideoPlayerDuringAnswer: false,
      buttonCheckEnabled: false,
      debug: false,
      ...settings,
    },
    questions: [
      { index: 0, startTime: 10, revealTime: 20, endTime: 25, answers: ['東京'] },
      { index: 1, startTime: 30, revealTime: 40, endTime: 45, answers: ['大阪'] },
      { index: 2, startTime: 50, revealTime: 60, endTime: 65, answers: ['京都'] },
    ],
  }
}

/** Seek/time and playback state stay consistent; notifications may be delivered separately. */
export function fakePlayer() {
  let time = 0
  let state = YouTubePlayerState.PAUSED
  let listener: ((state: YouTubePlayerState) => void) | undefined
  const player: YouTubePlayerManager = {
    loadVideo: vi.fn(async () => {}),
    playVideo: vi.fn(() => {
      state = YouTubePlayerState.PLAYING
    }),
    pauseVideo: vi.fn(() => {
      state = YouTubePlayerState.PAUSED
    }),
    seekTo: vi.fn((value: number) => {
      time = value
    }),
    getCurrentTime: () => time,
    getDuration: () => 70,
    getPlayerState: () => state,
    getVideoTitle: () => 'Quiz',
    onStateChange: (callback) => {
      listener = callback
    },
    destroy: vi.fn(),
  }
  return {
    player,
    setTime: (value: number) => {
      time = value
    },
    notify: (value: YouTubePlayerState) => {
      state = value
      listener?.(value)
    },
  }
}
