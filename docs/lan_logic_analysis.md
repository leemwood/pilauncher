# 局域网发现与信任设备逻辑安全及代码逻辑分析报告

本报告对当前 PiLauncher 的局域网设备发现（mDNS Scanner）与信任/传输协议的后端 Rust 实现及前端交互逻辑进行了详细的静态代码审计。

审计发现系统在**密码学安全设计、越权漏洞、路径穿越、高并发/大数据性能、网络边界异常、死代码与逻辑未闭环**等方面存在若干明显 Bug 与逻辑缺陷。

---

## 一、 核心安全漏洞（Critical Security Issues）

### 1. 密码学公私钥体系流于形式，缺少签名校验
* **代码定位**：
  * [trust_store.rs](file:///h:/VSCodeWork/pilauncher/src-tauri/src/services/lan/trust_store.rs#L56-L90) 生成了 Ed25519 密钥对并保存在 `lan_identity.json` 中。
  * [lan_cmd.rs](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/lan_cmd.rs) 与 [http_api.rs](file:///h:/VSCodeWork/pilauncher/src-tauri/src/services/lan/http_api.rs) 传输并保存了 `publicKey` / `public_key_b64`。
* **缺陷分析**：
  整个局域网协议中，**没有任何一处代码使用私钥对请求载荷进行签名（Sign），也没有任何一处代码使用公钥对签名进行验签（Verify）**。公私钥目前只被当作纯文本的“唯一标识符”使用。
* **安全风险**：
  局域网中的任意攻击者都可以伪造声称自己拥有某个公钥，由于系统不进行挑战应答（Challenge-Response）验签，攻击者可以轻易冒充已知信任设备。

### 2. 用户 UUID 自动信任逻辑可被静默越权绕过（静默自动信任漏洞）
* **代码定位**：
  * [http_api.rs:L111-L144](file:///h:/VSCodeWork/pilauncher/src-tauri/src/services/lan/http_api.rs#L111-L144)
* **缺陷分析**：
  当接收到来自 `/trust/request` 的 HTTP 握手请求时，代码首先进行如下判断：
  ```rust
  let is_same_user = !my_user_uuid.is_empty() && my_user_uuid == payload.user_uuid;
  if is_same_user {
      // 直接执行数据库入库逻辑 (TrustStore::add_trusted_device 或 TrustStore::add_friend_device)
      // 并不经过用户前端的 oneshot::channel 审批弹窗，直接返回信任成功
  }
  ```
  本意是为了让同一用户在局域网内的多台设备（拥有相同的 `user_uuid`）能够免确认互信。但由于 `/device/init` 接口是完全公开无防范的，任何局域网设备都可以通过 `GET /device/init` 获取你当前的 `user_uuid`。
* **安全风险**：
  攻击者只需先向目标设备请求 `/device/init` 获取其 `user_uuid`，随后向目标的 `/trust/request` 发送一个 `user_uuid` 被伪造为该值的 `TrustRequest`。目标接收端会认为“这是我的其他设备在请求互信”，从而**无需弹出任何用户交互界面，直接静默将攻击者设备加入数据库信任列表**。

### 3. 文件传输接口鉴权缺失，沦为完全敞开的后门
* **代码定位**：
  * [http_api.rs:L87-L94](file:///h:/VSCodeWork/pilauncher/src-tauri/src/services/lan/http_api.rs#L87-L94) & [L502-L508](file:///h:/VSCodeWork/pilauncher/src-tauri/src/services/lan/http_api.rs#L502-L508)
* **缺陷分析**：
  用于接收整合包或存档的核心 HTTP 接口 `/api/transfer/receive` 被注册在 `secure_routes` 下，并声明使用 `auth_middleware` 进行鉴权：
  ```rust
  async fn auth_middleware(
      State(_state): State<Arc<AxumAppState>>,
      _headers: HeaderMap,
      request: Request<axum::body::Body>,
      next: Next,
  ) -> Result<Response, StatusCode> {
      Ok(next.run(request).await) // 极其致命：直接透传，无任何安全校验！
  }
  ```
* **安全风险**：
  `auth_middleware` 沦为空壳，并未校验发送请求的客户端是否在 `trusted_devices` 数据库中。局域网内的任何未授权设备都可以直接调用该 POST 接口，向目标上传任意大小的 ZIP 压缩包。

### 4. 接收传输文件存在 X-Transfer-Id 路径穿越写入漏洞（Arbitrary File Write）
* **代码定位**：
  * [http_api.rs:L316-L353](file:///h:/VSCodeWork/pilauncher/src-tauri/src/services/lan/http_api.rs#L316-L353)
* **缺陷分析**：
  在 `receive_transfer` 函数中，临时文件的写入路径依赖于客户端传入的 `X-Transfer-Id` 请求头：
  ```rust
  let transfer_id = headers
      .get("X-Transfer-Id")
      .and_then(|value| value.to_str().ok())
      .map(|value| value.to_string())
      .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
  ...
  let temp_path = temp_dir.join(format!("{}.zip", transfer_id));
  ```
  代码**完全没有对 `transfer_id` 进行任何路径合法性校验（如防止 `..` 或 `/`）**。
* **安全风险**：
  局域网攻击者可以通过传入包含路径穿越字符的 `X-Transfer-Id`（例如 `../../../../Windows/System32/evil`），将恶意 zip 文件直接写入或覆写到目标系统上具有写入权限的任意敏感目录。

---

## 二、 逻辑未闭环与死代码（Unclosed Logic & Dead Code）

### 1. 信任校验降级逻辑沦为死代码
* **代码定位**：
  * 后端命令：[lan_cmd.rs:L448-L489 (`verify_trusted_devices`)](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/lan_cmd.rs#L448-L489)
  * 前端 Hook：[useLan.ts:L251-L263 (`verifyTrustedDevices`)](file:///h:/VSCodeWork/pilauncher/src-tauri/src/hooks/useLan.ts#L251-L263)
* **缺陷分析**：
  后端提供了 `verify_trusted_devices` 用于在扫描到在线设备时，核对已信任设备的设备名或公钥是否被篡改。如果被篡改则在数据库中将其降级为 `friend`。
  前端 Hook 虽封装并导出了 `verifyTrustedDevices`，但**整个前端项目（包括 `MicrosoftAccountSidebar.tsx` 等）中没有任何一处组件或副作用调用了此函数**。
* **逻辑后果**：
  这是一个**完全未闭环的逻辑**。当局域网内有已信任设备信息发生变动（或被劫持/冒充）时，系统在运行时永远不会触发自动降级机制，信任名单变相处于不受监控的状态。

### 2. 设备名称与账户信息修改后，广播无法动态同步
* **代码定位**：
  * [lan_cmd.rs:L263-L273 (`update_lan_device_info`)](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/lan_cmd.rs#L263-L273)
* **缺陷分析**：
  当用户在启动器中修改了设备名称、绑定了新的微软账户，或者切换了整合包，前端会调用 `update_lan_device_info` 将新的富文本名片同步到后端的 `shared_state`。
  但该命令**仅更新了内存中的 `current_device_info` 状态，并没有调用 `MdnsScanner::start_broadcast` 来注销旧的并注册新的 mDNS 广播服务**。
* **逻辑后果**：
  局域网内其他设备扫描看到的 mDNS 广播名与 IP 依然是修改前的老旧状态，只有在重启启动器后才会刷新广播，逻辑不具备动态闭环性。

---

## 三、 崩溃与阻断 Bug（Panics & Blockers）

### 1. 启动器首次启动/未完成初始化时，局域网服务 Panic 阻断
* **代码定位**：
  * [deferred_startup.rs:L45-L49](file:///h:/VSCodeWork/pilauncher/src-tauri/src/services/deferred_startup.rs#L45-L49)
  * [mdns_service.rs:L28-L54 (`start_broadcast`)](file:///h:/VSCodeWork/pilauncher/src-tauri/src/services/lan/mdns_service.rs#L28-L54)
* **缺陷分析**：
  在启动器首次运行或由于配置损坏导致 `settings.json` 中不存在 `deviceId` 和 `deviceName` 时，[trust_store.rs](file:///h:/VSCodeWork/pilauncher/src-tauri/src/services/lan/trust_store.rs) 读出的 `device_id` 和 `device_name` 将为空字符串。
  空字符串传入 `start_broadcast` 后：
  ```rust
  let clean_hostname = device_id.replace("-", "").to_lowercase(); // 依然为空
  let host_name = format!("{}.local.", clean_hostname); // 格式化为 ".local."
  
  let service_info = ServiceInfo::new(
      service_type,
      &instance_name,
      &host_name, // 非法的 mDNS 主机名格式
      &ip,
      http_port,
      properties,
  )
  .unwrap(); // 如果 host_name 非法或为空，这里将直接返回 Err 并触发 .unwrap() Panic
  ```
* **运行后果**：
  后台异步线程抛出 `unwrap` Panic，导致紧随其后的 `services::lan::http_api::start_http_server(...)` **根本不会被执行**。由于是在后台异步 runtime 中 Panic，主程序虽不会闪退，但局域网 HTTP API 服务已被彻底阻断，且用户在此期间无法获知服务已死。

### 2. 多网卡环境下广播不可达 IP 导致逻辑失效
* **代码定位**：
  * [mdns_service.rs:L32-L39](file:///h:/VSCodeWork/pilauncher/src-tauri/src/services/lan/mdns_service.rs#L32-L39)
* **缺陷分析**：
  广播宣告的本地 IP 是通过外部库 `local_ip_address::local_ip()` 获取的。
  如果用户电脑上启用了 WSL、VPN 或 VMware/VirtualBox 虚拟网卡，`local_ip()` 返回的往往是这些虚拟适配器的 IP（例如 `172.x.x.x` 或 `192.168.56.x`），而不是与路由器直连的真实物理局域网网段（如 `192.168.1.x`）。
* **逻辑后果**：
  局域网内其他设备虽然能从 mDNS 雷达上捕获到广播事件，但在尝试连接该虚拟 IP 上的 `9999` 端口时会因网络不通直接超时失败，导致局域网设备间“看得见却连不上”。

---

## 四、 性能与资源消耗隐患（Performance & Resource Issues）

### 1. 打包/发送大文件时引发内存暴涨（OOM 风险）
* **代码定位**：
  * [transfer_service.rs:L41-L47 (`zip_dir_with_progress`)](file:///h:/VSCodeWork/pilauncher/src-tauri/src/services/lan/transfer_service.rs#L41-L47)
* **缺陷分析**：
  在将整合包或存档打包为 ZIP 时，代码对于每个文件都采用一次性全部载入内存的同步读取方式：
  ```rust
  let mut source_file = File::open(path).map_err(|e| ...)?;
  let mut buffer = Vec::new();
  source_file.read_to_end(&mut buffer).map_err(|e| ...)?; // 将整个文件全部读入内存
  zip.write_all(&buffer).map_err(|e| e.to_string())?;
  ```
* **运行风险**：
  如果待传输的整合包或存档中包含体积巨大的文件（例如数以 GB 计的备份包、特大世界的区块文件等），一次性读入内存（特别是高并发或在内存受限的树莓派等运行环境）会瞬间引发内存突增，甚至直接被操作系统 OOM Killer 杀掉或导致界面卡死。

### 2. mDNS 扫描去重处理过于偏重前端，后端返回冗余数据
* **代码定位**：
  * [mdns_service.rs:L71-L98](file:///h:/VSCodeWork/pilauncher/src-tauri/src/services/lan/mdns_service.rs#L71-L98)
* **缺陷分析**：
  后端 mDNS 雷达在 3 秒扫描期间只要捕获到 `ServiceResolved` 事件就会直接 push 到 Vec，不做任何基于 `device_id` 或 IP 端口的去重。
  虽然前端 `useLan.ts` 实现了 `dedupeDiscoveredDevices`，但如果局域网设备较多或网络抖动，后端会向 Tauri 通信层返回大量包含重复主机的垃圾数据，浪费序列化和通信带宽。

---

## 五、 改进与修复建议（Recommendations）

> [!IMPORTANT]
> **以下为改进方案建议，本次审计未修改任何源文件代码。**

1. **安全加固 (握手签名验签)**:
   在发起 `/trust/request` 和接收文件时，使用 `lan_identity.json` 中保存的私钥对请求内容进行签名（如加入随机数 Timestamp 和 Signature），在接收端使用存储的对应设备公钥进行 `ed25519` 验签，拒绝无签名或签名失效的请求。
2. **防范越权与自动信任**:
   将 `/trust/request` 强制降级为每次都必须经过 Oneshot 弹窗让用户手动点击“同意”（即使 UUID 相同），或者仅在通过高强度签名握手校验的前提下允许对相同 UUID 执行免交互自动信任。
3. **补齐鉴权中间件**:
   在 `auth_middleware` 中，比对请求头中携带的设备指纹与签名，确认该设备处于 `trusted_devices` 数据库中且信誉级别为 `trusted` 才能放行 `/api/transfer/receive` 的写入流。
4. **路径穿越防护**:
   在接收传输端，严格剥离并清理 `X-Transfer-Id` 请求头，限制其只能为合法 UUID 格式（或只允许包含数字、字母和横杠），严防 `..` 等穿越路径。
5. **流式压缩减小内存抖动**:
   在打包 ZIP 时，不要使用 `read_to_end`，建议使用 buffer 流式复制：
   ```rust
   let mut source_file = File::open(path)?;
   std::io::copy(&mut source_file, &mut zip)?;
   ```
6. **补全广播动态更新与信任自检闭环**:
   * 在 `update_lan_device_info` 触发时，主动重新调用一次广播重置逻辑。
   * 在前端 `useLan` 钩子的 `scan` 逻辑中，完成扫描后将在线设备列表传入并调用 `verifyTrustedDevices`，使被篡改的假冒/异常设备能被及时拉黑或降级。
