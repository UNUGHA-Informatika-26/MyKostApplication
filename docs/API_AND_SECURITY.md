# 🔒 API Reference & Arsitektur Keamanan

Dokumen ini mendokumentasikan spesifikasi seluruh endpoint REST API, mekanisme autentikasi dan otorisasi (*Role-Based Access Control*), serta langkah-langkah mitigasi keamanan (*security hardening*) yang diimplementasikan pada sistem **MyKost**.

---

## 1. Matriks Endpoint API (*API Reference Matrix*)

Semua endpoint backend berlokasi di direktori `src/app/api/` dan merespon dengan format JSON.

| Endpoint | Method | Proteksi Auth | Role yang Diizinkan | Deskripsi Singkat |
| :--- | :---: | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Publik | Semua (Bebas) | Autentikasi email & password, menerbitkan cookie `auth_token`. |
| `/api/auth/logout` | `POST` | Publik | Semua (Bebas) | Menghapus cookie `auth_token` untuk mengakhiri sesi. |
| `/api/auth/register` | `POST` | Publik | Semua (Bebas) | Registrasi mandiri akun penghuni baru. |
| `/api/kamar` | `GET` | Wajib Login | `OWNER`, `ADMIN`, `PENGHUNI` | Daftar kamar (otomatis sensor nomor HP penghuni lain untuk role `PENGHUNI`). |
| `/api/kamar` | `POST` | Wajib Role | `OWNER`, `ADMIN` | Tambah unit kamar baru beserta tipe, tarif, dan fasilitas. |
| `/api/penghuni` | `GET` | Wajib Role | `OWNER`, `ADMIN` | Daftar master data penghuni kost beserta kontak dan KTP. |
| `/api/kontrak` | `GET` | Wajib Login | `OWNER`, `ADMIN`, `PENGHUNI` | Daftar kontrak (penghuni hanya melihat kontrak miliknya). |
| `/api/kontrak` | `POST` | Wajib Role | `OWNER`, `ADMIN` | Onboarding penghuni & kontrak sewa, update kamar jadi TERISI, auto-generate invoice 1. |
| `/api/checkout` | `POST` | Wajib Role | `OWNER`, `ADMIN` | Eksekusi checkout penghuni, hitung potongan deposit, dan ubah kamar jadi KOSONG. |
| `/api/tagihan` | `GET` | Wajib Login | `OWNER`, `ADMIN`, `PENGHUNI` | Daftar tagihan sewa (penghuni hanya melihat tagihan miliknya). |
| `/api/tagihan` | `POST` | Wajib Role | `OWNER`, `ADMIN` | Trigger manual pembuatan invoice bulanan untuk seluruh kontrak aktif. |
| `/api/pembayaran` | `GET` | Wajib Role | `OWNER`, `ADMIN` | Daftar pembayaran yang perlu diverifikasi dan riwayat transaksi. |
| `/api/pembayaran` | `POST` | Wajib Login | `PENGHUNI`, `OWNER`, `ADMIN` | Upload bukti transfer ke R2 (IDOR protected: wajib pemilik tagihan). |
| `/api/pembayaran` | `PUT` | Wajib Role | `OWNER`, `ADMIN` | Verifikasi status pembayaran (`DISETUJUI` / `DITOLAK`) & auto-lunas tagihan. |
| `/api/pengaduan` | `GET` | Wajib Login | `OWNER`, `ADMIN`, `PENGHUNI` | Daftar keluhan (penghuni hanya melihat keluhan miliknya). |
| `/api/pengaduan` | `POST` | Wajib Login | `PENGHUNI` | Buat tiket pengaduan kerusakan fasilitas baru (+ foto lampiran). |
| `/api/pengaduan` | `PUT` | Wajib Role | `OWNER`, `ADMIN` | Update status komplain (`BARU` → `DIPROSES` → `SELESAI`) & catatan internal. |
| `/api/cron/tagihan` | `GET` | Bearer Token | Sistem Cron | Otomasi tagihan (tiap tgl 1), update denda keterlambatan, & reminder WA. |
| `/api/users` | `GET` | Wajib Role | `OWNER`, `ADMIN` | Daftar akun pengelola kost. |
| `/api/users` | `POST` | Wajib Role | `OWNER`, `ADMIN` | Tambah akun pengelola baru (Hanya role `OWNER` atau `ADMIN` yang diizinkan). |
| `/api/users/password`| `PUT` | Wajib Login | Semua Role (Milik Sendiri) | Penggantian kata sandi akun pengguna yang sedang login. |
| `/api/notifikasi` | `GET` | Wajib Login | Semua Role (Milik Sendiri) | Mengambil daftar notifikasi in-app untuk pengguna saat ini. |
| `/api/log` | `GET` | Wajib Role | `OWNER`, `ADMIN` | Mengambil jejak audit (*audit trail*) aktivitas operasional. |
| `/api/pengaturan` | `GET` | Wajib Role | `OWNER`, `ADMIN` | Mengambil pengaturan tarif denda harian dan template pesan WhatsApp. |
| `/api/pengaturan` | `PUT` | Wajib Role | `OWNER` | Mengubah tarif denda harian dan template pesan WhatsApp. |

