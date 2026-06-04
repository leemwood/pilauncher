# 部署实例下载速度异常分析与修改建议

日期：2026-06-04

范围：仅分析当前项目代码，不修改业务代码。重点覆盖部署实例时的 Minecraft 核心、assets 资源、libraries 依赖以及 Fabric / Forge / NeoForge / Quilt loader 下载链路。

## 结论摘要

当前下载慢并不只是 BMCLAPI 源速度问题，主要是项目内下载链路没有统一走同一套高性能下载器，且部分设置会被前端性能档位逻辑覆盖。

主要结论：

1. `concurrency` 文件级并发只对 libraries 和 assets object 批量下载生效，对版本清单、assets index、loader 元数据和 loader 安装包下载不生效。
2. `chunkedDownloadThreads` 分块线程只对调用 `transfer::download_file` 的大文件生效。loader 安装包目前用 `response.bytes().await` 一次性读取，不走分块、断点续传、速度回调和限速器。
3. 前端 `applyPerformanceProfileToSettings` 会把下载并发裁剪到 4，并强制关闭分块下载。这会让用户感觉“线程数、分块数调了也没效果”。
4. Vanilla 核心 jar 使用了 `download_file`，理论上支持分块，但每次 retry 前主动删除 `.jar.download` 临时文件，导致断点续传能力在重试场景下被抵消。
5. assets object 是并发下载的，但单个 assets 通常很小，分块阈值对它们基本不会触发。真正影响 assets 的主要是文件级并发、校验开销、磁盘写入和大量小请求调度。
6. 同样使用 BMCLAPI，PCL 快的原因更可能是 PCL 对小文件批量调度、连接复用、任务池、失败重试、校验时机、源路由和缓存策略更成熟，而当前项目的 loader 和元数据阶段仍有明显串行或非统一下载器路径。

## 下载链路现状

### 1. 配置来源

前端默认配置位于 `src/types/settings.ts`：

- `concurrency: 8`
- `chunkedDownloadEnabled: true`
- `chunkedDownloadThreads: 2`
- `chunkedDownloadMinSizeMb: 8`
- 默认 Vanilla / Forge / NeoForge 源为 BMCLAPI

后端默认配置位于 `src-tauri/src/services/config_service.rs`：

- `concurrency: 8`
- `chunked_download_enabled: true`
- `chunked_download_threads: 4`
- `chunked_download_min_size_mb: 32`
- 默认 Fabric 源在后端是 official，前端默认是 BMCLAPI

需要注意：`src/store/useSettingsStore.ts` 的 `applyPerformanceProfileToSettings` 会覆盖下载设置：

- `concurrency: Math.min(settings.download.concurrency || 4, 4)`
- `chunkedDownloadEnabled: false`
- `chunkedDownloadThreads: 2`
- `chunkedDownloadMinSizeMb` 至少 64

这是一处高优先级问题。只要该逻辑被应用，用户界面上调高并发或开启分块后，可能又被静默压回低性能配置。

### 2. 通用下载器

`src-tauri/src/services/downloader/transfer.rs` 提供了通用下载器：

- `download_single_stream` 支持 Range 断点续传。
- `download_chunked_stream` 会先用 `Range: bytes=0-0` 探测服务端是否支持 Range。
- 分块下载要求：
  - `chunked_enabled == true`
  - `chunked_threads >= 2`
  - 文件总大小大于等于 `chunked_threshold_bytes`
  - 服务端返回 HTTP 206 且 `Content-Range` 可解析
- `download_file` 会先尝试分块，失败后回退单流。

这套能力本身方向是对的，但它只对接入了 `download_file` 的路径有效。

### 3. Libraries 和 Assets

`src-tauri/src/services/downloader/dependencies/scheduler.rs` 的 `run_downloads` 负责批量任务：

- 通过 `.buffer_unordered(concurrency)` 做文件级并发。
- 内部读取当前下载设置并构造 `DownloadTuning`。
- 每个任务最终调用 `download_file`。

