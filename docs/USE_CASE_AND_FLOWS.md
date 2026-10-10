# 📋 Use Case, Alur Bisnis, & Activity Diagram

Dokumen ini memetakan seluruh aktor, *use case*, diagram alir bisnis (*flowchart*), serta diagram aktivitas (*activity diagram*) pada sistem **MyKost**.

---

## 1. Definisi Aktor & Matriks Hak Akses

Sistem MyKost melibatkan 4 aktor utama (3 aktor manusia dan 1 aktor sistem):

| Aktor | Deskripsi Peran | Hak Akses Utama |
| :--- | :--- | :--- |
| **Owner (Pemilik Kost)** | Pemilik properti kost dengan otoritas tertinggi operasional dan finansial. | Akses penuh dashboard, seluruh properti/kamar, verifikasi pembayaran, laporan laba rugi, penyesuaian tarif, dan manajemen akun pengelola (tambah/hapus Admin). |
| **Admin (Pengelola)** | Petugas operasional harian yang mengelola kamar, penghuni, dan keluhan. | Manajemen kamar, onboarding penghuni, input kontrak, verifikasi pembayaran, respon pengaduan, dan monitoring tagihan. Tidak bisa mengubah kepemilikan properti utama. |
| **Penghuni (Tenant)** | Penyewa kamar kost yang menggunakan aplikasi PWA di perangkat seluler. | Melihat info kamar & sisa masa sewa, melihat tagihan, mengunggah bukti pembayaran, mengajukan komplain maintenance (+ foto), dan mengunduh kwitansi lunas. |
| **Sistem / Cron Job** | Layanan otomasi terjadwal yang dipicu secara periodik oleh Vercel Cron. | Men-generate tagihan sewa bulanan otomatis pada tanggal 1 tiap bulan, mengalkulasi denda keterlambatan dinamis, dan mengirimkan reminder WhatsApp. |

---

## 2. Diagram Use Case (*Use Case Diagram*)

```mermaid
flowchart LR
    subgraph Aktor ["Aktor Pengguna"]
        Owner(("🏢 Owner"))
        Admin(("👨‍💼 Admin"))
        Penghuni(("📱 Penghuni"))
        Cron(("⏱️ Sistem Cron"))
    end

    subgraph ModulAuth ["Autentikasi & Akun"]
        UC_Login["Login Akun (Email/HP)"]
        UC_GantiPass["Ganti Password Akun"]
        UC_ManageUser["Kelola Akun Admin/Owner"]
    end

    subgraph ModulKamar ["Kamar & Onboarding"]
        UC_KelolaKamar["Kelola Unit Kamar & Tarif"]
        UC_Onboard["Onboarding Penghuni & Kontrak"]
        UC_Checkout["Proses Checkout & Deposit"]
    end

    subgraph ModulTagihan ["Keuangan & Tagihan"]
        UC_GenTagihan["Generate Tagihan Bulanan"]
        UC_LihatTagihan["Lihat Rincian Tagihan"]
        UC_Bayar["Upload Bukti Pembayaran"]
        UC_Verifikasi["Verifikasi Bukti Transfer"]
        UC_Kwitansi["Unduh Kwitansi Digital Lunas"]
        UC_Laporan["Lihat & Export Laporan Keuangan"]
    end

    subgraph ModulPengaduan ["Komplain & Maintenance"]
        UC_BuatKomplain["Ajukan Komplain (+ Foto)"]
        UC_TindakKomplain["Update Status & Catatan Komplain"]
        UC_PantauKomplain["Pantau Progres Penanganan"]
    end

    subgraph ModulOtomasi ["Notifikasi & Otomasi"]
        UC_AutoBill["Auto-Generate Invoice (Tgl 1)"]
        UC_ReminderWA["Broadcast Reminder WA Tagihan"]
        UC_AuditLog["Catat Jejak Audit (Log)"]
    end

    %% Relasi Owner
    Owner --> UC_Login
    Owner --> UC_GantiPass
    Owner --> UC_ManageUser
    Owner --> UC_KelolaKamar
    Owner --> UC_Onboard
    Owner --> UC_Checkout
    Owner --> UC_GenTagihan
    Owner --> UC_Verifikasi
    Owner --> UC_Laporan
    Owner --> UC_TindakKomplain

    %% Relasi Admin
    Admin --> UC_Login
    Admin --> UC_GantiPass
    Admin --> UC_KelolaKamar
    Admin --> UC_Onboard
    Admin --> UC_Checkout
    Admin --> UC_GenTagihan
    Admin --> UC_Verifikasi
    Admin --> UC_Laporan
    Admin --> UC_TindakKomplain

    %% Relasi Penghuni
    Penghuni --> UC_Login
    Penghuni --> UC_GantiPass
    Penghuni --> UC_LihatTagihan
    Penghuni --> UC_Bayar
    Penghuni --> UC_Kwitansi
    Penghuni --> UC_BuatKomplain
    Penghuni --> UC_PantauKomplain

    %% Relasi Cron
    Cron --> UC_AutoBill
    Cron --> UC_ReminderWA

    %% Jejak Audit Include
    UC_Verifikasi -.-> |include| UC_AuditLog
    UC_Onboard -.-> |include| UC_AuditLog
    UC_Checkout -.-> |include| UC_AuditLog
    UC_TindakKomplain -.-> |include| UC_AuditLog
```

