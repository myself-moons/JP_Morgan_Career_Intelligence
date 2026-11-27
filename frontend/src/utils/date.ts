/** Formats YYYY-MM-DD or ISO timestamp strings to DD/MM/YYYY. */
export function formatDateDDMMYYYY(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  const isoPrefix = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefix) {
    const [, year, month, day] = isoPrefix;
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}
