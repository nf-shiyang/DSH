# dsh-senior-developer

> ✅ 已验证兼容 DeepSeek Harness 0.1.7：核心注入 API（`ctx.systemPrompt.section`）与 bundle 分发格式（`dsh.bundle.patch` + `cordis.patch.yml`）均未变；仅将 `peerDependencies` 对齐到 vendored 的 `@deepseek-ai/cordis >=4.0.0-rc.7`。

让 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）以「高级全栈开发工程师（核心）」角色 + 工作流工作。

**这是「高级开发工程师套件」中的「开发」本体**：纯核心全栈工程师（前端 / 后端 / 数据 / 基建 / AI 集成）+ 产品经理（需求澄清 / 拆解 / 验收）能力已并入核心。代码评审、技术文档、部署运维已拆分为独立插件，按需安装组合：

| 插件 | 仓库 | 职责 |
| --- | --- | --- |
| **开发（本插件）** | `github:nf-shiyang/DSH` | 全栈开发本体 + 需求 / 验收 |
| 代码评审 | `github:nf-shiyang/dsh-reviewer` | 写完自检 + 四维度评审 + 测试策略 |
| 技术文档 | `github:nf-shiyang/dsh-docs` | README / API / 变更日志产出 |
| 部署运维 | `github:nf-shiyang/dsh-devops` | 容器化 / CI-CD / 可观测 / 事故复盘 |

> **v0.4.0 变更（重要）**：从 v0.3.0 的「单仓多模块 + config.modules 开关」拆分为**独立插件套件**。本仓回归纯核心开发（PM 能力并入核心），评审 / 文档 / 运维各自独立成仓。切换方式从「手动改 yaml 配置」变为「装 / 卸对应插件」，更直观、互不干扰，且每个插件可独立维护。
> **v0.3.0 变更**：角色拆分为核心 + 4 可选模块并新增 config.modules 开关（已弃用，见 v0.4.0）。
> **v0.2.0 变更**：人设升级为全栈全能 + 加固插件健壮性。

## 特性

- **开箱即用**：默认内置「高级全栈开发工程师」核心角色，装上即以该角色工作。
- **可换角色**：通过 `config.text` 可整体替换为任意角色，无需改代码。
- **免构建**：纯 ESM JavaScript，`index.js` 既是源码也是发布产物。
- **零运行时依赖**：只依赖 `@deepseek-ai/dsh-base` 提供的 `systemPrompt` 服务。
- **标准分发**：带 `dsh-plugin` 话题，可被社区聚合目录收录。

## 安装（开发本体）

> 前提：Node.js 22.19+ 或 24+，pnpm 11（`corework enable` 或 `npm i -g pnpm`）。`dsh plugin` 会在 profile 目录内转发给 pnpm。

本插件已发布在 https://github.com/nf-shiyang/DSH。

**方式 A：从 DeepSeek Harness 源码 checkout（推荐，同时拿到 harness 源码）**

```sh
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

`web` 是 `dsh web` 默认启动的 profile。卸载：`dsh plugin --profile web remove dsh-senior-developer`。

## 组合安装建议（套件）

- **只写码**：只装本插件。
- **完整产品**：本插件 + `dsh-reviewer` + `dsh-docs` + `dsh-devops`（四个都装）。
- **部署上线**：本插件 + `dsh-devops`。

```sh
# 评审 / 文档 / 运维 各自独立安装（需先在 GitHub 建好对应仓库）
dsh plugin --profile web add github:nf-shiyang/dsh-reviewer
dsh plugin --profile web add github:nf-shiyang/dsh-docs
dsh plugin --profile web add github:nf-shiyang/dsh-devops
```

不需要某能力时，直接 `dsh plugin --profile web remove <插件名>` 卸载即可，**不用改任何配置文件**——这正是拆分相比 v0.3.0「手动改 yaml 开关」的最大好处。

## 自定义角色

默认角色在 `index.js` 的 `CORE_ROLE` 常量（已含 PM / 需求能力）。要换成别的角色，在
`$DSH_HOME/profiles/web/cordis.patch.yml` 里覆盖该行：

```yaml
- id: senior-developer
  name: 'dsh-senior-developer'
  config:
    text: |
      你是一位资深后端工程师，擅长高并发服务……
    order: 50
```

`text` 为空（默认）时，插件注入内置核心角色。

## 配置项

| Key       | 默认                  | 含义                                                         |
| --------- | --------------------- | ------------------------------------------------------------ |
| `text`    | 内置核心角色          | 整体覆盖角色文本。                                           |
| `name`    | `senior-developer:core` | section 名（同一 scope 层内须唯一）。                       |
| `order`   | `50`                  | 排序值。惯例：`0` = persona，`100–199` = 工具指导。          |
| `complete`| `false`               | `true` 时该段成为完整 system prompt，抑制其它所有段（慎用）。 |

## 验证是否生效

装完重启 `dsh web`（端口默认 http://127.0.0.1:3080）后：

- **简单法**：发一条开发任务，看回复是否带「高级开发工程师」风格（先任务分解、小步快跑、写→验→报）。
- **严谨法**：运行 `dsh --profile web --dump-config`，在打印的 bundles 列表里看到 `dsh-senior-developer` 即挂载成功。

## 本地开发

`index.js` 既是源码也是产物，无需转译。测试：`node test/apply.test.mjs`（零依赖，覆盖默认注入、健壮性、已知限制）。

## 发布到社区（可选）

1. Fork / 推送到你自己的 GitHub 仓库。
2. 给仓库打上 **`dsh-plugin`** 话题（Topic），即可被社区聚合目录收录。

## License

[MIT](./LICENSE)
