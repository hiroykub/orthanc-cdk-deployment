# Orthanc Dockerイメージ バージョン差分ドキュメント

## 概要

| 項目 | 現在 | 最新 |
|------|------|------|
| Dockerイメージ | `orthancteam/orthanc:24.8.3-full` | `orthancteam/orthanc:26.1.0-full` |
| Orthanc Core推定バージョン | 1.12.4 | 1.12.10+ (mainline) |
| リリース日 | 2024年8月 | 2026年1月30日 |

Dockerイメージのタグは `YY.M.N-full` 形式で、Orthanc本体（core）のバージョンとは独立しています。`-full` サフィックスは全プラグインが同梱されていることを示します。

---

## バージョン間の主要な変更点

### 1. データベース性能の大幅改善（Orthanc 1.12.5）

24.8.3以降で最も大きな変更の一つです。

- **ExtendedFind**: 多数の小さなSQLクエリを1つの大きなクエリに統合する最適化。PostgreSQLなどレイテンシの大きいDBで劇的な性能向上
- **ExtendedChanges**: `/changes` APIでフィルタリングが可能に
- DICOMファイル取り込み時のSQLクエリ数を削減
- 新設定 `ReadOnly` でインデックスDBとストレージへの書き込みを禁止可能

REST APIの改善:
- `/tools/find` でソート（`OrderBy`）、親リソース指定、メタデータクエリが可能に
- `/tools/count-resources` で条件に合致するリソース数のみ取得可能
- HTTP `Range` リクエストヘッダーのサポート
- DICOMweb JSONで `DS - Decimal String` が文字列として返却されるように変更（標準準拠）

### 2. DICOM C-GET SCUサポート（Orthanc 1.12.6）

- C-GET SCUが新たにサポートされ、`/modalities/{id}/get` ルートで利用可能
- 新設定:
  - `AcceptedSopClasses` / `RejectedSopClasses`: C-STORE SCPで受け入れるSOPクラスを制限
  - `DicomDefaultRetrieveMethod`: C-FIND後のリソース取得にC-MOVEかC-GETを選択
  - `MaximumConcurrentDcmtkTranscoders`: 同時トランスコーダー数の制限でCPU/メモリ使用量を削減
- DICOM SCU接続時、使用するコンテキストのみを提案するように改善（以前は全コンテキストを提案）
- DCMTK 3.6.9にアップグレード
- `HttpsCACertificates` が空の場合、OS標準のCA証明書ストアを使用

### 3. REST API機能拡張（Orthanc 1.12.7）

- `POST /tools/create-dicom` で `Encapsulate` 引数を追加（JPEG画像をトランスコードなしでDICOMに格納）
- アーカイブ・ファイルダウンロード時の `filename` 引数サポート
- トランスコード時の `lossy-quality` / `LossyQuality` パラメータ追加
- Deflated Explicit VR Little Endian転送構文のサポート
- 匿名化時の `0012,0063` タグの改善

### 4. データベースプラグインSDK拡張（Orthanc 1.12.8）

- デフォルトSQLiteエンジンがメタデータとアタッチメントのリビジョンをサポート
- キーバリューストアとキューのSDK追加（プラグインからDB内のキーバリューストア・キューにアクセス可能）
- ストレージエリアプラグインV3 SDK（アタッチメントにカスタムデータを関連付け可能）
- `OrthancPluginAdoptDicomInstance()` でストレージ外のDICOMインスタンスを取り込み可能
- Delayed Deletionプラグインのインデックス追加で100倍の性能改善

### 5. 監査ログ・認証拡張（Orthanc 1.12.9）

- ジョブに `UserData` フィールドを追加可能
- 新Prometheusメトリクス:
  - `orthanc_available_dicom_threads`: 利用可能なDICOMスレッド数
  - `orthanc_available_http_threads_count`: 利用可能なHTTPスレッド数
- 新プラグインSDK:
  - `OrthancPluginSetStableStatus()`: リソースの安定化を強制
  - `OrthancPluginRegisterHttpAuthentication()`: カスタムHTTP認証コールバック
  - `OrthancPluginEmitAuditLog()` / `OrthancPluginRegisterAuditLogHandler()`: 監査ログ
- セキュリティ: `RegisteredUsers` が空の場合、デフォルトユーザー `orthanc` を作成しない

### 6. エラー報告・接続管理の改善（Orthanc 1.12.10）