---

## 3. Alur Bisnis Utama (*Business Flows*)

### 3.1. Alur 1: Onboarding Penghuni & Pembuatan Kontrak (Alur 6.1)
Alur ketika ada penghuni baru yang mendaftar dan menyewa kamar kost.

```mermaid
flowchart TD
    Start([Calon Penghuni Datang / Booking]) --> InputForm[Pengelola input data diri, KTP, nomor HP, & pilih Kamar kosong]
    InputForm --> CheckKamar{Status Kamar Kosong?}
    CheckKamar -- Tidak --> PilihLain[Pilih unit kamar yang berstatus KOSONG] --> InputForm
    CheckKamar -- Ya --> SubmitOnboard[Kirim form Onboarding ke /api/kontrak]
    
    SubmitOnboard --> CreateEntities[Sistem membuat record Penghuni & Kontrak baru]
    CreateEntities --> UpdateKamar[Ubah status Kamar menjadi TERISI]
    UpdateKamar --> GenFirstBill[Otomatis terbitkan Tagihan Bulan Pertama]
    GenFirstBill --> CreateAccount[Buat akun User Penghuni jika belum ada]
    CreateAccount --> SendWA[Kirim WhatsApp Onboarding otomatis ke Penghuni]
    SendWA --> LogAudit[Catat aktivitas ke LogAktivitas]
    LogAudit --> Selesai([Penghuni resmi terdaftar & dapat login])
```

---

### 3.2. Alur 2: Otomatisasi Tagihan Bulanan & Reminder WA (Cron Job)
Alur otomatisasi yang dijalankan setiap hari oleh scheduler Vercel Cron.

```mermaid
flowchart TD
    TriggerCron([Vercel Cron memicu GET /api/cron/tagihan]) --> CheckAuth{Bearer Token == CRON_SECRET?}
    CheckAuth -- Salah / Kosong --> Reject401[Tolak Request: 401 Unauthorized]
    CheckAuth -- Valid --> CheckDate{Hari ini Tanggal 1?}
    
    CheckDate -- Ya --> GenBills[Panggil generateMonthlyBills: Buat tagihan periode ini untuk seluruh Kontrak AKTIF yang belum punya tagihan]
    CheckDate -- Tidak --> FetchUnpaid[Ambil seluruh tagihan berstatus BELUM_BAYAR atau TERLAMBAT]
    GenBills --> FetchUnpaid

    FetchUnpaid --> LoopTagihan[Iterasi setiap tagihan yang belum lunas]
    LoopTagihan --> CheckDueDate{Hari ini > Jatuh Tempo?}
    
    CheckDueDate -- Ya --> UpdateTerlambat[Set status TERLAMBAT & tambahkan denda dinamis sesuai Pengaturan]
    UpdateTerlambat --> SendOverdueWA[Kirim template WA: Peringatan Terlambat + Denda]
    
    CheckDueDate -- Tidak --> SendReminderWA[Kirim template WA: Reminder Tagihan Menjelang Jatuh Tempo]
    
    SendOverdueWA --> NextTagihan{Ada tagihan berikutnya?}
    SendReminderWA --> NextTagihan
    NextTagihan -- Ya --> LoopTagihan
    NextTagihan -- Tidak --> ReturnCronResponse[Kembalikan JSON sukses & jumlah WA terkirim]
```

