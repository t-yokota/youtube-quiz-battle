# Design Document

## Overview

YouTube上のクイズ動画を使った「早押しクイズ」ができるWebアプリケーション。視聴者もプレイヤーとなり、動画出演者との疑似的な早押しクイズ対決を楽しむことを可能にする。

### Core Concept

```
YouTubeクイズ動画 + 動画視聴中のリアルタイム早押し = インタラクティブな動画視聴体験
```

**基本体験**: プレイヤーはYouTubeに投稿されたクイズ動画を視聴しながら、画面上の早押しボタンをタップすることで解答権を取得し、動画内で出題されたクイズに解答する

**プレイ可能人数**: 1人

**対象環境**

- プライマリ: スマートフォンブラウザ（縦画面専用）
- セカンダリ: PCブラウザ（開発・デバッグ機能も用意する）

### Technical Stack

**推奨スタック**

- **Frontend**: Vue 3 (Composition API) + TypeScript + Vite
- **State Management**: Pinia
- **Styling**: Tailwind CSS
- **Target Platform**: スマートフォンブラウザ（縦画面専用）、PCブラウザ（開発・デバッグ用）

**代替スタック**

- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: Context API + useReducer
- **Styling**: Tailwind CSS

### Framework Selection

このプロジェクトではVue.js 3を採用します。主な理由：

1. **複雑な状態管理**: ゲーム状態、ボタン状態、時間管理の複雑な相互作用をPiniaで直感的に管理
2. **リアルタイム性**: 100ms間隔の動画時間更新、即座のUI状態反映にリアクティブシステムが最適
3. **状態遷移の可視性**: テンプレート内での条件分岐が複雑な状態遷移を理解しやすくする
4. **TypeScript統合**: Composition APIとTypeScriptの組み合わせが優秀
5. **学習・保守性**: 単一ファイルコンポーネントで構造が理解しやすい

## User Experience

### User Flow

**導入フェーズ**:

1. **Webページの読み込み** → ローディング画面を表示
2. **読み込み完了** → 動画プレイヤーや早押しボタンなどが画面に表示される
3. **早押しボタンをタップ** → ボタンチェック演出 → クイズ動画の再生開始

**ゲームプレイ**:

1. **動画が進行** → 問題が出題される → 早押しボタンが押せる状態になる
2. **早押しボタンをタップ** → 動画を一時停止・効果音を再生(ボタン音) → 解答入力フォームが有効になり、問題に解答できる
3. **解答を入力・送信** → 正誤判定の結果を表示・効果音を再生(正解音・不正解音) → 動画を再開
4. **次の問題まで動画が進行** → すべての問題が終わるまで繰り返し

### Control Methods

- **スマートフォン**: タッチ操作
- **PC**: モニターが対応していればタッチ操作可能、加えてスペースキー押下でも早押しが可能（その他は通常のマウス操作に対応）

#### Keyboard Handling (PC)

- 入力中の誤操作防止: フォーカスが`input/textarea/contentEditable`上にある場合はスペースキーを無視
- 既定スクロール抑止: スペースキー早押し時は`preventDefault()`を行う

```typescript
document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null
  const typing = !!target && (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    (target as any).isContentEditable
  )
  if (typing) return
  if (e.code === 'Space' && (state === 'READY' || state === 'QUESTIONING')) {
    e.preventDefault()
    handleButtonPress()
  }
})
```

### Button Check Feature

早押しクイズ文化における「ボタンチェック」を踏襲し、はじめに早押しボタンを押すことを動画の再生開始（＝クイズ対戦の開始）のトリガーとする。これによって、クイズが好きな視聴者にとって馴染みのあるインタラクションでゲームに導入する。

## System Architecture

```mermaid
graph TB
    subgraph "Client Application"
        UI[UI Components]
        GM[Game Manager]
        YT[YouTube Player]
        AM[Audio Manager]
        TM[Time Manager]
        VM[Validation Manager]
    end

    subgraph "External Services"
        YTA[YouTube API]
        QD[Quiz Data Files]
        AS[Audio Sprites]
    end

    UI --> GM
    GM --> YT
    GM --> AM
    GM --> TM
    GM --> VM
    YT --> YTA
    GM --> QD
    AM --> AS
```

## Game State Management

### Game State Definitions

| ゲーム状態 | 説明 | 早押しボタン操作 |
|------|------|-----------|
| LOADING | リソースのロード中 | ボタン非表示 |
| READY | ゲームの開始準備完了（ボタンチェック待ち） | 有効（ボタンチェック） |
| TALKING | 問題前後の会話区間 | 無効 |
| QUESTIONING | 問読み区間（早押し可能区間） | 有効（早押し） |
| ANSWERING | プレイヤーの解答区間 | 無効 |
| WAITING | 早押し不可区間（動画内プレイヤーの解答区間など） | 無効 |
| REVEALING | 正解発表区間 | 無効 |
| FINISHED | ゲーム終了（結果表示） | ボタン非表示 |

### State Transition Patterns

#### 状態遷移の起点

- **⏰ 時間経過起点**: 動画時間や制限時間の到達により自動発生する状態遷移
- **👆 アクション起点**: プレイヤーの操作によって即座に発生する状態遷移

#### ゲーム導入時の状態遷移

```
LOADING → [⏰ リソース読み込み完了] → READY → [👆 ボタンチェック] → TALKING（動画再生開始） → [⏰ 最初の問読み区間開始] → QUESTIONING
```

#### クイズ出題中の状態遷移

**（１）QUESTIONING状態からの分岐**

```
QUESTIONING
├── [👆 早押しボタン押下　] → ANSWERING（動画一時停止）
├── [⏰ 早押し不可区間開始] → WAITING
└── [⏰ 正解発表区間開始　] → REVEALING
```

**（２）ANSWERING状態からの分岐**

```
ANSWERING（動画一時停止）
├── [👆 解答送信] → 正誤判定
│   ├── [正解の場合]
│   │   ├── [正解発表区間への遷移設定 = true ] → REVEALING (時間をジャンプして動画再開)
│   │   └── [正解発表区間への遷移設定 = false] → WAITING (そのまま動画再開)
│   │
│   ├── [不正解 & 残り解答回数あり] → QUESTIONING (そのまま動画再開)
│   │
│   └── [不正解 & 残り解答回数なし]
│       ├── [正解発表区間への遷移設定 = true ] → REVEALING (時間をジャンプして動画再開)
│       └── [正解発表区間への遷移設定 = false] → WAITING (そのまま動画再開)
│
└── [⏰ 解答制限時間終了] → 強制正誤判定
    └── （上記と同じ分岐処理）
```

**（３）WAITING状態からの分岐**

```
WAITING
├── [⏰ 早押し不可区間終了] → QUESTIONING
└── [⏰ 正解発表区間開始　] → REVEALING
```

**（４）その他の時間経過起点遷移**

```
REVEALING → [⏰ 正解発表区間終了] →
            ├── [最後の問題の場合] → FINISHED
            └── [続きの問題がある場合] → TALKING

TALKING → [⏰ 問読み区間開始] → QUESTIONING
```

### State Transition Flow

```mermaid
flowchart TD
  START([ゲーム開始]) --> LOADING[リソース読み込み<br>LOADING]
  LOADING --> |⏰ リソース読み込み完了| READY[ボタンチェック待ち<br>READY]
  READY --> |👆 ボタンチェック<br>→動画再生開始| TALKING[会話区間<br>TALKING]
  TALKING --> |⏰ 最初の問題の<br>問読み区間開始| QUESTIONING[問読み区間<br>QUESTIONING]

  QUESTIONING --> |👆 早押しボタン押下| ANSWERING[解答区間<br>ANSWERING]
  QUESTIONING --> |⏰ 早押し不可区間開始| WAITING[早押し不可区間<br>WAITING]
  QUESTIONING --> |⏰ 正解発表区間開始| REVEALING[正解発表区間<br>REVEALING]

  ANSWERING --> |👆 解答送信| JUDGE{解答判定}
  ANSWERING --> |⏰ 解答制限時間終了| JUDGE

  JUDGE --> |正解| CORRECT_JUMP{正解発表区間へ遷移?}
  JUDGE --> |不正解| INCORRECT_CHECK{残り解答回数?}

  CORRECT_JUMP --> |true| REVEALING
  CORRECT_JUMP --> |false| WAITING

  INCORRECT_CHECK --> |あり| QUESTIONING
  INCORRECT_CHECK --> |なし| INCORRECT_JUMP{正解発表区間へ遷移?}
  INCORRECT_JUMP --> |true| REVEALING
  INCORRECT_JUMP --> |false| WAITING

  WAITING --> |⏰ 早押し不可区間終了| QUESTIONING
  WAITING --> |⏰ 正解発表区間開始| REVEALING

  REVEALING --> |⏰ 正解発表区間終了| LAST_CHECK{最後の問題?}

  LAST_CHECK --> |No| TALKING[会話区間<br>TALKING]
  LAST_CHECK --> |Yes| FINISHED[ゲーム終了<br>FINISHED]

  TALKING --> |⏰ 次の問題の<br>問読み区間開始| QUESTIONING

  FINISHED --> |👆 もう一度プレイ| LOADING
```

