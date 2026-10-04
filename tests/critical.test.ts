import { describe, it, expect } from 'vitest';
import { normalizePhone } from '@/lib/phone';
import { hitungDenda } from '@/lib/denda';
import { hashToken } from '@/lib/token';
import { detectImageFromBytes } from '@/lib/r2';
import { canAccessFile } from '@/lib/file-auth';
import { checkPerpanjanganEligibility } from '@/lib/perpanjangan';
import { tambahBulan } from '@/lib/date-utils';

describe('1. Normalisasi Nomor Handphone (normalizePhone)', () => {
  it('harus mempertahankan format standar 08xxxxxxxxxx', () => {
    expect(normalizePhone('081234567890')).toBe('081234567890');
  });

  it('harus mengonversi awalan 62 menjadi 08', () => {
    expect(normalizePhone('6281234567890')).toBe('081234567890');
  });

  it('harus membersihkan karakter spasi, tanda tambah, dan tanda hubung (+62 812-3456-7890)', () => {
    expect(normalizePhone('+62 812-3456-7890')).toBe('081234567890');
  });

  it('harus menambahkan awalan 0 jika nomor diawali dengan angka 8', () => {
    expect(normalizePhone('81234567890')).toBe('081234567890');
  });

  it('harus mengembalikan string kosong jika input kosong', () => {
    expect(normalizePhone('')).toBe('');
  });
});

describe('2. Kalkulasi Denda Keterlambatan (hitungDenda)', () => {
  it('mode HARIAN: harus mengalikan tarif denda dengan jumlah hari terlambat', () => {
    const denda3Hari = hitungDenda('HARIAN', 50000, 3);
    expect(denda3Hari).toBe(150000);

    const denda5Hari = hitungDenda('HARIAN', 25000, 5);
    expect(denda5Hari).toBe(125000);
  });

  it('mode HARIAN: tidak boleh membebankan denda jika hari terlambat <= 0', () => {
    expect(hitungDenda('HARIAN', 50000, 0)).toBe(0);
    expect(hitungDenda('HARIAN', 50000, -2)).toBe(0);
  });

  it('mode TETAP: harus mengenakan tarif flat satu kali terlepas dari jumlah hari terlambat', () => {
    expect(hitungDenda('TETAP', 50000, 1)).toBe(50000);
    expect(hitungDenda('TETAP', 50000, 10)).toBe(50000);
    expect(hitungDenda('TETAP', 100000, 30)).toBe(100000);
  });

  it('mode TETAP: tidak boleh membebankan denda jika hari terlambat <= 0', () => {
    expect(hitungDenda('TETAP', 50000, 0)).toBe(0);
    expect(hitungDenda('TETAP', 50000, -1)).toBe(0);
  });
});

describe('3. Token Aktivasi & Reset (hashToken)', () => {
  it('harus menghasilkan hash SHA-256 sepanjang 64 karakter heksadesimal', () => {
    const rawToken = '4f8a3c2e1b9d7e5f0a2c4e6b8d0f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f';
    const hashed = hashToken(rawToken);
    expect(hashed).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hashed)).toBe(true);
  });

  it('harus bersifat deterministik (input yang sama menghasilkan hash yang identik)', () => {
    const token = 'sample-secret-token-12345';
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('harus menghasilkan hash yang berbeda untuk token yang berbeda', () => {
    expect(hashToken('token-alpha')).not.toBe(hashToken('token-beta'));
  });
});

describe('4. Deteksi Magic Bytes Gambar (detectImageFromBytes)', () => {
  it('harus mengenali berkas JPEG asli (FF D8 FF)', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const detected = detectImageFromBytes(jpegBuffer);
    expect(detected).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
  });

  it('harus mengenali berkas PNG asli (89 50 4E 47 0D 0A 1A 0A)', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const detected = detectImageFromBytes(pngBuffer);
    expect(detected).toEqual({ ext: 'png', mime: 'image/png' });
  });

  it('harus mengenali berkas WebP asli (RIFF....WEBP)', () => {
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // 'RIFF'
      0x00, 0x00, 0x00, 0x00, // file size placeholder
      0x57, 0x45, 0x42, 0x50, // 'WEBP'
    ]);
    const detected = detectImageFromBytes(webpBuffer);
    expect(detected).toEqual({ ext: 'webp', mime: 'image/webp' });
  });

  it('harus menolak berkas teks atau palsu (mengembalikan null)', () => {
    const textBuffer = Buffer.from('Ini adalah berkas teks, bukan gambar asli.');
    expect(detectImageFromBytes(textBuffer)).toBeNull();

    const pdfBuffer = Buffer.from('%PDF-1.4 ...');
    expect(detectImageFromBytes(pdfBuffer)).toBeNull();

    const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
    expect(detectImageFromBytes(exeBuffer)).toBeNull();
  });
});

