# DSH 插件「高级开发工程师」— 适配与交接指南

> **用途**：当 DeepSeek Harness（简称 dsh）大版本更新、本插件可能失效时，把**整个这个文件夹（或同名 ZIP）**整体发给任意 AI，让它照本指南核对并改写，使其兼容新版 dsh。
> 本指南是给「未来 AI」和「未来的你」看的，不是给当前 dsh 看的。

---

## 0. 一句话定位

这是一个 **dsh bundle 插件**，向 dsh 的 system prompt 注入「高级全栈开发工程师（全能）」角色设定 + 工作流纪律。v0.3.0 起角色被拆为**多个 section**：一个始终在的 `core`（核心全栈工程师）段，外加四个可选模块 `reviewer`（代码评审）/ `docs`（技术文档）/ `devops`（部署运维）/ `pm`（产品经理），由 `config.modules` 控制是否注入。装上后，dsh 即以该角色与用户协作。默认角色文本在 `index.js` 的 `CORE_ROLE` / `REVIEWER_ROLE` / `DOCS_ROLE` / `DEVOPS_ROLE` / `PM_ROLE` 常量，可通过 `config.text` 整体替换。

> 已发布仓库：`github:nf-shiyang/DSH`（用户已发布，可 `dsh plugin --profile web add github:nf-shiyang/DSH` 安装）。

---

## 1. 文件清单与职责（改插件只看这几样）

| 文件 | 作用 | 更新时大概率要不要改 |
|------|------|----------------------|
| `index.js` | 插件主体（ESM）。`export const name` / `export const inject` / `export function apply(ctx, config)`；核心逻辑是按 `MODULE_SPECS`（core+4 模块）循环调用 `ctx.effect(() => ctx.systemPrompt.section({...}))` | 仅当 `systemPrompt.section` 接口改名/改签名时改 |
| `cordis.patch.yml` | bundle 挂载声明（YAML） | 仅当 bundle 挂载格式变化时改 |
| `package.json` | 声明为 dsh bundle（`"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` + `keywords: ["dsh-plugin"]`），并锁 peer 依赖 | 仅当 bundle 标识字段或 cordis 版本变化时改 |
| `README.md` | 安装 / 配置 / 自定义角色 / 卸载 说明 | 顶部的兼容性段落补充新版本号 |
| `LICENSE` / `.gitignore` | 仓库配套 | 不改 |

---

## 2. 兼容契约（新版 dsh 必须核对的 5 个点）

### 2.1 系统提示词注入接口（最关键）
当前实现（v0.3.0）：按 `MODULE_SPECS`（含 core / reviewer / docs / devops / pm 五段）逐一调用 `ctx.systemPrompt.section(...)`，core 始终注册，可选模块由 `config.modules[key]===false` 跳过：
```js
for (const [key, spec] of Object.entries(MODULE_SPECS)) {
  const isCore = key === 'core'
  if (!isCore && mods[key] === false) continue
  ctx.effect(() => ctx.systemPrompt.section({
    name: isCore ? (cfg.name || spec.name) : spec.name,
    order: isCore ? coreOrder : spec.order,
    text: spec.text,
  }), spec.name)
}
```
- `section()` 由 `core/system-prompt` 服务提供（`index.js` 顶部 `@deepseek-ai/dsh-base` 提供，`inject: ['systemPrompt']`）。
- 每段字段语义：`name / order / text`（v0.3.0 起默认不再注入 `complete`，避免误抑制其它段；仅 `config.text` 整体覆盖模式支持 `complete:true`）。
- 新版若改名/改签名（例如变成 `ctx.prompt.addSection(...)` 或字段改名），**只改 `index.js` 这一处循环调用**，语义保持 `name / order / text` 即可。
- `complete: true` 会**抑制其它 system prompt 段**，除非用户显式要「整段替换」，否则默认不要给。

### 2.2 插件模块格式
ESM（纯 JS，免编译）。必须导出：
```js
export const name = 'senior-developer'        // 与 cordis.patch.yml 的 name 字段一致
export const inject = ['systemPrompt']          // 声明依赖的服务（可选但建议）
export function apply(ctx, config = {}) { ... } // config 来自 cordis.patch.yml 的 config 块
```
> 注：`apply(ctx, config)` 实际未给默认参数，而是在函数体内用 `const cfg = config && typeof config === 'object' ? config : {}` 兜底，对 `config` 为 null/undefined 也安全。config 支持 `text` / `name` / `order` / `complete`（仅 text 模式）/ `modules`（对象，`{reviewer?,docs?,devops?,pm?}`，值为 `false` 时关闭对应可选模块）。

### 2.3 Bundle 分发格式（让 `dsh plugin add` 能识别）
`package.json` 须含：
```json
"type": "module",
"dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
"keywords": ["dsh-plugin"]
```
三者缺一会无法被 `dsh plugin add github:...` 自动识别。

