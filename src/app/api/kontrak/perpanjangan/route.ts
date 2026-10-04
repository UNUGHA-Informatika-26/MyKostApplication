import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthApi, requireRoleApi } from '@/lib/rbac';
import { Prisma, Role, StatusPengajuanPerpanjangan } from '@prisma/client';
import { logAktivitas } from '@/lib/log';
import { handleApiError } from '@/lib/errors';
import { checkPerpanjanganEligibility, PerpanjanganError } from '@/lib/perpanjangan';

export async function GET() {
  try {
    const session = await requireAuthApi();

    if (session.role === Role.PENGHUNI) {
      // Find active contract for this tenant
      const penghuni = await prisma.penghuni.findUnique({
        where: { user_id: session.id },
        include: {
          kontrak: {
            where: { status: 'AKTIF' },
            take: 1,
          },
        },
      });

      const activeKontrak = penghuni?.kontrak[0];
      if (!activeKontrak) {
        return NextResponse.json({ pengajuan: null });
      }

      const latestPengajuan = await prisma.pengajuanPerpanjangan.findFirst({
        where: { kontrak_id: activeKontrak.id },
        orderBy: { created_at: 'desc' },
      });

      return NextResponse.json({ pengajuan: latestPengajuan });
    }

    // OWNER / ADMIN: list pending extension submissions
    await requireRoleApi([Role.OWNER, Role.ADMIN]);
    const pengajuanList = await prisma.pengajuanPerpanjangan.findMany({
      where: { status: StatusPengajuanPerpanjangan.PENDING },
      include: {
        penghuni: { select: { id: true, nama: true, no_hp: true } },
        kontrak: {
          include: {
            kamar: { select: { id: true, nomor_kamar: true, tipe: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(pengajuanList);
  } catch (error: any) {
    return handleApiError(error, 'Gagal mengambil data pengajuan perpanjangan');
  }
}

export async function POST() {
  try {
    const session = await requireRoleApi([Role.PENGHUNI]);

    // Check active contract for this tenant
    const penghuni = await prisma.penghuni.findUnique({
      where: { user_id: session.id },
      include: {
        kontrak: {
          where: { status: 'AKTIF' },
          include: { kamar: true },
          take: 1,
        },
      },
    });

    const activeKontrak = penghuni?.kontrak[0];
    if (!activeKontrak) {
      return NextResponse.json(
        { error: 'Tidak ditemukan kontrak sewa aktif untuk diajukan perpanjangan.' },
        { status: 400 }
      );
    }

    const MAX_RETRIES = 2;
    let attempt = 0;
    let pengajuanResult: any = null;

    while (attempt <= MAX_RETRIES) {
      try {
        pengajuanResult = await prisma.$transaction(
          async (tx) => {
            // 1. Ambil riwayat pengajuan kontrak_id di dalam transaksi serializable
            const previousSubmissions = await tx.pengajuanPerpanjangan.findMany({
              where: { kontrak_id: activeKontrak.id },
              select: { status: true, created_at: true },
            });

            // 2. Cek eligibility (jika ada PENDING lempar 409, jika < 7 hari lempar 429)
            const eligibility = checkPerpanjanganEligibility(previousSubmissions);
            if (!eligibility.allowed) {
              throw new PerpanjanganError(
                eligibility.statusCode || 400,
                eligibility.message || 'Pengajuan tidak dapat diproses saat ini.',
                eligibility.reason
              );
            }

            // 3. Buat pengajuan baru
            const pengajuan = await tx.pengajuanPerpanjangan.create({
              data: {
                kontrak_id: activeKontrak.id,
                penghuni_id: penghuni.id,
                status: StatusPengajuanPerpanjangan.PENDING,
              },
            });

            // 4. Cari manajer (OWNER & ADMIN) dan buat notifikasi
            const managers = await tx.user.findMany({
              where: { role: { in: [Role.OWNER, Role.ADMIN] } },
              select: { id: true },
            });

            const pesanNotifikasi = `Penghuni ${session.nama} (Kamar ${activeKontrak.kamar.nomor_kamar}) mengajukan perpanjangan sewa`;

            if (managers.length > 0) {
              await tx.notifikasi.createMany({
                data: managers.map((mgr) => ({
                  user_id: mgr.id,
                  judul: 'Pengajuan Perpanjangan Sewa',
                  pesan: pesanNotifikasi,
                  tipe: 'KONTRAK',
                })),
              });
            }

            return pengajuan;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          }
        );

        // Berhasil, keluar dari retry loop
        break;
      } catch (err: any) {
        // Tangani error eligibility: jika PENDING lempar 409, jika < 7 hari lempar 429 (tanpa retry)
        if (err instanceof PerpanjanganError) {
          return NextResponse.json({ error: err.message }, { status: err.statusCode });
        }

        // Tangani Prisma serialization conflict (P2034) dengan retry
        const isSerializationError =
          err?.code === 'P2034' ||
          (typeof err?.message === 'string' &&
            (err.message.includes('could not serialize access') ||
              err.message.includes('deadlock detected') ||
              err.message.includes('P2034')));

        if (isSerializationError && attempt < MAX_RETRIES) {
          attempt++;
          // Jitter backoff sebelum mencoba lagi
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
          continue;
        }

        if (isSerializationError) {
          return NextResponse.json(
            { error: 'Permintaan sedang diproses, silakan coba lagi.' },
            { status: 409 }
          );
        }

        // Error lain dilempar ke catch luar
        throw err;
      }
    }

    // Log aktivitas setelah transaksi berhasil
    await logAktivitas(
      session.id,
      'ajukan_perpanjangan_sewa',
      `Penghuni ${session.nama} (Kamar ${activeKontrak.kamar.nomor_kamar}) mengajukan perpanjangan sewa untuk kontrak ${activeKontrak.id}`
    );

    return NextResponse.json({
      success: true,
      message: 'Pengajuan perpanjangan sewa berhasil dikirimkan ke pengelola kost.',
      pengajuan: pengajuanResult,
    });
  } catch (error: any) {
    return handleApiError(error, 'Gagal mengajukan perpanjangan sewa');
  }
}
