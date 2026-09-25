/**
 * dsh-senior-developer —— apply() 零依赖测试（v0.4.0 单段核心版）
 *
 * 运行：  node test/apply.test.mjs   （需 Node 18+，支持 ESM 与 node:assert）
 * 依赖：  仅用 Node 内置模块，无需 npm install。
 *
 * 覆盖维度：
 *   正常路径   —— 默认注入 1 段核心 / config.text 整体覆盖 / 自定义 name /
 *               order 数字生效 / order 非数字回退 50
 *   边界&异常  —— complete 严格语义 / order NaN·Infinity / config=null /
 *               缺失 systemPrompt 服务 / API 改名
 *
 * 标 [KNOWN-BUG] 的用例是**当前实现仍存在的真实残留限制**（非崩溃类）：
 *   · 同一 ctx 重复 apply 会产生重复同名 section（热重载/重复挂载场景）。
 * 其余历史 P0 缺陷均已修复，下方对应用例断言「已修复」行为。
 * 退出码：仅当「常规用例」失败时为 1；[KNOWN-BUG] 失败仅作风险提示。
 */
import assert from 'node:assert/strict'
import { apply } from '../index.js'

let passed = 0
let failed = 0
const knownBugFailures = []
const unexpectedFailures = []

function makeMockCtx({ systemPrompt = 'ok' } = {}) {
  const registered = []
  const warns = []
  const errors = []
  let effectName = null
  const ctx = {
    _registered: registered, _warns: warns, _errors: errors,
    get sections() { return registered },
    get warns() { return warns },
    get errors() { return errors },
    get lastEffectName() { return effectName },
    logger: { warn: (m) => warns.push(m), error: (m) => errors.push(m) },
    effect(fn, name) { effectName = name; return fn() },
    systemPrompt:
      systemPrompt === 'ok'
        ? { section(spec) { registered.push(spec); return () => {} } }
        : systemPrompt === 'wrong-api' ? { add() {} } : undefined,
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

console.log('\n=== 正常路径（单段核心） ===')

test('默认注入：1 段', () => {
  const ctx = makeMockCtx()
  apply(ctx, {})
  assert.equal(ctx.sections.length, 1)
})
test('默认段 name = senior-developer:core', () => {
  const ctx = makeMockCtx()
  apply(ctx, {})
  assert.equal(ctx.sections[0].name, 'senior-developer:core')
})
test('默认段 order = 50', () => {
  const ctx = makeMockCtx()
  apply(ctx, {})
  assert.equal(ctx.sections[0].order, 50)
})
test('默认段包含核心标识文本', () => {
  const ctx = makeMockCtx()
  apply(ctx, {})
  assert.ok((ctx.sections[0].text || '').includes('高级全栈开发工程师'))
})
test('默认段不含 complete（不抑制其它段）', () => {
  const ctx = makeMockCtx()
  apply(ctx, {})
  assert.equal(ctx.sections[0].complete, undefined)
})
test('config.text 整体覆盖：单段 persona', () => {
  const ctx = makeMockCtx()
  apply(ctx, { text: '你是后端专家' })
  assert.equal(ctx.sections.length, 1)
  assert.equal(ctx.sections[0].text, '你是后端专家')
  assert.equal(ctx.sections[0].name, 'senior-developer:core')
})
test('自定义 name 生效', () => {
  const ctx = makeMockCtx()
  apply(ctx, { name: 'custom:core' })
  assert.equal(ctx.sections[0].name, 'custom:core')
})
test('order 为数字 0 时生效', () => {
  const ctx = makeMockCtx()
  apply(ctx, { order: 0 })
  assert.equal(ctx.sections[0].order, 0)
})
test('order 非数字（字符串）回退 50', () => {
  const ctx = makeMockCtx()
  apply(ctx, { order: '50' })
  assert.equal(ctx.sections[0].order, 50)
})

console.log('\n=== 边界 / 异常（健壮性探针） ===')

test('[已修复] complete:true 设置 complete', () => {
  const ctx = makeMockCtx()
  apply(ctx, { text: 'x', complete: true })
  assert.equal(ctx.sections[0].complete, true)
})
test('[已修复] complete:false 不设置 complete 且无告警', () => {
  const ctx = makeMockCtx()
  apply(ctx, { text: 'x', complete: false })
  assert.equal(ctx.sections[0].complete, undefined)
  assert.equal(ctx.warns.length, 0)
})
test('[已修复] complete:"false" 不误启用且告警', () => {
  const ctx = makeMockCtx()
  apply(ctx, { complete: 'false' })
  assert.equal(ctx.sections[0].complete, undefined)
  assert.equal(ctx.warns.length, 1)
})
test('[已修复] order:NaN 消毒为 50', () => {
  const ctx = makeMockCtx()
  apply(ctx, { order: NaN })
  assert.equal(ctx.sections[0].order, 50)
})
test('[已修复] order:Infinity 消毒为 50', () => {
  const ctx = makeMockCtx()
  apply(ctx, { order: Infinity })
  assert.equal(ctx.sections[0].order, 50)
})
test('[已修复] config 为 null 不崩溃，注入 1 段', () => {
  const ctx = makeMockCtx()
  assert.doesNotThrow(() => apply(ctx, null))
  assert.equal(ctx.sections.length, 1)
})
test('[已修复] config 非对象（字符串）不崩溃，注入 1 段', () => {
  const ctx = makeMockCtx()
  assert.doesNotThrow(() => apply(ctx, 'oops'))
  assert.equal(ctx.sections.length, 1)
})
test('[已修复] 缺失 systemPrompt 优雅降级（0 段 + 记错误）', () => {
  const ctx = makeMockCtx({ systemPrompt: 'missing' })
  assert.doesNotThrow(() => apply(ctx, {}))
  assert.equal(ctx.sections.length, 0)
  assert.equal(ctx.errors.length, 1)
})
test('[已修复] systemPrompt API 改名优雅降级', () => {
  const ctx = makeMockCtx({ systemPrompt: 'wrong-api' })
  assert.doesNotThrow(() => apply(ctx, {}))
  assert.equal(ctx.sections.length, 0)
  assert.equal(ctx.errors.length, 1)
})

console.log('\n=== 已知限制 ===')
test('[KNOWN-BUG] 同一 ctx 重复 apply 产生重复 section（无去重，非崩溃）', () => {
  const ctx = makeMockCtx()
  apply(ctx, {})
  apply(ctx, {})
  assert.equal(ctx.sections.length, 1) // 理想应去重；当前实现会重复
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