describe('5. Otorisasi Akses Berkas (canAccessFile)', () => {
  const tenantId = 'tenant-123';
  const otherTenantId = 'tenant-456';
  const ownAvatarKey = 'avatar-tenant-123.jpg';
  const otherAvatarKey = 'avatar-tenant-456.jpg';
  const ownPaymentKey = 'payment-123.jpg';
  const otherPaymentKey = 'payment-456.jpg';
  const roomPhotoKey = 'kamar-101.jpg';

  it('OWNER dan ADMIN harus dapat mengakses semua berkas (termasuk avatar siapapun)', () => {
    expect(canAccessFile('OWNER', 'owner-1', otherAvatarKey, {})).toBe(true);
    expect(canAccessFile('ADMIN', 'admin-1', otherAvatarKey, {})).toBe(true);
    expect(canAccessFile('OWNER', 'owner-1', otherPaymentKey, {})).toBe(true);
  });

  it('PENGHUNI harus diizinkan mengakses foto avatar miliknya sendiri', () => {
    const isAllowed = canAccessFile('PENGHUNI', tenantId, ownAvatarKey, {
      userFotoUrl: ownAvatarKey,
    });
    expect(isAllowed).toBe(true);
  });

  it('PENGHUNI harus DITOLAK (403) saat mencoba mengakses foto avatar penghuni lain', () => {
    const isAllowed = canAccessFile('PENGHUNI', tenantId, otherAvatarKey, {
      userFotoUrl: ownAvatarKey, // avatar milik tenant ini berbeda dari key yang diminta
    });
    expect(isAllowed).toBe(false);
  });

  it('PENGHUNI harus diizinkan mengakses bukti bayar miliknya sendiri', () => {
    const isAllowed = canAccessFile('PENGHUNI', tenantId, ownPaymentKey, {
      paymentUserIds: [tenantId],
    });
    expect(isAllowed).toBe(true);
  });

  it('PENGHUNI harus DITOLAK saat mengakses bukti bayar penghuni lain', () => {
    const isAllowed = canAccessFile('PENGHUNI', tenantId, otherPaymentKey, {
      paymentUserIds: [otherTenantId],
    });
    expect(isAllowed).toBe(false);
  });

  it('PENGHUNI harus diizinkan melihat foto kamar umum', () => {
    const isAllowed = canAccessFile('PENGHUNI', tenantId, roomPhotoKey, {
      isRoomPhoto: true,
    });
    expect(isAllowed).toBe(true);
  });
});

describe('6. Aturan Rate Limit & Duplikat Perpanjangan Sewa (checkPerpanjanganEligibility)', () => {
  const now = new Date('2026-10-03T12:00:00.000Z');

  it('harus MENGIZINKAN (allowed: true) jika belum pernah ada pengajuan sebelumnya', () => {
    const res = checkPerpanjanganEligibility([], now);
    expect(res.allowed).toBe(true);
  });

  it('harus MENOLAK dengan 409 (PENDING_EXIST) jika sudah ada pengajuan berstatus PENDING', () => {
    const res = checkPerpanjanganEligibility(
      [
        {
          status: 'PENDING',
          created_at: new Date('2026-10-01T10:00:00.000Z'),
        },
      ],
      now
    );
    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(409);
    expect(res.reason).toBe('PENDING_EXIST');
  });

  it('harus MENOLAK dengan 429 (RATE_LIMITED) jika pengajuan terakhir dibuat kurang dari 7 hari lalu (< 7 hari)', () => {
    // 3 days ago, previously rejected or finished
    const threeDaysAgo = new Date('2026-09-30T12:00:00.000Z');
    const res = checkPerpanjanganEligibility(
      [
        {
          status: 'DITOLAK',
          created_at: threeDaysAgo,
        },
      ],
      now
    );
    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.reason).toBe('RATE_LIMITED');
  });

  it('harus MENGIZINKAN (allowed: true) jika pengajuan terakhir sudah lewat dari 7 hari (> 7 hari)', () => {
    // 8 days ago
    const eightDaysAgo = new Date('2026-09-25T12:00:00.000Z');
    const res = checkPerpanjanganEligibility(
      [
        {
          status: 'DISETUJUI',
          created_at: eightDaysAgo,
        },
      ],
      now
    );
    expect(res.allowed).toBe(true);
  });
});

