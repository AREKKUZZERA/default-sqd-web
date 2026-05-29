const URL_PATTERN = /(https?:\/\/|www\.)/gi;
const SUSPICIOUS_WORDS = [
  'casino',
  'казино',
  'ставки',
  'viagra',
  't.me/',
  'telegram',
  'airdrop',
  'crypto pump',
];

export function normalizeModerationText(value = '') {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getClientSpamSignals(value = '') {
  const text = normalizeModerationText(value);
  const urls = text.match(URL_PATTERN) || [];
  const signals = [];

  if (!text) signals.push('empty');
  if (text.length > 0 && text.length < 3) signals.push('too_short');
  if (urls.length >= 2) signals.push('too_many_links');
  if (/(.)\1{9,}/u.test(text)) signals.push('repeated_characters');
  if (SUSPICIOUS_WORDS.some((word) => text.includes(word))) signals.push('suspicious_keyword');

  return signals;
}

export function assertClientContentAllowed(value = '', label = 'Текст') {
  const signals = getClientSpamSignals(value);

  if (signals.includes('empty')) {
    throw new Error(`${label} не может быть пустым.`);
  }

  if (signals.includes('too_many_links')) {
    throw new Error('Слишком много ссылок в одном сообщении. Уберите лишние ссылки и попробуйте снова.');
  }

  if (signals.includes('repeated_characters')) {
    throw new Error('Текст похож на спам из повторяющихся символов. Измените сообщение.');
  }

  return true;
}
