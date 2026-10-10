# 🚀 Panduan Deployment & Operasional Sistem

Dokumen ini menyediakan panduan komprehensif untuk *setup*, *deployment*, serta operasional harian aplikasi **MyKost** di lingkungan *production* (Vercel, Supabase, Cloudflare R2, dan Fonnte WhatsApp API).

---

## 1. Arsitektur Lingkungan Produksi (*Production Architecture*)

Aplikasi MyKost mengadopsi prinsip *JAMstack / Serverless* bebas server fisik:

| Komponen | Layanan Rekomendasi | Peran & Deskripsi |
| :--- | :--- | :--- |
| **Compute / Frontend** | [Vercel](https://vercel.com) | Hosting Next.js App Router, Edge Caching, Serverless Functions, dan Vercel Cron. |
| **Relational Database** | [Supabase](https://supabase.com) | Managed PostgreSQL dengan PgBouncer Connection Pooler. |
| **Object Storage** | [Cloudflare R2](https://www.cloudflare.com/products/r2/) | S3-compatible storage untuk foto bukti transfer, foto kamar, dan berkas KTP (zero egress fee). |
| **WhatsApp Gateway** | [Fonnte](https://fonnte.com) | API gateway untuk broadcast pesan pengingat tagihan dan aktivasi akun. |

---

## 2. Matriks Environment Variables (`.env`)

Seluruh environment variable berikut **wajib dikonfigurasi** pada Vercel Dashboard (*Project Settings* → *Environment Variables*):

| Variabel | Contoh Nilai | Keterangan & Cara Mendapatkan |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true` | Supabase Connection String dengan port **6543** (Connection Pooler PgBouncer). |
| `DIRECT_URL` | `postgresql://postgres.[ref]:[pass]@aws-0-[region].supabase.com:5432/postgres` | Supabase Direct Connection String dengan port **5432** (Digunakan untuk Prisma migrate/push). |
| `JWT_SECRET` | `4f3a... (string acak minimal 32 karakter)` | Secret key untuk enkripsi cookie JWT. Generate via terminal: `openssl rand -hex 32` |
| `CRON_SECRET` | `8c1b... (string acak minimal 32 karakter)` | Token autentikasi request dari Vercel Cron. Generate via terminal: `openssl rand -hex 32` |
| `R2_ACCOUNT_ID` | `c4a17890bfe3...` | Cloudflare Account ID dari dashboard Cloudflare. |
| `R2_ACCESS_KEY_ID` | `9b3f112e...` | S3 Access Key ID dibuat di menu *R2* → *Manage R2 API Tokens*. |
| `R2_SECRET_ACCESS_KEY` | `d720a4...` | S3 Secret Access Key dari token yang sama. |
| `R2_BUCKET_NAME` | `mykost` | Nama bucket Cloudflare R2 yang dibuat. |
| `R2_PUBLIC_DOMAIN` | `https://pub-xxxxxx.r2.dev` | Domain publik R2 (atau kustom domain CDN yang dihubungkan ke bucket). |
| `FONNTE_API_TOKEN` | `A7b8c9d...` | Token akun Fonnte dari dashboard fonnte.com setelah menghubungkan nomor WA. |

---

## 3. Langkah Demi Langkah Deployment ke Produksi

### Langkah 1: Persiapan Database Supabase
1. Buat proyek baru di [Supabase Dashboard](https://supabase.com).
2. Masuk ke **Project Settings** → **Database**.
3. Di bagian **Connection String**:
   - Pilih tab **Transaction Pooler** (Mode: Transaction, Port: 6543) → Salin ke `DATABASE_URL`.
   - Pilih tab **Session** atau **Direct Connection** (Port: 5432) → Salin ke `DIRECT_URL`.
4. Jalankan sinkronisasi skema dari terminal lokal Anda:
   ```bash
   npx prisma db push
   ```

### Langkah 2: Persiapan Cloudflare R2 Storage
1. Buka dashboard Cloudflare → Menu **R2 Object Storage**.
2. Klik **Create Bucket** → Beri nama `mykost` (Location: Automatic / APAC).
3. Masuk ke tab **Settings** pada bucket tersebut:
   - Di bagian **Public Access**, aktifkan **R2.dev subdomain** atau sambungkan **Custom Domain** Anda.
   - Di bagian **CORS Policy**, tambahkan aturan CORS:
     ```json
     [
       {
         "AllowedOrigins": ["*"],
         "AllowedMethods": ["GET", "HEAD"],
         "AllowedHeaders": ["*"],
         "MaxAgeSeconds": 3600
       }
     ]
     ```
4. Buat kredensial API:
   - Masuk ke *Manage R2 API Tokens* → *Create API Token*.
   - Pilih izin: **Object Read & Write**.
   - Salin `Access Key ID` dan `Secret Access Key`.

### Langkah 3: Persiapan Akun Fonnte WhatsApp
1. Daftarkan akun di [Fonnte.com](https://fonnte.com).
2. Scan QR code WhatsApp pengelola kost untuk menghubungkan nomor pengirim.
3. Salin **API Token** dari dashboard Fonnte ke variabel `FONNTE_API_TOKEN`.

### Langkah 4: Deployment ke Vercel
1. Hubungkan repository GitHub [Zeinkunn/MyKostAPP](https://github.com/Zeinkunn/MyKostAPP.git) ke Vercel.
2. Atur **Production Branch** ke `main`.
3. Masukkan seluruh environment variable yang telah disiapkan pada poin 2 di atas.
4. Klik **Deploy**. Vercel akan otomatis mengeksekusi:
   - `prisma generate` (otomatis via script `postinstall` di `package.json`).
   - `next build` (menghasilkan optimized production build).

---

## 4. Konfigurasi Jadwal Otomatisasi (Vercel Cron)

Aplikasi MyKost telah dilengkapi berkas konfigurasi [vercel.json](file:///c:/Users/Zee/Documents/myproject/KostManagement/vercel.json) di root repository:

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

### Mekanisme Eksekusi:
- Jadwal `0 1 * * *` dieksekusi setiap hari pada pukul **01:00 UTC (08:00 Pagi WIB)**.
- Setiap tanggal 1, endpoint secara otomatis menerbitkan tagihan sewa bulanan untuk seluruh kontrak aktif.
- Setiap hari, endpoint memeriksa tagihan yang mendekati tanggal jatuh tempo atau terlambat, mengkalkulasi denda dinamis, dan mengirimkan pesan WhatsApp secara otomatis.
- Vercel Cron secara otomatis menyertakan header `Authorization: Bearer <CRON_SECRET>` saat memicu endpoint.

---

## 5. Prosedur Pemeliharaan & Troubleshooting (*Runbook*)

### 5.1. Error: Database Connection Timeout / Prisma P1001
- **Penyebab**: Serverless function kehabisan koneksi langsung ke PostgreSQL karena limit max connections terlampaui.
- **Solusi**: Pastikan `DATABASE_URL` menggunakan koneksi port **6543** dengan parameter `?pgbouncer=true`. Port 5432 hanya untuk `DIRECT_URL`.

### 5.2. Error: Upload Gambar Gagal (HTTP 400 / 500)
- **Penyebab**: File melebihi batas 5MB, format bukan JPEG/PNG/WEBP, atau kredensial R2 salah.
- **Solusi**:
  1. Periksa apakah `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, dan `R2_SECRET_ACCESS_KEY` sudah benar di Vercel.
  2. Pastikan file gambar berformat standar dan telah dikompresi otomatis oleh client.

### 5.3. Error: Cron Job Mengembalikan HTTP 401 Unauthorized
- **Penyebab**: `CRON_SECRET` di Vercel Dashboard belum di-set atau berbeda dengan secret yang dikirimkan.
- **Solusi**: Isi variabel `CRON_SECRET` di Vercel Settings → Environment Variables dengan string acak 32 karakter dan lakukan redeploy.

### 5.4. Mengamankan Akun Default Seed di Produksi
Jika script `prisma/seed.ts` pernah dijalankan secara manual pada database produksi:
1. Login menggunakan akun `owner@mykost.com` (password default: `password123`).
2. Masuk ke menu **Profil** → **Ganti Kata Sandi**.
3. Masukkan password baru yang kuat.
4. Ulangi hal yang sama untuk akun `admin@mykost.com`.
