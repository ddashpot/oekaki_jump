# 転送失敗ログ / Transfer Failure Log

このファイルは、公開・転送時に発生した `Failed to fetch` を記録し、同じ種類の問題を再発させないためのチェック基準を残すためのログです。

## 2026-09-12 — `icon-512.png`

- 症状: `転送中: icon-512.png > ❌ エラー: Failed to fetch`
- 対応: 512pxアイコンの個別ファイル依存を廃止。
- 教訓: UIの成立に不要な静的画像を配布ファイルとして増やさない。

## 2026-09-12 — `assets/ui/motion-squash.png`

- 症状: `転送中: assets/ui/motion-squash.png > ❌ エラー: Failed to fetch`
- 原因区分: アプリロジックの不具合ではなく、個別PNGファイルを転送する経路での取得失敗。ほかの画像でも同じ形式の障害が起こり得る構成だった。
- 対応: `assets/ui/` のUI画像をすべてHTML/JavaScript内のData URIへ埋め込み、個別PNGファイルの転送を不要にした。
- 追加対応: `icon-192.png` も埋め込み化。ManifestおよびService Workerから個別PNG参照を除去。

## 再発防止ルール

1. UI表示だけに使う静的画像は、原則として個別PNGファイルで配布せずData URIまたはHTML/CSS/SVGへ埋め込む。
2. Service Workerのプリキャッシュ一覧に、存在しないファイルや不要な画像ファイルを入れない。
3. Manifestから、個別転送が必要な画像アイコンへの依存を作らない。
4. ZIP作成前に、HTML/JS/CSS/SW/Manifest内のローカル画像参照を検索する。
5. ZIPの整合性、JavaScript構文、Service Worker参照ファイルの存在を確認してから配布する。
6. 今後転送失敗が発生した場合は、このログに「対象・症状・原因区分・対策」を追記する。

## v9.1 パッケージ方針

- 個別の `*.png`, `*.jpg`, `*.webp` を配布しない。
- デザイン用ビットマップはData URIとしてコード内に保持する。
- ユーザーが生成するPNG/GIFは実行時Blob URLなので、配布時の静的ファイル転送対象ではない。

## v9.1 事前検査

以下はZIP作成時に実施するチェック項目です。実行結果は本ファイル末尾に追記します。

- [x] `assets/ui/` ディレクトリを配布物から削除
- [x] `icon-192.png` を配布物から削除
- [x] UI用画像はData URIへ埋め込み
- [x] HTML/JS/SWに `assets/ui/*.png` 参照なし
- [x] Manifestに個別画像アイコン参照なし
- [x] Service Workerの全ローカル参照ファイルが存在
- [x] `app.js` / `settings.js` / `sw.js` の構文チェック合格
- [x] `manifest.json` のJSON構文チェック合格
- [x] 失敗ログ自体はService Workerのプリキャッシュ対象外（実行時に不要な追加fetchを発生させない）


## 2026-09-12 v9.1.1 保存・共有UI改善
- 新規の外部画像ファイルは追加していません。
- HTML/CSS/JavaScriptのみを変更し、過去の `Failed to fetch` 対策（個別UI画像を作らない方針）を維持しています。
- Service Workerのキャッシュキーを更新しました。


## 2026-09-12 v9.1.2 アイコン操作UI
- 新規の外部画像ファイルは追加していません。
- 保存/共有の見た目はHTML/CSSのみで変更し、画像ファイルの転送対象は増やしていません。
- 作成ボタン文言の変更もHTMLテキストのみです。
