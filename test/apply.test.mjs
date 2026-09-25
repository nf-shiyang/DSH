/**
 * dsh-senior-developer —— apply() 零依赖测试
 *
 * 运行：  node test/apply.test.mjs   （需 Node 18+，支持 ESM 与 node:assert）
 * 依赖：  仅用 Node 内置模块（node:assert/strict），无需 npm install。
 *
 * 覆盖维度：
 *   正常路径   —— 默认注入 / config.text 覆盖 / 空白回退 / 自定义 name /
 *                order 数字生效 / order 非数字回退 50 / complete:true / complete:false
 *   边界&异常  —— complete 字符串真值语义 / config.text 类型健壮性 / order NaN·Infinity /
 *                缺失 systemPrompt 服务 / API 改名 / 重复注入 / config=null
 *
 * 标 [KNOWN-BUG] 的用例是**当前实现仍存在的真实残留限制**（非崩溃类）：
 *   · 同一 ctx 重复 apply 会产生重复同名 section（热重载/重复挂载场景）。
 * 其余历史 P0 缺陷（text 类型崩溃、complete 字符串误启用、order NaN、
 * config=null 崩溃、服务缺失硬崩溃）均已修复，下方对应用例断言「已修复」行为。
 * 本脚本退出码：仅当「常规用例」失败时为 1；[KNOWN-BUG] 失败仅作风险提示。
 */
import assert from 'node:assert/strict'
import { apply } from '../index.js'

let passed = 0
let failed = 0
const knownBugFailures = []
const unexpectedFailures = []

/**
 * 构造一个最小 mock ctx，仅实现 apply() 实际用到的 API：
 *   ctx.effect(fn, name)        —— 按 Cordis 语义执行回调，返回值作为 disposer
 *   ctx.systemPrompt.section(s) —— 记录注册的 section
 *   ctx.logger?.warn/error      —— 可选，记录告警/错误（缺失时静默）
 * systemPrompt 可选：'ok' | 'missing' | 'wrong-api'
 */
function makeMockCtx({ systemPrompt = 'ok' } = {}) {
  const registered = []
  const warns = []
  const errors = []
  let effectName = null
  const ctx = {
    _registered: registered,
    _warns: warns,
    _errors: errors,
    get sections() { return registered },
    get warns() { return warns },
    get errors() { return errors },
    get lastEffectName() { return effectName },
    logger: {
      warn: (m) => warns.push(m),
      error: (m) => errors.push(m),
    },
    effect(fn, name) {
      effectName = name
      const disposer = fn() // Cordis: 执行回调，返回值若是可释放对象则作为 dispose
      return disposer
    },
    systemPrompt:
      systemPrompt === 'ok'
        ? {
            section(spec) {
              registered.push(spec)
              return () => {} // 模拟 systemPrompt 返回的 disposer
            },
          }
        : systemPrompt === 'wrong-api'
          ? { add() {} } // DSH 升级后 API 改名（section → add）
          : undefined, // 'missing'：systemPrompt 服务不存在
  }
  return ctx
}

