# 启动器 Java 版好友状态显示设计方案

**文档目标**：在现有的 Pilauncher (Rust + Tauri) 架构下，实现**仅获取和显示 Minecraft Java 版好友**及其在线状态，屏蔽与 Minecraft 无关的 Xbox Live 好友。

**更新日期**：2026-05-21

---

## 1. 核心业务逻辑解析

Xbox Live 的好友系统是全局的（包含主机游戏、PC 游戏、基岩版等）。如果要在启动器中做到“只显示 Java 版好友”，我们需要通过**两步过滤机制（双重数据源交叉验证）**来实现精准过滤：

1. **好友列表层级过滤**：不使用 Xbox 的通用好友列表 API，而是使用 **Mojang 专用的社交 API** 获取好友列表。
2. **在线状态层级过滤**：从 Xbox 获取所有好友的在线状态后，通过 **Title ID (游戏标识符)** 或富文本状态过滤出当前正在游玩“Java 版”的好友。

---

## 2. API 数据流与调用链

我们需要结合你现有的 `src-tauri/src/services/auth/xbox.rs` 与 `minecraft.rs` 基础设施。

### 阶段一：获取“纯 Java 版”好友列表
**不调用** Xbox 的 `peoplehub` 列表 API。
**调用** Minecraft Services API。

- **Endpoint**: `GET https://api.minecraftservices.com/player/social/friends`
- **Auth Header**: `Authorization: Bearer <Minecraft_Access_Token>` (注意：这里用的是最终换取到的 MC 令牌，而不是 Xbox Token)。
- **返回值**：这个 API 仅返回玩家在 Minecraft Java 版体系内（或通过新版官方启动器）添加的专属好友。
- **作用**：构建一个“基准白名单 UUID/XUID 集合”。

### 阶段二：获取全局在线状态 (Presence)
在线状态只能通过 Xbox Live API 获取，因此我们需要一个专门请求 Xbox API 的 XSTS Token。

- **前置准备**：复用你现有的 `auth_xbl` 拿到 XBL Token。然后用 `RelyingParty: "http://xboxlive.com"` 调用 `auth_xsts`，换取 Xbox 专用的 XSTS Token 和 `uhs`。
- **Endpoint**: `GET https://peoplehub.xboxlive.com/users/me/people/social`
- **Auth Header**: `Authorization: XBL3.0 x=<uhs>;<xsts_token>`
- **返回值**：返回所有在线 Xbox 好友的当前状态（包含他们在玩什么游戏）。

### 阶段三：数据交叉过滤 (Intersection)

在 Rust 后端 (`services`) 拿到上述两份数据后进行合并：

1. 遍历 Xbox People API 返回的在线好友列表。
2. **条件 1（身份匹配）**：检查该好友的 ID 是否存在于阶段一的“Mojang 好友基准白名单”中。
3. **条件 2（游戏匹配）**：检查该好友的 `presenceState` 是否为 `Online`，且其 `titleHistory` 或 `devices[0].titles[0]` 中的游戏名称/Title ID 是否匹配 Java 版。
   - *注：Java 版的常见 Rich Presence 标识包含 `"Minecraft: Java Edition"` 或特定的服务器/单人游戏状态（如 `PLAYING_SERVER`, `PLAYING_HOSTED_SERVER`）。*
4. 将满足条件的好友组装为最终的 JSON 结构，通过 Tauri Command 返回给前端。

---

## 3. 架构设计与代码落地方案

在不修改你现有代码结构的前提下，建议在 `src-tauri/src/services/` 下新增一个专门的 `social_service.rs`。

### 3.1 目录结构规划
```text
src-tauri/src/
  ├── services/
  │    ├── auth/
  │    │    ├── xbox.rs        (保持原样，可新增一个针对 xboxlive.com 的 xsts 认证方法)
  │    │    └── minecraft.rs   (保持原样)
  │    └── social_service.rs   (🆕 新增：负责合并 MC API 与 Xbox API 数据)
  ├── commands/
  │    └── social_cmds.rs      (🆕 新增：提供给 Vue/React 前端的 Tauri 命令)
```

### 3.2 核心函数签名设计 (Rust)

```rust
// in src-tauri/src/services/social_service.rs

pub struct JavaFriendStatus {
    pub uuid: String,          // Minecraft UUID
    pub name: String,          // 游戏内名称/Gamertag
    pub is_online: bool,       // 是否在线
    pub activity: String,      // 正在玩什么 (例如: "正在单人游戏", "正在 Hypixel")
    pub can_join: bool,        // 是否可以加入 (如果是局域网穿透状态)
}

/// 1. 获取 Mojang 专属好友列表
pub async fn fetch_mojang_friends(mc_token: &str) -> Result<Vec<String>, Error> { ... }

/// 2. 获取 Xbox 全局好友在线状态
pub async fn fetch_xbox_presence(xsts_token: &str, uhs: &str) -> Result<XboxPresenceResponse, Error> { ... }

/// 3. 核心业务层：组装并过滤 Java 版状态
pub async fn get_java_friends_presence(mc_token: &str, xsts_token: &str, uhs: &str) 
    -> Result<Vec<JavaFriendStatus>, Error> 
{
    // 并发请求两个 API
    let (mc_friends, xbox_presence) = tokio::join!(
        fetch_mojang_friends(mc_token),
        fetch_xbox_presence(xsts_token, uhs)
    );
    
    // 过滤逻辑
    // ...
}
```

### 3.3 前端 (Tauri Command) 接口设计

在 Tauri 端暴露极其简单的命令，让前端完全不需要处理复杂的认证链和数据过滤：

```rust
#[tauri::command]
pub async fn get_friends_status(state: State<'_, AppState>) -> Result<Vec<JavaFriendStatus>, String> {
    // 1. 从 state 中取出当前登录用户的 ms_token 或已有的 mc_token
    // 2. 检查缓存的 xbox XSTS token (如果没有则临时生成)
    // 3. 调用 social_service::get_java_friends_presence
    // 4. 返回干净的数据给前端渲染
}
```

---

## 4. 该方案的优势

1. **精准屏蔽基岩版/Xbox主机玩家**：如果一个玩家只是你的 Xbox 好友，但在玩《光环》或者《我的世界 基岩版》，通过阶段一的白名单和阶段二的游戏 ID 校验，他会被完美过滤掉，不会污染启动器界面。
2. **最小化侵入现有代码**：你的认证模块 `auth/xbox.rs` 几乎不需要改动（只需补一个针对 `http://xboxlive.com` 的 Token 获取函数），所有新逻辑都在新的 `social_service` 中独立运行。
3. **原生高性能**：完全复用你的 Rust `reqwest` 异步生态，使用 `tokio::join!` 并发请求两个 API，速度极快，无需依赖类似 OpenFriendCore 这样的外部 Go 进程。