## Button State Management

### Button State Definitions

| ボタン状態 | 名称 | 説明 | 押下可否 |
|------|------|------|---------|
| STANDBY | 待機状態 | ボタンのデフォルト状態 | 可能 |
| PUSHED | 押下状態 | ボタンが押された状態 | 不可 |
| RELEASED | 点灯状態 | ボタンのLEDが点灯した状態（解答権取得） | 不可 |
| DISABLED | 無効状態 | ボタン押下が無効の状態 | 不可 |

### Button State Transitions

```mermaid
stateDiagram-v2
  [*] --> 非表示 : LOADING
  非表示 --> STANDBY : READY

  %% ユーザー操作起因の遷移（ボタンチェック＆早押し）
  STANDBY --> PUSHED : ボタン押下<br>(ボタンチェックor早押し)
  PUSHED --> RELEASED : 100ms後<br>自動遷移
  RELEASED --> STANDBY : (ボタンチェック時)<br>1500ms後<br>自動遷移

  %% 解答結果・状態変化による遷移
  RELEASED --> STANDBY : QUESTIONING
  RELEASED --> DISABLED : WAITING<br>REVEALING<br>TALKING

  STANDBY --> DISABLED : WAITING<br>REVEALING<br>TALKING

  DISABLED --> STANDBY : QUESTIONING
  DISABLED --> 非表示 : FINISHED
```

### Button State Transition Timing Details

| 遷移パターン | トリガー | 遷移時間 | 詳細 |
|------------|---------|---------|------|
| 非表示 → STANDBY | ゲーム状態変化（READY） | 即座 | ゲーム開始準備完了時 |
| STANDBY → PUSHED | ボタン押下 | 即座 | ボタン押下音再生 |
| PUSHED → RELEASED | 自動遷移 | 100ms後 | 視覚的フィードバック |
| RELEASED → STANDBY | 自動遷移（ボタンチェック時） | 1500ms後 | 正解音再生 |
| RELEASED → STANDBY | ゲーム状態変化（QUESTIONING） | 即座 | 早押し成功時 |
| RELEASED → DISABLED | ゲーム状態変化 | 即座 | WAITING/REVEALING/TALKING状態時 |
| STANDBY → DISABLED | ゲーム状態変化 | 即座 | WAITING/REVEALING/TALKING状態時 |
| DISABLED → STANDBY | ゲーム状態変化（QUESTIONING） | 即座 | 問題開始時 |
| DISABLED → 非表示 | ゲーム状態変化（FINISHED） | 即座 | ゲーム終了時 |

### Button Interaction Rules

**ボタンチェック時**（ゲーム状態: READY状態）

1. ボタン押下 → PUSHED状態（ボタン押下音再生開始）
2. 100ms後 → RELEASED状態
3. 1500ms後 → STANDBY状態（正解音再生開始）
4. 1500ms後 → ゲーム状態がTALKING状態に遷移（動画再生開始）

**早押し時**（ゲーム状態: QUESTIONING状態）

1. ボタン押下 → PUSHED状態（ボタン押下音再生開始、動画一時停止）
2. 100ms後 → RELEASED状態
3. ゲーム状態がANSWERING状態に遷移 → RELEASED状態を維持

**状態連動**

- ゲーム状態がWAITING/REVEALING/TALKING状態 → DISABLED状態
- ゲーム状態がQUESTIONING状態 → STANDBY状態（押下可能）

## Time Management

### Video Time Structure

- **QUIZ区間**: 問読み区間から正解発表区間までをまとめた1問の問題の区間
- **TALK区間**: QUIZ区間以外の区間

動画内で複数の問題が出題される場合、複数のQUIZ区間を持つ。動画内のQUIZ区間以外の区間はすべてTALK区間とする。

### Static Time Variables

#### QUIZ区間に関する時間変数:

```typescript
interface QuizQuestion {
  startTime: number // 問読み区間の開始時間（秒）
  revealTime: number // 正解発表区間の開始時間（秒）
  endTime: number // 正解発表区間の終了時間（秒）
  othersAnsweringPeriods?: OthersAnsweringPeriod[] // 動画内プレイヤーの解答区間
}

interface OthersAnsweringPeriod {
  startTime: number // 解答開始時間（秒）
  endTime: number // 解答終了時間（秒）
}
```

#### OthersAnsweringPeriods の優先順位と検証

- 区間優先順位（同一問題内の時刻`t`）
  1. `revealTime <= t < endTime` → REVEALING
  2. それ以外で `othersAnsweringPeriods` のいずれかに含まれる → WAITING
  3. `startTime <= t < revealTime` → QUESTIONING
  4. 上記以外 → TALKING

- 完全包含の条件（検証）
  - 各 `othersAnsweringPeriods` は、その問題の QUESTIONING 区間（`[startTime, revealTime)`）に完全に収まること
  - 相互に重ならない（昇順に整列し、`p[i].endTime <= p[i+1].startTime`）
  - 違反するデータは読み込み時にエラーとする

#### TALK区間に関する時間変数:

なし。QUIZ区間の範囲外の動画時間を自動的にTALK区間として扱い、その間のゲーム状態をTALKING状態と判定する。

### Dynamic System Time Variables

動画の再生時間に関する以下のシステム変数を常に管理・更新することで、現在の動画時間を把握する。
currentVideoTimeは、YouTube PlayerのAPIによって取得する動画の現在再生時間である。

| 変数名 | 説明 | 更新タイミング | 用途 |
|--------|------|-------------|------|
| currentVideoTime | 現在の動画再生時間 | 100ms間隔 | 状態遷移判定 |
| watchedVideoTime | 連続視聴での最大到達時間 | currentVideoTime更新後 | シーク検出、状態遷移判定 |

### Seek Detection via watchedVideoTime

**前提**: 本ゲームでは公正な進行のために、シークバーの使用を原則で禁止とする。

watchedVideoTimeは、currentVideoTimeの更新後にその値と同期させるかたちで更新していく変数である。currentVideoTimeの値を更新したあとで、"更新後のcurrentVideoTimeの値"と"同期更新前のwatchedVideoTimeの値"の比較を行うことで、プレイヤーによるシークバーの使用（による、動画再生時間のジャンプ）を検出する。

- **シーク判定方法**: `|currentVideoTime - watchedVideoTime| > SEEK_TOLERANCE_SEC` を満たすとき
- **同期更新方式**: `watchedVideoTime = Math.max(watchedVideoTime, currentVideoTime)` ※常に最大値を保持する
- **監視頻度**: currentVideoTimeの更新ごと

推奨の許容幅（更新間隔との関係）:

- 基本方針: 「TimeUpdateの更新間隔 × 2」を許容幅とし、最低でも0.2秒を確保する
- 目的: setIntervalの揺らぎや`getCurrentTime()`の量子化を吸収して誤検出を防ぐ

```typescript
// 更新間隔（TimeUpdateのtick間隔と合わせる）
const UPDATE_INTERVAL_MS = 150 // 例: setInterval(timeUpdateTick, 150)
const SEEK_TOLERANCE_SEC = Math.max(0.2, (UPDATE_INTERVAL_MS / 1000) * 2)
```

### Seek Detection Behavior

プレイヤーによるシークバーの利用が検出された場合の挙動として、以下の2パターンを設定変数の値によって選択できるようにする。

| disableSeekbar設定 | シーク検出時の動作 |
|---------------|------------------|
| true | 動画の再生時間をwatchedVideoTimeまで強制リセットする |
| false | ゲーム状態を強制的にWAITING状態にして、その状態で固定したままシーク後の位置からの動画再生を継続する。<br>そこからシーク操作なしで新たなQUIZ区間に到達したら、その時点からゲーム状態の遷移判定処理を再開し、プレイヤーが問題に参加できるようにする。 |

### State Transition Conditions

```typescript
// 時間経過を起点とした状態遷移の判定条件
function shouldTransition(targetTime: number): boolean {
  return currentVideoTime >= targetTime && watchedVideoTime >= targetTime
}
```

#### 遷移境界ルール（包含規則）

- QUESTIONING 開始: `current >= startTime`（`startTime`で包含）
- REVEALING 開始: `current >= revealTime`（`revealTime`で包含）
- REVEALING 終了: `current >= endTime` 到達で次状態へ
- 1ティックで複数閾値を跨いだ場合は、時間順にすべて処理する

#### 一回性トリガ（Single‑Shot Guard）

採用: 問題単位で「start/reveal/end」を各1回だけ処理するフラグ管理を行う（巻き戻しや任意シークがあっても安全）。比較時には微小な許容値 `EPS`（目安: `1e-3` 秒）を加えて量子化ズレを吸収する。

