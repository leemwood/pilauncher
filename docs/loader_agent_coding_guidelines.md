# Loader 下载与部署改造编码规范

这份规范给编码 agent 使用。目标是修复和重构后端 loader 下载、安装、部署、校验逻辑时保持一致的工程边界，避免继续用目录名推导、重复安装和半状态缓存叠加补丁。

## 基本原则

1. 不要把 loader 目录名当作唯一真相。

   `runtime/versions/<id>/<id>.json` 中的真实 `id` 才是安装结果的权威值。Fabric/Quilt 可以由 profile API 预期 ID 得出；Forge/NeoForge 必须以 installer 产物或最终落盘 JSON 为准。

2. 安装函数必须返回安装结果。

   `install_loader` 不应只返回 `()`. 新逻辑应返回类似 `InstalledLoaderInfo` 的结构：

   ```text
   loader_type
   mc_version
   requested_loader_version
   normalized_loader_version
   version_id
   version_json_path
   install_source
   ```

3. 实例配置、缺失检测、manifest_builder、启动 target 必须使用同一个 `version_id`。

   不要在不同模块重复调用 `resolve_loader_folder` 后各自猜目录。允许保留旧推导函数作为 fallback，但不能作为新流程的主路径。

4. 区分三种状态。

   - `requested_loader_version`: 用户/API 请求的原始 loader 版本。
   - `normalized_loader_version`: 用于下载 URL 或版本匹配的规范化 token。
   - `version_id`: 最终 Minecraft launcher version ID。

   不要混用这三个值。

5. 不要让“能解析 JSON”代表“安装有效”。

   本地版本 JSON 必须至少校验 `id`、`inheritsFrom`、关键 loader library、关键 arguments/mainClass。依赖文件还要按 size/hash 或存在性校验。

## 允许的改造顺序

优先按以下顺序实现，避免一次性重构过大。

1. 新增安装结果结构，并让 Fabric/Quilt/Forge/NeoForge installer 返回真实 `version_id`。
2. 在实例配置中持久化真实 loader `version_id`。
3. 启动、缺失检测、manifest_builder 改为优先使用持久化 `version_id`。
4. Fabric/Quilt meta API 路径参数做 URL encode。
5. 强化 loader JSON 缓存校验。
6. Forge/NeoForge installer 参数改为兼容重试。
7. 最后再考虑把 Forge/NeoForge 改为完整 processors 执行模型。

## Fabric / Quilt 编码要求

1. 使用官方 profile JSON 作为权威元数据。

   Fabric:

   ```text
   /v2/versions/loader/{game_version}/{loader_version}/profile/json
   ```

   Quilt:

   ```text
   /v3/versions/loader/{game_version}/{loader_version}/profile/json
   ```

2. `game_version` 和 `loader_version` 必须按 URL 路径段 encode。

   预发布版本、快照版本或包含空格/特殊字符的版本不能直接拼接进 URL。

3. 下载 profile JSON 后不要盲信固定 ID。

   可以保留现有 ID 命名规则，但必须读取 JSON 中的 `id`。如果远端返回 ID 和本地预期不同：

   - 优先使用远端 `id`。
   - 落盘目录必须与最终 `id` 一致。
   - 记录日志说明请求版本与返回 ID。

4. 校验内容至少包括：

   - `inheritsFrom == mc_version`
   - Fabric 包含 `net.fabricmc:fabric-loader`
   - Quilt 包含 `org.quiltmc:quilt-loader`
   - 所有当前平台需要的 libraries 能解析出下载路径

## Forge 编码要求

1. 短期保留运行 installer 的模式时，不要同时把手动写入的 JSON 当成最终结果。

   推荐流程：

   ```text
   download installer
   inspect version.json / install_profile.json
   run installer
   discover final version JSON from runtime/versions
   verify final version JSON
   return InstalledLoaderInfo
   ```

2. 如果运行 installer，就以 installer 执行后的产物为准。

   不要强行把 `version.json.id` 改写成推导 ID 后再假设它就是最终 ID。可以在运行前用作预期值，但运行后必须重新发现和校验。

3. `launcher_profiles.json` 只能作为 installer 兼容文件。

   它不是 PiLauncher 的部署状态，不要从它读取实例状态，也不要把它当作安装成功依据。

4. installer 失败时错误信息必须包含：

   - Java 路径
   - Java major 要求
   - installer 路径
   - 使用的 CLI 参数
   - 最近 stdout/stderr
   - 候选下载源摘要

## NeoForge 编码要求

