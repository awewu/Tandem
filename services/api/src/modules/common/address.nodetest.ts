import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAddress, sameAddress } from './address';

// 地址规范化（Project 业务唯一键组成）· 纯函数单测。
// 见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md §6。

test('normalizeAddress: null/undefined/blank → 空串', () => {
  assert.equal(normalizeAddress(null), '');
  assert.equal(normalizeAddress(undefined), '');
  assert.equal(normalizeAddress('   '), '');
});

test('normalizeAddress: 折叠空白并去分隔符', () => {
  assert.equal(
    normalizeAddress('上海市 浦东新区  世纪大道 100 号'),
    normalizeAddress('上海市浦东新区世纪大道100号'),
  );
});

test('normalizeAddress: 全角折半角', () => {
  assert.equal(normalizeAddress('世纪大道１００号'), normalizeAddress('世纪大道100号'));
});

test('normalizeAddress: 繁简高频字归一（號→号, 樓→楼）', () => {
  assert.equal(normalizeAddress('中山路1號3樓'), normalizeAddress('中山路1号3楼'));
});

test('normalizeAddress: 忽略标点差异（#、-、逗号、句点）', () => {
  assert.equal(normalizeAddress('A栋-2单元#301'), normalizeAddress('A栋2单元301'));
  assert.equal(normalizeAddress('世纪大道100号，B座'), normalizeAddress('世纪大道100号B座'));
});

test('normalizeAddress: 拉丁段大小写不敏感', () => {
  assert.equal(normalizeAddress('Building A, Room 301'), normalizeAddress('building a room301'));
});

test('sameAddress: 不同书写的同一地址视为相等', () => {
  assert.equal(sameAddress('世纪大道１００號', '世纪大道100号'), true);
  assert.equal(sameAddress('中山路 1 号  3 楼', '中山路1号3樓'), true);
});

test('sameAddress: 不同地址不相等', () => {
  assert.equal(sameAddress('世纪大道100号', '世纪大道101号'), false);
});

test('sameAddress: 空地址永不相等（避免缺失地址被塌缩）', () => {
  assert.equal(sameAddress('', ''), false);
  assert.equal(sameAddress(null, undefined), false);
});