### 2.4 cordis.patch.yml 格式（注意它是 `insert` 列表）
当前内容（**精确格式，别写成别的结构**）：
```yaml
- insert:
    - id: senior-developer
      name: 'dsh-senior-developer'
      config:
        order: 50
```
- 顶层是一个 YAML **列表**，列表项是 `insert:` 键，其值又是一个对象列表（每项 `id` / `name` / `config`）。
- `id` 必须全局唯一；`name` 须等于插件导出的 `name`（这里是 `senior-developer`——注意 `cordis.patch.yml` 里的 `name` 字段写的是 bundle 包名 `dsh-senior-developer`，这是 dsh 的约定：patch 的 `name` 是 bundle 标识，`apply` 拿到的 `ctx` 的插件名是 `senior-developer`）。
- `config` 透传给 `apply(ctx, config)`；本例只传了 `order`，`text`/`name`/`complete`/`modules` 均为可选。

### 2.5 安装方式（0.1.x）
```sh
dsh plugin --profile web add github:<user>/<repo>   # 注意：0.1.x 不带 -w 参数
# 或 Web UI：「添加插件」弹窗 → 粘贴 GitHub 地址 → 安装
```
> 历史坑：早期文档/示例里出现过 `dsh plugin add -w ...` 的写法，0.1.x 实测**不需要** `-w`，README 已据此修正。

---

## 3. 已知良好版本
- 已验证兼容 **dsh 0.1.x**（重点交叉核对过 `0.1.7`）：`systemPrompt.section`、`cordis.patch.yml` 挂载格式、`dsh plugin add` 三种机制均未变。
- 依赖 cordis vendored 版本 `4.0.0-rc.7` → `package.json` 中 `peerDependencies` / `devDependencies` 写 `>=4.0.0-rc.7`。
  - 注：`dsh plugin add` 当前对 peer 范围**不校验**，所以即使写错也不会阻断安装；但新版若开启校验就会报错，故应保持与实际 vendored 版本一致。

---

## 4. 交给未来 AI 的执行清单（适配新版 dsh 时照做）

1. **核对 5 个契约点**（见 §2）：用官方文档 / Release Notes / 源码 `node_modules/@deepseek-ai` 里对应包核对 `systemPrompt.section` 签名、`bundle` 字段、`cordis.patch.yml` 结构、`dsh plugin add` 命令是否变化。
2. **若 `systemPrompt.section` 变**：改写 `index.js` 的循环调用（§2.1），保持 `name / order / text` 语义，其余逻辑不动。
3. **若 bundle 格式变**：同步改 `cordis.patch.yml` 与 `package.json` 的 `"dsh"` 字段（§2.3 / §2.4）。
4. **更新 peer 版本**：把 `package.json` 里 `>=4.0.0-rc.7` 改成新版实际 vendored 的 cordis 版本。
5. **更新 README 兼容性段落**：在顶部补上新验证过的 dsh 版本号。
6. **冒烟验证（两步）**：
   - 单元：直接 `node test/apply.test.mjs` 跑完整测试（覆盖默认 5 段注入、模块开关、健壮性、已知限制）。重点看「默认注入：5 段」「modules.x=false」与「全部可选关闭仅 core」三用例。
   - 实机：`dsh plugin --profile web add github:<user>/<repo>` → `dsh web` → 发开发任务确认角色生效。

---

## 5. 给未来 AI 的备注（避免改坏）
- **角色文本**在 `index.js` 拆为多个常量：`CORE_ROLE`（核心段，始终注入）+ `REVIEWER_ROLE` / `DOCS_ROLE` / `DEVOPS_ROLE` / `PM_ROLE`（四个可选模块，由 `config.modules` 控制）。换角色**无需改逻辑**：改这些常量文本即可；也可不改 `index.js`、只在 `config.text` 整体覆盖。注意 `MODULE_SPECS` 表把这些常量映射成 `{ name, order, text }`，新增/删除模块时同步改这张表与 `OPTIONAL_MODULES` 数组。
- **`config.text` 为空/纯空白/非字符串时回退内置多模块角色**（`index.js` 中：`const rawText = typeof cfg.text === 'string' ? cfg.text.trim() : ''; if (rawText) {...return}` 否则走模块注册循环），这条回退逻辑**务必保留**，否则用户清空配置会注入空段。注意 `config` 已做空对象兜底（`config && typeof config === 'object' ? config : {}`），`config` 为 null/undefined 也不会崩溃；`config.modules` 非对象时按「全开」处理。
- **`core` 段 `order` 默认 50**：排在 harness 自身身份段之后，不要改成 0 除非你想让它压过 harness 身份；可选模块 order 为 60–63。`complete:true` 路径（仅 text 模式）要谨慎。
- 插件**零运行时依赖**（只依赖 dsh 注入的 `systemPrompt` 服务），不要给 `index.js` 加 `import` 第三方包。

---

## 6. 快速还原命令（若要把这个包推成新仓库 / 发新版）
```sh
cd dsh-senior-developer
# 改完 index.js / cordis.patch.yml / package.json 后：
node --check index.js          # 语法自检
node test/apply.test.mjs       # 单元测试
git init && git add -A && git commit -m "feat: adapt to dsh <新版本>"
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```
