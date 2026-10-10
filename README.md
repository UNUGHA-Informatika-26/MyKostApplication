# 🏠 MyKost — Platform Manajemen Kost Modern & PWA Full-Stack

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-v6.4-2d3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2_Storage-f38020?style=for-the-badge&logo=cloudflare)](https://www.cloudflare.com/products/r2/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=for-the-badge&logo=pwa)](https://web.dev/progressive-web-apps/)

**MyKost** adalah sistem manajemen operasional rumah kost terpadu berbasis *Progressive Web App* (PWA) *full-stack* yang dirancang untuk mengotomasi seluruh siklus persewaan: mulai dari onboarding penghuni atomik, perpanjangan masa sewa, inventaris kamar, penagihan bulanan otomatis, verifikasi pembayaran digital, penanganan komplain fasilitas, hingga laporan laba rugi dan jejak audit (*audit trail*).

Aplikasi ini menyatukan 3 peran pengguna (**Owner**, **Admin**, dan **Penghuni**) dalam antarmuka web modern yang cepat, aman, dan responsif untuk perangkat mobile maupun desktop.

---

## 📑 Daftar Isi Dokumentasi Teknis (`/docs`)

Untuk kebutuhan analisis teknis mendalam, arsitektur sistem, dan diagram spesifikasi, silakan merujuk pada dokumentasi terperinci di bawah ini:

| Dokumen | Topik & Cakupan |
| :--- | :--- |
| 🏗️ [**Arsitektur Sistem & State Management**](docs/ARCHITECTURE.md) | Topologi cloud terdistribusi, arsitektur berlapis, strategi state management (Server, Session, Form, Offline PWA), dan struktur direktori. |
| 📋 [**Use Case, Alur Bisnis, & Activity Diagram**](docs/USE_CASE_AND_FLOWS.md) | Matriks hak akses aktor, diagram Use Case, Flowchart Onboarding 6.1, Billing Cron, Pembayaran 6.2, Komplain 6.3, Checkout, Perpanjangan Kontrak, serta Activity Diagram. |
| 🗄️ [**Database, ERD, & State Machines**](docs/DATABASE_AND_STATE.md) | Entity-Relationship Diagram (ERD), Kamus data atribut/tabel, Finite State Machines (Kamar, Kontrak, Tagihan, Pembayaran, Pengaduan, Perpanjangan), dan aturan integritas transaksi. |
| 🔒 [**API Reference & Arsitektur Keamanan**](docs/API_AND_SECURITY.md) | Matriks seluruh rute REST API, arsitektur sesi JWT & RBAC, proteksi IDOR, fail-closed Cron auth, pengamanan upload R2, magic bytes, dan jejak audit. |
| 🚀 [**Panduan Deployment & Operasional**](docs/DEPLOYMENT_AND_OPERATIONS.md) | Petunjuk step-by-step deploy ke Vercel, Supabase, Cloudflare R2, integrasi Fonnte WhatsApp, jadwal Cron, dan troubleshooting runbook. |

---

## 🌟 Fitur Utama Sistem

```mermaid
flowchart LR
    subgraph OwnerAdmin ["🏢 Panel Pengelola (Owner & Admin)"]
        D1["Dashboard KPI & Okupansi Real-time"]
        D2["Manajemen Unit Kamar & Properti"]
        D3["Onboarding Terpadu Penghuni & Kontrak (6.1)"]
        D4["Persetujuan Perpanjangan Kontrak"]
        D5["Generator Invoice & Dynamic Late Fee"]
        D6["Verifikasi Transfer & Pembayaran Tunai"]
        D7["Export Laporan Keuangan Excel (ExcelJS)"]
        D8["Audit Trail & Manajemen User Pengelola"]
    end

    subgraph TenantApp ["📱 Panel Penghuni (Mobile PWA)"]
        T1["Beranda Kamar & Hitung Mundur Masa Sewa"]
        T2["Pengajuan Perpanjangan Sewa Kamar"]
        T3["Tagihan Sewa & Kwitansi Resmi Lunas"]
        T4["Upload Bukti Bayar (+ Kompresi Otomatis)"]
        T5["Tiket Komplain & Pelacakan Status (6.3)"]
        T6["Kontrak Digital & Profil Pribadi / Avatar"]
    end

    subgraph AutomationEngine ["⏱️ Otomasi Sistem & Gateway"]
        A1["Auto-Generate Invoice (Tanggal 1 Tiap Bulan)"]
        A2["Kalkulasi Denda Keterlambatan Harian"]
        A3["Broadcast WhatsApp Reminder & Notifikasi"]
    end

    OwnerAdmin <--> AutomationEngine
    TenantApp <--> AutomationEngine
```

### 🏢 Panel Pengelola (Owner & Admin)
- **Dashboard Real-Time**: Statistik okupansi kamar, pendapatan bulanan (pokok + denda), piutang tertunggak, dan komplain aktif.
- **Manajemen Properti & Kamar**: CRUD unit kamar dengan proteksi nomor kamar unik per properti (`@@unique([properti_id, nomor_kamar])`).
- **Onboarding Atomik Terpadu (`/api/onboarding`)**: Pendaftaran penghuni, binding kamar (`TERISI` kondisional anti-race condition), pembuatan kontrak sewa, pembuatan tagihan pertama, dan pengiriman tautan aktivasi WhatsApp via transaksi tunggal.
- **Persetujuan Perpanjangan Kontrak**: Meninjau pengajuan durasi perpanjangan sewa dari penghuni, memperbarui tanggal selesai kontrak secara aman, dan auto-generate tagihan periode berikutnya.
- **Checkout Aman (`/api/checkout`)**: Pengecekan tunggakan tagihan dan pembayaran pending, validasi potongan deposit (`<= deposit_awal`), dan pelepasan kamar ke status `KOSONG` secara atomik.
- **Manajemen Tagihan & Pembayaran**:
  - Penyesuaian manual tagihan & denda dengan pencatatan alasan wajib ke Audit Log (`PATCH /api/tagihan`).
  - Pencatatan pembayaran tunai instan terverifikasi lunas (`POST /api/pembayaran/tunai`).
  - Verifikasi pembayaran transfer via thumbnail dan fullscreen preview bukti bayar.
- **Laporan Keuangan Excel**: Ekspor data laporan bulanan multi-sheet ke format spreadsheet `.xlsx` menggunakan `exceljs`.
- **Manajemen User & Reset Sandi**: Penambahan pengelola baru (Admin/Owner) serta reset sandi Admin oleh Owner (`PATCH /api/users`).
- **Pengaturan Sistem Dinamis**: Konfigurasi mode denda (`HARIAN` / `TETAP`), tarif denda, batas reminder (H-X), dan template WhatsApp kustom.
- **Audit Trail Paginasi**: Pelacakan aktivitas pengelola (`/api/log`) dengan paginasi dan pencatatan aktor, aksi, dan stempel waktu.

### 📱 Panel Penghuni (Mobile PWA)
- **Beranda Interaktif**: Sapaan personal dengan nama penghuni langsung dari session, informasi kamar aktif, hitung mundur sisa sewa, dan preview tagihan aktif.
- **Pengajuan Perpanjangan Sewa**: Formulir pengajuan perpanjangan kontrak sewa secara mandiri dari aplikasi dengan pilihan durasi (bulan).
- **Aktivasi Akun Berbasis Token WhatsApp**: Pendaftaran akun aman dengan validasi token sekali pakai (`AktivasiToken`) bertaut nomor HP resmi di kontrak.
- **Lupa & Reset Kata Sandi Mandiri**: Pengiriman token reset via WhatsApp dan form pengaturan kata sandi baru yang otomatis mencabut seluruh sesi aktif (`token_version`).
- **Rincian Tagihan & Kwitansi Digital**: Halaman cetak kwitansi resmi (`@media print` CSS khusus menyembunyikan navigasi) dengan proteksi IDOR kepemilikan.
- **Unggah Bukti Bayar & Pengaduan**: Validasi berkas berbasis magic bytes (JPEG/PNG/WebP), nama berkas acak UUID, pembatasan 3 foto, serta penyajian gambar aman melalui presigned URL berumur pendek (`/api/files?key=...`).
- **Paginasi Notifikasi**: Pelacakan notifikasi in-app dengan paginasi dan penandaan status dibaca.

---

## 🏗️ Arsitektur & Keamanan Sistem

1. **Role-Based Access Control (RBAC)**:
   - Edge Middleware (`src/middleware.ts`) untuk redirect kilat rute dashboard jika cookie sesi tidak ada.
   - Server Component Layout guards (`owner/layout.tsx`, `penghuni/layout.tsx`, dan sub-layout Owner-only untuk `users`, `log`, `pengaturan`).
   - Helper API terstandar `requireAuthApi()` dan `requireRoleApi([Role])` dengan `handleApiError` yang menyembunyikan error mentah database pada status 500.
2. **Session Revocation (`token_version`)**:
   - Kolom `token_version` pada model `User` disertakan dalam JWT session.
   - Sesi lama di semua perangkat langsung kedaluwarsa seketika kata sandi diubah atau direset.
3. **Penyimpanan Media & Cloudflare R2**:
   - Berkas diunggah dengan nama acak `crypto.randomUUID()` dan diverifikasi melalui *magic bytes*.
   - Tidak ada fallback penyimpanan lokal pada environment produksi (`NODE_ENV === 'production'`).
   - Berkas disajikan via endpoint otorisasi `GET /api/files?key=...` yang menghasilkan presigned URL sementara (15 menit).
4. **Service Worker & PWA Hardening**:
   - Versi cache `mykost-cache-v2` dengan instalasi toleran per berkas.
   - Strategi *Network-Only* untuk seluruh rute `/api/*` dan navigasi dashboard (mencegah kebocoran data terautentikasi ke cache publik).
   - Fallback navigasi offline ke `/offline.html` statis dan respons JSON `{ error: 'offline' }` 503 untuk API.
   - Pembersihan otomatis cache browser saat pengguna keluar melalui `LogoutButton`.

---

## 🛠️ Tech Stack & Pustaka Utama

| Komponen | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Framework** | Next.js 15 (App Router, React 19) | Server Components, Server Actions, Route Handlers |
| **Styling** | Tailwind CSS v4 + Lucide React Icons | Antarmuka modern, responsif, dan ringan |
| **Database & ORM** | PostgreSQL (Supabase) + Prisma ORM v6 | Connection pooling via PgBouncer port 6543 |
| **Media Storage** | Cloudflare R2 Storage | S3 API via `@aws-sdk/client-s3` & `@aws-sdk/s3-request-presigner` |
| **Autentikasi** | Session Cookie JWT via `jose` + `bcryptjs` | Enkripsi token HttpOnly aman, terproteksi dari XSS |
| **WhatsApp Gateway**| Fonnte WhatsApp API | Pengiriman reminder tagihan dan instruksi onboarding |
| **Spreadsheet** | `exceljs` | Pembuat laporan Excel multi-sheet yang aman dan stabil |
| **Kompresi Klien** | `browser-image-compression` | Kompresi gambar client-side sebelum upload |
| **PWA Engine** | Web App Manifest + Service Worker | Installable di Android/iOS dengan dukungan banner offline |
| **Pengujian & Lint** | Vitest + ESLint 9 | Suite unit test terintegrasi |

---

## 🚀 Panduan Memulai Cepat (*Quickstart*)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Zeinkunn/MyKostAPP.git
cd MyKostAPP
git checkout dev
npm install
```

### 2. Konfigurasi Environment Variables (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```

Pastikan variabel berikut terisi dengan benar di `.env`:
```env
# Koneksi Database Supabase
# DATABASE_URL: Pooler port 6543 (transaction mode) untuk runtime query
DATABASE_URL="postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# DIRECT_URL: Direct/Session port 5432 untuk sinkronisasi skema DDL via npx prisma db push
DIRECT_URL="postgresql://postgres.[ref]:[pass]@aws-0-[region].supabase.com:5432/postgres"

# JWT Secret: Minimal 32 karakter acak (jangan gunakan placeholder contoh)
# Generate via: openssl rand -hex 32
JWT_SECRET="isi-dengan-kunci-rahasia-minimal-32-karakter-acak"

# Cloudflare R2 Storage (S3 API)
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
R2_BUCKET_NAME="mykost"
R2_PUBLIC_DOMAIN="https://your-r2-domain.dev"

# Fonnte WhatsApp API Token
FONNTE_API_TOKEN="token-fonnte-wa-anda"

# Cron Secret Token (Minimal 32 karakter acak)
CRON_SECRET="token-rahasia-untuk-cron-scheduler"
```

### 3. Pengecekan Duplikasi, Sinkronisasi Skema & Seed
Proyek ini mengadopsi alur tunggal berbasis **`prisma db push`** (tidak menggunakan `prisma migrate`):
```bash
# Periksa data duplikat sebelum penerapan unique constraint
npx tsx scripts/check-duplicates.ts

# Sinkronisasikan skema Prisma langsung ke database Supabase
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Jalankan seeder database (idempotent, password bcrypt terenkripsi, tanggal dinamis)
npx tsx prisma/seed.ts
```

### 4. Menjalankan Pengujian & Server Lokal
```bash
# Jalankan test suite unit Vitest
npm test

# Jalankan linter ESLint
npm run lint

# Verifikasi kompilasi TypeScript
npx tsc --noEmit

# Jalankan server development
npm run dev
```
Buka browser pada **`http://localhost:3000`**.

---

## ⏰ Cara Kerja Cron Otomatis (Vercel Cron)

Sistem cron dikonfigurasikan pada [vercel.json](vercel.json):
```json
{
  "crons": [
    {
      "path": "/api/cron/tagihan",
      "schedule": "0 1 * * *"
    }
  ]
}
```
1. **Jadwal Eksekusi**: Berjalan setiap hari pukul `01:00 UTC` (`08:00 WIB` waktu Jakarta).
2. **Keamanan**: Wajib menyertakan header `Authorization: Bearer <CRON_SECRET>`. Permintaan tanpa secret akan langsung ditolak (401 Unauthorized / *fail-closed*).
3. **Zona Waktu**: Seluruh penentuan "hari ini" dan perhitungan selisih hari jatuh tempo menggunakan zona waktu **Asia/Jakarta** (`Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' })`).
4. **Auto-Generate Awal Bulan**: Setiap tanggal 1 WIB, cron secara otomatis membuat tagihan periode baru untuk seluruh kontrak aktif yang belum memiliki tagihan.
5. **Skema Denda**: Menghitung denda secara dinamis berdasarkan pengaturan database (`HARIAN` atau `TETAP`).
6. **Anti-Spam 24 Jam**: Reminder WhatsApp hanya dikirim jika tagihan berada dalam jendela reminder dan belum pernah diingatkan dalam kurun waktu 24 jam terakhir.

---

## 🔑 Kredensial Akun Default (Hasil Seeder)

Untuk pengujian di lingkungan lokal setelah menjalankan `prisma/seed.ts`:

| Role | Email / Nomor HP | Kata Sandi | Keterangan Akses |
| :--- | :--- | :--- | :--- |
| **Owner** | `owner@mykost.com` | `password123` | Akses penuh dashboard pengelola & laporan keuangan |
| **Admin** | `admin@mykost.com` | `password123` | Pengelolaan kamar, onboarding, & verifikasi bayar |
| **Penghuni** | `dimas@gmail.com` / `081234567890` | `password123` | Akses portal PWA penghuni (Kamar 204) |

> ⚠️ **PENTING UNTUK PRODUKSI**: Segera ubah kata sandi akun default di atas melalui menu **Profil** → **Ganti Kata Sandi** setelah aplikasi di-deploy ke lingkungan produksi!

---

## 📁 Struktur Direktori Singkat

```
KostManagement/
├── docs/                # Dokumentasi arsitektur, flow, ERD, API, & operasional
│   ├── ARCHITECTURE.md
│   ├── USE_CASE_AND_FLOWS.md
│   ├── DATABASE_AND_STATE.md
│   ├── API_AND_SECURITY.md
│   └── DEPLOYMENT_AND_OPERATIONS.md
├── prisma/              # Skema basis data (schema.prisma) & script data seed
├── public/              # Manifest PWA, service worker, icons, dan aset statis
├── src/
│   ├── app/             # Next.js App Router (Halaman Owner, Penghuni, API Handlers)
│   ├── components/      # Komponen UI modular, layout sidebar/bottom-nav, & export Excel
│   └── lib/             # Helper fungsi: auth, RBAC, R2 upload, Fonnte WA, billing engine
├── vercel.json          # Konfigurasi scheduler Vercel Cron
└── package.json         # Konfigurasi dependensi proyek
```

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi **MIT**. Bebas dikembangkan dan disesuaikan untuk efisiensi dan keamanan manajemen properti sewa kost di Indonesia.
