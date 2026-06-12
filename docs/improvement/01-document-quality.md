# 01. ドキュメント品質向上計画（指示書）

> 対象: `docs/design.md` / `docs/requirements.md` / `docs/tasks.md` / `README.md` / `docs/design-sync-handoff.md`
> 実行者への前提: 本書の指摘はすべて 2026-06-11 時点の実装（ブランチ `develop/claude-code`, HEAD `2b66c0b`）との突き合わせに基づく。修正前に必ず該当箇所を再確認すること（行番号は目安。編集により前後する）。

## 実行ルール

- 1 PR（または 1 コミット）= 1 カテゴリ（D-1〜D-17 の単位で分割してよいが、関連するものはまとめてよい）
- design.md の修正は**実装を正とする**。実装側にバグが疑われる場合は修正せず `02-refactoring-plan.md` への追記として報告する
- 修正後は `npm run test` が通ること（ドキュメント修正でテストは壊れないはずだが、リンク切れ・アンカー参照の確認を含める）

---

## A. design.md 内部の不整合・実装との乖離

### D-1: 時間更新間隔「100ms」の記述が定数 150ms と矛盾【優先: 高】

`src/constants/timing.ts` は `TIME_UPDATE_INTERVAL_MS = 150`。一方 design.md には「100ms間隔」の記述が複数残存している。

| 箇所 | 現状 | 修正 |
|---|---|---|
| Framework Selection（L42 付近）「100ms間隔の動画時間更新」 | 100ms | 「150ms間隔（`TIME_UPDATE_INTERVAL_MS`、目安 100〜200ms）」 |
| Dynamic System Time Variables の表（L405 付近）currentVideoTime の更新タイミング「100ms間隔」 | 100ms | 「`TIME_UPDATE_INTERVAL_MS`（150ms）間隔」 |
| Performance Considerations（L1931 付近）「100ms間隔の動画時間更新」 | 100ms | 同上 |
| YouTube IFrame Player API Integration（L2085, L2100 付近）「時間追跡の開始（100ms間隔）」「100ms間隔での現在時間取得」 | 100ms | 同上 |

定数名を明記する形に統一し、将来の値変更時に design.md の修正箇所が 1 箇所（定数定義の説明）で済むようにする。

### D-2: Timeline Example のシーク判定値が旧仕様（0.1秒）のまま【優先: 高】

「Seek Detection Behavior」直後の Timeline Examples（L856, L873 付近）に `|15.0 - 5.1| > 0.1` という旧閾値の記述がある。現仕様は `SEEK_TOLERANCE_SEC = 1.0`。

- 修正: `> 0.1` → `> 1.0`（2 つの mermaid timeline 双方を確認）

### D-3: React 代替スタックの記述が残存【優先: 中】

フレームワークは Vue 3 で確定・実装済み。以下の「代替案」記述は意思決定の歴史としての価値しかなく、現役ドキュメントのノイズになっている。

- Technical Stack の「代替スタック」
- Component Design Approach の「React Functional Components（代替案）」
- Project Structure の「React版（代替案）」
- Implementation Patterns の「React Approach」（Component Lifecycle / State Management Architecture 内）

修正方針: **削除**する。意思決定の経緯を残したい場合は文末の Future Work の後に「Appendix: 初期検討時の代替案」として 5 行程度に圧縮して移す（推奨は削除。git 履歴に残る）。

### D-4: `hideVideoPlayerDuringAnswer` が設計済み・型定義済みだが未実装【優先: 高】

- design.md は「ANSWERING State: Video Player: 表示（設定により非表示可能）」「When true: ANSWERING状態への遷移と同時に…即時に非表示」と実装済みのように記述
- 実態: `QuizSettings.hideVideoPlayerDuringAnswer` は型・ローダー・JSON に存在するが、`App.vue` / `VideoPlayer.vue` に表示制御コードが**存在しない**
- `docs/tasks.md` にも実装タスクが存在しない

修正:
1. design.md の該当 2 箇所に「**（未実装。Task 20-4 で実装予定）**」の注記を追加
2. `04-task-replan.md` の新タスク 20-4 として実装タスクを起票済み（本書の修正時に tasks.md 側と整合させる）

### D-5: GameManager interface 定義が実装クラスと乖離【優先: 中】

design.md「Core Components > Game Manager」の interface と `src/services/gameManager.ts` の public API を突き合わせ、以下を反映する。