```typescript
// 問題ごとの一回性フラグ（start/reveal/end を各1回だけ処理）
const consumed: Record<number, { start: boolean; reveal: boolean; end: boolean }> = {}
const EPS = 1e-3

function applyThresholds(prev: number, curr: number, q: QuizQuestion) {
  const c = consumed[q.index] ?? (consumed[q.index] = { start: false, reveal: false, end: false })
  if (!c.start && prev + EPS < q.startTime && curr + EPS >= q.startTime) { c.start = true; onStart(q) }
  if (!c.reveal && prev + EPS < q.revealTime && curr + EPS >= q.revealTime) { c.reveal = true; onReveal(q) }
  if (!c.end && prev + EPS < q.endTime && curr + EPS >= q.endTime) { c.end = true; onEnd(q) }
}
```

`jumpToRevealPeriod=true` でシークするコードパスでは、時間ハンドラより先に `consumed[q.index].reveal = true` を設定し、二重発火が起きないよう順序を固定する。

参考: 時間経過起点のハンドラと GameManager の対応付け

```typescript
function onStart(q: QuizQuestion) {
  // 状態とカウンタを問題開始用に初期化
  currentQuestionIndex = q.index
  remainingAttempts = quizSettings.attemptLimit
  remainingAnswerTime = q.answerTimeLimit ?? quizSettings.answerTimeLimit

  // 入力/UIの初期化
  currentAnswerInput = ''
  // QUESTIONING でボタンを押下可能に
  transitionToState(GAME_STATE.QUESTIONING)
}

function onReveal(q: QuizQuestion) {
  // 時間経過で正解発表区間へ遷移（入力は不可、結果表示）
  transitionToState(GAME_STATE.REVEALING)
  // 備考: アクション起点（解答送信）で jumpToRevealPeriod=true の場合は
  // 先に player.seekTo(q.revealTime) を行うコードパスが別に存在する
}

function onEnd(q: QuizQuestion) {
  // 正解発表区間の終了。最後かどうかで分岐
  const isLast = q.index >= questions.length
  transitionToState(isLast ? GAME_STATE.FINISHED : GAME_STATE.TALKING)
  // 後処理（例）: スコア集計・結果保存・入力クリアなど
}
```

#### 1ティック内の複数閾値走査

`setInterval`の遅延等で閾値を飛び越える可能性に備え、`(prev, curr]`の窓内を走査して順に処理する。比較は `EPS` を考慮して行い、境界値の取りこぼしを防ぐ。

```typescript
function processTimeWindow(prev: number, curr: number, q: QuizQuestion) {
  const thresholds = [q.startTime, q.revealTime, q.endTime]
    .filter((t) => t > prev + EPS && t <= curr + EPS)
    .sort((a, b) => a - b)
  for (const t of thresholds) transitionAt(t)
}
```

Tips: YouTube IFrame API の `getCurrentTime()` は量子化誤差で想定値より僅かに小さい値を返すことがあるため、このように `EPS` を用いて閾値との比較に余裕を持たせている。

### WatchedVideoTime Update Logic

```mermaid
flowchart TD
    Start(["currentVideoTimeを更新"]) --> Check{シーク検出?}

    Check -->|No| Update["watchedVideoTimeを更新<br>watchedVideoTime = Math.max(watchedVideoTime, currentVideoTime)"]

    Check -->|Yes| Setting1{disableSeekbar?}

    Setting1 -->|true| Reset["動画時間を強制リセット<br>player.seekTo(watchedVideoTime)"]
    Setting1 -->|false| Wait["ゲーム状態をWAITINGへ<br>watchedVideoTimeを更新<br>watchedVideoTime = Math.max(watchedVideoTime, currentVideoTime)"]

    Update --> Setting2{状態遷移を停止中？}

    Setting2 --> |true| Window[未消費閾値の走査]
    Setting2 --> |false| Transition[状態遷移の判定処理]

    Window --> |未消費startあり| Time{次のQUIZ区間に到達？}
    Window --> |全start消費済&未消費endなし| Finish[FINISHEDへ遷移]
    Window --> End

    Time --> |true| Transition
    Time --> |false| Block

    Reset --> End
    Wait --> Block["状態遷移を停止<br/>（閾値処理のみ継続）"]

    Transition --> End(["完了"])
    Finish --> End
    Block --> End
```

#### Time Update Loop（簡易実装例）

動画時刻の定期更新処理（TimeUpdate）では、再生直後の誤検出を避けるウォームアップ猶予と、壁時計との差分による停滞チェックの枠組みを持たせる。

状態遷移停止中も `processTimeWindow` は継続し、未消費の `reveal/end` 閾値があれば消化する。すべての問題で `start` が消費済みかつ未消費の `end` が残っていない場合は、強制的に `FINISHED` へ遷移させてソフトロックを防ぐ。

```typescript
const STALL_WALL_MS = 1200
const STALL_VIDEO_DELTA_SEC = 0.05
const STARTUP_GRACE_MS = 1000

let startedAt = performance.now()
let lastWallMs = startedAt
let lastVideoTime = player.getCurrentTime()

function timeUpdateTick() {
  const now = performance.now()
  const current = player.getCurrentTime()

  // 再生開始直後の誤検出回避
  if (now - startedAt < STARTUP_GRACE_MS) {
    lastWallMs = now
    lastVideoTime = current
    return
  }

  // 必要に応じて停滞（スタール）検出をここで行う
  const ps = player.getPlayerState()
  const wallDelta = now - lastWallMs
  const videoDelta = current - lastVideoTime
  const playbackIntended = ps === YouTubePlayerState.PLAYING || ps === YouTubePlayerState.BUFFERING
  if (!gm.externalPaused && playbackIntended && wallDelta >= STALL_WALL_MS && videoDelta < STALL_VIDEO_DELTA_SEC) {
    gm.pauseExternal('stall')
  }
  if (gm.externalPaused && gm.externalPausedReason === 'stall' && videoDelta >= STALL_VIDEO_DELTA_SEC) {
    gm.resumeExternal()
  }

  // 通常の時間更新・シーク検出・状態判定を実施
  gm.updateVideoTime(current)

  lastWallMs = now
  lastVideoTime = current
}

// 推奨起動間隔の目安: 100〜200ms
setInterval(timeUpdateTick, 150)
```

#### External Pause Handling（外部一時停止対応）

ページ可視性・プレイヤー状態・再生停滞を検出し、ゲームの時間遷移・シーク検出・UIを一時停止/再開する。

**現在の実装方針（MVP版、仕様最終確定時に記述整理）:**

- 外部一時停止検知時に `player.pauseVideo()` を明示的に呼び出す
- 動画停止中は `getCurrentTime()` が進まないため、TimeManagerへの影響はない
- GameManager側で状態管理とUI表示を実施
- TimeManagerから外部一時停止関連のコードは削除済み

**検出ポイント:**
- 可視性: `document.hidden` による検出（`visibilitychange`/`pagehide`/`pageshow`）
- プレイヤー状態: `onStateChange(PAUSED/PLAYING)`（内部操作は `gm.internalAction` で除外）
- 再生停滞: TimeUpdate内で `wallDelta` と `videoDelta` を比較
- 広告再生: YouTube広告中は `getCurrentTime()` が進まないため特別な処理不要

**一時停止時の動作:**
- `player.pauseVideo()` で動画を明示的に停止
- ANSWERING のカウントダウン停止
- UI に「一時停止中」オーバーレイを表示（ただし ANSWERING 中は表示しない）

**再開時の動作:**
- `player.playVideo()` で動画を再開
- 同じ時間から再開されるため、シーク誤検出は起きない想定

**将来の検討事項:**
- タブ切り替え時の `setInterval` 遅延による誤検出が発生する場合、猶予期間（`RESUME_GRACE_MS ≈ 300ms`）の追加を検討
- 動作確認で問題が確認されてから実装する

可視性・プレイヤー状態のイベント例:

```typescript
// 可視性変化
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    player.pauseVideo()
    gm.setExternalPaused(true, 'visibility')
  } else {
    player.playVideo()
    gm.setExternalPaused(false)
  }
})

// プレイヤー状態
player.onStateChange((s) => {
  if (s === YouTubePlayerState.PAUSED && !gm.internalAction) {
    gm.setExternalPaused(true, 'user')
  }
  if (s === YouTubePlayerState.PLAYING && gm.externalPaused) {
    gm.setExternalPaused(false)
  }
})
```

### Timeline Examples

**正常な連続視聴時**

```mermaid
timeline
  section システム処理1
    getCurrentTime()=0.1 : currentVideoTime=0.1<br>watchedVideoTime=0.0: シーク検出=false: watchedVideoTime=0.1
    getCurrentTime()=0.2 : currentVideoTime=0.2<br>watchedVideoTime=0.1: シーク検出=false: watchedVideoTime=0.2
    getCurrentTime()=0.3 : currentVideoTime=0.3<br>watchedVideoTime=0.2: シーク検出=false: watchedVideoTime=0.3
    ... snip ...  : ...<br>... : ... : ...
    getCurrentTime()=5.1 : currentVideoTime=5.1<br>watchedVideoTime=5.0: シーク検出=false: watchedVideoTime=5.1
```

