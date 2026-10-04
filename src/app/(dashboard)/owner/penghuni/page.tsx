'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Search, Phone, LogOut, CheckCircle, AlertCircle, X, ShieldCheck, DollarSign, Clock } from 'lucide-react';
import { formatRupiah, formatDateIndonesian } from '@/lib/utils';

interface PenghuniItem {
  id: string;
  nama: string;
  no_ktp: string;
  no_hp: string;
  email: string;
  created_at: string;
  kontrak?: Array<{
    id: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
    harga_sewa_disepakati: number;
    deposit_awal?: number;
    status: string;
    kamar: { nomor_kamar: string; tipe: string };
    pengajuan_perpanjangan?: Array<{
      id: string;
      status: string;
      catatan?: string;
    }>;
  }>;
}

interface KamarItem {
  id: string;
  nomor_kamar: string;
  tipe: string;
  harga_sewa: number;
  status: string;
}

export default function OwnerPenghuniPage() {
  const [penghuniList, setPenghuniList] = useState<PenghuniItem[]>([]);
  const [availableKamar, setAvailableKamar] = useState<KamarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State for Onboarding Flow 6.1
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nama: '',
    no_ktp: '',
    no_hp: '',
    email: '',
    kamar_id: '',
    tanggal_mulai: new Date().toISOString().split('T')[0],
    tanggal_selesai: new Date(new Date().setMonth(new Date().getMonth() + 6))
      .toISOString()
      .split('T')[0],
    harga_sewa_disepakati: '',
    deposit_awal: '',
  });

  // Modal State for Checkout (B4)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedKontrak, setSelectedKontrak] = useState<{
    id: string;
    namaPenghuni: string;
    nomorKamar: string;
  } | null>(null);
  const [potonganDeposit, setPotonganDeposit] = useState('0');
  const [catatanPotongan, setCatatanPotongan] = useState('');
  const [checkoutError, setCheckoutError] = useState('');

  const [modalLoading, setModalLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [durasiPerpanjangan, setDurasiPerpanjangan] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resPenghuni, resKamar] = await Promise.all([
        fetch('/api/penghuni'),
        fetch('/api/kamar?status=KOSONG'),
      ]);
      const dataPenghuni = await resPenghuni.json();
      const dataKamar = await resKamar.json();

      if (Array.isArray(dataPenghuni)) setPenghuniList(dataPenghuni);
      if (Array.isArray(dataKamar)) {
        setAvailableKamar(dataKamar);
        if (dataKamar.length > 0) {
          setFormData((prev) => ({
            ...prev,
            kamar_id: dataKamar[0].id,
            harga_sewa_disepakati: String(dataKamar[0].harga_sewa),
          }));
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectKamarChange = (kamarId: string) => {
    const selected = availableKamar.find((k) => k.id === kamarId);
    setFormData((prev) => ({
      ...prev,
      kamar_id: kamarId,
      harga_sewa_disepakati: selected ? String(selected.harga_sewa) : prev.harga_sewa_disepakati,
    }));
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      // Single Atomic Onboarding Request
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: formData.nama,
          no_ktp: formData.no_ktp,
          no_hp: formData.no_hp,
          email: formData.email,
          kamar_id: formData.kamar_id,
          tanggal_mulai: formData.tanggal_mulai,
          tanggal_selesai: formData.tanggal_selesai,
          harga_sewa_disepakati: formData.harga_sewa_disepakati,
          deposit_awal: formData.deposit_awal || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        setToastMessage(data.message || 'Penghuni & Kontrak sewa berhasil dibuat! Pesan instruksi WhatsApp telah dikirim.');
        setTimeout(() => setToastMessage(null), 6000);
        fetchData();
      } else {
        alert(data.error || 'Gagal memproses onboarding sewa');
      }
    } catch (err) {
      console.error('Onboarding error:', err);
      alert('Terjadi kesalahan koneksi saat onboarding');
    } finally {
      setModalLoading(false);
    }
  };

  // Open Checkout Modal
  const openCheckoutModal = (kontrakId: string, namaPenghuni: string, nomorKamar: string) => {
    setSelectedKontrak({ id: kontrakId, namaPenghuni, nomorKamar });
    setPotonganDeposit('0');
    setCatatanPotongan('');
    setCheckoutError('');
    setIsCheckoutModalOpen(true);
  };

  // Handle Checkout Submit (B4 & Priority 5)
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKontrak) return;
    setCheckoutError('');
    setModalLoading(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kontrak_id: selectedKontrak.id,
          potongan_deposit: parseFloat(potonganDeposit || '0'),
          catatan_potongan: catatanPotongan,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses checkout');
      }

      setIsCheckoutModalOpen(false);
      setToastMessage(`Checkout Kamar ${selectedKontrak.nomorKamar} berhasil! Kamar kini KOSONG.`);
      setTimeout(() => setToastMessage(null), 6000);
      fetchData();
    } catch (err: any) {
      setCheckoutError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleVerifikasiPerpanjangan = async (
    pengajuanId: string,
    status: 'DISETUJUI' | 'DITOLAK'
  ) => {
    const durasi = durasiPerpanjangan[pengajuanId] ?? 1;
    let catatan: string | null = null;

    if (status === 'DISETUJUI') {
      if (!window.confirm(`Apakah Anda yakin ingin menyetujui perpanjangan sewa ini selama ${durasi} bulan?`)) {
        return;
      }
    } else {
      const promptedCatatan = window.prompt('Masukkan catatan penolakan (opsional):', '');
      if (promptedCatatan === null) {
        // Owner clicked cancel
        return;
      }
      catatan = promptedCatatan.trim() || null;
    }

    try {
      const res = await fetch(`/api/kontrak/perpanjangan/${pengajuanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          durasi_bulan: status === 'DISETUJUI' ? durasi : undefined,
          catatan,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses verifikasi');
      }

      setToastMessage(data.message || `Pengajuan perpanjangan sewa berhasil ${status === 'DISETUJUI' ? 'disetujui' : 'ditolak'}.`);
      setTimeout(() => setToastMessage(null), 5000);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan');
    }
  };

  const filteredPenghuni = penghuniList.filter((item) => {
    return (
      item.nama.toLowerCase().includes(search.toLowerCase()) ||
      item.no_hp.includes(search) ||
      (item.kontrak?.[0]?.kamar?.nomor_kamar || '').includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2 shadow-md">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Manajemen Penghuni & Kontrak</h1>
          <p className="text-xs md:text-sm text-slate-500">
            Onboarding penghuni baru, registrasi kontrak sewa, dan penghentian sewa (checkout).
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Onboarding Penghuni Baru</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama penghuni, nomor HP, atau kamar..."
          className="w-full pl-10 pr-4 py-2.5 text-xs md:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
        />
      </div>

      {/* List Penghuni */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Memuat data penghuni...</div>
      ) : filteredPenghuni.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 text-sm">
          Belum ada penghuni terdaftar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPenghuni.map((item) => {
            const activeKontrak = item.kontrak?.find((k) => k.status === 'AKTIF');
            return (
              <div key={item.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{item.nama}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {item.no_hp}
                    </p>
                  </div>
                  {activeKontrak ? (
                    <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      Kamar {activeKontrak.kamar?.nomor_kamar}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-slate-100 text-slate-600">
                      Selesai / Non-Aktif
                    </span>
                  )}
                </div>

                {activeKontrak && (
                  <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                    <p>
                      <span className="text-slate-400">Periode: </span>
                      <strong>
                        {formatDateIndonesian(activeKontrak.tanggal_mulai)} s/d{' '}
                        {formatDateIndonesian(activeKontrak.tanggal_selesai)}
                      </strong>
                    </p>
                    <p>
                      <span className="text-slate-400">Harga Sewa: </span>
                      <strong className="text-emerald-700">
                        {formatRupiah(activeKontrak.harga_sewa_disepakati)} / bulan
                      </strong>
                      {activeKontrak.deposit_awal && (
                        <span className="ml-2 text-slate-500">
                          (Deposit: {formatRupiah(activeKontrak.deposit_awal)})
                        </span>
                      )}
                    </p>
                    {activeKontrak.pengajuan_perpanjangan?.[0] && (() => {
                      const pengajuan = activeKontrak.pengajuan_perpanjangan[0];
                      const durasi = durasiPerpanjangan[pengajuan.id] ?? 1;
                      return (
                        <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl space-y-2 mt-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-amber-900 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              Pengajuan Perpanjangan Sewa
                            </span>
                            <span className="font-bold text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                              Menunggu
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 bg-white/80 px-2.5 py-1.5 rounded-lg border border-amber-200/60 text-[11px]">
                            <label htmlFor={`durasi-${pengajuan.id}`} className="font-semibold text-slate-700">
                              Durasi Perpanjangan:
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                id={`durasi-${pengajuan.id}`}
                                type="number"
                                min={1}
                                max={24}
                                value={durasi}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setDurasiPerpanjangan((prev) => ({
                                    ...prev,
                                    [pengajuan.id]: isNaN(val) ? 1 : Math.max(1, Math.min(24, val)),
                                  }));
                                }}
                                className="w-14 px-2 py-0.5 bg-white border border-slate-300 rounded-md text-center font-bold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                              <span className="text-slate-500 font-medium">Bulan</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleVerifikasiPerpanjangan(pengajuan.id, 'DISETUJUI')}
                              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-lg transition-all text-[11px] cursor-pointer"
                            >
                              Setujui
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVerifikasiPerpanjangan(pengajuan.id, 'DITOLAK')}
                              className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 font-bold rounded-lg transition-all text-[11px] cursor-pointer"
                            >
                              Tolak
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="pt-1">
                      <button
                        onClick={() =>
                          openCheckoutModal(activeKontrak.id, item.nama, activeKontrak.kamar?.nomor_kamar)
                        }
                        className="w-full py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Proses Checkout Kamar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Checkout UI (B4 & Priority 5) */}
      {isCheckoutModalOpen && selectedKontrak && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Konfirmasi Checkout Kamar</h3>
                <p className="text-xs text-slate-500">
                  {selectedKontrak.namaPenghuni} — Kamar {selectedKontrak.nomorKamar}
                </p>
              </div>
              <button onClick={() => setIsCheckoutModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {checkoutError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{checkoutError}</span>
              </div>
            )}

            <form onSubmit={handleCheckoutSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Potongan Deposit (Rp) — Opsional</label>
                <input
                  type="number"
                  value={potonganDeposit}
                  onChange={(e) => setPotonganDeposit(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Catatan Potongan Deposit</label>
                <textarea
                  rows={2}
                  value={catatanPotongan}
                  onChange={(e) => setCatatanPotongan(e.target.value)}
                  placeholder="Alasan potongan deposit (misal: ganti rugi kerusakan kran air)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[11px] leading-relaxed">
                <strong>Perhatian:</strong> Proses checkout akan mengubah status kontrak menjadi{' '}
                <strong>SELESAI</strong> dan kamar menjadi <strong>KOSONG</strong>. Checkout akan ditolak jika
                penghuni masih memiliki tagihan yang belum lunas.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-colors"
                >
                  {modalLoading ? 'Memproses...' : 'Ya, Checkout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Onboarding (Alur 6.1) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Onboarding Penghuni Baru (Alur 6.1)</h3>
                <p className="text-xs text-slate-500">Buat data penghuni & kontrak sewa kamar sekaligus.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOnboardingSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Nama Lengkap (KTP)</label>
                  <input
                    type="text"
                    required
                    placeholder="Dimas Pratama"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Nomor KTP</label>
                  <input
                    type="text"
                    required
                    placeholder="3171012345670001"
                    value={formData.no_ktp}
                    onChange={(e) => setFormData({ ...formData, no_ktp: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Nomor HP (WhatsApp)</label>
                  <input
                    type="tel"
                    required
                    placeholder="081234567890"
                    value={formData.no_hp}
                    onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Alamat Email</label>
                  <input
                    type="email"
                    required
                    placeholder="penghuni@gmail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <label className="font-semibold text-slate-700">Pilih Kamar Sewa (Kosong)</label>
                {availableKamar.length === 0 ? (
                  <p className="text-rose-500 font-semibold py-1">Tidak ada kamar kosong yang tersedia!</p>
                ) : (
                  <select
                    value={formData.kamar_id}
                    onChange={(e) => handleSelectKamarChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    required
                  >
                    {availableKamar.map((k) => (
                      <option key={k.id} value={k.id}>
                        Kamar {k.nomor_kamar} — {k.tipe} ({formatRupiah(k.harga_sewa)}/bln)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Tanggal Mulai Sewa</label>
                  <input
                    type="date"
                    required
                    value={formData.tanggal_mulai}
                    onChange={(e) => setFormData({ ...formData, tanggal_mulai: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Tanggal Selesai Sewa</label>
                  <input
                    type="date"
                    required
                    value={formData.tanggal_selesai}
                    onChange={(e) => setFormData({ ...formData, tanggal_selesai: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Harga Sewa (Rp/bulan)</label>
                  <input
                    type="number"
                    required
                    value={formData.harga_sewa_disepakati}
                    onChange={(e) => setFormData({ ...formData, harga_sewa_disepakati: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Deposit Awal (Rp) — Opsional</label>
                  <input
                    type="number"
                    value={formData.deposit_awal}
                    onChange={(e) => setFormData({ ...formData, deposit_awal: e.target.value })}
                    placeholder="misal: 500000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 text-blue-800 rounded-xl flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Sistem akan otomatis mengubah status kamar jadi <strong>TERISI</strong>, membuat tagihan pertama,
                  dan mengirimi pesan WhatsApp aktivasi akun ke penghuni.
                </span>
              </div>

              <button
                type="submit"
                disabled={modalLoading || availableKamar.length === 0}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
              >
                {modalLoading ? 'Memproses Onboarding...' : 'Proses Onboarding & Kirim Link WA'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
