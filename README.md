# おえかきジャンプ v2

GitHub Pagesで公開できる静的Webアプリです。

## v2の修整内容

- Androidのカメラを `getUserMedia()` で直接起動
- カメラが使えない端末では `capture="environment"` のファイル入力へフォールバック
- APIキー入力欄をメイン画面から削除
- 右上の「設定」から `settings.html` へ移動
- APIキー、モデル、画質を設定画面で管理
- APIキーは「端末に保存する」を選べる
- 生成プロンプトを自由に編集可能
- プロンプトを初期値へ戻す機能
- GIFの動きを複数選択可能
  - ジャンプ
  - 左右ゆれ
  - ふわふわ
  - くるくる
  - ぷるぷる
  - 伸び縮み
- 複数の動きを同時に組み合わせ可能
- 動きの大きさ・速さを調整可能
- PNGとGIFを同時出力
- GitHub Pagesの `/ (root)` からそのまま公開可能
- Service Workerのキャッシュをv3に更新し、古い画面が残りにくい構成へ変更

## GitHub Pages 公開方法

1. ZIPを展開して、中身をGitHubリポジトリの直下へアップロード
2. GitHubで `Settings` → `Pages`
3. `Build and deployment`
4. `Source` → `Deploy from a branch`
5. Branch → `main`
6. Folder → `/ (root)`
7. `Save`

`index.html` がリポジトリ直下にあるため、READMEではなくアプリが表示されます。

## カメラについて

カメラ直接起動には HTTPS が必要です。GitHub Pages は HTTPS で配信されます。
ブラウザでカメラ権限を拒否した場合は、サイト権限からカメラを許可してください。

直接カメラを起動できないブラウザでは、端末標準のカメラ選択画面へフォールバックします。

## APIキーについて

利用者が設定画面で自分のAPIキーを入力する方式です。
GitHubリポジトリのHTML/JavaScriptにはAPIキーを入れません。

「この端末にAPIキーを保存する」がON:
- localStorageへ保存

OFF:
- sessionStorageのみ
- タブ/ブラウザセッション終了後に消える

ブラウザでAPIキーを扱うため、サーバー側で秘密情報として管理する構成より安全性は低くなります。

## 画像モデル

初期設定:
- `gpt-image-2.5-sunburst`

選択肢:
- `gpt-image-2.5-sunburst`
- `gpt-image-2.5-flare`
- `gpt-image-2`

## 外部ライブラリ

GIF作成:
- gif.js.optimized 1.0.1
- jsDelivr CDNから読み込み

GIF変換自体はブラウザ内で行います。
