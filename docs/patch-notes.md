# Patch Notes SiLahar

File ini dipakai untuk mencatat setiap batch perubahan pada project agar histori teknis dan fungsional tetap mudah dilacak.

## Format Pencatatan

Setiap patch sebaiknya ditulis dengan pola:

```md
## YYYY-MM-DD - Judul Patch

### Added
- Fitur baru yang ditambahkan.

### Changed
- Perubahan perilaku, UI, atau struktur data.

### Fixed
- Bug yang diperbaiki.

### Database
- Migration, policy, trigger, atau function SQL yang berubah.

### Notes
- Catatan deployment, risiko, atau langkah manual yang perlu dijalankan.
```

## 2026-04-03 - Public Any-Date Reports dan Admin Rules

### Added
- Input `Tanggal laporan` untuk pengguna publik saat rule database mengizinkan.
- Tab Admin dengan login Supabase Auth.
- Panel admin untuk mengatur `allowAnyReportDate` dan `maxPhotosPerActivity`.
- Migration `007_report_date_access_rules.sql`.
- Migration `008_fix_photo_rls_and_display_date_guard.sql`.

### Changed
- Teks `Hari / Tanggal dokumen` sekarang auto-generate dari `reportDate` yang dipilih user.
- Deteksi laporan duplikat dan load edit laporan kini berbasis tanggal yang dipilih, bukan selalu hari berjalan.
- Pesan sukses submit menyesuaikan hari dari `reportDate` laporan.
- Docs project rules, flows, dan architecture diperbarui mengikuti fitur admin dan rules tanggal.

### Fixed
- RLS insert/update foto aktivitas untuk laporan tanggal selain hari ini saat public any-date diaktifkan.
- Pencegahan manipulasi `display_date_text` dari inspect element dengan memaksa nilai itu dibentuk ulang di database dari `report_date`.
- Guard draft lokal agar ketika admin mematikan any-date, `reportDate` otomatis kembali ke hari berjalan.

### Database
- Menambahkan rule `allow_any_report_date` pada `app_settings.report_rules`.
- Menambahkan function `is_public_report_date_allowed(target_report_date date)`.
- Memperbarui policy `daily_reports`, `daily_report_activities`, dan `daily_report_activity_photos` agar mengikuti rule tanggal publik.
- Memperbarui trigger/function sinkronisasi `display_date_text` agar tidak mempercayai nilai dari client.

### Notes
- Setelah pull patch ini, jalankan migration `007` lalu `008` di Supabase.
- User admin Supabase Auth tetap harus dibuat dan dipetakan ke tabel `admin_profiles`.
- Build frontend sudah diverifikasi dengan `npm run build`.

## 2026-04-03 - Fix Recursive RLS Admin Profiles

### Fixed
- Error `stack depth limit exceeded` saat mengambil `admin_profiles` setelah login admin.

### Database
- Migration `009_fix_admin_profiles_rls_recursion.sql`.
- Function `public.is_admin()` dibuat `SECURITY DEFINER` dengan `search_path = public`.
- Policy `admin_profiles` ditambah rule baca profil sendiri langsung via `id = auth.uid()` agar tidak rekursif.

### Notes
- Jalankan migration `009` setelah `008`.

## 2026-04-03 - Realtime History/Status, Admin Delete, dan Optimasi Gambar

### Added
- Realtime subscription Supabase untuk `daily_reports`, `daily_report_activities`, `daily_report_activity_photos`, `reporter_directory`, dan `app_settings`.
- Badge `Baru ditambahkan` pada halaman Histori untuk laporan yang dibuat dalam 5 menit terakhir.
- Tombol `Delete` laporan di halaman Histori khusus untuk admin.
- Animasi spinner transisi pada label status pengisian saat status berubah.
- Image optimizer berbasis canvas yang mengecilkan sisi terpanjang gambar dan menyimpan hasil kompresi WebP jika ukuran lebih efisien.

### Changed
- Input `Tanggal laporan` di halaman Laporan hanya tampil untuk publik jika rule any-date aktif, dan selalu tampil untuk admin saat sesi admin aktif.
- Close panel `Cari laporan` hanya melalui tombol toggle, bukan klik luar area.
- Tooltip UI dirapikan agar konsisten di semua tema.
- Warna teks keterangan dan ringkasan di halaman Histori disesuaikan agar tetap terbaca pada mode gelap dan comfort.

### Fixed
- Pengguna publik tidak lagi bisa memaksa edit laporan lintas tanggal saat `allow_any_report_date` dimatikan.

### Notes
- Build frontend sudah diverifikasi dengan `npm run build`.

## 2026-04-03 - Fix Delete Report Audit FK Conflict