---

### 3.3. Alur 3: Siklus Pembayaran & Verifikasi Transfer (Alur 6.2)
Alur pengunggahan bukti transfer oleh penghuni hingga verifikasi oleh admin/owner.

```mermaid
flowchart TD
    P_Start([Penghuni buka detail Tagihan]) --> P_Upload[Pilih metode transfer & foto resi pembayaran]
    P_Upload --> P_Compress[Kompres gambar client-side via browser-image-compression]
    P_Compress --> P_Submit[Kirim FormData ke POST /api/pembayaran]
    
    P_Submit --> IDOR_Check{Tagihan milik user yang login?}
    IDOR_Check -- Bukan Miliknya --> Reject403[HTTP 403 Forbidden: IDOR Protected]
    IDOR_Check -- Valid --> UploadR2[Simpan file ke Cloudflare R2 Bucket]
    
    UploadR2 --> CreatePembayaran[Buat record Pembayaran dengan status_verifikasi: PENDING]
    CreatePembayaran --> NotifyAdmin[Kirim notifikasi in-app ke Owner & Admin]
    
    NotifyAdmin --> AdminReview[Admin buka menu Verifikasi Pembayaran]
    AdminReview --> AdminDecision{Keputusan Verifikasi?}
    
    AdminDecision -- Approve / Setujui --> ApproveTx[Jalankan Prisma Transaction: Update Pembayaran DISETUJUI & Tagihan LUNAS]
    AdminDecision -- Reject / Tolak --> RejectTx[Update Pembayaran DITOLAK]
    
    ApproveTx --> NotifyPenghuniLunas[Kirim WA & Notifikasi In-App: Pembayaran LUNAS]
    RejectTx --> NotifyPenghuniTolak[Kirim WA & Notifikasi In-App: Pembayaran DITOLAK]
    
    NotifyPenghuniLunas --> LogVerif[Catat aksi ke LogAktivitas]
    NotifyPenghuniTolak --> LogVerif
    LogVerif --> KwitansiReady([Penghuni dapat melihat kwitansi digital lunas])
```

---

### 3.4. Alur 4: Pengaduan Fasilitas / Maintenance & Resolusi (Alur 6.3)
Alur pelaporan kerusakan fasilitas kost hingga selesai ditangani.

```mermaid
flowchart TD
    T_Start([Penghuni menemukan kerusakan fasilitas]) --> T_Form[Buka menu Komplain Baru]
    T_Form --> T_Input[Pilih kategori, tulis deskripsi, lampirkan foto kerusakan]
    T_Input --> T_Upload[Upload ke R2 & simpan Pengaduan dengan status: BARU]
    T_Upload --> T_NotifAdmin[Kirim notifikasi in-app ke Owner/Admin]
    
    T_NotifAdmin --> AdminInspect[Admin melihat daftar pengaduan & meninjau foto]
    AdminInspect --> AdminProcess[Admin menugaskan teknisi & ubah status jadi DIPROSES]
    AdminProcess --> NotifProses[Penghuni menerima notifikasi status: DIPROSES]
    
    NotifProses --> RepairDone[Teknisi menyelesaikan perbaikan di kamar]
    RepairDone --> AdminResolve[Admin isi catatan internal & ubah status jadi SELESAI]
    AdminResolve --> SetResolvedAt[Simpan resolved_at timestamp & audit log]
    SetResolvedAt --> NotifSelesai([Penghuni menerima notifikasi: Komplain SELESAI])
```