1. 不允许固定假设版本目录一定是 `neoforge-{version}`。

   当前最大风险就是安装逻辑读取 installer 内真实 `version.json.id`，但其他模块用 `resolve_loader_folder` 推导 `neoforge-{normalized_loader_version}`。改造后必须统一使用安装返回的真实 `version_id`。

2. installer 下载 URL 继续支持 Maven 与 BMCLAPI fallback。

   官方 Maven 形态：

   ```text
   https://maven.neoforged.net/releases/net/neoforged/neoforge/<version>/neoforge-<version>-installer.jar
   ```

3. installer 参数不要只靠版本号猜测。

   短期可实现兼容重试：

   ```text
   try preferred flag
   if output indicates unknown/invalid option, retry alternate flag once
   persist/log successful flag
   ```

   常见候选：

   ```text
   --install-client
   --installClient
   ```

4. 校验内容至少包括：

   - final version JSON 存在且 `id` 与返回的 `version_id` 一致。
   - `inheritsFrom` 指向目标 Minecraft 版本。
   - libraries 中包含 NeoForge 关键坐标，例如 `net.neoforged:neoforge` 或启动所需 BootstrapLauncher/module path 依赖。
   - 现代 NeoForge 的 module path 条目没有重复进入 classpath。

## 依赖下载要求

1. 下载器必须支持 `downloads.artifact`、`downloads.classifiers` 和 legacy Maven 坐标。

2. rules 判断必须和启动侧一致。

   同一个 library 在下载阶段和启动阶段不能出现一边下载、一边不进 classpath 的规则差异，除 native classifiers 的特殊处理外。

3. 缓存命中必须经过校验。

   如果有 `sha1`，用 hash 校验；如果只有 `size`，用 size 校验；两者都没有时才只检查存在性。

4. 依赖损坏时允许删除并重下，但只删除明确属于当前任务的文件。

## 清理与失败恢复

1. 安装前记录本次可能写入的目标。

   至少记录：

   - `runtime/versions` 安装前目录列表
   - installer 临时文件路径
   - 当前 loader 相关 libraries 前缀

2. 失败清理只清理本次新增或明确损坏的文件。

   不要删除用户已有的 loader/runtime 文件。工作区可能已经有其他实例共享同一 runtime。

3. 取消安装应和失败安装走同样的临时文件清理，但不要删除已存在的有效 runtime。

## 启动侧要求

1. `LaunchCommandBuilder` 的 target version 必须来自实例配置中的真实 `version_id`。

2. `get_version_chain` 仍应沿 `inheritsFrom` 解析完整链路。

3. `merge_libraries` 和 args 合并不能只看 loader JSON；必须保留父 vanilla JSON 的 assets、downloads、javaVersion、arguments。

4. module path 处理不能回退。

   NeoForge/BootstrapLauncher 场景下，进入 `-p` / `--module-path` 的 jar 不应重复进入最终 classpath。

## 测试要求

新增或修改逻辑后至少补这些测试：

1. `resolve_loader_folder` fallback 不影响持久化 `version_id` 优先级。
2. NeoForge installer 返回的真实 ID 与 `neoforge-{version}` 不一致时，实例仍能启动。
3. Fabric/Quilt 特殊版本号会被 URL encode。
4. 已存在但 `inheritsFrom` 错误的 loader JSON 会触发重下或报错。
5. Forge/NeoForge installer 参数失败后能切换候选参数重试。
6. 安装失败不会删除安装前已存在的 loader 目录。
7. NeoForge module path 依赖不会重复进入 classpath。

## 禁止事项

- 禁止在新代码中把 `loader_type + mc_version + loader_version` 推导出的目录名当作安装成功依据。
- 禁止在 Forge/NeoForge 中强行改写 `version.json.id` 后跳过最终产物发现。
- 禁止把 `launcher_profiles.json` 当作 PiLauncher 状态源。
- 禁止只用 JSON 可解析性判断 loader 已安装。
- 禁止在失败清理中删除无法证明属于本次安装的 runtime 文件。
- 禁止绕过现有下载设置、代理、限速、取消标记和进度事件。

## 最小验收标准

改造完成后必须满足：

1. 新建任意非 Vanilla 实例后，实例配置中存在真实 loader `version_id`。
2. `runtime/versions/<version_id>/<version_id>.json` 存在，并与实例配置一致。
3. 删除 loader JSON 后，缺失检测能准确发现目标 loader 缺失。
4. NeoForge 不再依赖 `neoforge-{version}` 硬编码目录作为唯一真相。
5. Fabric/Quilt 对含特殊字符的版本请求不会生成非法 URL。
6. Forge/NeoForge 安装失败日志足够定位 Java、installer、参数、下载源或依赖问题。

