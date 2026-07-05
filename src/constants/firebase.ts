// Firebase Web 設定（Analytics 用。Web の apiKey/measurementId は公開前提の識別子であり秘密ではない）
// measurementId が空文字のときは Analytics を初期化しない（no-op）
export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  measurementId: '',
} as const
