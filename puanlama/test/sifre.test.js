import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sifreKuraliniDenetle, sifreDegisiminiDenetle } from '../src/lib/sifre.js'

test('kurala uyan şifreler: en az 6 karakter, harf + rakam', () => {
  for (const s of ['abc123', 'Deneme1', 'a1b2c3d4', '123abc', 'ogretmen7', 'Çağrı2026', 'ığüşöç1', 'ŞİFRE9']) {
    assert.deepEqual(sifreKuraliniDenetle(s), [], s)
  }
})

test('6 karakterden kısa şifre reddedilir; tam 6 karakter kabul edilir', () => {
  assert.match(sifreKuraliniDenetle('ab12')[0], /en az 6 karakter/)
  assert.match(sifreKuraliniDenetle('abc12')[0], /en az 6 karakter/)
  assert.deepEqual(sifreKuraliniDenetle('abc123'), [])
})

test('uzunluk karakter olarak sayılır (Türkçe harf 1 karakterdir)', () => {
  assert.deepEqual(sifreKuraliniDenetle('çğı12ö'), []) // 6 karakter (10 bayt)
})

test('harf yoksa ya da rakam yoksa reddedilir', () => {
  assert.deepEqual(sifreKuraliniDenetle('123456'), ['Şifre en az bir harf içermeli.'])
  assert.deepEqual(sifreKuraliniDenetle('abcdef'), ['Şifre en az bir rakam içermeli.'])
  assert.deepEqual(sifreKuraliniDenetle('!!!!!!'), ['Şifre en az bir harf içermeli.', 'Şifre en az bir rakam içermeli.'])
})

test('başında ya da sonunda boşluk olan şifre reddedilir', () => {
  assert.match(sifreKuraliniDenetle(' abc123')[0], /boşluk/)
  assert.match(sifreKuraliniDenetle('abc123 ')[0], /boşluk/)
  assert.deepEqual(sifreKuraliniDenetle('abc 123'), []) // ortada boşluk serbest
})

test('çok uzun şifre (72 bayttan fazla) reddedilir', () => {
  assert.deepEqual(sifreKuraliniDenetle('a1' + 'x'.repeat(70)), []) // 72 bayt
  assert.deepEqual(sifreKuraliniDenetle('a1' + 'x'.repeat(71)), ['Şifre çok uzun.'])
  assert.deepEqual(sifreKuraliniDenetle('a1' + 'ç'.repeat(36)), ['Şifre çok uzun.']) // 74 bayt
})

test('boş ya da tanımsız şifre tüm kuralları ihlal eder', () => {
  assert.equal(sifreKuraliniDenetle('').length, 3)
  assert.equal(sifreKuraliniDenetle(undefined).length, 3)
})

test('değişim formu: geçerli girdi hata vermez', () => {
  assert.deepEqual(sifreDegisiminiDenetle({ mevcut: 'eski123', yeni: 'yeni456', tekrar: 'yeni456' }), [])
})

test('değişim formu: mevcut şifre boş, tekrar farklı, yeni = mevcut', () => {
  assert.deepEqual(sifreDegisiminiDenetle({ mevcut: '', yeni: 'yeni456', tekrar: 'yeni456' }), ['Mevcut şifreni yaz.'])
  assert.deepEqual(sifreDegisiminiDenetle({ mevcut: 'eski123', yeni: 'yeni456', tekrar: 'yeni457' }), [
    'Yeni şifre ile tekrarı aynı değil.',
  ])
  assert.deepEqual(sifreDegisiminiDenetle({ mevcut: 'eski123', yeni: 'eski123', tekrar: 'eski123' }), [
    'Yeni şifre mevcut şifreden farklı olmalı.',
  ])
})

test('değişim formu: kurala uymayan yeni şifrenin tüm mesajları birlikte gelir', () => {
  const h = sifreDegisiminiDenetle({ mevcut: 'eski123', yeni: 'ab', tekrar: 'ab' })
  assert.equal(h.length, 2) // kısa + rakam yok (harf var)
  assert.match(h[0], /en az 6/)
  assert.match(h[1], /rakam/)
})
