# おえかきジャンプ v9

GitHub Pages で公開できる静的Webアプリです。

## v9 の画面構成

メイン画面は、1枚の完成画像を背景にして透明な操作領域を重ねる方式ではありません。
操作が必要な部分はHTML/CSSで実装し、手描きイラストなど画像で残す方が自然な部分だけを画像素材として使用しています。

- カメラ / 画像選択: HTMLボタン
- 動き6種類: HTMLチェックボックス付きカード
- 動きアイコン: 参考画面の専用画像パーツ
- 動きの大きさ / 速さ: HTML range
- 作成ボタン: HTMLボタン
- PNG / GIFの結果表示: HTMLカード
- PNG / GIF保存: 実HTMLリンク
- 設定: 複数生成プロンプト、動きプロンプトの追加・編集・管理に対応

## GitHub Pages

ZIPを展開し、ファイル一式をリポジトリ直下へ配置してください。
`index.html` と `manifest.json` が同じ階層にある状態で公開します。

## v9.1 転送安定化

デザイン用PNGはZIP内の個別ファイルとして配布せず、HTML/JavaScript内の `data:` URI に埋め込みました。
これにより `assets/ui/motion-squash.png` のような静的画像ファイルを1件ずつ転送する必要がなくなり、画像ファイル単位の `Failed to fetch` を回避します。

- `assets/ui/` は配布物から削除
- `icon-192.png` も配布物から削除し、favicon/ヘッダー画像は埋め込み
- Manifestの個別アイコン参照を削除
- Service Workerのプリキャッシュ対象から個別PNGを削除
- 過去の転送失敗と対策は `TRANSFER_FAILURE_LOG.md` に記録
