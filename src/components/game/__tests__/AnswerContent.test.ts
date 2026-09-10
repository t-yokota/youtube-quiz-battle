import { createApp, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, expect, it, vi } from 'vitest'
import AnswerContent from '../AnswerContent.vue'
import { useGameStore } from '@/stores/gameStore'
import { GameState } from '@/types'
import { quizFixture } from '@/__tests__/helpers/gameFixture'

let cleanup = () => {}
afterEach(() => cleanup())
it('IMEの確定Enterを送信せず、その後のEnterで一度だけ送る', async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGameStore()
  store.setQuizData(quizFixture())
  store.setCurrentQuestionIndex(0)
  store.transitionToState(GameState.ANSWERING)
  const submit = vi.fn()
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(AnswerContent, { onSubmit: submit })
  app.use(pinia)
  app.mount(host)
  cleanup = () => {
    app.unmount()
    host.remove()
  }
  const input = host.querySelector('input')!
  input.dispatchEvent(new CompositionEvent('compositionstart'))
  input.value = '東京'
  input.dispatchEvent(new Event('input'))
  await nextTick()
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }))
  expect(submit).not.toHaveBeenCalled()
  // Some browsers report isComposing=false before the confirming Enter.
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229 }))
  expect(submit).not.toHaveBeenCalled()
  input.dispatchEvent(new CompositionEvent('compositionend'))
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  expect(submit).toHaveBeenCalledExactlyOnceWith('東京')
})