**シーク操作による非連続な動画視聴時**（disableSeekbar = true）

```mermaid
timeline
  section システム処理1
    getCurrentTime()=0.1 : currentVideoTime=0.1<br>watchedVideoTime=0.0: シーク検出=false: watchedVideoTime=0.1
    ... snip ...  : ...<br>... : ... : ...
    getCurrentTime()=5.1 : currentVideoTime=5.1<br>watchedVideoTime=5.0: シーク検出=false: watchedVideoTime=5.1
  section プレイヤーアクション
    シーク実施 : 再生位置が15.0に移動
  section システム処理2
    getCurrentTime()=15.0 : currentVideoTime=15.0<br>watchedVideoTime=5.1: シーク検出=true<br>|15.0 - 5.1| > 0.1: seekTo(5.1)
    getCurrentTime()=5.1: currentVideoTime=5.1<br>watchedVideoTime=5.1: シーク検出=false: watchedVideoTime=5.1
    getCurrentTime()=5.2: currentVideoTime=5.2<br>watchedVideoTime=5.1: シーク検出=false: watchedVideoTime=5.2
```

**シーク操作による非連続な動画視聴時**（disableSeekbar = false）

```mermaid
timeline
  section システム処理1
    getCurrentTime()=0.1 : currentVideoTime=0.1<br>watchedVideoTime=0.0: シーク検出=false: watchedVideoTime=0.1
    ... snip ... : ...<br>... : ... : ...
    getCurrentTime()=5.1 : currentVideoTime=5.1<br>watchedVideoTime=5.0: シーク検出=false: watchedVideoTime=5.1
  section プレイヤーアクション
    シーク実施 : 再生位置を15.0にシーク
  section システム処理2
    getCurrentTime()=15.0 : currentVideoTime=15.0<br>watchedVideoTime=5.1: シーク検出=true<br>|15.0 - 5.1| > 0.1: watchedVideoTime=15.0: 状態=WAITING
    getCurrentTime()=15.1 : currentVideoTime=15.1<br>watchedVideoTime=15.0: シーク検出=false: watchedVideoTime=15.1: 正解発表区間が開始<br>revealTime=15.1 : 状態=WAITING<br>(状態遷移は停止中)
    getCurrentTime()=15.2 : currentVideoTime=15.2<br>watchedVideoTime=15.1: シーク検出=false: watchedVideoTime=15.2: 正解発表区間が終了<br>endTime=15.2 : 状態=WAITING<br>(状態遷移は停止中)
    getCurrentTime()=15.3 : currentVideoTime=15.3<br>watchedVideoTime=15.2: シーク検出=false: watchedVideoTime=15.3: 問読み区間が開始<br>startTime=15.3 : 状態遷移の判定処理 : 状態=QUESTIONING
```

## Core Components

### Game Manager

```typescript
interface GameManager {
  // 状態管理
  currentState: GAME_STATE
  buttonState: BUTTON_STATE

  // ゲーム制御
  startGame(): void
  handleButtonPress(): void
  handleAnswerSubmit(answer: string): void
  updateVideoTime(time: number): void

  // 状態遷移
  transitionToState(newState: GAME_STATE): void
  checkTimeBasedTransitions(): void
}
```

### YouTube Player Manager

```typescript
interface YouTubePlayerManager {
  // プレイヤー制御
  loadVideo(videoId: string): Promise<void>
  playVideo(): void
  pauseVideo(): void
  seekTo(time: number): void

  // 状態取得
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): YouTubePlayerState

  // イベント処理
  onTimeUpdate(callback: (time: number) => void): void
  onStateChange(callback: (state: number) => void): void
}

// YouTube IFrame API states (YT.PlayerState)
export enum YouTubePlayerState {
  UNSTARTED = -1, // 再生前
  ENDED = 0,      // 再生終了
  PLAYING = 1,    // 再生中
  PAUSED = 2,     // 一時停止
  BUFFERING = 3,  // バッファリング
  CUED = 5,       // ロード済み（再生待ち）
}
```

#### YouTube Player Vars（推奨設定）

本プロジェクトでの推奨 `playerVars` 構成（初期化時のみ設定。実行中の切替なし）:

```typescript
type PlayerVars = Record<string, string | number | boolean>

function buildPlayerVars(settings: QuizSettings): PlayerVars {
  return {
    playsinline: 1,
    controls: settings.disableSeekbar ? 0 : 1, // 公平性に合わせて決定
    disablekb: 1, // 常にキーボード操作無効
    fs: 0,        // 常にフルスクリーン禁止
    modestbranding: 1,
    rel: 0,
    autoplay: 0,
    cc_load_policy: 0,
    hl: 'ja',
    origin: window.location.origin, // ページオリジンを明示
  }
}

// プライバシー配慮が必要なら host に nocookie を指定
const player = new YT.Player(el, {
  videoId,
  host: 'https://www.youtube-nocookie.com',
  playerVars: buildPlayerVars(quizSettings),
  events: { onReady, onStateChange },
})
```

#### YouTube Player Vars Profiles（運用ガイド）

開発運用上のプロファイルとして、Strict（本番）と Debug（検証用）を用意できる。切り替えは初期化時のみで、実行中の変更は行わない。

```typescript
// Strict（本番既定）: 公平性を重視
const strictPlayerVars = {
  playsinline: 1,
  controls: 0,   // シークUIを隠す
  disablekb: 1,  // キーボード制御無効
  fs: 0,         // フルスクリーン不可
  modestbranding: 1,
  rel: 0,
  autoplay: 0,
  cc_load_policy: 0,
  hl: 'ja',
}

// Debug（検証用）: 操作性を一時的に優先（本番では使用しない）
const debugPlayerVars = {
  playsinline: 1,
  controls: 1,   // UIを出して手動検証しやすく
  disablekb: 1,  // それでもキーボードは無効化
  fs: 0,         // フルスクリーン不可のまま
  modestbranding: 1,
  rel: 0,
  autoplay: 0,
  cc_load_policy: 0,
  hl: 'ja',
}
```

注意:

- 本番は Strict を既定とし、`controls` は `disableSeekbar` 設定に基づく単一仕様で十分（実運用ではDebugに切り替えない）
- `origin: window.location.origin` は buildPlayerVars で明示し、オリジン検証の安定性を高める

### Time Manager

TimeManagerは時間管理のプリミティブなメソッドを提供する。動画時間に基づくシーク検出時の処理（player.seekTo()や状態遷移停止）はGameManager側で実施する。

```typescript
interface TimeManager {
  // 時間管理
  getCurrentVideoTime(): number
  getWatchedVideoTime(): number
  updateCurrentVideoTime(time: number): void
  updateWatchedVideoTime(time: number): void

  // シーク検出
  isSeekDetected(time: number): boolean

  // 状態判定
  getCurrentGameState(questionIndex: number): GAME_STATE
  isInQuestionPeriod(time: number, question: QuizQuestion): boolean
  isInRevealPeriod(time: number, question: QuizQuestion): boolean
  isInOthersAnsweringPeriod(time: number, question: QuizQuestion): boolean
  hasOthersAnsweringPeriodInRange(
    startTime: number,
    endTime: number,
    question: QuizQuestion,
  ): boolean
}
```

### Audio Manager

```typescript
interface AudioManager {
  // 音声制御
  playSound(soundType: SOUND_TYPE): Promise<void>
  stopSound(soundType?: SOUND_TYPE): void
  setVolume(volume: number): void // 0-1の範囲で設定

  // 設定管理
  setSoundEnabled(enabled: boolean): void
  isSoundSupported(): boolean

  // 音量制御
  getVolume(): number // 現在の音量を取得
  setMute(muted: boolean): void // ミュート制御
}
```

### Audio Mangement System Details

#### 音声の種類

- **ゲーム効果音**: ボタン押下音、正解音、不正解音
- **YouTube動画音**: 動画プレイヤー側で制御される動画音声

#### 制御手法

- 推奨: Web Audio API
- フォールバック: HTML Audio
- 役割分担: AudioManagerは再生制御のみ、GameConfigで設定管理を実施

#### 制御ルール

_ボタンチェック時_

- ボタン押下音 → 早押しボタン押下時
- 正解音 → ボタン状態がSTANDBY状態へ遷移時

_クイズ開始後_

- ボタン押下音 → 早押しボタン押下時 または ANSWERING状態への遷移時
- 正解音 → 正誤判定を実施して正解時
- 不正解音 → 正誤判定を実施して不正解時

_制御ルール_

- 新たな効果音再生時は、再生中の効果音を停止してから新しい効果音を再生
- ゲーム状態遷移は音声再生終了を待たないが、ゲーム状態が遷移した後も効果音の再生は継続する

#### 音声スプライトの構成

```typescript
enum SOUND_TYPE {
  BUTTON = 'button', // ボタン押下音
  CORRECT = 'correct', // 正解音
  INCORRECT = 'incorrect', // 不正解音
}

const DEFAULT_AUDIO_SPRITE = {
  src: '/assets/sounds/quiz-sounds.mp3',
  sprite: {
    button: { start: 0, duration: 0.5 },
    correct: { start: 0.5, duration: 1.0 },
    incorrect: { start: 1.5, duration: 0.8 },
  },
}
```

