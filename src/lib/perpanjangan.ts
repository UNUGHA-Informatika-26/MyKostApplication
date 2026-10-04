import { StatusPengajuanPerpanjangan } from '@prisma/client';

export interface PerpanjanganEligibilityResult {
  allowed: boolean;
  statusCode?: number;
  reason?: 'PENDING_EXIST' | 'RATE_LIMITED';
  message?: string;
}

export class PerpanjanganError extends Error {
  statusCode: number;
  reason?: 'PENDING_EXIST' | 'RATE_LIMITED';

  constructor(statusCode: number, message: string, reason?: 'PENDING_EXIST' | 'RATE_LIMITED') {
    super(message);
    this.name = 'PerpanjanganError';
    this.statusCode = statusCode;
    this.reason = reason;
  }
}

/**
 * Pure function to check whether a contract is eligible for lease extension submission.
 * Rule:
 * 1. Reject (409) if there is already a PENDING submission for this contract.
 * 2. Reject (429) if the last submission was created less than 7 days ago.
 * 3. Allow otherwise.
 */
export function checkPerpanjanganEligibility(
  pengajuanList: Array<{
    status: StatusPengajuanPerpanjangan | 'PENDING' | 'DISETUJUI' | 'DITOLAK';
    created_at: Date | string;
  }>,
  now = new Date()
): PerpanjanganEligibilityResult {
  // 1. Reject if already pending
  const hasPending = pengajuanList.some((p) => p.status === 'PENDING');
  if (hasPending) {
    return {
      allowed: false,
      statusCode: 409,
      reason: 'PENDING_EXIST',
      message: 'Pengajuan perpanjangan sewa Anda masih menunggu konfirmasi dari pengelola kost.',
    };
  }

  // 2. Reject if last submission is < 7 days old
  if (pengajuanList.length > 0) {
    const sorted = [...pengajuanList].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latest = sorted[0];
    const diffMs = now.getTime() - new Date(latest.created_at).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    if (diffMs < sevenDaysMs) {
      return {
        allowed: false,
        statusCode: 429,
        reason: 'RATE_LIMITED',
        message:
          'Anda telah mengajukan perpanjangan sewa dalam 7 hari terakhir. Silakan tunggu konfirmasi pengelola atau ajukan kembali setelah 7 hari.',
      };
    }
  }

  return { allowed: true };
}
