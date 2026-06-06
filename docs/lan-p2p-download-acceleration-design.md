# 局域网 P2P 下载加速设计文档

## 目标

为 PiLauncher 的资源下载、整合包下载、运行库/依赖下载提供局域网内的 P2P 加速能力。当同一局域网内已有设备下载过相同文件时，其他设备可以优先从局域网节点获取数据，减少公网下载耗时和外部源压力。

核心目标：

- 在不破坏现有下载流程的前提下加速重复资源下载。
- 所有数据必须按原始下载源的哈希或元数据校验，不能信任局域网节点。
- P2P 失败时必须自动回退到现有 HTTP 下载。
- 默认不暴露到公网，只在局域网内发现和传输。
- 对用户可解释，可关闭，可限制带宽。

非目标：

- 不做公网 P2P、NAT 穿透、DHT、BT 种子网络。
- 不把未知来源文件加入共享。
- 不绕过 Modrinth、CurseForge 或官方源的授权规则。
- 不共享用户账号、启动参数、日志、存档等私有数据。

## 适用场景

优先支持以下文件类型：

- Modrinth/CurseForge 下载得到的 mod、resourcepack、shader、modpack 文件。
- Minecraft client/server jar、libraries、assets 等可哈希校验的运行文件。
- 启动器更新包，如果已有服务端签名和哈希校验。

暂不建议支持：

- 未知来源导入文件。
- 用户自定义皮肤、披风、存档备份等隐私或账号相关文件。
- 没有稳定哈希、文件大小、来源标识的数据。

## 总体架构

局域网 P2P 加速由四个模块组成：

1. **Peer Discovery**
   负责发现同一局域网内运行 PiLauncher 的其他节点。

2. **Content Index**
   维护本机可共享文件索引，包括内容 ID、文件大小、哈希、分片信息、来源信息。

3. **Piece Transfer**
   负责分片请求、传输、校验和失败重试。

4. **Download Scheduler**
   在公网 HTTP 下载和局域网 P2P 下载之间做调度，决定每个分片从哪里下载。

推荐实现位置：

- Rust/Tauri 后端负责发现、传输、校验、文件读写。
- 前端只展示开关、状态、速度、来源和错误提示。

## 内容标识

所有可共享文件必须生成稳定的 `content_id`。

推荐格式：

```text
sha256:<file_sha256>
```

如果下载源已经提供可信哈希，直接使用源哈希作为内容 ID。否则下载完成后计算 SHA-256，并只用于本地缓存匹配，不用于跳过上游校验。

索引字段：

```ts
interface SharedContentEntry {
  contentId: string;
  fileName: string;
  fileSize: number;
  sha256: string;
  pieceSize: number;
  pieceHashes: string[];
  sourceKind: 'modrinth' | 'curseforge' | 'minecraft' | 'launcher-update' | 'other';
  sourceUrl?: string;
  projectId?: string;
  versionId?: string;
  localPath: string;
  lastVerifiedAt: number;
}
```

原则：

- `content_id` 只代表内容，不代表文件名。
- 文件名只用于 UI 展示和落盘建议。
- 传输完成后必须校验完整文件哈希。
- 分片哈希用于尽早丢弃错误数据。

## 分片策略

推荐默认分片大小：

- 小于 8 MiB：单分片或 1 MiB 分片。
- 8 MiB 到 512 MiB：2 MiB 分片。
- 大于 512 MiB：4 MiB 或 8 MiB 分片。

分片元数据：

```ts
interface PieceInfo {
  index: number;
  offset: number;
  length: number;
  sha256: string;
}
```

下载临时文件：

```text
<target>.part
<target>.part.meta
```

`.part.meta` 记录：

- content ID
- 文件总大小
- piece size
- 已完成分片 bitmap
- 每个分片来源和重试次数
- 当前文件锁 owner

## Peer 发现

推荐使用 mDNS/Bonjour 进行局域网发现。

服务名：

```text
_pilauncher-p2p._tcp.local
```

广播字段：

```text
device_id=<settings.general.deviceId>
app_version=<launcher version>
protocol_version=1
port=<tcp port>
features=piece-v1,index-v1
```

发现规则：

- 只接受同一协议主版本的节点。
- 忽略自己的 `device_id`。
- 节点超过 TTL 未刷新则移除。
- 不依赖节点名称做安全判断。

备选方案：

- UDP multicast 自定义发现协议。
- 手动输入局域网 IP。

推荐优先 mDNS，因为跨平台成熟，且便于后续调试。

## Peer 通信协议

传输协议建议使用 TCP，本地 HTTP API 或轻量二进制协议均可。

