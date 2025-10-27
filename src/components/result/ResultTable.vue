<script setup lang="ts">
// ResultTable コンポーネント
// 個別問題の結果テーブル表示

// 個別結果の型定義
interface QuestionResult {
  questionNumber: number
  isCorrect: boolean
  correctAnswer: string
  userAnswer: string
}

// Props定義
interface Props {
  results?: QuestionResult[]
  showUserAnswers?: boolean // 横幅に応じて「あなたの解答」列を表示するか
}

withDefaults(defineProps<Props>(), {
  results: () => [],
  showUserAnswers: true,
})
</script>

<template>
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
</template>

<style scoped>
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

/* モバイル対応 */
@media (max-width: 640px) {
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
}

/* 小さい画面での追加調整 */
@media (max-height: 700px) {
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
}
</style>
