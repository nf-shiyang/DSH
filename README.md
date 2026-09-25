# dsh-senior-developer

> ✅ 已验证兼容 DeepSeek Harness 0.1.7：核心注入 API（`ctx.systemPrompt.section`）与 bundle 分发格式（`dsh.bundle.patch` + `cordis.patch.yml`）均未变；仅将 `peerDependencies` 对齐到 vendored 的 `@deepseek-ai/cordis >=4.0.0-rc.7`。

让 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）以「高级全栈开发工程师（全能）」角色 + 工作流工作。

这是一个 **DSH bundle 插件**：它通过 `ctx.systemPrompt.section()` 向每次模型请求前的系统提示词里，注入**多段**角色设定与工作流纪律——一个始终在的「核心（全栈工程师）」段，外加按需开启的 `reviewer`（代码评审）/ `docs`（技术文档）/ `devops`（部署运维）/ `pm`（产品经理）四个可选模块。装上后，dsh 就像 WorkBuddy 里的「高级开发工程师」专家一样工作，且具备端到端全栈交付能力；用 `config.modules` 关掉暂时用不到的模块即可省 token。

> **v0.2.0 变更**：人设升级为「全栈全能」——补齐全栈能力边界（前端/后端/数据/基建/自动化/AI 集成）、范围自律、破坏性操作强制确认、架构权衡、测试与评审、性能与依赖安全、DSH 运行环境意识；同时加固了插件代码健壮性（text 类型守卫、complete 严格判定、order 消毒、服务缺失优雅降级）。
> **v0.3.0 变更**：角色拆分为「核心 + 4 个可选模块」并新增 `config.modules` 开关——`reviewer` / `docs` / `devops` / `pm` 默认全开（等同原全栈全能角色），可按任务关闭以省 token；`core` 始终注入、不可关闭。向后兼容 `config.text` 整体覆盖与全部健壮性守卫。

## 特性

- **开箱即用**：默认内置完整的「高级全栈开发工程师（全能）」角色 system prompt，装上即以该角色工作。
- **模块开关（省 token）**：角色拆为「核心 + 4 可选模块」（reviewer/docs/devops/pm），默认全开；用 `config.modules` 关掉暂时用不到的模块，做简单任务时不必背着全套指令。
- **可换角色**：通过 `config.text` 可整体替换为任意角色（产品经理、运维、安全审计……），无需改代码。
- **免构建**：纯 ESM JavaScript，`index.js` 既是源码也是发布产物，git 安装后无需编译。
- **零运行时依赖**：只依赖 `@deepseek-ai/dsh-base` 提供的 `systemPrompt` 服务。
- **标准分发**：带 `dsh-plugin` 话题，可被社区聚合目录收录。

## 安装

> 前提：Node.js 22.19+ 或 24+，pnpm 11（`corework enable` 或 `npm i -g pnpm`）。`dsh plugin` 会在 profile 目录内转发给 pnpm。

本插件已发布在 https://github.com/nf-shiyang/DSH，下面命令直接使用该仓库地址。

**方式 A：从 DeepSeek Harness 源码 checkout（推荐，同时拿到 harness 源码）**

```sh
# 把分支替换为最新发布标签（如 dsh-v0.1.7；可用 `git tag | tail` 查看）
git clone --depth 1 --branch dsh-v0.1.7 https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness && pnpm install && pnpm run build
pnpm dsh plugin --profile web add github:nf-shiyang/DSH
pnpm dsh web
```

**方式 B：无 checkout（npx，仅编译版 harness）**

```sh
npx @deepseek-ai/dsh plugin --profile web add github:nf-shiyang/DSH
npx @deepseek-ai/dsh web
```

`web` 是 `dsh web` 默认启动的 profile。插件会被装进该 profile，`dsh web` 启动后即生效。
卸载：`dsh plugin --profile web remove dsh-senior-developer`。

## 自定义角色

默认角色已写入 `index.js`：主角色 `CORE_ROLE` 与可选模块 `REVIEWER_ROLE` / `DOCS_ROLE` / `DEVOPS_ROLE` / `PM_ROLE`（五个常量）。如果你想换成别的角色，在
`$DSH_HOME/profiles/web/cordis.patch.yml` 里覆盖该行（见官方
[publish 指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md) 的层级优先级）：

```yaml
- id: senior-developer
  name: 'dsh-senior-developer'
  config:
    text: |
      你是一位资深 DevOps 工程师，擅长 CI/CD、容器化与可观测性……
    order: 50
```

`text` 字段为空（默认）时，插件注入内置的多模块角色（core + 全部可选模块）。如只想用核心工程师、关掉评审与文档：

```yaml
- id: senior-developer
  name: 'dsh-senior-developer'
  config:
    modules:
      reviewer: false
      docs: false
```

（devops / pm 不写即默认开启；`core` 始终注入、不可关闭。）

## 配置项

| Key       | 默认                    | 含义                                                         |
| --------- | ----------------------- | ------------------------------------------------------------ |
| `text`    | 内置多模块角色          | 整体覆盖角色文本。为空 ⇒ 注入内置的 core + 可选模块。         |
| `name`    | `senior-developer:core` | 多模块模式下 core 段名（同一 scope 层内须唯一）；`text` 覆盖模式下默认 `senior-developer:persona`。 |
| `order`   | `50`                    | core 段排序值。惯例：`0` = persona，`100–199` = 工具指导。    |
| `complete`| `false`                 | 仅 `text` 覆盖模式可用；`true` 时该段成为完整 system prompt，抑制其它所有段（慎用）。 |
| `modules` | `{}`（全部可选开启）    | 模块开关：`{ reviewer?, docs?, devops?, pm? }`，某键为 `false` 即关闭对应模块；`core` 始终注入、不可关闭。 |

## 验证是否生效

装完重启 `dsh web`（端口默认 http://127.0.0.1:3080）后：

- **简单法**：发一条开发任务，看回复是否带「高级开发工程师」风格（先任务分解、小步快跑、写→验→报）。
- **严谨法**：运行 `dsh --profile web --dump-config`，在打印的 bundles 列表里看到 `dsh-senior-developer` 即挂载成功。

## 本地开发

`index.js` 既是源码也是产物，无需转译。用 link 装进隔离的开发 profile：

```sh
pnpm install
DSH_HOME=$HOME/.dsh-senior-dev pnpm --dir /path/to/deepseek-harness dsh plugin --profile web add -w link:/path/to/dsh-senior-developer
```

改完 `index.js` 直接重启 `dsh web` 即可，不触碰 harness 仓库与默认 `~/.dsh`。

测试：`node test/apply.test.mjs`（零依赖，覆盖默认注入、模块开关、健壮性、已知限制）。

## 发布到社区（可选）

1. Fork / 推送到你自己的 GitHub 仓库。
2. 给仓库打上 **`dsh-plugin`** 话题（Topic），即可被社区聚合目录收录。
3. 如需 npm 发布，建议在 `package.json` 的 `name` 上加 scope（如 `@nf-shiyang/dsh-senior-developer`）。

## License

[MIT](./LICENSE)
