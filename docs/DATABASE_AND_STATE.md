# 🗄️ Database, ERD, & State Machine Entity

Dokumen ini menjelaskan struktur basis data relasional, kamus data (*data dictionary*), diagram hubungan antar entitas (*Entity-Relationship Diagram* / ERD), serta siklus status (*Finite State Machines*) untuk setiap entitas utama pada sistem **MyKost**.

---

## 1. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USER ||--o{ PROPERTI : owns
    USER ||--o| PENGHUNI : profile
    USER ||--o{ LOG_AKTIVITAS : performs
    USER ||--o{ NOTIFIKASI : receives

    PROPERTI ||--o{ KAMAR : contains

    KAMAR ||--o{ KONTRAK : leased_in
    KAMAR ||--o{ PENGADUAN : subject_of

    PENGHUNI ||--o{ KONTRAK : holds
    PENGHUNI ||--o{ PENGADUAN : submits

    KONTRAK ||--o{ TAGIHAN : generates

    TAGIHAN ||--o{ PEMBAYARAN : settled_by

    USER {
        string id PK "cuid"
        string nama
        string email UK
        string password_hash
        Role role "OWNER | ADMIN | PENGHUNI"
        datetime created_at
    }

    PROPERTI {
        string id PK "cuid"
        string nama
        string alamat
        string user_id FK
        datetime created_at
    }

    KAMAR {
        string id PK "cuid"
        string properti_id FK
        string nomor_kamar
        string tipe
        decimal harga_sewa "Decimal(12,2)"
        StatusKamar status "KOSONG | TERISI | BOOKING | MAINTENANCE"
        string fasilitas
        string foto_url
    }

    PENGHUNI {
        string id PK "cuid"
        string user_id FK,UK "nullable"
        string nama
        string no_ktp
        string no_hp UK
        string email
        string foto_ktp_url
        datetime created_at
    }

    KONTRAK {
        string id PK "cuid"
        string kamar_id FK
        string penghuni_id FK
        datetime tanggal_mulai
        datetime tanggal_selesai
        decimal harga_sewa_disepakati "Decimal(12,2)"
        decimal deposit_awal "nullable"
        decimal potongan_deposit "nullable"
        string catatan_potongan "nullable"
        datetime tanggal_checkout "nullable"
        StatusKontrak status "AKTIF | SELESAI | DIBATALKAN"
        string dokumen_url
    }

    TAGIHAN {
        string id PK "cuid"
        string kontrak_id FK
        string periode "Format YYYY-MM"
        decimal jumlah "Decimal(12,2)"
        decimal denda "Decimal(12,2)"
        datetime jatuh_tempo
        StatusTagihan status "BELUM_BAYAR | SEBAGIAN | LUNAS | TERLAMBAT"
        datetime created_at
    }

    PEMBAYARAN {
        string id PK "cuid"
        string tagihan_id FK
        decimal jumlah_dibayar "Decimal(12,2)"
        string metode
        datetime tanggal_bayar
        string bukti_url
        StatusVerifikasi status_verifikasi "PENDING | DISETUJUI | DITOLAK"
    }

    PENGADUAN {
        string id PK "cuid"
        string kamar_id FK
        string penghuni_id FK
        string kategori
        string deskripsi
        json foto_url "Array of URLs"
        StatusPengaduan status "BARU | DIPROSES | SELESAI"
        string catatan_internal
        datetime created_at
        datetime resolved_at
    }

    LOG_AKTIVITAS {
        string id PK "cuid"
        string user_id FK
        string aksi
        string detail
        datetime timestamp
    }

    PENGATURAN {
        string id PK "default"
        decimal harga_default "Decimal(12,2)"
        decimal denda_per_hari "Decimal(12,2)"
        string wa_template
        datetime updated_at
    }

    NOTIFIKASI {
        string id PK "cuid"
        string user_id FK
        string judul
        string pesan
        string tipe
        boolean dibaca
        datetime created_at
    }
```

---

## 2. Kamus Data & Spesifikasi Model (*Data Dictionary*)

### 2.1. Model `User`
Menyimpan akun autentikasi untuk login ke sistem.
- `id` (String, PK, CUID): ID unik pengguna.
- `nama` (String): Nama lengkap pengguna.
- `email` (String, Unique): Alamat email untuk kredensial login.
- `password_hash` (String): Hash sandi terenkripsi menggunakan bcrypt (salt round: 10).
- `role` (Enum `Role`): Hak akses (`OWNER`, `ADMIN`, `PENGHUNI`).
- `created_at` (DateTime): Waktu pendaftaran akun.

### 2.2. Model `Kamar`
Menyimpan data fisik kamar kost.
- `id` (String, PK, CUID): ID unit kamar.
- `properti_id` (String, FK): Relasi ke Properti pemilik kamar.
- `nomor_kamar` (String): Nomor/label kamar (contoh: "101", "204").
- `tipe` (String): Kategori kamar (contoh: "Deluxe AC", "Standard Fan").
- `harga_sewa` (Decimal(12,2)): Tarif sewa per bulan.
- `status` (Enum `StatusKamar`): Kondisi kamar (`KOSONG`, `TERISI`, `BOOKING`, `MAINTENANCE`).
- `fasilitas` (String): Daftar fasilitas kamar (kamar mandi dalam, WiFi, dll).
- `foto_url` (String, Nullable): URL foto kamar di Cloudflare R2.

### 2.3. Model `Kontrak`
Mewakili perjanjian sewa kamar antara pengelola dan penghuni.
- `id` (String, PK, CUID): ID kontrak perjanjian.
- `kamar_id` (String, FK): Kamar yang disewa.
- `penghuni_id` (String, FK): Data penyewa kamar.
- `tanggal_mulai` & `tanggal_selesai` (DateTime): Periode masa sewa.
- `harga_sewa_disepakati` (Decimal(12,2)): Harga kesepakatan per bulan.
- `deposit_awal` (Decimal(12,2), Nullable): Uang jaminan saat awal masuk.
- `potongan_deposit` (Decimal(12,2), Nullable): Potongan saat checkout (jika ada kerusakan/tunggakan).
- `catatan_potongan` (String, Nullable): Alasan potongan deposit.
- `tanggal_checkout` (DateTime, Nullable): Tanggal riil penghuni keluar.
- `status` (Enum `StatusKontrak`): `AKTIF`, `SELESAI`, `DIBATALKAN`.

### 2.4. Model `Tagihan`
Invoice kewajiban pembayaran sewa per bulan.
- `id` (String, PK, CUID): ID tagihan.
- `kontrak_id` (String, FK): Kontrak sewa rujukan.
- `periode` (String): Format periode `YYYY-MM` (contoh: "2026-10").
- `jumlah` (Decimal(12,2)): Nominal pokok tagihan sewa.
- `denda` (Decimal(12,2)): Denda keterlambatan (dinamis dari pengaturan).
- `jatuh_tempo` (DateTime): Batas akhir pembayaran (default tanggal 10 tiap bulan).
- `status` (Enum `StatusTagihan`): `BELUM_BAYAR`, `SEBAGIAN`, `LUNAS`, `TERLAMBAT`.

### 2.5. Model `Pembayaran`
Pencatatan transaksi pembayaran yang diunggah oleh penghuni.
- `id` (String, PK, CUID): ID pembayaran.
- `tagihan_id` (String, FK): Tagihan yang dibayar.
- `jumlah_dibayar` (Decimal(12,2)): Jumlah uang yang ditransfer.
- `metode` (String): Metode bayar (contoh: "Transfer Bank", "BCA", "QRIS").
- `tanggal_bayar` (DateTime): Tanggal transfer dilakukan.
- `bukti_url` (String): URL berkas bukti struk transfer di Cloudflare R2.
- `status_verifikasi` (Enum `StatusVerifikasi`): `PENDING`, `DISETUJUI`, `DITOLAK`.

### 2.6. Model `Pengaduan`
Tiket laporan keluhan atau perbaikan fasilitas.
- `id` (String, PK, CUID): ID pengaduan.
- `kamar_id` & `penghuni_id` (String, FK): Lokasi dan pelapor keluhan.
- `kategori` (String): Kategori (misal: "Kelistrikan", "Pipa/Air", "AC").
- `deskripsi` (String): Penjelasan detail kerusakan.
- `foto_url` (Json, Nullable): Array URL foto bukti kerusakan.
- `status` (Enum `StatusPengaduan`): `BARU`, `DIPROSES`, `SELESAI`.
- `catatan_internal` (String, Nullable): Catatan pengelola / teknisi perbaikan.
- `resolved_at` (DateTime, Nullable): Timestamp saat keluhan tuntas.

---

## 3. Siklus Status Entitas (*Finite State Machines*)

### 3.1. Siklus Status Kamar (`StatusKamar`)

```mermaid
stateDiagram-v2
    [*] --> KOSONG: Kamar baru ditambahkan
    KOSONG --> BOOKING: Calon penghuni reservasi awal
    BOOKING --> KOSONG: Reservasi dibatalkan
    BOOKING --> TERISI: Kontrak disetujui & aktif
    KOSONG --> TERISI: Onboarding langsung
    TERISI --> KOSONG: Checkout kontrak selesai
    TERISI --> MAINTENANCE: Terjadi kerusakan besar saat sewa
    KOSONG --> MAINTENANCE: Kamar direnovasi / dicat
    MAINTENANCE --> KOSONG: Selesai perbaikan fasilitas
```

### 3.2. Siklus Status Kontrak (`StatusKontrak`)

```mermaid
stateDiagram-v2
    [*] --> AKTIF: Onboarding penghuni disubmit
    AKTIF --> SELESAI: Penghuni checkout di akhir periode sewa
    AKTIF --> DIBATALKAN: Penghuni membatalkan sebelum mulai / dikeluarkan
    SELESAI --> [*]
    DIBATALKAN --> [*]
```

### 3.3. Siklus Status Tagihan (`StatusTagihan`)

```mermaid
stateDiagram-v2
    [*] --> BELUM_BAYAR: Tagihan baru terbit (Tanggal 1)
    BELUM_BAYAR --> TERLAMBAT: Melewati tanggal jatuh tempo (Tanggal 10)
    BELUM_BAYAR --> LUNAS: Pembayaran penuh disetujui admin
    TERLAMBAT --> LUNAS: Pembayaran + denda disetujui admin
    BELUM_BAYAR --> SEBAGIAN: Pembayaran termin / cicilan disetujui
    SEBAGIAN --> LUNAS: Pelunasan sisa tagihan disetujui
    LUNAS --> [*]: Kwitansi lunas terkunci (read-only)
```

### 3.4. Siklus Status Pembayaran (`StatusVerifikasi`)

```mermaid
stateDiagram-v2
    [*] --> PENDING: Penghuni upload bukti transfer
    PENDING --> DISETUJUI: Admin klik "Setujui" (Tagihan otomatis LUNAS)
    PENDING --> DITOLAK: Bukti palsu / nominal tidak sesuai
    DITOLAK --> PENDING: Penghuni mengunggah ulang bukti pembayaran valid
    DISETUJUI --> [*]: Transaksi sah tercatat di laporan keuangan
```

### 3.5. Siklus Status Pengaduan (`StatusPengaduan`)

```mermaid
stateDiagram-v2
    [*] --> BARU: Penghuni kirim form komplain
    BARU --> DIPROSES: Admin meninjau & menugaskan teknisi
    DIPROSES --> SELESAI: Fasilitas selesai diperbaiki & catatan diisi
    SELESAI --> [*]: Tiket ditutup & disimpan di riwayat
```

---

## 4. Integritas Data & Aturan Transaksi (*Integrity Rules*)

1. **Pencegahan Tagihan Ganda (*Anti-Duplicate Billing*)**:
   - Generator tagihan (`generateMonthlyBills()`) selalu memeriksa keberadaan record tagihan dengan kombinasi `{ kontrak_id, periode }` sebelum mengeksekusi `create`.
   - Menghindari tagihan ganda jika cron terpanggil berulang kali pada tanggal 1.
2. **Atomisitas Verifikasi Pembayaran (`Prisma Transaction`)**:
   - Pembaruan status verifikasi pembayaran menggunakan `prisma.$transaction(async (tx) => { ... })`.
   - Mengubah status `pembayaran.status_verifikasi = DISETUJUI` dan `tagihan.status = LUNAS` secara atomik dalam satu transaksi SQL. Jika salah satu gagal, seluruh operasi di-rollback.
3. **Presisi Finansial (*Decimal Precision*)**:
   - Seluruh kolom moneter (`harga_sewa`, `jumlah`, `denda`, `jumlah_dibayar`, `deposit_awal`) menggunakan tipe `Decimal(12, 2)` pada PostgreSQL untuk mencegah bug pembulatan angka (*floating-point rounding issue*).
