import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: any): string {
  const numericAmount = typeof amount === 'object' && amount !== null
    ? parseFloat(amount.toString())
    : typeof amount === 'string'
    ? parseFloat(amount)
    : Number(amount || 0);

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(isNaN(numericAmount) ? 0 : numericAmount);
}

export function formatDateIndonesian(dateInput: Date | string): string {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getStatusBadgeStyle(status: string) {
  switch ((status || '').toUpperCase()) {
    case 'KOSONG':
    case 'LUNAS':
    case 'SELESAI':
    case 'DISETUJUI':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'TERISI':
    case 'PENDING':
    case 'DIPROSES':
    case 'SEBAGIAN':
    case 'BOOKING':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'MAINTENANCE':
    case 'BELUM_BAYAR':
    case 'TERLAMBAT':
    case 'DITOLAK':
    case 'DIBATALKAN':
    case 'BARU':
      return 'bg-rose-100 text-rose-800 border-rose-300';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-300';
  }
}

export function getFileDisplayUrl(keyOrUrl?: string | null): string {
  if (!keyOrUrl) return '';
  const trimmed = keyOrUrl.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('/api/files')
  ) {
    return trimmed; // Legacy full URL fallback or already formatted
  }
  return `/api/files?key=${encodeURIComponent(trimmed)}`;
}

export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return '-';
  const clean = phone.trim();
  const digits = clean.replace(/\D/g, '');
  if (!digits) return clean;

  let local = digits;
  if (local.startsWith('62')) {
    local = local.slice(2);
  } else if (local.startsWith('0')) {
    local = local.slice(1);
  }

  if (local.length >= 9 && local.length <= 13) {
    const p1 = local.slice(0, 3);
    const p2 = local.slice(3, 7);
    const p3 = local.slice(7);
    return `+62 ${p1}-${p2}-${p3}`;
  }

  return clean.startsWith('+') ? clean : `+62 ${local}`;
}

export function maskKTP(ktp?: string | null): string {
  if (!ktp) return '-';
  const clean = ktp.trim();
  if (clean.length < 8) return clean;
  const first4 = clean.slice(0, 4);
  const last4 = clean.slice(-4);
  return `${first4}********${last4}`;
}

export function formatDateShortIndonesian(dateInput: Date | string): string {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateRange(startInput: Date | string, endInput: Date | string): string {
  if (!startInput || !endInput) return '-';
  return `${formatDateShortIndonesian(startInput)} – ${formatDateShortIndonesian(endInput)}`;
}

export { tambahBulan } from './date-utils';