`libraries.rs` 和 `assets.rs` 都会读取 `dl_settings.concurrency` 并调用 `run_downloads`。因此：

- libraries：并发和分块设置基本接入。
- assets object：并发接入，分块通常不明显，因为大量 assets 文件很小，达不到分块阈值。
- assets index：走 `download_text_from_candidates`，不走 `download_file`，不受分块线程影响。

### 4. Vanilla 核心

`src-tauri/src/services/downloader/core_installer.rs` 中：

- 版本列表和版本 JSON 走 `fetch_manifest_with_retry` / `fetch_text_from_candidates`，是普通 GET 文本下载。
- client jar 走 `download_file`，因此理论上支持分块、断点续传、限速和速度事件。
- 但每次下载尝试前有 `tokio::fs::remove_file(&temp_jar_path).await`，会删除临时文件。

影响：

- 首次完整下载可用分块。
- 网络中断后 retry 不能利用上一轮已下载内容。
- 如果分块探测失败，会退回单流，用户调 `chunkedDownloadThreads` 看不到效果。

### 5. Loader

`src-tauri/src/services/downloader/loader_installer.rs` 是当前最明显短板。

关键路径：

- Fabric profile JSON 走 `download_text_from_candidates`。
- Forge installer 走 `download_bytes_from_candidates`。
- NeoForge installer 走 `load_or_download_installer_archive`，内部仍调用 `download_bytes_from_candidates`。
- `download_bytes_from_candidates` 使用 `response.bytes().await?.to_vec()`。

影响：

- loader 安装包不使用 `download_file`。
- 不支持分块。
- 不支持断点续传。
- 不使用全局 `DownloadRateLimiter`。
- 没有逐 chunk 速度事件。
- 对用户来说，调“分块线程”对 loader 下载完全无效。

Forge / NeoForge installer 往往比 metadata 大得多，这一段慢会非常明显。

## 为什么同样 BMCLAPI，PCL 可能更快

从当前代码看，差异更可能来自下载调度和路径接入，而不是单纯源地址。

可能原因：

1. PCL 对 loader installer、libraries、assets 使用更统一的下载任务池，当前项目 loader installer 仍是一次性 `bytes()`。
2. PCL 对大量小文件 assets 可能有更高效的队列、连接复用、失败降级和缓存命中策略。
3. 当前项目在开启校验时会对已有文件和下载后文件做 SHA-1，assets 数量大时会增加磁盘读开销。PCL 可能在已有缓存、大小校验、散列校验之间做了更激进的跳过策略。
4. 当前项目的性能档位可能把并发和分块降级，导致用户以为设置已生效，实际运行时配置被改低。
5. 当前项目多个 metadata / installer 下载路径没有统一测速、源选择和自动切源逻辑。`autoCheckLatency` 也不是全链路优选源，只是在部分校验失败或候选 URL 构造中参与。

## 修改建议

### P0：先修配置覆盖问题

建议审查 `src/store/useSettingsStore.ts` 的 `applyPerformanceProfileToSettings`：

- 不要无条件把 `download.concurrency` 限制到 4。
- 不要无条件关闭 `chunkedDownloadEnabled`。
- 性能档位只应在用户选择低功耗/Steam Deck 模式时显式应用，并在 UI 上提示会降低下载并发。
- 区分“用户手动设置”和“性能档位推荐值”，避免持久化设置被静默覆盖。

建议验收：

- 设置并发为 8、分块为开启、分块线程为 8 后，重启应用仍保持。
- 部署实例时后端日志能打印实际 `concurrency/chunked_enabled/chunked_threads/chunked_threshold`。

### P0：Loader installer 接入通用下载器

建议把 `loader_installer.rs` 中的 installer jar 下载从 `download_bytes_from_candidates` 改为基于文件的 `download_file`：