### Answer Validator

```typescript
interface AnswerValidator {
  // 正誤判定
  validate(userInput: string, correctAnswers: string[]): boolean

  // 正規化処理
  normalizeAnswer(input: string, config: AnswerValidationConfig): string
  detectTextType(input: string): TextType
}
```

### Answer Validation System Details

#### 基本方針と段階導入

- クライアント側で処理: 正解データをクライアントで保持し、入力と比較して同期判定
- Phase 2（MVP）: 正規化なし＋完全一致のみ（必要なら内部で`trim+NFKC`を用意し既定OFF）
- Phase 3: 安全な統一パイプラインをグローバル適用（下記）。可変オプションは使用しない
- Requirement 4 の受け入れ条件（全角半角・大小文字・仮名揺れなど）を満たすのは Phase 3 完了時点。Phase 2 では未達成であることをタスク計画に明記し、進捗管理時は Phase 3 を要件達成ポイントとする。

#### Phase 3 デフォルト正規化パイプライン

1. Unicode 正規化（NFKC）
2. 英字の大文字小文字統一（casefold）
3. 前後空白の trim（内部空白は保持）
4. 日本語が含まれる場合のみ（文字種検出でON）
   - 半角カナ→全角カナ
   - ひらがな/カタカナのどちらかへ統一（既定: カタカナ）
   - 小書きかなの標準化
   - 長音記号の同形異体統一（「ー/ｰ/―/－」→「ー」）
5. 数字の幅統一（全角→半角）。桁区切り・先頭ゼロ・ローマ/漢数字変換は行わない

注: 句読点・記号の統一/除去は Phase 3 では実施しない（誤陽性リスク回避）。

#### 日本語含有の存在検出（ON/OFF判定）

```typescript
// Unicode Property 対応環境（Node 20+ / 主要ブラウザ）
const RE_JP = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\uFF66-\uFF9F\u3005\u303B\u309D-\u309E\u30FD-\u30FE]/u

function containsJapanese(s: string): boolean {
  const t = s.normalize('NFKC')
  return RE_JP.test(t)
}

// フォールバック（Property未対応）
const RE_JP_FALLBACK = /[\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF66-\uFF9F\u3005\u303B\u309D-\u309E\u30FD-\u30FE]/
```

## UI Architecture

### Component Design Approach

**Vue.js Single File Components（推奨）**

- テンプレート、スクリプト、スタイルを分離した構造
- Composition APIによる状態管理
- リアクティブな状態変更の自動反映

**React Functional Components（代替案）**

- JSX内での条件分岐による状態表現
- Hooksによる状態管理
- useCallback/useMemoによる最適化

### UI Component Hierarchy

```
App
├── AppHeader (common/)
│   ├── Title
│   └── SettingsButton (歯車アイコン)
├── VideoPlayer (common/)
│   └── YouTubePlayer
├── GamePanel (game/) - ゲーム中の統合パネル
│   ├── GameInfo
│   │   ├── ProgressDisplay
│   │   └── ScoreDisplay
│   └── AnswerArea (内部でmode切り替え)
│       ├── GuideText (LOADING/READY/TALKING状態)
│       └── AnswerContent (QUESTIONING/ANSWERING/WAITING/REVEALING状態)
│           ├── AnswerMeta
│           │   ├── AttemptsCounter
│           │   ├── AnswerTimer
│           │   └── AnswerResult
│           └── AnswerInput
│               ├── TextInput
│               └── SubmitButton
├── QuizButton (game/)
├── FinalScore (result/) - FINISHED状態で直接配置
├── ResultTable (result/) - FINISHED状態で直接配置
├── ResultActions (result/) - FINISHED状態で直接配置
├── SettingsModal (dialogs/)
│   ├── VolumeControl
│   │   ├── VolumeIcon (音量0-4に応じて表示変化)
│   │   └── VolumeSlider (0-4の5段階)
│   ├── PrivacyInfo
│   └── CloseButton
└── DialogSystem (dialogs/)
    ├── LoadingDialog
    ├── OrientationDialog
    └── ErrorDialog
```

**ディレクトリ構造:**

```
src/components/
├── common/      - 共通コンポーネント
├── game/        - ゲーム中のコンポーネント
├── result/      - リザルト表示コンポーネント
└── dialogs/     - モーダル/ダイアログ
```

**コンポーネント設計の特徴:**

- **GamePanel**: GameInfoとAnswerAreaを一つのパネルとして統合
  - 視覚的な一つの単位（白いパネル）とコンポーネント構造を一致
  - GameInfo/AnswerArea間のgap管理を担当
  - 内部でmode切り替えによりGuideText/AnswerContentを表示制御

- **Result領域**: 統合役コンポーネントなし
  - FinalScore、ResultTable、ResultActionsを個別コンポーネント化
  - App.vueで直接配置し、`.result-ui`でpadding/gap管理

- **レイアウト責任分担**:
  - App.vue: `.game-ui`/`.result-ui`でpadding管理
  - GamePanel: GameInfo/AnswerArea間のgap管理（背景色が見える隙間）
  - 各コンポーネント: 内部スタイリングのみ担当

### Screen Layout

- **Screen Size**: スマートフォン画面に合わせたレスポンシブ設計（縦画面専用）
- **Layout**: 上から順に配置される垂直レイアウト
- **Video Player**: 16:9アスペクト比を維持（画面幅に応じて自動調整）

### UI Elements

**Header**