---

## 2. Mekanisme Autentikasi & Sesi (*Authentication Architecture*)

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna
    participant Frontend as Web PWA
    participant API as POST /api/auth/login
    participant DB as Supabase PostgreSQL

    User->>Frontend: Masukkan Email/HP & Password
    Frontend->>API: Request Login { email, password }
    API->>DB: Query User berdasarkan email
    API->>API: Verifikasi bcrypt.compare(password, password_hash)
    alt Password Cocok
        API->>API: Generate JWT via jose (Payload: id, email, role, exp: 7 hari)
        API-->>Frontend: Set-Cookie: auth_token=jwt_val; HttpOnly; Secure; SameSite=Lax; Path=/
        API-->>Frontend: Response 200 { user, redirectUrl }
        Frontend-->>User: Redirect ke Dashboard sesuai Role
    else Password Salah / User Tidak Ada
        API-->>Frontend: Response 401 { error: "Kredensial tidak valid" }
        Frontend-->>User: Tampilkan pesan kesalahan
    end
```

### Karakteristik Token JWT:
- **Pustaka**: `jose` (ringan dan kompatibel dengan Edge / Serverless Runtime).
- **Masa Berlaku**: 7 hari (`7d`).
- **Enkripsi Kunci Rahasia**: Wajib disuplai melalui environment variable `JWT_SECRET` dengan panjang **minimal 32 karakter**. Jika tidak ada atau kurang dari 32 karakter, aplikasi akan *fail-fast* saat inisialisasi untuk mencegah eksploitasi kunci default.
- **Penyimpanan**: Disimpan di cookie browser dengan flag `HttpOnly: true` (tidak dapat diakses oleh script JavaScript client-side, terlindung dari serangan XSS).

---

## 3. Otorisasi & Role-Based Access Control (RBAC)

Pengecekan hak akses diimplementasikan secara tersentralisasi pada [src/lib/rbac.ts](file:///c:/Users/Zee/Documents/myproject/KostManagement/src/lib/rbac.ts):

```typescript
// 1. Memeriksa apakah request memiliki sesi login yang valid
export async function requireAuthApi(): Promise<JWTPayload>;

