/** Национальный номер РФ без +7: 10 цифр, обычно с 9 */

/**
 * Из произвольной строки — только цифры национальной части (макс. 10).
 * Ведущая 7/8 (код страны) отбрасывается; 8 нормализуется в 7.
 * @param {string} s
 */
export function parseRuPhoneDigits(s) {
  let d = String(s ?? '').replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (d.startsWith('7')) d = d.slice(1);
  return d.slice(0, 10);
}

/**
 * Число национальных цифр слева от позиции курсора (без учёта +7 в шаблоне).
 * @param {string} value
 * @param {number} caretPos
 */
export function nationalDigitsLeftOfCaret(value, caretPos) {
  const before = String(value ?? '').slice(0, Math.max(0, caretPos));
  let d = before.replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (d.startsWith('7')) d = d.slice(1);
  return Math.min(d.length, 10);
}

/**
 * Пропуск «) », «-» сразу после n-й национальной цифры — чтобы курсор не залипал перед разделителем.
 * @param {string} formatted
 * @param {number} pos
 */
function skipPhoneDelimitersAfter(formatted, pos) {
  let p = pos;
  while (p < formatted.length) {
    const c = formatted[p];
    if (c === ')') {
      p += 1;
      while (p < formatted.length && formatted[p] === ' ') p += 1;
      continue;
    }
    if (c === '-') {
      p += 1;
      continue;
    }
    break;
  }
  return Math.min(p, formatted.length);
}

/**
 * Индекс курсора после n-й национальной цифры (n от 0 до 10).
 * Учитывает только цифры внутри «(...) ...-..-..», не семёрку из «+7».
 * @param {string} formatted
 * @param {number} nationalCount
 */
export function ruPhoneCaretIndex(formatted, nationalCount) {
  const n = Math.max(0, Math.min(10, nationalCount | 0));
  const open = formatted.indexOf('(');

  if (open === -1) {
    return formatted.length;
  }
  if (n === 0) {
    return open + 1;
  }

  let seen = 0;
  let pos = formatted.length;
  for (let i = open + 1; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen === n) {
        pos = i + 1;
        break;
      }
    }
  }

  if (seen < n) {
    return formatted.length;
  }

  return skipPhoneDelimitersAfter(formatted, pos);
}

/**
 * Видимое значение поля: +7 и введённые цифры с разделителями, без «звёздочек».
 * @param {string} national10 0–10 цифр
 */
export function formatRu7Progressive(national10) {
  const d = String(national10 ?? '').replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '+7 ';
  let p = '+7 (';
  p += d.slice(0, 3);
  if (d.length < 3) return p;
  p += ') ';
  if (d.length === 3) return p;
  p += d.slice(3, 6);
  if (d.length <= 6) return p;
  p += '-';
  p += d.slice(6, 8);
  if (d.length <= 8) return p;
  p += '-';
  p += d.slice(8, 10);
  return p;
}

/**
 * @deprecated Используйте formatRu7Progressive — маска со «*» ломала ввод.
 * @param {string} national10
 */
export function formatRu7Mask(national10) {
  return formatRu7Progressive(national10);
}
