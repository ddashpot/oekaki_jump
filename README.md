# おえかきジャンプ — GitHub Pages版

子どもの紙の絵をブラウザから OpenAI Image API に送り、

- 背景透過の完成イラスト（PNG）
- ジャンプするループアニメーション（GIF）

を一度に作る静的Webアプリです。

## 特徴

- サーバー不要
- GitHub Pagesだけで公開可能
- Android向けレスポンシブUI
- PWA対応（Chromeの「ホーム画面に追加」）
- APIキーは画面で利用者が入力
- APIキーを localStorage / sessionStorage / Cookie に保存しない
- APIキーをリポジトリへ書き込まない
- 画像生成後のGIF化はブラウザ内で実行

## 重要: APIキーについて

この版は、要望に合わせて **ブラウザからOpenAI APIへ直接アクセス**します。

ブラウザ上のAPIキーは、サーバー側の秘密情報ほど安全には扱えません。
公開サイトに共有APIキーを埋め込む用途には使わないでください。

想定する使い方は「利用者が自分のAPIキーを、その都度入力して使う」です。
入力値はこのアプリでは永続保存しません。

## GitHub Pagesで公開

1. GitHubで新しいリポジトリを作成します。
2. このZIPを展開し、中身をリポジトリへアップロードします。
3. デフォルトブランチを `main` にします。
4. GitHubの **Settings → Pages** を開きます。
5. **Build and deployment → Source** を **GitHub Actions** にします。
6. `main` にpushすると、同梱のActionsワークフローが `docs/` を公開します。

または GitHub Pages の Source を **Deploy from a branch** にして、
`main` / `/docs` を選んでも公開できます。

## ファイル構成

```text
.
├── .github/
│   └── workflows/
│       └── pages.yml
├── docs/
│   ├── .nojekyll
│   ├── app.js
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── style.css
│   └── sw.js
└── README.md
```

## 使用している外部ライブラリ

GIF生成に `gif.js.optimized 1.0.1`（MIT License）を jsDelivr CDN から読み込みます。
そのため初回利用時はインターネット接続が必要です。

## APIモデル

初期値は `gpt-image-2.5-sunburst` です。
画面の「詳細設定」から `gpt-image-2` へ変更できます。

## 開発時の確認

ローカルで `docs/` を静的HTTPサーバーから開いてください。

例:

```bash
python -m http.server 8080 --directory docs
```

その後 `http://localhost:8080/` を開きます。

`file://` で直接開くと、Service Workerなど一部機能が動作しません。