- interface にない実装 public メソッド: `submitAnswer(questionIndex, isCorrect)`（jumpToRevealPeriod 時のシーク処理）
- interface にある `currentState` / `buttonState` プロパティ: 実装では GameManager は保持せず gameStore が保持。「状態は gameStore が単一の真実の源であり、GameManager はそれを操作する」旨を明記してプロパティ記述を削除
- `handleAnswerSubmit(answer)` の戻り値: 実装は `void`（store 側が `{isCorrect, isFinal}` を返す）。記述を実装に合わせる

### D-6: エラーメッセージ設計と現状実装のギャップ【優先: 中】

design.md は `ERROR_MESSAGES`（ユーザー向け日本語）を定義しているが、現実装は `'QUIZ_DATA_NOT_FOUND'` 等の**エラーコード文字列をそのまま ErrorDialog に表示**している（`App.vue` の `initError`）。

修正: Error Handling セクションに現状注記を追加 — 「現在はエラーコードを直接表示する暫定実装。コード→メッセージ変換は Task 20（errorHandler）で実装」。Task 20 の完了定義にも「`ERROR_MESSAGES` によるコード→ユーザー向けメッセージ変換」を明記（`04-task-replan.md` 反映済み）。

### D-7: 音声スプライト素材の準備タスクが欠落【優先: 中】

design.md は `/assets/sounds/quiz-sounds.mp3`（button: 0–0.5s / correct: 0.5–1.5s / incorrect: 1.5–2.3s）を前提とするが、`public/` 配下に音声ファイルが存在せず、素材の入手・制作タスクが tasks.md にない。

修正: `04-task-replan.md` の Task 19-0（音声素材準備）を tasks.md に反映。design.md には「素材は Task 19-0 で準備」と注記。

### D-8: `modestbranding` は YouTube 側で廃止済みパラメータ【優先: 低】

YouTube IFrame API の `modestbranding` は 2023 年 8 月に廃止（無視される）。design.md の推奨 playerVars と Strict/Debug プロファイル例、実装 `youtubePlayer.ts` に残存。

修正: design.md から削除（または「廃止済み・無害だが指定不要」と注記）。実装側の削除は `02-refactoring-plan.md` R-3 に含める。

### D-9: requirements.md 3.3 の表現が実装仕様と不一致【優先: 低】

Requirement 3.3「システムはゲーム状態を待機状態に固定し、次の問題から参加可能にする」に対し、実装は WAITING / TALKING / FINISHED の 3 分岐（シーク先に依存）。

修正: AC 3.3 を「システムは対象の問題を不参加（スキップ）として記録し、シーク先に応じた状態（WAITING/TALKING/FINISHED）に遷移する」へ更新。requirements は変更頻度を抑えるべきドキュメントなので、この修正は他の requirements 変更とまとめて 1 コミットで行う。

### D-10: Testing Strategy の「@testing-library/vue」が未導入【優先: 低】

design.md Testing Tools に Component Tests: @testing-library/vue とあるが未インストールで、コンポーネントテストは 0 件。

修正: 方針を決めて記述を合わせる。推奨 — 「コンポーネントテストは Phase 3 の Task 26（E2E 整備）時に導入判断。それまでは services/stores のユニットテストと Playwright E2E でカバー」と明記。

---

## B. ドキュメント構造の改善

### D-11: design.md（2,316 行）の分割【優先: 高・ただし実行は Phase R 完了後】

単一ファイルが肥大化し、編集衝突・参照性・AI エージェントのコンテキスト効率すべてに悪影響。以下に分割する。

```
docs/design/
├── README.md            # 索引 + Overview + Core Concept（旧 Overview / UX）
├── state-management.md  # Game State / Button State（遷移図・タイミング表）
├── time-management.md   # Time Management 全体（シーク検出 / Single-Shot Guard /
│                        #   External Pause / YouTube Rewind / Timeline Examples）
├── components.md        # Core Components（GameManager 等 interface）+ UI Architecture
│                        #   + Screen Layout / UI State Management / Input Specs
├── data-model.md        # Quiz Data Structure / Application State / Configuration
│                        #   / Data Acquisition / Validation / Sample Data
├── error-handling.md    # Error Handling + 将来の audio / analytics 設計
└── testing-deployment.md # Testing Strategy / Performance / Security / A11y / Deployment
```

