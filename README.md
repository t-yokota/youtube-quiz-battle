# YouTube Quiz Battle

## Overview

YouTube上のクイズ動画を使った「早押しクイズ」ができるWebアプリケーション。視聴者もプレイヤーとなり、動画出演者との疑似的な早押しクイズ対決を楽しむことを可能にする。

### Core Concept

```
YouTubeクイズ動画 + 視聴中のリアルタイム早押し = インタラクティブな動画視聴体験
```

**基本体験**: プレイヤーはYouTubeに投稿されたクイズ動画を視聴しながら、画面上の早押しボタンをタップすることで解答権を取得し、動画内で出題されたクイズに解答する

**プレイ可能人数**: 1人

**対象環境**

- プライマリ: スマートフォンブラウザ（縦画面専用）
- セカンダリ: PCブラウザ（開発・デバッグ機能も用意する）

### Technical Stack

- **Frontend**: Vue 3 (Composition API) + TypeScript + Vite
- **State Management**: Pinia
- **Styling**: Tailwind CSS
- **Target Platform**: スマートフォンブラウザ（縦画面専用）、PCブラウザ（開発・デバッグ用）

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```