// 2. Memeriksa apakah pengguna memiliki salah satu role yang diizinkan
export async function requireRoleApi(allowedRoles: Role[]): Promise<JWTPayload>;
```

Jika autentikasi atau otorisasi gagal, fungsi melemparkan error `ApiAuthError` yang secara otomatis dikembalikan sebagai:
- **401 Unauthorized**: Pengguna belum login atau token sudah kedaluwarsa.
- **403 Forbidden**: Pengguna login, tetapi role tidak memiliki hak akses (misal: Penghuni mencoba mengakses rute Owner/Admin).

---

## 4. Perlindungan & Penguatan Keamanan (*Security Hardening*)

Aplikasi MyKost menerapkan serangkaian lapisan pengamanan proaktif:

### 4.1. Pencegahan IDOR (*Insecure Direct Object Reference*)
- **Masalah**: Penghuni jahat mencoba melihat atau membayar tagihan penghuni lain dengan mengganti parameter `tagihan_id`.
- **Mitigasi di [src/app/api/pembayaran/route.ts](file:///c:/Users/Zee/Documents/myproject/KostManagement/src/app/api/pembayaran/route.ts)**:
  ```typescript
  if (session.role === Role.PENGHUNI) {
    if (tagihan.kontrak.penghuni.user_id !== session.id) {
      throw new ApiAuthError('Anda tidak memiliki akses untuk membayar tagihan ini', 403);
    }
  }
  ```
- **Mitigasi di [src/app/api/tagihan/route.ts](file:///c:/Users/Zee/Documents/myproject/KostManagement/src/app/api/tagihan/route.ts)**:
  Filter otomatis di level database berdasarkan `session.id` penghuni yang sedang login.

### 4.2. Proteksi Fail-Closed Endpoint Cron Job
- **Masalah**: Endpoint cron yang terbuka untuk publik dapat disalahgunakan untuk spam reminder WhatsApp dan pengacauan denda keterlambatan.
- **Mitigasi di [src/app/api/cron/tagihan/route.ts](file:///c:/Users/Zee/Documents/myproject/KostManagement/src/app/api/cron/tagihan/route.ts)**:
  ```typescript
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  ```
  Prinsip **Fail-Closed**: Jika variabel `CRON_SECRET` belum di-set di server produksi, endpoint akan **menolak seluruh request**, bukan membiarkannya terbuka ke publik.

### 4.3. Validasi & Sanitasi Berkas Unggahan (*File Upload Hardening*)
- **Pustaka**: Terpusat pada [src/lib/r2.ts](file:///c:/Users/Zee/Documents/myproject/KostManagement/src/lib/r2.ts).
- **Validasi Ukuran**: Dibatasi maksimal **5 MB** per berkas.
- **Validasi Format (MIME Type)**: Hanya menerima tipe gambar resmi:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
- **Sanitasi Nama Berkas**: Berkas yang diunggah tidak menggunakan nama asli pengguna, melainkan digenerate menggunakan format acak `uploads/${Date.now()}-${randomUUID()}.${ext}` untuk mencegah serangan *Path Traversal*.

### 4.4. Penutupan Kebocoran Data Pribadi (*Data Masking*)
- Pada endpoint publik/kamar [src/app/api/kamar/route.ts](file:///c:/Users/Zee/Documents/myproject/KostManagement/src/app/api/kamar/route.ts):
  Jika pengguna yang melakukan request adalah role `PENGHUNI`, kolom nomor HP (`no_hp`) milik penghuni lain pada kamar yang terisi otomatis **disensor/dihapus** dari response JSON untuk melindungi privasi sesama penghuni kost.

### 4.5. Validasi Role Tambah User
- Pada endpoint [src/app/api/users/route.ts](file:///c:/Users/Zee/Documents/myproject/KostManagement/src/app/api/users/route.ts):
  Request pembuatan user baru divalidasi secara ketat dan **hanya menerima** role `OWNER` atau `ADMIN`. Upaya pembuatan akun dengan role sembarang akan ditolak dengan `400 Bad Request`.

### 4.6. Jejak Audit Administratif (*Audit Trail Logging*)
- Setiap tindakan penting oleh pengelola dicatat ke tabel `LogAktivitas`:
  - Onboarding penghuni & penerbitan kontrak sewa.
  - Verifikasi (persetujuan / penolakan) pembayaran.
  - Perubahan status penanganan komplain kamar.
  - Proses checkout penghuni dan pemotongan deposit.
  - Penambahan user pengelola baru.