実行手順:
1. 分割は**内容を変更せず移動のみ**のコミットとして実施（D-1〜D-10 の修正を先に完了させる）
2. 旧 `docs/design.md` は「分割済み。docs/design/README.md を参照」のスタブにする（外部参照を壊さないため。1 リリース後に削除可）
3. アンカー参照の更新を必ず行う: `docs/tasks.md` 内の `design.md#seek-detection-via-previousvideotime` 等、`CLAUDE.md` のドキュメント参照表、`.claude/rules/*.md` 内の参照
4. 検証: `grep -rn "design\.md" docs/ CLAUDE.md .claude/ README.md` で参照箇所を列挙し、全件更新されたことを確認

### D-12: design-sync-handoff.md の処遇【優先: 中】

「git 管理対象外の一次資料」と自己宣言しているのに staged になっている。また記載の残課題 R-4（quizDataLoader テスト）は Task 18-3 で解消済みで、資料は役目を終えている。

修正:
1. 恒久的価値のある「採番体系」（index = 0-indexed / questionNumber = 1-indexed の使い分け表）を design.md（分割後は data-model.md）の Data Models セクションへ転記
2. ファイル自体は削除する（経緯は git 履歴と本書に残る）。ユーザーが履歴保存を望む場合は `docs/archive/` へ移動

### D-13: README.md / package.json の整備【優先: 中】

- `package.json` の `name` が `temp-vue-project` のまま → `youtube-quiz-battle` に変更
- README.md は design.md の Overview と重複。README は**利用者・コントリビュータ向け**に再構成する:
  - プロジェクト概要（1 段落）+ スクリーンショット枠
  - セットアップ（mise / npm）と開発コマンド表（CLAUDE.md と重複してよい。READMEは人間向け）
  - クイズデータの作り方（`public/data/{videoId}/data.json` の最小例と URL 仕様 `?v={videoId}`）
  - ドキュメントへのリンク（docs/design/, docs/tasks.md, docs/requirements.md）

### D-14: docs/assets/button.webp（untracked）の処遇【優先: 低】→ 決定済み（2026-06-12）

早押しボタンの参考画像。**ユーザー確認済み: 不使用・削除する**（コミットしない）。旧 Task 24（画像スプライト）も廃止が確定しており、ボタンはケース1ワイヤーフレームの CSS 物理ボタンで表現する。

修正: `docs/assets/button.webp` を削除する。

---

## C. 記述精度の向上（任意・低優先）

### D-15: Analytics のプライバシー記述整合

design.md は `input_answer`（プレイヤーの入力内容）を Firebase に送信する設計。SettingsModal の PrivacyInfo 文言（「入力した解答内容も統計処理の対象」）と整合していることを Task 25 実装時に再確認する旨を design.md Analytics セクションに注記。

### D-16: 「現在の実装方針（MVP版、仕様最終確定時に記述整理）」の棚卸し

External Pause Handling セクションに「仕様最終確定時に記述整理」と自己注記がある。Task 18 完了で仕様は実質確定しているため、この注記を外し、現実装（pauseExternal/resumeExternal、ANSWERING 中のカウントダウンのみ停止、stall 検出）を正として記述を確定させる。

### D-17: tasks.md Phase 1〜2 の完了タスクのアーカイブ

tasks.md は 450 行のうち 350 行が完了済みタスク。`docs/tasks-archive.md` へ Phase 1〜2 を移動し、tasks.md は「次のタスク + Phase 3 以降」のみにする（`04-task-replan.md` の新タスク表で置き換える際に同時実施）。

---

## 完了チェックリスト

- [x] D-1 100ms→150ms/定数名表記（5 箇所。ボタン演出の「100ms後」は BUTTON_PUSHED_DURATION_MS=100 として正しいため対象外）
- [x] D-2 Timeline の旧閾値 0.1 → 1.0
- [x] D-3 React 代替案の削除
- [x] D-4 hideVideoPlayerDuringAnswer 未実装注記 + タスク化
- [x] D-5 GameManager interface の実装同期
- [x] D-6 エラー表示の現状注記
- [x] D-7 音声素材タスクの追加
- [x] D-8 modestbranding 記述整理
- [ ] D-9 requirements 3.3 の表現更新
- [x] D-10 コンポーネントテスト方針の明記
- [ ] D-11 design.md 分割（参照更新・grep 検証込み）
- [ ] D-12 design-sync-handoff.md の転記と削除
- [ ] D-13 README / package.json name
- [ ] D-14 button.webp の削除（処遇は確認済み: 不使用）
- [ ] D-15 / D-17 任意項目（D-16 は完了: External Pause の注記を確定化済み）