- Forge installer 写入 `temp/forge-installer-xxx.jar.download` 后 rename。
- NeoForge installer 同理。
- 下载完成后再读取文件内容用于解析 `version.json` / `install_profile.json`。
- 保留现有 archive entry 校验。
- 使用同一套 `DownloadTuning`、`DownloadRateLimiter`、stall timeout、取消检查和速度事件。

收益：

- loader 下载会真正受分块线程影响。
- 支持断点续传。
- 大 installer 不再一次性读入内存。
- 速度表现和核心 jar、libraries 统一。

### P1：核心 jar 重试不要删除临时文件

建议移除或条件化 `core_installer.rs` 中 retry 前删除 `.jar.download` 的逻辑：

- 网络错误重试时保留临时文件，让 `download_single_stream` 的 Range 续传生效。
- 只有 SHA-1 mismatch、大小 mismatch、HTTP 416 或确认源内容不一致时才删除临时文件。
- 分块下载失败回退单流时也应尽量允许已有临时文件续传。

### P1：为部署下载增加实际配置日志

建议在以下入口记录一次下载配置：

- `install_vanilla_core`
- `download_dependencies_inner`
- `install_forge`
- `install_neoforge`
- `install_fabric`

日志字段：

- selected source URL
- candidate URL 首项
- concurrency
- chunked enabled
- chunked threads
- chunked threshold
- retry count
- timeout
- verifyAfterDownload

这样可以直接确认用户调参后后端是否读到正确值。

### P1：改进 assets 小文件策略

assets object 大多是小文件，分块线程不是核心优化点。建议优先优化文件级调度：

- 把 assets 和 libraries 的默认并发允许到 16 或 32，但需要 UI 提示“过高可能触发 429 或磁盘占用上升”。
- 对 assets 继续按大小跳过 SHA-1，只有大小不匹配或强校验模式才读盘 hash。
- 统计每阶段平均速度和失败率，便于自动推荐并发。
- 对 429 / 5xx 做指数退避，但不要让单个慢任务长期占住整体。

### P2：统一 metadata 下载路径

版本 manifest、version JSON、assets index、Fabric profile 等文本资源现在走各自的 GET helper。建议后续统一成轻量版本的下载 helper：

- 统一 timeout / retry / candidate URL fallback。
- 统一日志。
- 统一取消检查。
- 对小文本不必分块，但要能记录 TTFB 和最终源。

### P2：源路由与自动测速需要闭环

当前有下载测速 UI，但实际部署链路未明显看到“测速结果驱动源选择”的闭环。建议：

- 测速结果写入配置或短期缓存。
- 部署时按目标类型选择当前最快候选源，而不是只按配置顺序尝试。
- 对 assets、loader、libraries 分开测速和分开优选，因为它们可能落到不同路径和 CDN 缓存。

## 建议验证方案

1. 打开下载设置，设置：
   - 并发：8
   - 分块下载：开启
   - 分块线程：8
   - 分块阈值：8 MB
2. 重启应用，确认设置没有被性能档位覆盖。
3. 部署一个 Forge 或 NeoForge 实例，观察 loader installer 是否走 `download_file`，日志中应显示 chunked enabled 和 chunked threads。
4. 人为中断一次核心 jar 或 loader installer 下载，再重试，确认 `.download` 文件被复用而不是从 0 开始。
5. 部署一个资源缺失较多的新版本实例，对比：
   - assets 阶段总耗时
   - libraries 阶段总耗时
   - loader installer 阶段总耗时
   - 实际并发任务数
6. 与 PCL 使用同版本、同源、同网络环境对照，优先比较 loader installer 和 assets 阶段。

## 优先级排序

最推荐的落地顺序：

1. 修复前端性能档位覆盖下载设置。
2. loader installer 下载接入 `download_file`。
3. 核心 jar retry 保留临时文件，恢复断点续传收益。
4. 增加部署下载实际配置日志。
5. 提高 assets 文件级并发上限并加失败率保护。
6. 将测速结果接入部署时的候选源排序。

按这个顺序改，能最快解释并解决“线程数和分块数好像不起作用”的体感问题。
