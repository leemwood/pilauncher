# Loader 下载与部署逻辑分析及重构方案

## 结论

当前后端的 loader 下载与部署逻辑“部分符合”现代 Minecraft 启动器的运行模型，但存在结构性风险。

Fabric 和 Quilt 基本走标准的 launcher profile JSON：从官方/镜像 meta API 获取 `versions/<id>/<id>.json`，再按 JSON 中的 `libraries` 下载依赖。这条路径总体合理。

Forge 和 NeoForge 当前是混合模式：先从 installer JAR 中解出 `version.json` / `install_profile.json`，手动下载一部分库，再运行官方 installer，最后再按生成的版本 JSON 补下载依赖。这个流程能覆盖不少场景，但不够“启动器规范化”：它既没有完全信任 installer 的产物，也没有完整实现 installer profile 的 processors 语义，导致版本 ID、目录、依赖校验和失败恢复都有不一致风险。

## 对照的现行规范/事实

1. 标准 Minecraft launcher runtime 仍以 `versions/<versionId>/<versionId>.json` 为入口，版本 JSON 通过 `inheritsFrom` 继承 vanilla 版本，并通过 `libraries`、`arguments.jvm`、`arguments.game`、`assetIndex`、`downloads` 描述启动所需文件。
2. Fabric Meta 明确提供 `/v2/versions/loader/{game_version}/{loader_version}/profile/json`，返回“standard Minecraft launcher”可用的 profile JSON。
3. Quilt Meta v3 也提供 `/v3/versions/loader/{game_version}/{loader_version}/profile/json`，返回 loader profile。
4. Forge/NeoForge 的 installer 是独立安装器。现代第三方启动器通常有两种路线：
   - 路线 A：运行 installer，让它生成版本 JSON、必要库和 profile，再把生成结果纳入启动器管理。
   - 路线 B：不运行 installer GUI/CLI，而是解析 installer 内的 `install_profile.json`，完整执行 processors、下载 libraries，最终生成与 installer 等价的 runtime。
5. NeoForge 官方 Maven 路径形如 `https://maven.neoforged.net/releases/net/neoforged/neoforge/<version>/neoforge-<version>-installer.jar`，当前代码中的基础路径方向是对的。

参考资料：

- Fabric Meta: https://github.com/FabricMC/fabric-meta
- Quilt Meta API: https://meta.quiltmc.org/
- NeoForge client install docs: https://docs.neoforged.net/user/docs/client/
- NeoForge Maven/server docs showing installer Maven layout: https://docs.neoforged.net/user/docs/server
- NeoForged project page: https://neoforged.net/

## 代码现状

### Fabric

相关文件：

- `src-tauri/src/services/downloader/loader_installer/fabric.rs`
- `src-tauri/src/services/downloader/dependencies/mirror.rs`

现状：

- 版本 ID 固定为 `fabric-loader-{loader_version}-{mc_version}`。
- 从 Fabric profile API 下载 JSON。
- 调用 `download_dependencies(version_id)` 下载该 loader JSON 中的依赖。
- 最后做 loader 文件完整性扫描。

判断：

这条路径基本符合 Fabric 的第三方启动器集成方式。主要缺口不是架构问题，而是健壮性问题：

- `mc_version` / `loader_version` 没有 URL encode。Fabric 官方文档特别提醒 game version 和 loader version 应 URL encode；预发布、包含空格或特殊字符的版本会有风险。
- 已存在 JSON 只检查“是否可解析”，不检查是否与请求的 `mc_version` / `loader_version` 匹配，也不校验关键库是否仍正确。

### Quilt

相关文件：

- `src-tauri/src/services/downloader/loader_installer/quilt.rs`
- `src-tauri/src/services/downloader/dependencies/mirror.rs`

现状与 Fabric 类似：

- 版本 ID 固定为 `quilt-loader-{loader_version}-{mc_version}`。
- 从 Quilt v3 profile API 下载 JSON。
- 按 JSON 下载依赖。

判断：

总体方向正确。主要问题同 Fabric：

- API 路径参数应 URL encode。
- 本地缓存 JSON 的有效性检查过弱。
- Quilt 只有官方 meta 源，当前 mirror 路由没有 BMCLAPI fallback，这不是 bug，但应该在 UI/日志中明确“无国内镜像兜底”或允许自定义源。

### Forge

相关文件：

- `src-tauri/src/services/downloader/loader_installer/forge.rs`
- `src-tauri/src/services/downloader/loader_installer.rs`
- `src-tauri/src/services/downloader/dependencies/libraries.rs`

现状：

- 版本 ID 固定为 `{mc_version}-forge-{loader_version}`。
- 下载 Forge installer JAR。
- 从 installer JAR 读取 `version.json`，并强行把 JSON 的 `id` 改成固定的 `version_id`。
- 从 `install_profile.json` 手动下载 `libraries`。
- 创建最小 `launcher_profiles.json`。
- 执行 `java -jar installer.jar --installClient <global_mc_root>`。
- 再按最终 `version_id` 下载依赖并校验。

