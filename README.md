# LOVERYツムツム

GitHub Pages でそのまま公開できる静的ブラウザゲームです。

## 構成

- `index.html`
- `style.css`
- `script.js`
- `assets/`
  - `audio/`
  - `images/`
  - `characters/`

## GitHub Pages 公開手順

1. このフォルダ内容を GitHub リポジトリのルートにアップロードします。
2. GitHub のリポジトリ画面で `Settings` を開きます。
3. `Pages` を開きます。
4. `Build and deployment` の `Source` を `Deploy from a branch` にします。
5. Branch は `main`、フォルダは `/ (root)` を選んで保存します。
6. 数十秒から数分待つと、公開URLが表示されます。

## メモ

- `index.html` はプロジェクトルートに置いたままです。
- 画像、音声、JS はすべて相対パスで参照しています。
- サーバーサイドコードは不要です。
