/** Preserva o instante; apenas a apresentação HTTP usa UTC-3 fixo. */
export function brazilTimestamp(date: Date): string {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000)
    .toISOString()
    .replace(/Z$/, '-03:00');
}
export function responseDates(value: unknown, key = ''): unknown {
  if (
    key === 'detail' &&
    typeof value === 'string' &&
    value.startsWith('Resultado: ')
  )
    return value.replace(
      /(último cálculo: )(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))/g,
      (_match, prefix: string, timestamp: string) => {
        const date = new Date(timestamp);
        return Number.isFinite(date.getTime())
          ? prefix + brazilTimestamp(date)
          : prefix + timestamp;
      },
    );
  if (value instanceof Date) return brazilTimestamp(value);
  if (Array.isArray(value)) return value.map((item) => responseDates(item));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([field, item]) => [
        field,
        responseDates(item, field),
      ]),
    );
  if (
    typeof value === 'string' &&
    (/At$/.test(key) ||
      ['timestamp', 'from', 'to', 'previousFrom', 'previousTo'].includes(
        key,
      )) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return brazilTimestamp(date);
  }
  return value;
}