判断：

这条路径有可用性，但不够规范，主要问题是“职责重复且边界不清”：

1. 既手动写 loader JSON，又运行 installer。installer 本身会写版本目录和依赖，手动提前写入可能与 installer 输出冲突。
2. `prepare_loader_version_json` 强行改 `id`。如果 Forge installer 内部版本 ID、`jar` 字段、profile 名称或 libraries 假设发生变化，手动改 ID 会制造隐性不一致。
3. 手动下载 `install_profile.json` 的 libraries 只覆盖 `libraries`，没有完整表达 installer processors。现在依赖最终靠运行 installer 兜底，因此逻辑不是一个完整的“无 installer 实现”。
4. `launcher_profiles.json` 是为 Forge installer 兼容官方 launcher 环境做的最小假文件，不属于第三方启动器 runtime 规范。可以作为兼容手段，但不应成为核心部署状态。
5. 安装失败清理只按预先推导的 loader 文件夹删除。如果 installer 实际生成了其他 ID 或写了额外文件，可能残留。

### NeoForge

相关文件：

- `src-tauri/src/services/downloader/loader_installer/neoforge.rs`
- `src-tauri/src/services/minecraft_service.rs`
- `src-tauri/src/services/instance/creation.rs`

现状：

- installer 下载 URL 使用 `net/neoforged/neoforge/{version}/neoforge-{version}-installer.jar`，方向正确。
- 会尝试从 BMCLAPI list 解析 installer URL，再 fallback 到 Maven URL。
- 实际安装时从 installer `version.json` 读取真实 `id`，然后写入 `versions/<id>/<id>.json`。
- 但其他地方的 folder 推导固定为 `neoforge-{normalized_loader_version}`。

这是最需要修的地方。

风险点：

1. `neoforge.rs` 安装时使用 installer 内 `version.json.id` 作为真实目录名；但 `minecraft_service::resolve_loader_folder` 固定返回 `neoforge-{normalized_loader_version}`。
2. 如果 installer 内的真实 ID 与 `neoforge-{version}` 不完全一致，例如带 `-beta`、历史兼容 ID、或未来 NeoForge 改变命名，实例缺失检测、失败清理、`instance_manifest.json` 生成可能找错目录。
3. `is_modern_neoforge` 用版本号大小猜测 CLI 参数：现代版本用 `--install-client`，旧版本用 `--installClient`。这类启发式很脆弱，应该改为从 installer 元数据、installer 帮助输出或兼容重试机制确定。
4. 与 Forge 一样，当前 NeoForge 也混合了“解包 JSON + 跑 installer + 补下载”，未形成清晰的安装契约。

## 启动链路是否闭环

启动侧整体比安装侧更接近规范。

相关文件：

- `src-tauri/src/services/launcher/builder/version_chain.rs`
- `src-tauri/src/services/launcher/builder/args.rs`

现状优点：

- `get_version_chain` 能沿 `inheritsFrom` 加载父版本。
- `merge_libraries` 会按继承链合并 libraries。
- `collect_raw_arguments` 能合并新版 `arguments.jvm/game` 和旧版 `minecraftArguments`。
- classpath 处理考虑了 module path，避免 NeoForge/BootstrapLauncher 场景把 module path 条目重复放进 classpath。
- 原生库、rules、classifiers 都有基本处理。

主要缺口：

- 依赖下载阶段只对当前 manifest 下载；vanilla 依赖靠创建实例时提前下载，运行时缺失修复能力不足。
- 缓存 JSON 的有效性判断太弱，不能发现“版本 JSON 可解析但属于另一个版本/旧 loader/半安装状态”。
- 安装侧没有持久化“真实 loader version id”，启动侧只能依赖实例配置中的 `target_version_id` 或目录推导。

## 建议的修改方案

### 方案一：小步修复，保留现有架构

适合短期止血。

1. 增加 `InstalledLoaderInfo`

部署完成后返回并持久化真实信息：

```text
loader_type
mc_version
requested_loader_version
normalized_loader_version
version_id
version_json_path
install_source
```

`install_loader` 不应只返回 `()`: Fabric/Quilt 返回固定 profile ID；Forge/NeoForge 返回最终落盘 JSON 的真实 ID。

2. 实例配置写入真实 `target_version_id`

当前 `InstanceConfig.loader.version` 只保存 loader 版本号。建议在 `loader` 或顶层增加：

```text
loader.version_id
```

启动、缺失检测、manifest_builder、失败清理都优先使用真实 `version_id`，不要再反推目录名。

3. 改造 `resolve_loader_folder`

保留作为 fallback，但不再作为权威来源。优先顺序：

```text
instance.json 中的 loader.version_id
runtime/versions 中扫描匹配 id
按旧规则推导 folder
```

