/**
 * dsh-senior-developer —— apply() 零依赖测试（v0.3.0 多模块版）
 *
 * 运行：  node test/apply.test.mjs   （需 Node 18+，支持 ESM 与 node:assert）
 * 依赖：  仅用 Node 内置模块（node:assert/strict），无需 npm install。
 *
 * 覆盖维度：
 *   正常路径   —— 默认注入 5 段 / config.text 整体覆盖 / 自定义 name（作用于 core）/
 *               order 数字生效 / order 非数字回退 50
 *   模块开关   —— reviewer 关闭 / devops+pm 关闭 / 全部可选关闭（仅 core）/
 *               modules 非对象时全开且不崩溃
 *   边界&异常  —— complete 字符串真值语义 / config.text 类型健壮性（对象→走多模块）/
 *               order NaN·Infinity / config=null / 缺失 systemPrompt 服务 /
 *               API 改名 / 重复注入 / 全部可选关闭仍保留 core
 *
 * 标 [KNOWN-BUG] 的用例是**当前实现仍存在的真实残留限制**（非崩溃类）：
 *   · 同一 ctx 重复 apply 会产生重复同名 section（热重载/重复挂载场景）。
 * 其余历史 P0 缺陷均已修复，下方对应用例断言「已修复」行为。
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
 *   ctx.effect(fn, name)        —— 按 Cordis 语义执行回调
 *   ctx.systemPrompt.section(s) —— 记录注册的 section
 *   ctx.logger?.warn/error      —— 可选，记录告警/错误
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
      return fn()
    },
    systemPrompt:
      systemPrompt === 'ok'
        ? {
            section(spec) {
              registered.push(spec)
              return () => {}
            },
          }
        : systemPrompt === 'wrong-api'
          ? { add() {} }
          : undefined,
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

const ALL_NAMES = [
  'senior-developer:core', 'senior-developer:reviewer',
  'senior-developer:docs', 'senior-developer:devops', 'senior-developer:pm',
]
function assertHasAll(names, ctx) {
  for (const n of names) {
    assert.ok(ctx.sections.some((s) => s.name === n), `缺少段 ${n}`)
  }
}

console.log('\n=== 正常路径（多模块） ===')

test('默认注入：5 段（core + 4 可选全开）', () => {
  const ctx = makeMockCtx()
  apply(ctx, {})
  assert.equal(ctx.sections.length, 5)
  assertHasAll(ALL_NAMES, ctx)
})

test('默认各段 order 递增且 core=50', () => {
  const ctx = makeMockCtx()
  apply(ctx, {})
  const byName = Object.fromEntries(ctx.sections.map((s) => [s.name, s.order]))
  assert.equal(byName['senior-developer:core'], 50)
  assert.equal(byName['senior-developer:reviewer'], 60)
  assert.equal(byName['senior-developer:docs'], 61)
  assert.equal(byName['senior-developer:devops'], 62)
  assert.equal(byName['senior-developer:pm'], 63)
})

test('config.text 整体覆盖：单段 persona（向后兼容）', () => {
  const ctx = makeMockCtx()
  apply(ctx, { text: '你是产品经理，负责需求与验收。' })
  assert.equal(ctx.sections.length, 1)
  assert.equal(ctx.sections[0].text, '你是产品经理，负责需求与验收。')
  assert.equal(ctx.sections[0].name, 'senior-developer:persona')
})

test('自定义 name 作用于 core 段（多模块模式）', () => {
  const ctx = makeMockCtx()
  apply(ctx, { name: 'custom:core' })
  const core = ctx.sections.find((s) => s.name === 'custom:core')
  assert.ok(core, 'core 段未应用自定义 name')
  // 其它可选模块 name 保持不变
  assert.ok(ctx.sections.some((s) => s.name === 'senior-developer:reviewer'))
})

test('order 为数字时 core 原值生效（含 0）', () => {
  const ctx = makeMockCtx()
  apply(ctx, { order: 0 })
  const core = ctx.sections.find((s) => s.name === 'senior-developer:core')
  assert.equal(core.order, 0)
})

test('order 非数字（字符串 "50"）回退 50', () => {
  const ctx = makeMockCtx()
  apply(ctx, { order: '50' })
  const core = ctx.sections.find((s) => s.name === 'senior-developer:core')
  assert.equal(core.order, 50)
})

console.log('\n=== 模块开关 ===')

test('modules.reviewer=false：4 段，不含 reviewer', () => {
  const ctx = makeMockCtx()
  apply(ctx, { modules: { reviewer: false } })
  assert.equal(ctx.sections.length, 4)
  assert.ok(!ctx.sections.some((s) => s.name === 'senior-developer:reviewer'))
  assertHasAll(['senior-developer:core', 'senior-developer:docs',
    'senior-developer:devops', 'senior-developer:pm'], ctx)
})

test('modules.devops=false, pm=false：3 段', () => {
  const ctx = makeMockCtx()
  apply(ctx, { modules: { devops: false, pm: false } })
  assert.equal(ctx.sections.length, 3)
  assert.ok(!ctx.sections.some((s) => s.name === 'senior-developer:devops'))
  assert.ok(!ctx.sections.some((s) => s.name === 'senior-developer:pm'))
})

test('全部可选模块关闭：仍 1 段（core 不可关闭）', () => {
  const ctx = makeMockCtx()
  apply(ctx, { modules: { reviewer: false, docs: false, devops: false, pm: false } })
  assert.equal(ctx.sections.length, 1)
  assert.equal(ctx.sections[0].name, 'senior-developer:core')
})

test('modules 非对象（如字符串）时全开且不崩溃', () => {
  const ctx = makeMockCtx()
  assert.doesNotThrow(() => apply(ctx, { modules: 'all' }))
  assert.equal(ctx.sections.length, 5)
})

console.log('\n=== 边界 / 异常（健壮性探针） ===')

test('[已修复] complete:true（text 模式）设置 complete=true', () => {
  const ctx = makeMockCtx()
  apply(ctx, { text: '自定义角色', complete: true })
  assert.equal(ctx.sections[0].complete, true)
})

test('[已修复] complete:false（text 模式）不设置 complete 且无告警', () => {
  const ctx = makeMockCtx()
  apply(ctx, { text: '自定义角色', complete: false })
  assert.equal(ctx.sections[0].complete, undefined)
  assert.equal(ctx.warns.length, 0)
})

test('[已修复] complete:"false" 字符串不再误启用抑制性 complete', () => {
  const ctx = makeMockCtx()
  apply(ctx, { text: '自定义角色', complete: 'false' })
  assert.equal(ctx.sections[0].complete, undefined)
  assert.equal(ctx.warns.length, 1)
})

test('[已修复] config.text 为对象时不崩溃，走多模块 5 段', () => {
  const ctx = makeMockCtx()
  assert.doesNotThrow(() => apply(ctx, { text: {} }))
  assert.equal(ctx.sections.length, 5)
})

test('[已修复] config.text 为数组时不崩溃，走多模块 5 段', () => {
  const ctx = makeMockCtx()
  assert.doesNotThrow(() => apply(ctx, { text: [] }))
  assert.equal(ctx.sections.length, 5)
})

test('[已修复] order:NaN 被消毒为 50', () => {
  const ctx = makeMockCtx()
  apply(ctx, { order: NaN })
  const core = ctx.sections.find((s) => s.name === 'senior-developer:core')
  assert.equal(core.order, 50)
})

test('[已修复] order:Infinity 被消毒为有限值（回退 50）', () => {
  const ctx = makeMockCtx()
  apply(ctx, { order: Infinity })
  const core = ctx.sections.find((s) => s.name === 'senior-developer:core')
  assert.equal(Number.isFinite(core.order), true)
  assert.equal(core.order, 50)
})

test('[已修复] config 为 null 时不再崩溃（兜底空对象，注入 5 段）', () => {
  const ctx = makeMockCtx()
  assert.doesNotThrow(() => apply(ctx, null))
  assert.equal(ctx.sections.length, 5)
})

test('[已修复] 缺失 systemPrompt 服务时优雅降级（不崩溃、不注入、记错误）', () => {
  const ctx = makeMockCtx({ systemPrompt: 'missing' })
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
  assert.equal(ctx.sections.length, 5)
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
