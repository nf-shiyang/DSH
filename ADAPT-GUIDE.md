# DSH 插件「高级开发工程师 · 开发本体」— 适配与交接指南

> **用途**：当 DeepSeek Harness（简称 dsh）大版本更新、本插件可能失效时，把**整个这个文件夹（或同名 ZIP）**整体发给任意 AI，让它照本指南核对并改写，使其兼容新版 dsh。
> 本指南是给「未来 AI」和「未来的你」看的，不是给当前 dsh 看的。

---

## 0. 一句话定位

这是 **dsh bundle 插件「开发」本体**：向 dsh 的 system prompt 注入「高级全栈开发工程师（核心）」角色 + 工作流纪律，**PM / 需求能力已并入核心角色文本**。本插件是「高级开发工程师套件」的一员，套件其余成员为独立仓库：

- `github:nf-shiyang/DSH` —— **本插件（开发本体）**
- `github:nf-shiyang/dsh-reviewer` —— 代码评审
- `github:nf-shiyang/dsh-docs` —— 技术文档
- `github:nf-shiyang/dsh-devops` —— 部署运维

装上后，dsh 即以该角色与用户协作。默认角色文本在 `index.js` 的 `CORE_ROLE` 常量，可通过 `config.text` 整体替换。

---

## 1. 文件清单与职责（改插件只看这几样）

| 文件 | 作用 | 更新时大概率要不要改 |
|------|------|----------------------|
| `index.js` | 插件主体（ESM）。`export const name` / `export const inject` / `export function apply(ctx, config)`；核心逻辑是调用一次 `ctx.effect(() => ctx.systemPrompt.section({...}))` 注入单段 `CORE_ROLE` | 仅当 `systemPrompt.section` 接口改名/改签名时改 |
| `cordis.patch.yml` | bundle 挂载声明（YAML） | 仅当 bundle 挂载格式变化时改 |
| `package.json` | 声明为 dsh bundle（`"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` + `keywords: ["dsh-plugin"]`），并锁 peer 依赖 | 仅当 bundle 标识字段或 cordis 版本变化时改 |
| `README.md` | 安装 / 配置 / 自定义角色 / 卸载 说明 | 顶部的兼容性段落补充新版本号 |
| `LICENSE` / `.gitignore` | 仓库配套 | 不改 |

---

## 2. 兼容契约（新版 dsh 必须核对的 5 个点）

### 2.1 系统提示词注入接口（最关键）
当前实现（v0.4.0）：注入**单段**核心角色（已含 PM）：
```js
ctx.effect(() => ctx.systemPrompt.section({
  name: cfg.name || 'senior-developer:core',
  order,
  text,                 // config.text 覆盖 或 内置 CORE_ROLE
  ...(complete ? { complete: true } : {}),
}), 'senior-developer:core')
```
- `section()` 由 `core/system-prompt` 服务提供（`index.js` 顶部 `@deepseek-ai/dsh-base` 提供，`inject: ['systemPrompt']`）。
- 字段语义：`name / order / text`；`complete: true` 会**抑制其它 system prompt 段**，默认不要给。
- 新版若改名/改签名（例如 `ctx.prompt.addSection(...)`），**只改 `index.js` 这一处调用**，语义保持 `name / order / text`。

### 2.2 插件模块格式
ESM（纯 JS，免编译）。必须导出：
```js
export const name = 'senior-developer'        // 与 cordis.patch.yml 的 name 字段一致
export const inject = ['systemPrompt']          // 声明依赖的服务（可选但建议）
export function apply(ctx, config = {}) { ... } // config 来自 cordis.patch.yml 的 config 块
```
> `apply(ctx, config)` 实际未给默认参数，而是在函数体内用 `const cfg = config && typeof config === 'object' ? config : {}` 兜底，对 `config` 为 null/undefined 也安全。config 支持 `text` / `name` / `order` / `complete`。

### 2.3 Bundle 分发格式
`package.json` 须含：
```json
"type": "module",
"dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
"keywords": ["dsh-plugin"]
```
三者缺一会无法被 `dsh plugin add github:...` 自动识别。

### 2.4 cordis.patch.yml 格式（注意它是 `insert` 列表）
```yaml
- insert:
    - id: senior-developer
      name: 'dsh-senior-developer'
      config:
        order: 50
```
- 顶层是 YAML **列表**，列表项是 `insert:` 键，其值又是一个对象列表（每项 `id` / `name` / `config`）。
- `id` 必须全局唯一；`name` 须等于插件导出的 `name`（这里是 `senior-developer`）。
- `config` 透传给 `apply(ctx, config)`；本例只传了 `order`，`text`/`name`/`complete` 均为可选。

### 2.5 安装方式（0.1.x）
```sh
dsh plugin --profile web add github:<user>/<repo>   # 0.1.x 不带 -w 参数
# 或 Web UI：「添加插件」弹窗 → 粘贴 GitHub 地址 → 安装
```

---

## 3. 已知良好版本
- 已验证兼容 **dsh 0.1.x**（重点 `0.1.7`）：`systemPrompt.section`、`cordis.patch.yml` 挂载格式、`dsh plugin add` 三种机制均未变。
- 依赖 cordis vendored 版本 `4.0.0-rc.7` → `package.json` 中 `peerDependencies` / `devDependencies` 写 `>=4.0.0-rc.7`。

---

## 4. 交给未来 AI 的执行清单（适配新版 dsh 时照做）

1. **核对 5 个契约点**（见 §2）。
2. **若 `systemPrompt.section` 变**：改写 `index.js` 的调用（§2.1），保持 `name / order / text` 语义，其余逻辑不动。
3. **若 bundle 格式变**：同步改 `cordis.patch.yml` 与 `package.json` 的 `"dsh"` 字段。
4. **更新 peer 版本**：把 `package.json` 里 `>=4.0.0-rc.7` 改成新版实际 vendored 的 cordis 版本。
5. **更新 README 兼容性段落**：顶部补上新验证过的 dsh 版本号。
6. **冒烟验证**：`node test/apply.test.mjs` → 看「默认注入：1 段」与「systemPrompt 缺失降级」用例。

---

## 5. 给未来 AI 的备注（避免改坏）
- **角色文本**在 `index.js` 的 `CORE_ROLE` 常量（单段）。换角色**无需改逻辑**：改这个常量文本即可；也可不改 `index.js`、只在 `config.text` 整体覆盖。
- **PM / 需求能力已并入 `CORE_ROLE`**（见「需求澄清与验收」小节），不是独立段——若未来要把它拆出，参照套件其它仓库（dsh-reviewer 等）的独立插件结构。
- **`config.text` 为空/非字符串时回退内置 `CORE_ROLE`**（`const text = rawText || CORE_ROLE`），这条回退**务必保留**，否则用户清空配置会注入空段。`config` 已做空对象兜底，`config` 为 null/undefined 也不会崩溃。
- `order` 默认 50；`complete:true` 路径要谨慎（会抑制其它段）。
- 插件**零运行时依赖**，不要给 `index.js` 加 `import` 第三方包。

---

## 6. 快速还原命令（若要把这个包推成新仓库 / 发新版）
```sh
cd dsh-senior-developer
node --check index.js          # 语法自检
node test/apply.test.mjs       # 单元测试
git add -A && git commit -m "feat: adapt to dsh <新版本>"
git push
```
