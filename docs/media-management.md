# Pengelolaan media gambar

Halaman **Pengaturan → Media gambar** mengaudit bucket SiLahar yang sudah ada:

- `daily-report-proofs`: foto aktivitas dan tanda tangan yang menggunakan lokasi fallback.
- `official-signatures`: gambar tanda tangan pejabat.

Sumber keterkaitan adalah `daily_report_activity_photos`, relasi aktivitas/laporan, `team_types.signature_url`, dan `report_template_approvers.signature_url`. Referensi pejabat/tim yang tidak aktif juga tetap dilindungi. Tidak ada integrasi Google Sheets atau bucket contoh dari aplikasi lain.

## Pemindaian dan klasifikasi

Daftar storage dibaca rekursif, termasuk gambar di root dan folder dengan lebih dari 1.000 objek. Ukuran berasal dari metadata gambar; angka ini bukan kuota seluruh proyek Supabase. Metadata dipertahankan di `sessionStorage` selama lima menit, terpisah per proyek, administrator, dan bucket. Tombol **Pindai ulang** melewati cache.

Referensi database selalu dibaca ulang saat halaman dimuat dan sebelum menghapus. Normalisasi mempertahankan path lengkap serta casing, menguraikan URL public/signed, dan menangani percent encoding. Referensi yang hanya berupa nama berkas diperlakukan konservatif: seluruh gambar dengan nama tersebut dilindungi. Jika salah satu sumber referensi gagal, hasil audit tidak dianggap lengkap dan penghapusan dinonaktifkan.

## Operasi oleh administrator

- Pencarian mencakup nama/path gambar, pelapor, tanggal, dan ID laporan.
- Tampilan grid/tabel, urutan, serta paginasi 12/24/48 berkas.
- Pilihan per halaman dapat diteruskan ke halaman berikutnya; jumlah pilihan di halaman lain ditampilkan. Mengganti pencarian/filter/bucket membersihkan pilihan.
- **Pilih semua orphan** memilih seluruh hasil audit orphan dalam bucket aktif.
- Pratinjau menampilkan metadata dan daftar referensi. Bucket privat memakai tautan sementara lima menit.
- Arsip ZIP laporan berisi gambar yang dirujuk laporan serta manifest; penghapusan hanya berada pada daftar Media gambar.

Penghapusan orphan meminta konfirmasi. Penghapusan yang mencakup gambar terkait data memverifikasi password akun Supabase Auth administrator aktif melalui client sementara, tanpa mengganti sesi utama. Tidak ada password master atau pengecekan password dari localStorage. Penghapusan tidak mengubah baris laporan; administrator diberi penjelasan bahwa gambar pada laporan terkait tidak akan dapat ditampilkan lagi.

Penghapusan berjalan dalam batch 50 berkas. Hanya nama berkas yang dikonfirmasi API Storage dihitung berhasil. Kegagalan parsial tetap terlihat dan dapat dipilih ulang. Izin operasi tetap mengikuti RLS Storage yang berlaku pada proyek; verifikasi tambahan ini diterapkan pada alur pengelolaan media di aplikasi. Tidak ada policy atau migrasi database yang diubah oleh fitur ini.

## Validasi lokal tanpa data asli

```sh
npm run test:media
npm run build
```

Pengujian layanan menggunakan adapter Supabase di memori dan tidak melakukan request jaringan. Pengujian UI memakai endpoint fiktif dan intersepsi seluruh request API/gambar. Implementasi kode tidak menjalankan CRUD terhadap database atau storage asli; operasi tersebut dijalankan administrator melalui aplikasi.
