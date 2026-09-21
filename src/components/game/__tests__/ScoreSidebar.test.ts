import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { afterEach, expect, it } from 'vitest'
import ScoreSidebar from '../ScoreSidebar.vue'
import { useGameStore } from '@/stores/gameStore'
import { GameState } from '@/types'
import { quizFixture } from '@/__tests__/helpers/gameFixture'
let cleanup = () => {}
afterEach(() => cleanup())
it('確定した正誤の問題数を集計し、スキップ・スルーを除外する', async () => {
  const pinia = createPinia()
  const store = useGameStore(pinia)
  store.setQuizData(quizFixture())
  store.setCurrentQuestionIndex(0)
  store.transitionToState(GameState.QUESTIONING)
  const host = document.createElement('div')
  const app = createApp(ScoreSidebar)
  app.use(pinia).mount(host)
  cleanup = () => app.unmount()
  expect(host.querySelector('[aria-label="正解 0問"]')).not.toBeNull()
  expect(host.querySelector('[aria-label="不正解 0問"]')).not.toBeNull()
  expect(host.textContent).toContain('出題中')
  expect(host.querySelectorAll('.result-row')).toHaveLength(0)
  store.transitionToState(GameState.ANSWERING)
  await nextTick()
  expect(host.textContent).toContain('解答中')
  store.$patch({
    results: [
      {
        questionNumber: 1,
        isCorrect: false,
        correctAnswer: '正答',
        userAnswers: [],
        skipped: false,
        timesUntilPress: [],
        submissionTypes: [],
      },
    ],
  })
  await nextTick()
  expect(host.querySelector('.current-question-row')).toBeNull()
  expect(host.textContent).toContain('正答')
  expect(host.textContent).toContain('無解答')
  const result = store.results[0]!
  store.$patch({
    results: [
      result,
      { ...result, questionNumber: 2, isCorrect: true, userAnswers: ['正答'] },
      { ...result, questionNumber: 3, userAnswers: ['誤答', '再誤答'] },
      { ...result, questionNumber: 4, skipped: true, userAnswers: ['誤答'] },
    ],
  })
  await nextTick()
  expect(host.querySelector('[aria-label="正解 1問"]')).not.toBeNull()
  expect(host.querySelector('[aria-label="不正解 1問"]')).not.toBeNull()
  store.$patch({ results: [] })
  await nextTick()
  expect(host.querySelector('[aria-label="正解 0問"]')).not.toBeNull()
  expect(host.querySelector('[aria-label="不正解 0問"]')).not.toBeNull()
})