NeoForge 尤其不能只固定 `neoforge-{version}`。

4. URL encode meta API 路径参数

Fabric/Quilt 的 `mc_version`、`loader_version` 应按路径段 encode。Forge/NeoForge Maven artifact path 也应保证版本 token 不含未转义路径特殊字符。

5. 加强 JSON 缓存校验

`needs_loader_manifest_download` 目前只检查是否存在和能否解析。应至少校验：

- `id` 与期望或真实 `version_id` 一致。
- `inheritsFrom` 与 `mc_version` 一致，或安装器明确允许不同父版本。
- Fabric/Quilt 检查 loader library 坐标。
- Forge 检查 `net.minecraftforge:forge` 或关键 BootstrapLauncher 依赖。
- NeoForge 检查 `net.neoforged:neoforge` 或关键 module path 依赖。

6. NeoForge installer 参数改为探测/重试

不要只用 `is_modern_neoforge` 判断。建议：

- 首选当前已知参数。
- 如果退出码失败且输出包含 unknown option / invalid option，再自动用另一个参数重试一次。
- 把实际成功参数写入日志。

7. 清理逻辑按真实安装结果清理

安装前后记录 `runtime/versions`、`runtime/libraries/net/minecraftforge`、`runtime/libraries/net/neoforged` 的差异，失败时只清理本次新增且与目标 loader 相关的文件。

### 方案二：中期重构，统一 LoaderInstaller 契约

建议作为后续主线。

定义统一接口：

```text
trait LoaderInstaller {
  resolve_metadata(request) -> LoaderResolvedMetadata
  plan_install(metadata) -> LoaderInstallPlan
  execute_plan(plan) -> InstalledLoaderInfo
  verify(installed) -> VerificationReport
}
```

核心数据结构：

```text
LoaderRequest:
  loader_type
  mc_version
  loader_version
  runtime_root

LoaderInstallPlan:
  version_id
  version_json
  required_libraries
  required_assets
  installer_jar
  processors
  execution_mode

execution_mode:
  profile_json_only
  run_installer
  run_processors
```

各 loader 策略：

- Fabric/Quilt: `profile_json_only`
- Forge/NeoForge 短期: `run_installer`
- Forge/NeoForge 长期: `run_processors`

这样可以把“下载 URL 解析”“文件下载”“installer 执行”“版本 JSON 落盘”“校验”拆成清晰阶段。

### 方案三：长期目标，实现 Forge/NeoForge processors

这是最符合现代第三方启动器规范的方向，但工作量最大。

目标：

- 不依赖官方 launcher profile。
- 不创建伪 `launcher_profiles.json`。
- 不运行 GUI installer。
- 解析 installer 的 `install_profile.json`，下载 libraries，执行 processors，生成与 installer 等价的 runtime。

需要实现：

1. installer JAR 解包与 schema 兼容层。
2. `install_profile.json` 的 libraries 下载。
3. processors 的 classpath、args、outputs、规则判断、校验。
4. Maven artifact resolver。
5. 完整的校验报告。

这条路线能最大化控制下载源、并发、缓存、断点续传和错误提示，但建议在方案一稳定后再做。

## 推荐落地顺序

1. 先修 NeoForge 真实 `version_id` 持久化问题。
2. Fabric/Quilt API 参数 URL encode。
3. 强化 `needs_loader_manifest_download`，避免半安装 JSON 被长期复用。
4. Forge/NeoForge installer 参数改为兼容重试。
5. 统一 `InstalledLoaderInfo`，让安装、缺失检测、manifest_builder、启动 target 全部使用同一个真实版本 ID。
6. 再考虑 Forge/NeoForge processors 化。

## 验证清单

每次修改后至少验证这些场景：

- Vanilla 1.20.1、1.21.1、1.21.5+。
- Fabric latest loader + release 版 Minecraft。
- Fabric/Quilt 对预发布或包含特殊字符的 Minecraft 版本。
- Forge 1.12.2、1.16.5、1.20.1。
- NeoForge 1.20.1 legacy 版本。
- NeoForge 1.21.1、1.21.4+ modern 版本。
- loader 已存在、JSON 损坏、依赖缺失、依赖 hash 错误。
- 安装中取消、下载失败、installer 失败后的清理。
- 启动时 classpath/module-path 不重复且不缺 BootstrapLauncher。

## 最小重构验收标准

完成方案一后，应满足：

- 新建实例后，`instance.json` 中能找到真实 loader `version_id`。
- `runtime/versions/<version_id>/<version_id>.json` 与实例配置一致。
- 删除 loader JSON 后，缺失检测能准确提示并触发重装。
- NeoForge 不再依赖 `neoforge-{version}` 这个硬编码目录作为唯一真相。
- Fabric/Quilt 预发布版本的 profile URL 不因特殊字符失败。
- Forge/NeoForge installer 失败时错误日志能指出 Java 路径、installer 参数、最近输出和候选下载源。

