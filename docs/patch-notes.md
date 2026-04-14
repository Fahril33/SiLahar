
## 2026-04-14 - Overwrite Warning dan Optimasi Komponen Anchored Warning

### Added
- Peringatan kontekstual `AnchoredInlineWarning` pada tombol **Simpan** untuk mencegah tindakan *overwrite* laporan yang tidak disengaja saat pengguna mengganti nama.
- Dukungan properti `placement` (left/right), `gap`, dan `maxWidth` pada komponen warning agar lebih modular dan adaptif terhadap posisi tombol induk.
- Fitur Popover Patch Notes pada footer form (ikon Info) untuk memudahkan pengguna melihat riwayat pembaruan aplikasi secara langsung.

### Changed
- Refaktor UI `AnchoredInlineWarning`: mendukung 2 baris summary, teks "Lihat selengkapnya" tetap terlihat, dan proteksi *overflow*.
- Pesan peringatan overwrite rename dibuat lebih sopan dan edukatif.
- UI Patch Notes diperbarui agar lebih ringan, bersih, dan informatif dengan sistem pembagi antar sesi.

### Notes
- Komponen warning menggunakan `fixed` positioning dengan proteksi *clamp* terhadap batas layar.

## 2026-04-06 - Draft Lokal Bertumpuk dan Normalisasi Nama

### Added
- Sistem `draft lokal` bertumpuk berbasis `IndexedDB` untuk menyimpan progres laporan secara manual, terpisah dari cache utama.
- Antrean upload draft lokal ke database di background dengan notifikasi real-time.

### Changed
- Split button pada aksi `Simpan` dan `Print` untuk akses cepat ke fitur draf dan pilihan ukuran kertas.
- Aturan nama pelapor diseleraskan: casing input terakhir dipertahankan untuk tampilan, namun pencarian tetap case-insensitive.
- Header preview laporan disederhanakan pada tampilan mobile.

### Fixed
- Pencegahan duplikasi laporan saat mengubah tanggal pada mode edit; perubahan kini diperlakukan sebagai pemindahan record.
- Perbaikan keandalan Print preview agar selalu mematerialisasi gambar foto aktivitas.

## 2026-04-05 - Pejabat Default, UX Foto, dan Sinkronisasi Suara

### Added
- Tabel `report_template_approvers` untuk menyimpan default pejabat per template laporan (Koordinator & Kasubag).
- Tombol `restore` dan `kosongkan foto` pada form aktivitas untuk fleksibilitas pengelolaan dokumentasi.
- Flag kontrol suara global (`show_admin_sound_settings` & `disable_sound_responses_for_all_users`).

### Changed
- Form laporan mengambil data pejabat default langsung dari database, bukan lagi nilai statis di client.
- Progress simpan laporan membedakan visualisasi antara upload foto baru dan memproses foto lama.
- Toast SweetAlert kini bersifat non-blocking dan menampilkan progress bertahap yang lebih informatif.

### Fixed
- Perbaikan relasi foto saat edit laporan: foto lama tetap dipertahankan jika tidak diubah oleh pengguna.
- Sinkronisasi suara alert kini bersifat global untuk seluruh pengguna melalui konfigurasi di database.
- Perbaikan error audit log (FK Conflict) saat menghapus laporan.

## 2026-04-04 - Export Excel Client-Side dan UX Admin

### Added
- Kerangka export Excel client-side berbasis `exceljs` dan `file-saver` menggunakan template master dari Supabase Storage.
- Panel Admin `Template Excel` untuk mengelola file `.xlsx` dan aktivasi template utama.
- Filter rentang waktu interaktif pada grafik aktivitas pengguna di dashboard admin.

### Changed
- Sinkronisasi status halaman terakhir (`active-view`) ke local storage agar posisi user terjaga saat refresh.
- Toolbar admin dioptimasi untuk perangkat mobile dengan sistem pencarian inline.

## 2026-04-03 - Real-Time Dashboard dan Fondasi Admin Rules

### Added
- Real-time subscription Supabase untuk semua tabel utama (Reports, Activities, Photos, Directory, Settings).
- Badge `Baru ditambahkan` pada laporan histori yang masuk dalam 5 menit terakhir.
- Panel aturan laporan awal: `allowAnyReportDate` dan `maxPhotosPerActivity`.

### Changed
- input `Tanggal laporan` mendukung pemilihan tanggal lampau jika diizinkan oleh admin via database rules.
- Mekanisme tab navbar menggunakan slider transisi yang mulus.
- Tema `comfort` diperbarui menjadi `cheerfull` dengan palet warna yang lebih segar.

### Fixed
- Perbaikan rekursi RLS pada profil admin yang menyebabkan error stack depth.
- RLS insert/update foto diperketat untuk mengikuti aturan tanggal publik.
