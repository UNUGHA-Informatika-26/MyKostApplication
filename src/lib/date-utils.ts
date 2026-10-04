/**
 * Pure date calculation utilities for lease and contract management.
 */

/**
 * Safely adds n calendar months to a given date, handling end-of-month clamping and leap years.
 * E.g.:
 * - 31 Jan 2024 (leap year) + 1 month => 29 Feb 2024
 * - 31 Jan 2025 (non-leap) + 1 month => 28 Feb 2025
 * - 29 Feb 2024 + 12 months => 28 Feb 2025
 * - 31 Aug 2026 + 1 month => 30 Sep 2026
 * - 30 Nov 2026 + 3 months => 28 Feb 2027
 *
 * Preserves time components (hours, minutes, seconds, milliseconds).
 */
export function tambahBulan(dateInput: Date | string, n: number): Date {
  if (typeof n !== 'number' || isNaN(n) || !Number.isInteger(n)) {
    throw new Error('Durasi bulan harus berupa bilangan bulat');
  }

  let d: Date;
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // If YYYY-MM-DD format without time, interpret as UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      d = new Date(`${trimmed}T00:00:00.000Z`);
    } else {
      d = new Date(trimmed);
    }
  } else if (dateInput instanceof Date) {
    d = new Date(dateInput.getTime());
  } else {
    throw new Error('Tanggal tidak valid');
  }

  if (isNaN(d.getTime())) {
    throw new Error('Tanggal tidak valid');
  }

  // If created via local midnight constructor (hours=0, minutes=0, but UTC hours != 0), perform local date math
  const isLocalMidnight =
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0 &&
    d.getUTCHours() !== 0;

  if (isLocalMidnight) {
    const targetYear = d.getFullYear() + Math.floor((d.getMonth() + n) / 12);
    const targetMonth = ((d.getMonth() + n) % 12 + 12) % 12;
    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const targetDay = Math.min(d.getDate(), daysInTargetMonth);
    return new Date(targetYear, targetMonth, targetDay, 0, 0, 0, 0);
  }

  // Otherwise perform UTC date math (standard for database ISO strings & Prisma Date instances)
  const originalYear = d.getUTCFullYear();
  const originalMonth = d.getUTCMonth();
  const originalDay = d.getUTCDate();

  const targetYear = originalYear + Math.floor((originalMonth + n) / 12);
  const targetMonth = ((originalMonth + n) % 12 + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(originalDay, daysInTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds()
    )
  );
}
