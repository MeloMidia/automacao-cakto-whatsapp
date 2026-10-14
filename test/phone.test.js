import assert from 'node:assert/strict';
import test from 'node:test';
import { firstName, normalizePhone } from '../src/phone.js';

test('normaliza celular brasileiro', () => {
  assert.equal(normalizePhone('(11) 99999-9999'), '5511999999999');
  assert.equal(normalizePhone('+55 11 99999-9999'), '5511999999999');
});

test('rejeita telefone impossível', () => {
  assert.throws(() => normalizePhone('123'), /Telefone inválido/);
});

test('extrai primeiro nome', () => {
  assert.equal(firstName('  Maria da Silva '), 'Maria');
  assert.equal(firstName(''), 'Aluno');
});