### Fixed
- Error `409 Conflict` saat admin menghapus laporan karena audit trigger mencoba menyimpan `report_id` yang parent row-nya sudah terhapus.

### Database
- Migration `010_fix_delete_report_audit_fk.sql`.
- `daily_report_audit_logs.report_id` dibuat nullable dan FK diubah ke `ON DELETE SET NULL`.
- Snapshot audit event `delete` kini menyimpan `deleted_report_id` dan payload `deleted_report`.

### Notes
- Jalankan migration `010` setelah `009`.

## 2026-04-03 - Navbar Slider dan Status Badge Transition

### Changed
- Badge status pengisian tidak lagi menyisakan ruang kosong di sisi spinner saat status sedang tidak berubah.
- Background aktif pada tab navbar sekarang bergeser mulus mengikuti halaman yang dibuka.
- Menambahkan sliding line indicator di bawah navbar saat posisi navbar dipindah ke kiri, kanan, atau kembali full/top.

### Notes
- Build frontend sudah diverifikasi dengan `npm run build`.

## 2026-04-03 - Navbar Position Button Breakpoint Sync

### Changed
- Tombol pindah posisi navbar hanya aktif saat halaman Laporan tampil dalam layout 2 kolom yang tidak menumpuk.
- Breakpoint desktop untuk rule navbar dan layout split laporan diselaraskan ke `768px`.
- Grid 2 kolom halaman Laporan dibuat lebih adaptif di tablet/desktop agar preview dan form tetap terbaca.

### Notes
- Build frontend sudah diverifikasi dengan `npm run build`.

## 2026-04-03 - Compact Icon Tabs dan Cheerfull Theme

### Changed
- `AppTabs` otomatis beralih ke mode ikon saat lebar container terlalu sempit, dan hanya menampilkan label pada tab yang sedang aktif.
- Wrapper navbar diperbaiki agar tab bar dapat mengecil dengan benar saat navbar berada di section kiri.
- Theme switcher mendapat efek slider pada mode aktif.
- Mode `comfort` diganti menjadi `cheerfull` dengan palet warna yang lebih segar namun tetap formal dan nyaman untuk aplikasi laporan.

### Notes
- Preferensi theme lama `comfort` otomatis dimigrasikan ke `cheerfull` di client.
- Build frontend sudah diverifikasi dengan `npm run build`.

## 2026-04-03 - Admin Kelola Pengguna Publik

### Added
- Menu Admin dipisah menjadi `Aturan laporan` dan `Kelola pengguna`.
- Admin dapat meninjau daftar pengguna publik yang pernah tercatat menggunakan sistem.
- Admin dapat mengubah nama pengguna publik, dan perubahan ikut diterapkan ke laporan terkait.
- Admin dapat menghapus jejak pengguna publik beserta laporan, status, dan file foto bukti terkait.
- Migration `011_admin_manage_reporter_directory.sql`.

### Changed
- Card sesi admin dipindahkan sejajar dengan header Panel Admin agar tampilan lebih compact.
- `schema.sql` disinkronkan dengan kolom tracking `reporter_directory` dan trigger normalisasi nama reporter.

### Notes
- Jalankan migration `011` di Supabase sebelum memakai fitur kelola pengguna.
- Build frontend sudah diverifikasi dengan `npm run build`.

## 2026-04-04 - Kerangka Export Excel Client-Side dan Template Management

### Added
- Kerangka export Excel client-side berbasis `exceljs`, `file-saver`, dan template master dari Supabase Storage.
- Util modular `src/lib/excel/cacheManager.ts`, `src/lib/excel/excelMapper.ts`, dan `src/lib/excel/excelGenerator.ts`.
- Service `src/lib/excel-template-service.ts` untuk baca daftar template, upload template, dan aktivasi template utama.
- Section Admin `Template Excel` untuk upload file `.xlsx`, set versi cache, dan memilih template aktif.
- Migration `012_excel_template_management.sql`.

### Changed
- Tombol export kini mengarah ke pembuatan Excel dari template aktif dan menampilkan status loading per laporan.
- Cache template Excel dipanaskan saat data dashboard dimuat agar download berikutnya lebih cepat.
- Realtime subscription ikut memantau perubahan `excel_report_templates`.

### Database
- Menambahkan tabel `excel_report_templates`, RLS policy admin/public, dan RPC `set_active_excel_report_template`.
- Menambahkan bucket Storage `report-excel-templates` beserta policy upload/read/delete yang dibatasi admin.
- `schema.sql` disinkronkan dengan struktur template Excel.

### Notes
- Jalankan migration `012` di Supabase.
- Mapping sel Excel di `excelMapper.ts` masih memakai layout awal dan bisa disesuaikan mengikuti struktur template master final.
- Build frontend sudah diverifikasi dengan `npm run build`.
