import assert from 'node:assert/strict'
import { test } from 'node:test'

import { dictionaries } from '../src/locales'

test('English copy describes an allowlist flag without claiming KYC or a market', () => {
  assert.equal(
    dictionaries.en.whitelisted,
    'On-chain allowlist flag: allowed (demo; no KYC performed)',
  )
  assert.equal(
    dictionaries.en.transferTitle,
    'Direct transfer between allowlisted wallets',
  )
  assert.doesNotMatch(dictionaries.en.transferTitle, /OTC|secondary market/i)
  assert.match(dictionaries.en.riskNotice, /performs no identity, KYC, AML/i)
})

test('Chinese copy preserves the same honest product boundary', () => {
  assert.equal(
    dictionaries.zh.whitelisted,
    '链上允许标记：已允许（演示；未执行真实 KYC）',
  )
  assert.equal(dictionaries.zh.transferTitle, '链上允许名单钱包间直接转账')
  assert.doesNotMatch(dictionaries.zh.transferTitle, /OTC|二级市场/i)
  assert.match(dictionaries.zh.riskNotice, /没有执行身份核验、KYC、AML/)
})
