// ゲーム状態の定義
export enum GameState {
  LOADING = 'LOADING', // リソースのロード中
  READY = 'READY', // ゲームの開始準備完了（ボタンチェック待ち）
  TALKING = 'TALKING', // 問題前後の会話区間
  QUESTIONING = 'QUESTIONING', // 問読み区間（早押し可能区間）
  ANSWERING = 'ANSWERING', // プレイヤーの解答区間
  WAITING = 'WAITING', // 早押し不可区間（動画内プレイヤーの解答区間など）
  REVEALING = 'REVEALING', // 正解発表区間
  FINISHED = 'FINISHED', // ゲーム終了（結果表示）
}
