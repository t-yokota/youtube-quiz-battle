<script setup lang="ts">
// ResultArea コンポーネント
// ゲーム終了時の結果表示

import { computed } from 'vue'

// 個別結果の型定義
interface QuestionResult {
  questionNumber: number
  isCorrect: boolean
  correctAnswer: string
  userAnswer: string
}

// Props定義（Phase 2で状態管理と連携予定）
interface Props {
  correctCount?: number
  totalQuestions?: number
  results?: QuestionResult[]
  showUserAnswers?: boolean // 横幅に応じて「あなたの解答」列を表示するか
}

const props = withDefaults(defineProps<Props>(), {
  correctCount: 0,
  totalQuestions: 5,
  results: () => [],
  showUserAnswers: true,
})

// イベント定義
const emit = defineEmits<{
  replay: []
}>()

// 正解率の計算
const percentage = computed(() => {
  if (props.totalQuestions === 0) return 0
  return Math.round((props.correctCount / props.totalQuestions) * 100)
})

const handleReplay = () => {
  emit('replay')
}
</script>

<template>
  <section class="result-area">
    <!-- Final Score -->
    <div class="final-score">
      <p class="score-title">ゲーム終了！</p>
      <p class="score-text">正解数: {{ correctCount }}/{{ totalQuestions }}問 ({{ percentage }}%)</p>
    </div>

    <!-- Result Table -->
    <div class="result-table-container">
      <table class="result-table">
        <thead>
          <tr>
            <th>問題</th>
            <th>結果</th>
            <th>正答</th>
            <th v-if="showUserAnswers">あなたの解答</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="result in results" :key="result.questionNumber">
            <td>第{{ result.questionNumber }}問</td>
            <td>
              <span :class="['result-badge', result.isCorrect ? 'correct' : 'incorrect']">
                {{ result.isCorrect ? '○' : '×' }}
              </span>
            </td>
            <td>{{ result.correctAnswer }}</td>
            <td v-if="showUserAnswers">{{ result.userAnswer }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Action Buttons -->
    <div class="action-buttons">
      <button class="replay-button" @click="handleReplay">もう一度プレイ</button>
    </div>
  </section>
</template>

<style scoped>
/* Result Area */
.result-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

/* Final Score */
.final-score {
  text-align: center;
  padding: 1.5rem;
  background-color: white;
  border-radius: 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.score-title {
  margin: 0 0 0.75rem 0;
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
}

.score-text {
  margin: 0;
  font-size: 1.125rem;
  color: #666;
}

/* Result Table Container */
.result-table-container {
  background-color: white;
  border-radius: 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
  padding: 1rem;
}

/* Result Table */
.result-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9375rem;
}

.result-table thead {
  background-color: #f3f4f6;
}

.result-table th {
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #e5e7eb;
}

.result-table td {
  padding: 0.75rem 0.5rem;
  text-align: center;
  border-bottom: 1px solid #e5e7eb;
  color: #666;
}

.result-table tbody tr:last-child td {
  border-bottom: none;
}

.result-badge {
  display: inline-block;
  font-size: 1.125rem;
  font-weight: bold;
  width: 1.75rem;
  height: 1.75rem;
  line-height: 1.75rem;
  border-radius: 50%;
}

.result-badge.correct {
  background-color: #dcfce7;
  color: #166534;
}

.result-badge.incorrect {
  background-color: #fef2f2;
  color: #dc2626;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0 0.5rem;
}

.replay-button {
  padding: 0.875rem 1.5rem;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.replay-button:hover {
  background-color: #1d4ed8;
}

.replay-button:active {
  transform: translateY(1px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* モバイル対応 */
@media (max-width: 640px) {
  .result-area {
    padding: 1rem;
    gap: 1rem;
  }

  .final-score {
    padding: 1rem;
  }

  .score-title {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }

  .score-text {
    font-size: 1rem;
  }

  .result-table-container {
    padding: 0.75rem;
  }

  .result-table {
    font-size: 0.875rem;
  }

  .result-table th,
  .result-table td {
    padding: 0.5rem 0.375rem;
  }

  .result-badge {
    font-size: 1rem;
    width: 1.5rem;
    height: 1.5rem;
    line-height: 1.5rem;
  }

  .replay-button {
    padding: 0.75rem 1.25rem;
    font-size: 0.9375rem;
  }
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
  .result-area {
    padding: 0.75rem;
    gap: 0.75rem;
  }

  .final-score {
    padding: 0.875rem;
  }

  .score-title {
    font-size: 1.125rem;
    margin-bottom: 0.5rem;
  }

  .score-text {
    font-size: 0.9375rem;
  }

  .result-table-container {
    padding: 0.625rem;
  }

  .result-table {
    font-size: 0.8125rem;
  }

  .result-table th,
  .result-table td {
    padding: 0.5rem 0.25rem;
  }

  .replay-button {
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
  }
}
</style>