为了实现简单，第一版推荐局域网 HTTP：

```text
GET /p2p/v1/manifest/:content_id
GET /p2p/v1/piece/:content_id/:piece_index
GET /p2p/v1/status
POST /p2p/v1/query
```

### 查询内容

请求：

```json
{
  "content_ids": [
    "sha256:..."
  ]
}
```

响应：

```json
{
  "available": [
    {
      "content_id": "sha256:...",
      "file_size": 123456,
      "piece_size": 2097152,
      "piece_count": 12
    }
  ]
}
```

### 获取 manifest

响应：

```json
{
  "content_id": "sha256:...",
  "file_size": 123456,
  "sha256": "...",
  "piece_size": 2097152,
  "piece_hashes": ["..."]
}
```

### 获取分片

请求：

```text
GET /p2p/v1/piece/sha256:.../3
```

响应：

```text
200 OK
Content-Type: application/octet-stream
X-PiLauncher-Piece-Sha256: ...
```

接收端必须：

- 校验分片长度。
- 校验分片 SHA-256。
- 最终校验完整文件 SHA-256。

## 调度策略

下载任务开始时：

1. 从现有下载源获取文件大小和哈希。
2. 计算 `content_id`。
3. 查询局域网 peers 是否拥有该内容。
4. 如果有可用 peer，进入混合下载模式。
5. 如果没有，使用原 HTTP 下载。

混合下载策略：

- 优先从局域网下载未完成分片。
- 公网 HTTP 作为兜底，可以并行下载部分分片。
- 每个 peer 设置最大并发分片数，例如 2。
- 全局 P2P 并发设置，例如 4 到 8。
- 对慢 peer 降权，对错误 peer 拉黑一段时间。

分片选择：

- 优先下载稀缺分片。
- 对只有一个 peer 可提供的分片提前下载。
- 对连续失败的分片切回 HTTP。

失败策略：

- 单个分片从 peer 下载失败 2 次后换 peer。
- 同一 peer 连续 3 次提供错误分片，临时封禁 10 分钟。
- P2P 总体 10 秒无有效吞吐，启动 HTTP 并行兜底。
- 最终文件哈希失败，丢弃临时文件并重走 HTTP。

## 安全设计

局域网节点不可信。P2P 只能作为数据来源，不能作为信任来源。

必须满足：

- 不接受 peer 提供的新下载任务。
- 不接受 peer 提供的文件名覆盖本地路径。
- 不允许通过 URL 参数读取任意路径。
- 只共享 Content Index 中登记并通过校验的文件。
- 传输 API 只绑定局域网地址或本机选定网卡。
- 默认禁止公网监听。

建议增加：

- 协议 token：启动器本地生成一次性 session token，仅用于降低误访问，不作为强安全认证。
- 局域网设备白名单：可选。
- 共享目录限制：只允许缓存目录和下载缓存中的文件。
- 速率限制：避免局域网被单个设备打满。

隐私边界：

- 不广播用户名、账号 UUID、实例名称、资源列表。
- 查询时只发送目标 `content_id`。
- 状态接口不返回完整共享索引，除非用户开启调试模式。

## 缓存与共享策略

下载完成后，文件进入可共享缓存需要满足：

- 文件完整哈希校验通过。
- 文件来源属于允许共享类型。
- 文件未标记为私有。
- 本地缓存未超过大小限制。

缓存淘汰：

- 默认上限可设为 10 GiB。
- 按 LRU 淘汰。
- 正在被实例引用的文件不删除。
- 用户可手动清理 P2P 缓存。

共享开关：

- 总开关：启用局域网 P2P 加速。
- 上传开关：允许向局域网设备上传。
- 下载开关：允许从局域网设备下载。
- 带宽限制：上传 KB/s、下载 KB/s。
- 网络限制：仅当前私有网络、仅指定网卡。

## UI 设计建议

设置页：

- `启用局域网 P2P 加速`
- `允许向局域网设备共享已验证缓存`
- `上传速度限制`
- `下载速度限制`
- `P2P 缓存大小`
- `清理 P2P 缓存`

下载任务状态：

```text
正在下载 45.2 MB/s
局域网 31.7 MB/s · 公网 13.5 MB/s · 3 个局域网节点
```

详情展开：

- 来源：HTTP / LAN Peer
- 已完成分片数
- 已连接节点数
- P2P 命中率
- 校验状态

错误提示保持低干扰：

- P2P 失败不弹窗，只降级到 HTTP。
- 只有最终下载失败才展示错误。

## 与现有下载系统的集成点