- HTTPエラー時に `ErrorPayload` フィールドで詳細情報を返却
- C-Move/C-Get ジョブに `Details` フィールド（`DimseErrorStatus` と `RetrievedInstancesIds`）
- 新設定 `HttpBindAddresses` でHTTPサーバーのリッスンアドレスを指定可能
- キュー処理の信頼性向上（`OrthancPluginReserveQueueValue()` / `OrthancPluginAcknowledgeQueueValue()`）
- DICOM SCP用の新しいコールバック（`OrthancPluginDicomConnection` 構造体）
- Windows: コンソール出力がUTF-8に対応（キリル文字等の表示改善）
- HTTPレスポンスのストリーミング改善
- 非ASCII文字パスの改善（Windows）

### 7. mainline（未リリース・26.1.0に含まれる可能性）

- 新設定 `PermissiveStoreSopClasses`: モダリティがSOPクラスを受け入れない場合のエラーを無視
- セキュリティ修正: HTTPレスポンスの `filename` 引数によるヘッダーハイジャック対策
- `LimitFindResults` / `LimitFindInstances` がC-FINDに適用されないバグの修正
- Boost 1.89.0、DCMTK 3.7.0にアップグレード

---

## セキュリティ修正

| バージョン | 内容 |
|-----------|------|
| 1.12.5 | 大きな画像処理時のクラッシュ修正、無効なDICOMファイルのデッドロック修正 |
| 1.12.7 | Windows XP互換性の回復 |
| 1.12.10 | CVE-2025-55763（civetweb）パッチ適用、HTTPユーザー名のコロン禁止（Issue #252） |
| mainline | HTTPレスポンスヘッダーハイジャック対策 |

---

## 依存ライブラリのアップグレード

| ライブラリ | 24.8.3時点（推定） | 26.1.0時点 |
|-----------|-------------------|-----------|
| Boost | 1.85.0 | 1.89.0 |
| DCMTK | 3.6.8 | 3.7.0 |
| civetweb | - | 1.16 (CVE-2025-55763パッチ含む) |
| SQLite | 3.46.1 | 3.50.4 |
| libpng | - | 1.6.50 |
| curl | 8.9.0 | 8.17.0 |
| Lua | - | 5.4.7 |

---

## 破壊的変更・注意点

1. **DICOMweb JSON形式の変更**（1.12.5）: `DS - Decimal String` が浮動小数点数から文字列に変更。Stone Web ViewerとOHIFには影響なし
2. **`/tools/find` の制限**（1.12.5）: インデックスDBに格納されていないDICOMタグでフィルタリングする場合、`Limit` と `Since` 引数が使用不可に
3. **`limit=0` の意味変更**（1.12.5）: `/studies?since=x&limit=0` で `limit=0` が「結果なし」から「制限なし」に変更
4. **`RejectedSopClasses` のスペル修正**（1.12.8）: 1.12.6-1.12.7では `RejectSopClasses` が使用されていたが、正しい `RejectedSopClasses` に修正
5. **デフォルトユーザーの変更**（1.12.9）: `RegisteredUsers` が空の場合、デフォルトの `orthanc` ユーザーが作成されなくなった

---

## CDKデプロイメントへの影響

### 更新が必要な箇所

`orthanc-cdk-deployment/infrastructure/lib/orthanc-stack.ts` の以下の行:

```typescript
// 変更前
image: ContainerImage.fromRegistry("orthancteam/orthanc:24.8.3-full"),

// 変更後
image: ContainerImage.fromRegistry("orthancteam/orthanc:26.1.0-full"),
```

### 推奨される追加設定

26.1.0では以下の環境変数・設定の追加を検討してください:

```typescript
environment: {
  // 既存の設定に加えて...
  
  // ExtendedFindの有効化（PostgreSQLプラグインが対応している場合）
  // → 大規模DBでの検索性能が大幅に向上
  
  // C-GET SCUのデフォルト取得方法
  // ORTHANC_JSON内に "DicomDefaultRetrieveMethod": "C-MOVE" を追加可能
}
```

### 互換性

- PostgreSQLプラグインのバージョンも確認が必要（ExtendedFind対応にはPostgreSQLプラグイン v7.0以降が必要）
- S3ストレージプラグインは引き続き互換性あり
- DICOMwebプラグインも引き続き互換性あり

---

## 参考リンク

- [Orthanc公式サイト](https://www.orthanc-server.com/)
- [Orthanc Book](https://orthanc.uclouvain.be/book/)
- [Orthanc Core ソースコード（NEWS）](https://orthanc.uclouvain.be/hg/orthanc/file/default/NEWS)
- [Docker イメージ（orthancteam/orthanc）](https://hub.docker.com/r/orthancteam/orthanc)
- [orthanc-builder リポジトリ](https://github.com/orthanc-server/orthanc-builder)

---

*作成日: 2026年2月12日*
*対象: orthanc-cdk-deployment プロジェクト（https://github.com/hiroykub/orthanc-cdk-deployment）*
