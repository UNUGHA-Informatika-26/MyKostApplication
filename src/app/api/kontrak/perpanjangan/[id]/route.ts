import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRoleApi } from '@/lib/rbac';
import { Role, StatusPengajuanPerpanjangan } from '@prisma/client';
import { logAktivitas } from '@/lib/log';
import { handleApiError } from '@/lib/errors';
import { formatDateIndonesian, tambahBulan } from '@/lib/utils';
import { z } from 'zod';

const updatePengajuanSchema = z
  .object({
    status: z.enum([StatusPengajuanPerpanjangan.DISETUJUI, StatusPengajuanPerpanjangan.DITOLAK]),
    durasi_bulan: z
      .coerce
      .number()
      .int('Durasi perpanjangan harus berupa bilangan bulat')
      .min(1, 'Durasi perpanjangan minimal 1 bulan')
      .max(24, 'Durasi perpanjangan maksimal 24 bulan')
      .default(1),
    catatan: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.status === StatusPengajuanPerpanjangan.DISETUJUI) {
        return typeof data.durasi_bulan === 'number' && data.durasi_bulan >= 1 && data.durasi_bulan <= 24;
      }
      return true;
    },
    {
      message: 'Durasi bulan wajib diisi antara 1-24 saat pengajuan disetujui',
      path: ['durasi_bulan'],
    }
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRoleApi([Role.OWNER, Role.ADMIN]);
    const { id } = await params;

    const body = await req.json();
    const parseResult = updatePengajuanSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map((e) => e.message).join(', ');
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { status, durasi_bulan, catatan } = parseResult.data;

    // Verify existence of pengajuan
    const pengajuan = await prisma.pengajuanPerpanjangan.findUnique({
      where: { id },
      include: {
        penghuni: {
          select: {
            id: true,
            nama: true,
            user_id: true,
          },
        },
        kontrak: {
          include: {
            kamar: { select: { nomor_kamar: true } },
          },
        },
      },
    });

    if (!pengajuan) {
      return NextResponse.json(
        { error: 'Pengajuan perpanjangan tidak ditemukan' },
        { status: 404 }
      );
    }

    if (pengajuan.status !== StatusPengajuanPerpanjangan.PENDING) {
      return NextResponse.json(
        { error: `Pengajuan ini sudah berstatus ${pengajuan.status} dan tidak dapat diubah lagi.` },
        { status: 409 }
      );
    }

    // Ensure contract is still AKTIF before approval
    if (status === StatusPengajuanPerpanjangan.DISETUJUI && pengajuan.kontrak.status !== 'AKTIF') {
      return NextResponse.json(
        {
          error: `Kontrak sewa tidak berstatus AKTIF (status saat ini: ${pengajuan.kontrak.status}). Perpanjangan sewa hanya dapat disetujui untuk kontrak yang aktif.`,
        },
        { status: 409 }
      );
    }

    // Calculate new end date if approved
    const tanggalBaru =
      status === StatusPengajuanPerpanjangan.DISETUJUI
        ? tambahBulan(pengajuan.kontrak.tanggal_selesai, durasi_bulan)
        : null;
    const tanggalBaruFormatted = tanggalBaru ? formatDateIndonesian(tanggalBaru) : '';

    // Atomic transaction: update status pengajuan, update kontrak tanggal_selesai, and send tenant notification
    const [updated] = await prisma.$transaction([
      prisma.pengajuanPerpanjangan.update({
        where: { id },
        data: {
          status,
          catatan: catatan || null,
        },
      }),
      ...(status === StatusPengajuanPerpanjangan.DISETUJUI && tanggalBaru
        ? [
            prisma.kontrak.update({
              where: { id: pengajuan.kontrak_id },
              data: {
                tanggal_selesai: tanggalBaru,
              },
            }),
          ]
        : []),
      ...(pengajuan.penghuni.user_id
        ? [
            prisma.notifikasi.create({
              data: {
                user_id: pengajuan.penghuni.user_id,
                judul:
                  status === StatusPengajuanPerpanjangan.DISETUJUI
                    ? 'Pengajuan Perpanjangan Sewa Disetujui'
                    : 'Pengajuan Perpanjangan Sewa Ditolak',
                pesan:
                  status === StatusPengajuanPerpanjangan.DISETUJUI
                    ? `Pengajuan perpanjangan sewa kamar ${pengajuan.kontrak.kamar.nomor_kamar} telah disetujui selama ${durasi_bulan} bulan. Masa sewa berakhir pada ${tanggalBaruFormatted}.`
                    : `Pengajuan perpanjangan sewa kamar ${pengajuan.kontrak.kamar.nomor_kamar} ditolak pengelola kost.${catatan ? ` Catatan: ${catatan}` : ''}`,
                tipe: 'KONTRAK',
              },
            }),
          ]
        : []),
    ]);

    // Log activity with durasi_bulan and new date
    if (status === StatusPengajuanPerpanjangan.DISETUJUI) {
      await logAktivitas(
        session.id,
        'verifikasi_perpanjangan_sewa',
        `${session.role} ${session.nama} menyetujui perpanjangan sewa (Kamar ${pengajuan.kontrak.kamar.nomor_kamar}) selama ${durasi_bulan} bulan hingga ${tanggalBaruFormatted}`
      );
    } else {
      await logAktivitas(
        session.id,
        'verifikasi_perpanjangan_sewa',
        `${session.role} ${session.nama} menolak perpanjangan sewa (Kamar ${pengajuan.kontrak.kamar.nomor_kamar})${catatan ? ` dengan catatan: ${catatan}` : ''}`
      );
    }

    return NextResponse.json({
      success: true,
      message:
        status === StatusPengajuanPerpanjangan.DISETUJUI
          ? `Pengajuan perpanjangan berhasil disetujui selama ${durasi_bulan} bulan hingga ${tanggalBaruFormatted}.`
          : 'Pengajuan perpanjangan berhasil ditolak.',
      pengajuan: updated,
      tanggal_selesai_baru: tanggalBaru,
    });
  } catch (error: any) {
    return handleApiError(error, 'Gagal memproses verifikasi perpanjangan');
  }
}