---

### 3.5. Alur 5: Checkout Penghuni & Pengembalian Deposit
Alur ketika masa sewa penghuni berakhir dan keluar dari kost.

```mermaid
flowchart TD
    C_Start([Masa sewa habis / Penghuni mengajukan checkout]) --> C_CheckTagihan{Ada tagihan belum lunas?}
    C_CheckTagihan -- Ya --> SelesaikanTagihan[Lunasi seluruh tunggakan terlebih dahulu] --> C_CheckTagihan
    C_CheckTagihan -- Tidak --> InspeksiKamar[Pengelola inspeksi fisik kamar & fasilitas]
    
    InspeksiKamar --> AdaKerusakan{Ada kerusakan / denda?}
    AdaKerusakan -- Ya --> HitungPotongan[Hitung nominal potongan deposit & tulis catatan]
    AdaKerusakan -- Tidak --> FullDeposit[Potongan deposit = Rp 0]
    
    HitungPotongan --> ExecuteCheckout[Eksekusi Checkout via POST /api/checkout]
    FullDeposit --> ExecuteCheckout
    
    ExecuteCheckout --> DBUpdate[Update Kontrak: SELESAI, simpan tanggal_checkout & potongan]
    DBUpdate --> ResetKamar[Ubah status Kamar menjadi KOSONG]
    ResetKamar --> ReturnDeposit[Kembalikan sisa deposit ke rekening Penghuni]
    ReturnDeposit --> LogCheckout[Catat aktivitas ke LogAktivitas]
    LogCheckout --> C_End([Kamar siap disewakan kembali ke penghuni baru])
```

---

## 4. Diagram Aktivitas (*Activity Diagram*)

### Activity Diagram: Verifikasi Pembayaran oleh Pengelola

```mermaid
sequenceDiagram
    autonumber
    actor Penghuni as 📱 Penghuni
    participant ClientApp as PWA Frontend
    participant ServerAPI as Next.js API (/api/pembayaran)
    participant Storage as Cloudflare R2
    participant Database as Supabase PostgreSQL
    actor Admin as 🏢 Pengelola (Admin/Owner)

    Penghuni->>ClientApp: Buka tagihan & pilih bayar
    Penghuni->>ClientApp: Ambil foto struk / pilih dari galeri
    ClientApp->>ClientApp: Kompresi gambar client-side (<1MB)
    ClientApp->>ServerAPI: POST /api/pembayaran (FormData)
    ServerAPI->>Database: Validasi kepemilikan tagihan (IDOR Protection)
    ServerAPI->>Storage: Upload buffer gambar ke bucket R2
    Storage-->>ServerAPI: Kembalikan URL publik berkas
    ServerAPI->>Database: Simpan record Pembayaran (status: PENDING)
    ServerAPI->>Database: Buat notifikasi in-app untuk Admin
    ServerAPI-->>ClientApp: Response 201 Created
    ClientApp-->>Penghuni: Tampilkan status "Menunggu Verifikasi"

    Admin->>ClientApp: Buka menu Verifikasi Pembayaran
    ClientApp->>ServerAPI: GET /api/pembayaran
    ServerAPI->>Database: Fetch pembayaran status PENDING
    ServerAPI-->>ClientApp: List pembayaran
    Admin->>ClientApp: Klik "Setujui Pembayaran"
    ClientApp->>ServerAPI: PUT /api/pembayaran { id, status_verifikasi: "DISETUJUI" }
    ServerAPI->>Database: Prisma Transaction (Pembayaran: DISETUJUI & Tagihan: LUNAS)
    ServerAPI->>ServerAPI: Kirim WhatsApp Lunas ke Penghuni via Fonnte
    ServerAPI->>Database: Buat Notifikasi in-app Penghuni & Audit Log
    ServerAPI-->>ClientApp: Response 200 OK
    ClientApp-->>Admin: Tampilkan status "Disetujui"
    ClientApp-->>Penghuni: Kwitansi resmi lunas terbit
```
