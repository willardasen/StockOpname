export type CalculationType = 'BOX' | 'SIZE';

const numbers = new Intl.NumberFormat('id-ID');
export const formatQuantity = (value?: number | string) =>
  value === undefined || value === '' || !Number.isSafeInteger(Number(value)) ? '' : numbers.format(Number(value));

export function parseQuantity(text: string): number {
  if (text === '') return 0;
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(text)) return NaN;
  const n = Number(text.replace(/\./g, ''));
  return Number.isSafeInteger(n) ? n : NaN;
}

export function totalQuantity(type: CalculationType, ratio: number, boxes: number, pieces: number) {
  if (!Number.isSafeInteger(pieces) || pieces < 0) return NaN;
  if (type === 'SIZE') return pieces;
  if (!Number.isSafeInteger(boxes) || boxes < 0 || !Number.isSafeInteger(ratio) || ratio < 1) return NaN;
  const n = boxes * ratio + pieces;
  return Number.isSafeInteger(n) ? n : NaN;
}