describe('7. Penambahan Bulan Kalender Aman (tambahBulan)', () => {
  it('harus menambahkan bulan normal dengan tanggal yang sama (15 Jan -> 15 Apr)', () => {
    const awal = new Date('2026-01-15T00:00:00.000Z');
    const hasil = tambahBulan(awal, 3);
    expect(hasil.toISOString()).toBe('2026-04-15T00:00:00.000Z');
  });

  it('akhir bulan pada tahun kabisat (leap year): 31 Jan 2024 + 1 bulan harus menjadi 29 Feb 2024', () => {
    const awal = new Date('2024-01-31T00:00:00.000Z');
    const hasil = tambahBulan(awal, 1);
    expect(hasil.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(hasil.getUTCDate()).toBe(29);
    expect(hasil.getUTCMonth()).toBe(1); // Februari
  });

  it('akhir bulan pada tahun non-kabisat: 31 Jan 2025 + 1 bulan harus menjadi 28 Feb 2025', () => {
    const awal = new Date('2025-01-31T00:00:00.000Z');
    const hasil = tambahBulan(awal, 1);
    expect(hasil.toISOString()).toBe('2025-02-28T00:00:00.000Z');
    expect(hasil.getUTCDate()).toBe(28);
    expect(hasil.getUTCMonth()).toBe(1); // Februari
  });

  it('hari kabisat ke tahun non-kabisat: 29 Feb 2024 + 12 bulan harus menjadi 28 Feb 2025', () => {
    const awal = new Date('2024-02-29T00:00:00.000Z');
    const hasil = tambahBulan(awal, 12);
    expect(hasil.toISOString()).toBe('2025-02-28T00:00:00.000Z');
    expect(hasil.getUTCDate()).toBe(28);
    expect(hasil.getUTCMonth()).toBe(1);
    expect(hasil.getUTCFullYear()).toBe(2025);
  });

  it('penyesuaian dari bulan 31 hari ke bulan 30 hari (31 Agu -> 30 Sep, 31 Mei -> 30 Jun)', () => {
    const agu = new Date('2026-08-31T00:00:00.000Z');
    const sep = tambahBulan(agu, 1);
    expect(sep.toISOString()).toBe('2026-09-30T00:00:00.000Z');

    const mei = new Date('2026-05-31T00:00:00.000Z');
    const jun = tambahBulan(mei, 1);
    expect(jun.toISOString()).toBe('2026-06-30T00:00:00.000Z');
  });

  it('melewati pergantian tahun dengan benar (30 Nov 2026 + 3 bulan -> 28 Feb 2027)', () => {
    const awal = new Date('2026-11-30T00:00:00.000Z');
    const hasil = tambahBulan(awal, 3);
    expect(hasil.toISOString()).toBe('2027-02-28T00:00:00.000Z');
    expect(hasil.getUTCFullYear()).toBe(2027);
  });

  it('mendukung durasi maksimal 24 bulan (1 Jan 2026 + 24 bulan -> 1 Jan 2028)', () => {
    const awal = new Date('2026-01-01T00:00:00.000Z');
    const hasil = tambahBulan(awal, 24);
    expect(hasil.toISOString()).toBe('2028-01-01T00:00:00.000Z');
    expect(hasil.getUTCFullYear()).toBe(2028);
  });

  it('mempertahankan komponen jam, menit, dan detik', () => {
    const awal = new Date('2026-01-31T15:45:30.500Z');
    const hasil = tambahBulan(awal, 1);
    expect(hasil.toISOString()).toBe('2026-02-28T15:45:30.500Z');
  });

  it('menerima input string format tanggal YYYY-MM-DD', () => {
    const hasil = tambahBulan('2024-01-31', 1);
    expect(hasil.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });

  it('harus menolak input durasi atau tanggal yang tidak valid', () => {
    expect(() => tambahBulan('bukan-tanggal', 1)).toThrow('Tanggal tidak valid');
    expect(() => tambahBulan(new Date(), NaN)).toThrow('Durasi bulan harus berupa bilangan bulat');
    expect(() => tambahBulan(new Date(), 1.5 as any)).toThrow('Durasi bulan harus berupa bilangan bulat');
  });
});
