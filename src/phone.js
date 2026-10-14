export function normalizePhone(input) {
  let digits = String(input || '').replace(/\D/g, '');

  if (digits.startsWith('00')) digits = digits.slice(2);

  // Checkouts brasileiros às vezes entregam somente DDD + número.
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;

  if (digits.length < 10 || digits.length > 15 || digits.startsWith('0')) {
    throw new Error('Telefone inválido');
  }

  return digits;
}

export function firstName(fullName) {
  const name = String(fullName || '').trim().split(/\s+/)[0] || 'Aluno';
  return name.slice(0, 60);
}