建议在下载逻辑中抽象一个统一接口：

```ts
interface DownloadSource {
  kind: 'http' | 'lan-peer';
  open(contentId: string): Promise<DownloadSession>;
}

interface DownloadSession {
  readPiece(index: number): Promise<ArrayBuffer>;
  close(): Promise<void>;
}
```

现有 HTTP 下载保留为默认 source。P2P scheduler 只是额外 source，不改变最终文件校验和安装流程。

Rust 后端推荐新增能力：

- `p2p_start_service`
- `p2p_stop_service`
- `p2p_query_peers`
- `p2p_register_verified_file`
- `p2p_download_content`
- `p2p_get_status`

前端只调用状态和配置，不参与分片传输。

## 兼容性

Windows：

- mDNS 可能受防火墙影响，需要给出提示。
- TCP 监听首次可能触发防火墙弹窗。

macOS：

- 需要确认本地网络权限提示。

Linux：

- Avahi/mDNS 环境不稳定时提供手动 IP fallback。

Tauri：

- 网络监听应在 Rust 后端实现。
- 前端不直接暴露局域网服务。

## 观测指标

建议记录本地匿名指标，不上传也可用于调试：

- P2P 查询次数
- P2P 命中次数
- P2P 下载字节数
- HTTP 下载字节数
- peer 连接成功率
- 分片校验失败次数
- 最终文件校验失败次数
- 平均节省时间

日志等级：

- `info`：服务启动、发现 peer、命中内容。
- `warn`：peer 超时、分片校验失败、降级 HTTP。
- `error`：服务启动失败、最终校验失败。

## 分阶段落地

### Phase 1: 本地索引和缓存

- 为已下载文件建立 content index。
- 记录文件大小、SHA-256、来源、路径。
- 下载完成后注册已验证文件。
- 不做网络传输。

验收标准：

- 能稳定列出可共享缓存。
- 删除文件后索引能自愈。
- 哈希校验失败不会进入共享池。

### Phase 2: mDNS 发现和状态页

- 启动局域网服务。
- 发现同网段 PiLauncher 节点。
- UI 显示 peer 数量。
- 不传输文件。

验收标准：

- 两台设备能互相发现。
- 关闭服务后 peer 自动消失。
- 防火墙阻断时有可理解提示。

### Phase 3: 单 peer 分片下载

- 支持 manifest 和 piece API。
- 一个下载任务可以从一个 peer 获取分片。
- 完成后做完整哈希校验。
- 失败自动回退 HTTP。

验收标准：

- 同一文件第二台设备能从第一台设备下载。
- 人为篡改分片会被校验拒绝。
- peer 中断后任务能继续 HTTP 下载。

### Phase 4: 多 peer 混合调度

- 多 peer 并发下载不同分片。
- HTTP 与 P2P 混合下载。
- 慢 peer 降权，坏 peer 临时封禁。

验收标准：

- 三台设备场景下能同时从多个 peer 拉取。
- 总速度优于单 HTTP 或单 peer。
- 不会出现最终文件损坏。

### Phase 5: 产品化

- 设置页加入开关和限速。
- 下载 UI 展示局域网加速状态。
- 加入缓存清理。
- 加入调试日志导出。

验收标准：

- 用户可以完全关闭 P2P。
- 默认配置不会明显占满上传带宽。
- 下载失败路径仍与原逻辑一致。

## 主要风险

- 防火墙导致发现或传输失败。
- 上游资源缺少可信哈希，无法安全复用。
- 多任务并发时磁盘随机读写变多。
- 同一文件不同来源但内容相同，需要谨慎合并。
- 局域网内恶意节点提供错误数据，必须依赖校验和封禁。

## 推荐默认配置

```json
{
  "enabled": true,
  "allowUpload": true,
  "allowDownload": true,
  "maxUploadKbps": 0,
  "maxDownloadKbps": 0,
  "maxCacheBytes": 10737418240,
  "pieceSizeBytes": 2097152,
  "maxPeersPerTask": 4,
  "maxPiecesPerPeer": 2,
  "peerTimeoutMs": 5000,
  "httpFallbackAfterMs": 10000
}
```

其中 `0` 表示不限速。首次发布时也可以默认关闭 `enabled`，让用户手动开启，以减少防火墙和隐私顾虑。

## 总结

局域网 P2P 加速应作为现有 HTTP 下载的增强层，而不是替代层。关键原则是：发现可以不可信，传输可以不可信，但最终内容必须由可信哈希校验。第一版应优先实现可验证、可回退、可关闭的最小闭环，再逐步加入多 peer 调度和产品化 UI。