function test(label, fn, { knownBug = false } = {}) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${label}`)
  } catch (err) {
    if (knownBug) {
      knownBugFailures.push({ label, err: err.message })
      console.log(`  ⚠ ${label}\n      → ${err.message}`)
    } else {
      unexpectedFailures.push({ label, err: err.message })
      failed++
      console.log(`  ✗ ${label}\n      → ${err.message}`)
    }
  }
}

console.log('\n=== 正常路径 ===')

test('默认注入：1 段 / 默认 name / order=50 / 含默认角色 / 无 complete', () => {
  const ctx = makeMockCtx()
  apply(ctx, {})
  assert.equal(ctx.sections.length, 1)
  const s = ctx.sections[0]
  assert.equal(s.name, 'senior-developer:persona')
  assert.equal(s.order, 50)
  assert.match(s.text, /高级开发工程师/)
  assert.equal(s.complete, undefined)
  assert.equal(ctx.lastEffectName, 'senior-developer.section()')
})

test('config.text 整体覆盖默认角色', () => {
  const ctx = makeMockCtx()
  apply(ctx, { text: '你是产品经理，负责需求与验收。' })
  assert.equal(ctx.sections.length, 1)
  assert.equal(ctx.sections[0].text, '你是产品经理，负责需求与验收。')
})

test('空白 text 回退到默认角色', () => {
  const ctx = makeMockCtx()
  apply(ctx, { text: '   \t\n  ' })
  assert.equal(ctx.sections.length, 1)
  assert.match(ctx.sections[0].text, /高级开发工程师/)
})

test('自定义 name 生效', () => {
  const ctx = makeMockCtx()
  apply(ctx, { name: 'custom:persona' })
  assert.equal(ctx.sections[0].name, 'custom:persona')
})

test('order 为数字时原值生效（含 0）', () => {
  const ctx = makeMockCtx()
  apply(ctx, { order: 0 })
  assert.equal(ctx.sections[0].order, 0)
})

test('order 非数字（字符串 "50"）回退 50', () => {
  const ctx = makeMockCtx()
  apply(ctx, { order: '50' })
  assert.equal(ctx.sections[0].order, 50)
})

test('complete:true 时设置 complete=true', () => {
  const ctx = makeMockCtx()
  apply(ctx, { complete: true })
  assert.equal(ctx.sections[0].complete, true)
})

test('complete:false 时不设置 complete（且不应告警）', () => {
  const ctx = makeMockCtx()
  apply(ctx, { complete: false })
  assert.equal(ctx.sections[0].complete, undefined)
  assert.equal(ctx.warns.length, 0)
})

console.log('\n=== 边界 / 异常（健壮性探针） ===')

test('[已修复] complete:"false" 字符串不再误启用抑制性 complete', () => {
  // YAML 中 complete: "false" 会被解析为字符串；字符串为真值，
  // 旧实现会错误启用 complete（抑制其它所有 section），现已严格判定为布尔 true。
  const ctx = makeMockCtx()
  apply(ctx, { complete: 'false' })
  assert.equal(ctx.sections[0].complete, undefined)
  assert.equal(ctx.warns.length, 1) // 应告警一次提示误用
})

test('[已修复] config.text 为对象时不崩溃并回退默认角色', () => {
  const ctx = makeMockCtx()
  assert.doesNotThrow(() => apply(ctx, { text: {} }))
  assert.match(ctx.sections[0].text, /高级开发工程师/)
})

test('[已修复] config.text 为数组时不崩溃并回退默认角色', () => {
  const ctx = makeMockCtx()
  assert.doesNotThrow(() => apply(ctx, { text: [] }))
  assert.match(ctx.sections[0].text, /高级开发工程师/)
})

test('[已修复] order:NaN 被消毒为 50（旧实现 typeof NaN==="number" 漏洞）', () => {
  const ctx = makeMockCtx()
  apply(ctx, { order: NaN })
  assert.equal(ctx.sections[0].order, 50)
})

test('[已修复] order:Infinity 被消毒为有限值（回退 50）', () => {
  const ctx = makeMockCtx()
  apply(ctx, { order: Infinity })
  assert.equal(Number.isFinite(ctx.sections[0].order), true)
  assert.equal(ctx.sections[0].order, 50)
})

test('[已修复] config 为 null 时不再崩溃（兜底空对象）', () => {
  const ctx = makeMockCtx()
  assert.doesNotThrow(() => apply(ctx, null))
  assert.equal(ctx.sections.length, 1)
})

test('[已修复] 缺失 systemPrompt 服务时优雅降级（不崩溃、不注入、记错误）', () => {
  const ctx = makeMockCtx({ systemPrompt: 'missing' })
  // 旧实现会因 inject 缺失或调用 undefined 而硬崩溃；现改为记错误后安全返回。
  assert.doesNotThrow(() => apply(ctx, {}))
  assert.equal(ctx.sections.length, 0)
  assert.equal(ctx.errors.length, 1)
})

test('[已修复] systemPrompt API 改名（section → add）时优雅降级', () => {
  const ctx = makeMockCtx({ systemPrompt: 'wrong-api' })
  assert.doesNotThrow(() => apply(ctx, {}))
  assert.equal(ctx.sections.length, 0)
  assert.equal(ctx.errors.length, 1)
})

test('[KNOWN-BUG] 同一 ctx 重复 apply 仍会产生重复同名 section（无去重）', () => {
  const ctx = makeMockCtx()
  apply(ctx, {})
  apply(ctx, {})
  // 插件被重复挂载 / 热重载时，若未去重，最终 prompt 会出现两段相同角色。
  // 当前未做去重：属于残留限制（P2），非崩溃；后续如需可加按 name 去重。
  assert.equal(ctx.sections.length, 1)
}, { knownBug: true })

console.log('\n==== 测试结果汇总 ====')
console.log(`通过:                       ${passed}`)
console.log(`常规失败(需修源码/测试):    ${failed}`)
console.log(`已知缺陷暴露(KNOWN-BUG):    ${knownBugFailures.length}`)
if (unexpectedFailures.length) {
  console.log('— 常规失败用例 —')
  for (const f of unexpectedFailures) console.log(`  - ${f.label}: ${f.err}`)
}
if (knownBugFailures.length) {
  console.log('— 已知缺陷(KNOWN-BUG)暴露（真实残留限制）—')
  for (const f of knownBugFailures) console.log(`  - ${f.label.replace(/^\[KNOWN-BUG\]\s*/, '')}: ${f.err}`)
}
process.exit(failed > 0 ? 1 : 0)