- 固定表示「YouTube Quiz Battle」
- 青色背景 (#2563eb)
- 右上に歯車アイコンボタン（設定画面表示用）

**Video Player**

- 16:9アスペクト比維持
- 状態による表示制御あり
- 画面幅に応じてサイズ調整

**Game Info Area**

- 進行状況表示（例：「第3問」）
- スコア表示（例：「○: 2 ×: 1」）

**Answer Area**（解答エリアは状態によって異なるコンテンツを表示）

_Guide Text（LOADING/READY/TALKING状態用）_

- LOADING状態：「読み込み中...」
- READY状態：「ボタンを押してゲームを開始」
- TALKING状態：
  - 1問目開始前：「問題の開始をお待ちください」
  - 1問目終了後以降：「次の問題をお待ちください」

_Answer Content（QUESTIONING/ANSWERING/WAITING/REVEALING状態用）_

1. **Answer Meta Information Area**
   - 残り解答回数表示（例：「残り 2回」）
   - 解答制限時間タイマー（例：「残り 10秒」）
   - 解答結果表示（「正解！」または「不正解」）

2. **Answer Input Field**
   - テキスト入力（最大100文字）
   - プレースホルダー：「解答を入力」
   - 状態により有効/無効が切り替わる

3. **Answer Submit Button**
   - ラベル：「送信」
   - 状態により有効/無効が切り替わる

**Quiz Button**

- **Size**: レスポンシブ設計
  - 解答エリア下の余剰スペースを最大限活用
  - 縦横比固定（縦:横 = 4:3の比率を維持）
  - 画面サイズに応じて可能な限り大きなサイズで表示
- **Placement**: 解答エリア下の残りスペースを占有
- **Implementation**:
  - **Phase1**: Rectangle描画での実装（CSSスタイルによる状態表現）
  - **Future**: 横並び画像スプライト、SVG採用も検討
- **4つの状態**: STANDBY/PUSHED/RELEASED/DISABLED

**Result Area**（FINISHED状態でのみ表示）

_Final Score_

- 最終スコア表示（例：「🎉 ゲーム終了！ 正解数: 3/5問 (60%)」）

_Result Table_

- 個別結果表（基本構成）:
  | 問題 | 結果 | 正答 | あなたの解答 |
  |------|------|------|-------------|
  | 第1問 | ○ | 東京 | 東京 |
  | 第2問 | × | 織田信長 | 豊臣秀吉 |
  | 第3問 | ○ | 富士山 | ふじさん |

- 簡略版（横幅不足時）:
  | 問題 | 結果 | 正答 |
  |------|------|------|
  | 第1問 | ○ | 東京 |
  | 第2問 | × | 織田信長 |
  | 第3問 | ○ | 富士山 |

_Action Buttons_

- **もう一度プレイ**: 同じ動画で再プレイ（ページリロード）
- **別の動画**: 動画選択画面への遷移（将来実装）

**Settings Modal**（歯車ボタン押下で表示）

- オーバーレイでゲーム画面の上に表示
- モーダルウィンドウイメージ:
  ```
  ┌──────────────────────┐
  │       Settings     × │
  ├──────────────────────┤
  │ 🔊音声設定           │
  │ [✓] 効果音を再生     │
  │ 音量: 🔇 ●●○○○ 🔊   │
  │          01234       │
  │                      │
  │ 📊データ収集について  │
  │ ゲーム改善のため匿名の │
  │ 利用データを収集して   │
  │ います。入力した解答内 │
  │ 容も統計処理の対象です │
  │ が、個人を直接識別でき │
  │ る形では保存しません。 │
  │ • プレイ統計          │
  │ • エラー情報          │
  │ • デバイス情報        │
  │ • 入力した解答内容    │
  │   (匿名統計目的)       │
  │                      │
  │      [ 閉じる ]      │
  └──────────────────────┘
  ```

_Audio Settings_

- **Sound Toggle**: 効果音の有効/無効切り替え
- **Volume Slider**: 5段階音量調整（0: Mute, 1-4: 音量レベル）
- **UI表現**: クリック可能なドット表示

_Privacy Info_

- データ収集に関するコンパクトな説明
- 収集するデータと収集しないデータの明記

**Dialogs**

- ローディングダイアログ
- 横画面警告ダイアログ
- エラーダイアログ

### UI State Management by Game State

**LOADING State**

- **Loading Dialog**: 表示（「読み込み中...」）
- **Quiz Button**: 非表示
- **Answer Area**: ガイドテキスト「読み込み中...」

**READY State**

- **Loading Dialog**: 非表示
- **Video Player**: 表示
- **Game Info Area**: 表示
- **Answer Area**: ガイドテキスト「ボタンを押してゲームを開始」
- **Quiz Button**: STANDBY状態、操作可能

**TALKING State**

- **Video Player**: 表示
- **Game Info Area**: 表示
- **Answer Area**: ガイドテキスト
- **Quiz Button**: DISABLED状態、操作不可

**QUESTIONING State**

- **Video Player**: 表示
- **Game Info Area**: 表示
- **Answer Area**: 解答コンテンツ表示
  - 残り回数表示、タイマー表示なし
  - 解答入力フィールド: 無効（空の状態）
  - 送信ボタン: 無効、結果表示: 非表示
- **Quiz Button**: STANDBY状態、操作可能

**ANSWERING State**

- **Video Player**: 表示（設定により非表示可能）
- **Game Info Area**: 表示
- **Answer Area**: 解答コンテンツ表示
  - 残り回数表示、カウントダウンタイマー表示
  - 解答入力フィールド: 有効、自動フォーカス
  - 送信ボタン: 有効、結果表示: 非表示
- **Quiz Button**: PUSHED状態 → RELEASED状態に自動遷移、操作不可

**WAITING/REVEALING State**

- **Video Player**: 表示
- **Game Info Area**: 表示
- **Answer Area**: 解答コンテンツ表示
  - 残り回数表示、タイマー表示なし
  - 解答入力フィールド: 無効（前回解答内容を保持）
  - 送信ボタン: 無効、結果表示: 表示
- **Quiz Button**: DISABLED状態、操作不可

**FINISHED State**

- **Video Player**: 表示（動画は最後まで再生完了）
- **Game Info Area**: 「ゲーム終了」表示
- **Answer Area**: 非表示
- **Quiz Button**: 非表示
- **Result Area**: 表示（最終スコア + 個別結果表）

### Input Field Specifications

**Answer Input Field**

- **HTML Element**: `<input type="text">`（1行入力）
- **Character Limit**: 最大100文字
- **Input Characters**: 全角・半角文字、数字、記号、絵文字
- **Mobile Optimization**:
  - フォントサイズ16px以上（ズーム防止）
  - 入力エリア44px以上（タッチしやすさ）
  - キーボード表示時の画面調整対応

**Answer Submit Button**

- **HTML Element**: `<button type="button">`
- **Label**: 「送信」（固定）
- **Size**: 最小44px×44px（タッチしやすいサイズ）
- **Duplicate Prevention**: クリック瞬間にdisabled属性設定

### Responsive Design

- **Basic Layout**: 垂直配置（ヘッダー → 動画プレイヤー → ゲーム情報エリア → 解答エリア → 早押しボタン）
- **Quiz Button Size Calculation**:
  - 画面高さから上部要素の高さを除いた残りスペースを計算
  - そのスペース内で縦横比4:3を維持して最大サイズを算出
  - 最小サイズの制約も設定（タッチしやすさを確保）

### Screen Orientation Control

- **Portrait Only**: モバイルで横画面時は警告表示
- **Loading**: ダイアログ形式
- **Error**: ダイアログ表示 → ページ再読み込み誘導

### Visual Reference

初期検討時のワイヤーフレーム: [wireframe.html](./assets/wireframe.html)  
※ 参考用プロトタイプ。実装時は本コードで調整予定。

## Data Models

### Quiz Data Structure

```typescript
interface QuizData {
  youtubeVideoId: string
  quizTitle?: string
  quizSettings: QuizSettings
  questions: QuizQuestion[]
}

interface QuizQuestion {
  index: number
  questionText?: string
  answers: string[]
  startTime: number
  revealTime: number
  endTime: number
  othersAnsweringPeriods?: OthersAnsweringPeriod[]
  answerTimeLimit?: number
}

interface QuizSettings {
  answerTimeLimit: number
  attemptLimit: number
  disableSeekbar: boolean
  jumpToRevealPeriod: boolean
  hideVideoPlayerDuringAnswer: boolean
}
```

### Application State

```typescript
interface AppState {
  // ゲーム状態
  gameState: GAME_STATE
  buttonState: BUTTON_STATE

  // 時間管理
  currentVideoTime: number
  watchedVideoTime: number

  // 問題管理
  currentQuestionIndex: number // -1: 問題開始前, 0~: 配列インデックス
  remainingAttempts: number
  remainingAnswerTime: number

  // プレイヤー状態
  isPlayerAnswering: boolean
  currentAnswerInput: string
  correctAnswerCount: number
  incorrectAnswerCount: number

  // エラー状態
  error: string | null

  // ゲーム結果
  gameResult: GameResult | null
}

interface GameResult {
  totalQuestions: number
  correctAnswers: number
  accuracyRate: number
  questionResults: QuestionResult[]
}

interface QuestionResult {
  questionIndex: number
  isCorrect: boolean
  correctAnswer: string // 正解の最初の要素
  userAnswer: string // プレイヤーの入力内容
}
```

## Configuration Management

### Quiz Settings (QuizSettings)

**answerTimeLimit（解答の制限時間）**

- **Type**: number（秒）
- **Measurement Range**: 早押しボタン押下時点から解答送信まで
- **Timeout Processing**: その時点でのフォームへの入力内容で強制的に正誤判定を実施
- **UI Display**: カウントダウンタイマーで残り時間を表示
- **Question-specific Setting**: `QuizQuestion.answerTimeLimit`で個別上書き可能

**attemptLimit（解答可能な回数）**

- **Type**: number
- **Management Unit**: 問題ごと
- **Initial Value**: 各問題開始時に設定値をセット
- **Decrement Timing**: 解答送信時（正誤問わず）
- **Reset Timing**: 次の問題開始時
- **UI Display**: 「残り○回」形式で表示

**disableSeekbar（シークバーの操作を無効にする設定）**

- **Type**: boolean
- **When true**: シーク検出で`watchedVideoTime`まで強制リセット
- **When false**: シーク検出で強制的にWAITING状態遷移
- **Detection Method**: `|currentVideoTime - watchedVideoTime| > SEEK_TOLERANCE_SEC`でシーク判定
- **Purpose**: 順次視聴の担保

**jumpToRevealPeriod（正解発表区間への遷移設定）**

- **Type**: boolean
- **When true**:
  - 正解時: `currentVideoTime < revealTime` の場合のみ `seekTo(revealTime)` して動画再開
  - 不正解かつ解答回数終了時: 同様に `currentVideoTime < revealTime` の場合のみ `seekTo(revealTime)`
  - 備考: `disableSeekbar = true` でも、このプログラム起因のシークは許可する
- **When false**: 通常の動画再生を継続
- **Audio Playback**: 動画の時間をジャンプする際も効果音の再生は継続する

**hideVideoPlayerDuringAnswer（解答中の動画表示制御設定）**

- **Type**: boolean
- **When true**: ANSWERING状態への遷移と同時にYouTube動画プレイヤーを即時に非表示（演出待ちなし）
- **When false**: 動画プレイヤーは常時表示
- **Purpose**: 解答中に問題文を見られないルールの再現

```typescript
interface QuizSettings {
  answerTimeLimit: number // 解答の時間制限（秒）
  attemptLimit: number // 解答可能な回数
  disableSeekbar: boolean // シークバーの操作を無効にする設定
  jumpToRevealPeriod: boolean // 解答終了後に正解発表区間へ遷移する設定
  hideVideoPlayerDuringAnswer: boolean // 解答中に動画プレイヤーを隠す設定
}
```

### Game Configuration (GameConfig)

**System Information（読み取り専用）**

```typescript
interface SystemCapabilities {
  readonly soundSupported: boolean // 音声サポート状況
  readonly webAudioSupported: boolean // Web Audio API対応
  readonly isMobileDevice: boolean // モバイルデバイス判定
  readonly hasLocalStorage: boolean // LocalStorage利用可能
}
```

**User Settings（変更可能）**

```typescript
interface UserSettings {
  soundEnabled: boolean // ゲーム効果音有効/無効
  soundVolume: number // 音量（0, 0.25, 0.5, 0.75, 1.0）
  autoSaveProgress: boolean // 進行状況自動保存（将来実装）
}

// 音量レベル定数
const VOLUME_LEVELS = [0, 0.25, 0.5, 0.75, 1.0]
```

**Developer Settings（デバッグ用）**

```typescript
interface DeveloperSettings {
  enableDebugMode: boolean // デバッグモード
  showPerformanceInfo: boolean // パフォーマンス情報表示
  enableVerboseLogging: boolean // 詳細ログ
  bypassErrorDialogs: boolean // エラーダイアログスキップ
}
```

### Configuration Management

#### 設定項目の分類

**システム情報（読み取り専用）**

- soundSupported: 音声サポート状況
- webAudioSupported: Web Audio API対応状況
- isMobileDevice: モバイルデバイス判定
- hasLocalStorage: ローカルストレージ利用可能性

**ユーザー設定（変更可能）**

- soundEnabled: ゲーム効果音有効/無効
- soundVolume: 音量レベル（0-100）
- autoSaveProgress: 進行状況自動保存

**開発者設定（デバッグ用）**

- enableDebugMode: デバッグモード
- showPerformanceInfo: パフォーマンス情報表示
- enableVerboseLogging: 詳細ログ出力

## Data Structure and Management

### Data Acquisition Strategy

#### URL設計

- **Query Parameter**: `?v={videoId}` または `?video={videoId}`
- **Example**: `https://example.com/quiz?v=dQw4w9WgXcQ`

#### ディレクトリ構造

```
public/
├── data/
│   ├── {videoId}/
│   │   ├── data.json         # クイズデータ
│   │   └── metadata.json     # メタデータ（将来拡張用）
└── assets/
    └── sounds/
        └── quiz-sounds.mp3
```

#### データ取得フロー

1. URLからvideoIdを抽出
2. `/data/{videoId}/data.json` からクイズデータを取得
3. データ検証の実行
4. エラー時は適切なエラーメッセージを表示

### Data Validation

#### 検証項目

- **必須フィールド**: youtubeVideoId, questions
- **動画ID整合性**: URLとデータファイルのvideoId一致
- **時間データ妥当性**: startTime < revealTime < endTime, 各QUIZ区間の被りなし
- **解答データ**: 空でない文字列配列

## Error Handling

### Error Classification

#### リソース読み込みエラー

- YouTube動画読み込み失敗
- 音声ファイル読み込み失敗
- クイズデータ読み込み失敗

#### 実行時エラー

- データ検証失敗
- YouTube Player APIエラー
- Web Audio APIエラー

### Error Recovery Strategy

#### 基本方針

1. エラー分類による適切なメッセージ表示
2. 復旧可能なエラーは自動リトライ
3. 復旧不可能なエラーはページ再読み込み誘導
4. エラーダイアログによるユーザー操作待ち

#### エラーメッセージ

```typescript
const ERROR_MESSAGES = {
  YOUTUBE_LOAD_FAILED: 'YouTube動画の読み込みに失敗しました。ページを再読み込みしてください。',
  AUDIO_LOAD_FAILED: '音声ファイルの読み込みに失敗しました。ページを再読み込みしてください。',
  IMAGE_LOAD_FAILED: '画像ファイルの読み込みに失敗しました。ページを再読み込みしてください。',
  QUIZ_DATA_LOAD_FAILED: 'クイズデータの読み込みに失敗しました。ページを再読み込みしてください。',
  QUIZ_DATA_NOT_FOUND: 'クイズデータが見つかりません。URLを確認してください。',
  QUIZ_DATA_INVALID: 'クイズデータの形式が正しくありません。ページを再読み込みしてください。',
  NETWORK_ERROR: 'ネットワークエラーが発生しました。接続を確認してページを再読み込みしてください。',
  GENERIC_ERROR: 'エラーが発生しました。ページを再読み込みしてください。',
}
```

#### エラーダイアログイメージ

```
┌─────────────────────┐
│        Error      × │
├─────────────────────┤
│ YouTube動画の読み込み│
│ に失敗しました。      │
│ ページを再読み込みして│
│ ください。           │
│                     │
│    [ 再読み込み ]    │
└─────────────────────┘
```

## Testing Strategy

### Unit Testing

- **Game State Logic**: 状態遷移ロジックの単体テスト（遷移境界の包含規則、単発ガードの確認、窓走査）
- **Answer Validation**: 正規化処理と正誤判定のテスト
- **Time Management**: シーク検出と時間管理のテスト（`SEEK_TOLERANCE_SEC` 前後の検出可否）
- **Utility Functions**: ヘルパー関数のテスト

追加観点:

- othersAnsweringPeriods が QUESTIONING より優先されること
- jumpToRevealPeriod のシーク挙動（disableSeekbar の有無を含む）

### Integration Testing

- **YouTube Player Integration**: YouTube API連携のテスト
- **Audio System Integration**: 音声再生システムのテスト
- **State Management Integration**: 状態管理システムの統合テスト

### End-to-End Testing

- **Complete Game Flow**: ゲーム開始から終了までの完全フロー
- **Error Scenarios**: エラー発生時の復旧フロー
- **Mobile Device Testing**: スマートフォンでの動作確認

### Testing Tools

- **Unit Tests**: Vitest
- **Component Tests**: @testing-library/vue
- **E2E Tests**: Playwright
- **Mobile Testing**: BrowserStack または実機テスト

## Performance Considerations

### 基本方針

個人プロジェクトのため、パフォーマンス要件は特に設定せず、ベストエフォートで対応する。
実際の使用で体験に支障がある場合は都度改善を検討する。

### 最低限の考慮事項

- **モバイル対応**: スマートフォンでの基本動作を確保
- **リアルタイム性**: 100ms間隔の動画時間更新による状態遷移
- **音声再生**: 効果音の適切な再生タイミング

## Security Considerations

### 基本方針

個人プロジェクトのため、セキュリティ要件は最低限とし、重大なリスクがない範囲で運用する。

### 最低限の対策

- **入力処理**: ユーザー入力はローカル処理のみ（サーバー送信なし）
- **クイズデータ**: 自作データのため信頼できるソース
- **YouTube API**: 公式APIの適切な使用
- **URL Parameter**: videoIdの基本的な検証

### 想定リスク

現在の仕様では重大なセキュリティリスクは想定されない。

## Accessibility

### 基本方針

個人プロジェクトのため、アクセシビリティ要件は特に設定せず、基本的な配慮のみ行う。

### 最低限の配慮

- **タッチターゲット**: 44px以上のボタンサイズ
- **フォントサイズ**: 16px以上（モバイルズーム防止）
- **コントラスト**: 基本的な視認性の確保
- **キーボード操作**: PCでのスペースキー早押し対応

## Deployment Strategy

### Build Configuration

- **Environment Variables**: 環境別設定の管理
- **Asset Optimization**: 画像・音声ファイルの最適化
- **Code Splitting**: 必要に応じたコード分割

### Hosting Requirements

- **Static Hosting**: SPA対応の静的ホスティング
- **HTTPS**: セキュア接続の必須化
- **CDN**: 静的アセットの配信最適化

### Monitoring

- **Firebase Analytics**: 利用状況とゲームプレイの分析

## Analytics and Monitoring

### 基本方針

個人プロジェクトのため、最低限の利用分析のみ実施する。

### Firebase Analytics

#### 基本利用分析

- **利用状況分析**: ページビュー、セッション時間
- **ゲーム進行分析**: ゲーム開始率、完了率
- **エラー追跡**: 基本的なエラー発生状況
- **デバイス分析**: モバイル/PC利用比率

#### 問題正解率分析

**個人セッション単位**

- イベント: `quiz_session_completed`
- パラメータ:
  - `play_session_id`: プレイセッションID（UUID）
  - `video_id`: 動画ID
  - `total_questions`: 総問題数
  - `correct_answers`: 正解数
  - `accuracy_rate`: 正解率（%）
  - `completion_time`: プレイ時間

**問題単位**

- イベント: `question_answered`
- パラメータ:
  - `play_session_id`: プレイセッションID（UUID）
  - `video_id`: 動画ID
  - `question_index`: 問題番号
  - `is_correct`: 正誤結果（boolean）
  - `input_answer`: プレイヤーの入力内容
  - `correct_answer`: 正解（配列の最初の要素）
  - `answer_time`: 解答時間（秒）
  - `attempt_count`: 解答回数

#### プレイセッションID管理

- **生成タイミング**: アプリケーション初期化時（ページロード時）
- **使用タイミング**: ゲーム開始時（ボタンチェック完了時）から
- **形式**: UUID v4
- **スコープ**: 1回のクイズプレイ（動画1本分）
- **リセット**: ページリロードまたは別動画への遷移時

#### 収集データの活用

- **個別プレイ分析**: 1プレイ内での問題ごとの解答パターン
- **動画別難易度分析**: 各動画の平均正解率
- **問題別難易度分析**: 各問題の正解率ランキング
- **解答パターン分析**: よくある間違いや表記揺れの特定
- **ユーザー体験改善**: 離脱率の高い問題の特定
- **正規化処理改善**: 不正解になった解答の分析による正規化ルール改善

## Technical Implementation Details

### Project Structure

#### ディレクトリ構成

**Vue.js版（推奨）**

```
src/
├── components/          # UIコンポーネント
│   ├── common/          # 共通コンポーネント (AppHeader, VideoPlayer)
│   ├── game/            # ゲームコンポーネント (GamePanel, GameInfo, GuideText, AnswerContent, QuizButton)
│   ├── result/          # リザルトコンポーネント (FinalScore, ResultTable, ResultActions)
│   └── dialogs/         # モーダル/ダイアログ (SettingsModal, LoadingDialog, OrientationDialog, ErrorDialog)
├── composables/         # Composition API関数
├── stores/              # Pinia状態管理
├── services/            # 外部サービス連携
├── types/               # 型定義
├── utils/               # ユーティリティ関数
└── data/                # 静的データ
```

**React版（代替案）**

```
src/
├── components/          # UIコンポーネント
├── hooks/               # カスタムフック
├── contexts/            # React Context
├── services/            # 外部サービス連携
├── types/               # 型定義
├── utils/               # ユーティリティ関数
└── data/                # 静的データ
```

### YouTube IFrame Player API Integration

#### API統合方針

**初期化プロセス**

1. YouTube IFrame APIスクリプトの動的読み込み
2. プレイヤーインスタンスの作成
3. イベントハンドラーの設定
4. 時間追跡の開始（100ms間隔）

**プレイヤー設定**

- autoplay: 無効（ボタンチェック後に手動開始）
- controls: 有効（基本的な操作を許可）
- playsinline: 有効（モバイル対応）

**イベント処理**

- onReady: プレイヤー準備完了時の初期化
- onStateChange: 再生状態変更の検出
- onError: エラー発生時の処理

**時間管理**

- 100ms間隔での現在時間取得
- シーク検出とゲーム状態への反映
- 状態遷移判定の実行

### Implementation Patterns

#### Component Lifecycle Management

**Vue.js Approach**

- onMounted: プレイヤー初期化とリソース読み込み
- onUnmounted: タイマーやイベントリスナーのクリーンアップ
- watch: videoId変更時の動的プレイヤー更新

**React Approach**

- useEffect: プレイヤー初期化とクリーンアップ
- useRef: プレイヤーインスタンスの永続化
- useCallback: イベントハンドラーの最適化

#### Audio System Implementation

**Web Audio API使用**

- AudioContext: 音声コンテキストの管理
- AudioBuffer: 音声スプライトのデコード・保持
- BufferSource: 音声の再生制御

**音声スプライト構成**

- 単一ファイル内に複数音声を配置
- 開始時間と再生時間による区間指定
- 重複再生の制御とクリーンアップ

#### State Management Architecture

**Vue.js + Pinia**

- defineStore: 型安全なストア定義
- getters: 計算プロパティによる派生状態
- actions: 状態変更とビジネスロジック

**React + Context API**

- useReducer: 複雑な状態遷移の管理
- Context Provider: グローバル状態の提供
- Custom Hooks: 状態ロジックの再利用

### Development Configuration

#### 技術スタック設定

**ビルドツール**

- Vite: 高速な開発サーバーとビルド
- TypeScript: 型安全性の確保
- ESLint/Prettier: コード品質の維持

**スタイリング**

- Tailwind CSS: ユーティリティファーストCSS
- レスポンシブデザイン: モバイルファースト
- カスタムアニメーション: ボタン状態遷移

**開発環境**

- Hot Module Replacement: 開発効率の向上
- TypeScript strict mode: 厳密な型チェック
- Path alias: インポートパスの簡略化

## Implementation Details

### 開発フェーズ

#### Phase 1: UI基盤とコンポーネント実装 ✓ 完了

- **プロジェクト基盤**: Vue 3 + TypeScript + Vite + Tailwind CSS v4環境構築
- **基本UI構造**: 全コンポーネントの静的実装とレスポンシブレイアウト
- **コンポーネント作成**:
  - common/: AppHeader, VideoPlayer
  - game/: GamePanel, GameInfo, GuideText, AnswerContent, QuizButton
  - result/: FinalScore, ResultTable, ResultActions
  - dialogs/: SettingsModal, LoadingDialog, OrientationDialog, ErrorDialog
- **コンポーネント設計**:
  - GamePanelによるGameInfo/AnswerAreaの統合管理
  - GuideText/AnswerContentの分割とmode切り替え
  - Result系コンポーネントの個別化（統合役なし）
- **レイアウト設計**:
  - 縦画面専用の垂直配置レイアウト
  - App.vueでpadding管理、GamePanelでgap管理
  - 視覚的な単位とコンポーネント構造の一致
- **音量設定UI**: スライダー式（0-4の5段階）、音量レベル別アイコン表示

#### Phase 2: 状態管理とゲームロジック

- **状態管理システム**: Pinia導入とゲーム状態・ボタン状態の管理
- **YouTube Player統合**: 動画再生、時間管理、シーク検出
- **ゲーム状態遷移**: 時間経過・アクション起点の状態遷移ロジック
- **解答システム**: 入力処理、正誤判定、解答検証
- **UI状態制御**: ゲーム状態に応じた動的表示切り替え
- **クイズデータ処理**: データ取得、検証、エラーハンドリング

#### Phase 3: 高度な機能と最適化

- **音声システム**: 効果音の再生制御とWeb Audio API統合
- **エラーハンドリング**: 各種エラー対応とダイアログ表示
- **表記揺れ対応**: 解答の正規化処理拡張
- **早押しボタン画像スプライト**: CSSから画像スプライトへの移行
- **テストと最適化**: 単体・統合・E2Eテストとパフォーマンス最適化

### 技術的考慮事項

#### モバイル最適化

- タッチ操作の応答性向上
- バッテリー使用量の最適化
- ネットワーク使用量の最小化
- メモリ使用量の監視

#### パフォーマンス

- 初期読み込み時間の短縮
- リアルタイム処理の最適化
- 音声再生の低遅延化
- UI応答性の確保

## Sample Quiz Data

### データファイル例

`/public/data/E5200yjbvj8/data.json`

```json
{
  "youtubeVideoId": "E5200yjbvj8",
  "quizTitle": "QuizBattleDemo",
  "quizSettings": {
    "maxAttempts": 3,
    "answerTimeLimit": 10,
    "disableSeekbar": true,
    "jumpToRevealPeriod": false,
    "hideVideoPlayerDuringAnswer": false
  },
  "questions": [
    {
      "id": 1,
      "questionText": "「あかい」「まるい」「おおきい」「うまい」の頭文字をとって名付けられた、福岡の特産であるイチゴの品種は何でしょう？",
      "answers": ["あまおう"],
      "startTime": 4.01,
      "revealTime": 18.78,
      "endTime": 20.3
    },
    {
      "id": 2,
      "questionText": "特に粒の大きいものは「大納言」と呼ばれる、マメ科の植物は何でしょう？",
      "answers": ["小豆"],
      "startTime": 21.8,
      "revealTime": 33.93,
      "endTime": 35.45
    },
    {
      "id": 3,
      "questionText": "英語で「花びら」を表す言葉が由来となっている、炭酸飲料のペットボトルの底にデザインされている加工を何というでしょう？",
      "answers": ["ペタロイド"],
      "startTime": 36.95,
      "revealTime": 52.61,
      "endTime": 54.13
    },
    {
      "id": 4,
      "questionText": "ボウリングで「パーフェクトゲーム」を達成したとき、スコアは何点でしょう？",
      "answers": ["300"],
      "startTime": 55.63,
      "revealTime": 67.5,
      "endTime": 69.01
    },
    {
      "id": 5,
      "questionText": "「どっどど　どどうど　どどうど　どどう」という書き出しで始まる、宮沢賢治の童話は何でしょう？",
      "answers": ["風の又三郎"],
      "startTime": 70.51,
      "revealTime": 84.39,
      "endTime": 86.0
    }
  ]
}
```

### データ作成ガイドライン

- **youtubeVideoId**: YouTube動画のID（URLの`v=`パラメータ）
- **quizTitle**: クイズのタイトル（任意）
- **startTime/revealTime/endTime**: 秒単位で指定
- **answers**: 正解の配列（複数の表記を許可する場合）
- **questionText**: 問題文（任意、動画内で読み上げられる場合は省略可）

## Future Work

### LocalStorage Integration

- **設定の永続化**: 音声設定の保存
- **ゲーム進行状況**: プレイ履歴の保存
- **ユーザー設定**: 個人設定の永続化

### 実装予定

- Phase 1: セッション中の設定保持（メモリ内）
- Phase 2: LocalStorageによる永続化
- Phase 3: 設定のインポート/エクスポート機能
