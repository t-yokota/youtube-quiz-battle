export function calculateTimerLabelWidthCh(answerTimeLimit: number): number {
  return `${answerTimeLimit}s`.length
}

export function calculateTimerProgress(remainingSeconds: number, timeLimitSeconds: number): number {
  if (timeLimitSeconds <= 0) return 0

  return Math.max(0, Math.min(1, remainingSeconds / timeLimitSeconds))
}

export interface TimerLabelWidthState {
  questionNumber: number
  widthCh: number
}

export function resolveTimerLabelWidthState(
  previous: TimerLabelWidthState | undefined,
  questionNumber: number,
  ...seconds: number[]
): TimerLabelWidthState {
  const requiredWidthCh = Math.max(...seconds.map(calculateTimerLabelWidthCh))

  return {
    questionNumber,
    widthCh:
      previous?.questionNumber === questionNumber
        ? Math.max(previous.widthCh, requiredWidthCh)
        : requiredWidthCh,
  }
}
