# Arsitektur Awal SiLahar

## Tujuan tahap ini

Base project ini difokuskan untuk menyiapkan fondasi UI, state, dan skema database agar fitur berikutnya bisa ditambahkan bertahap tanpa refactor besar.

## Ruang lingkup yang sudah disiapkan

- React + TypeScript + Tailwind + Vite.
- Struktur UI responsif untuk split view desktop dan stacked view mobile.
- Halaman pengisian laporan dengan live review dokumen.
- Histori laporan dengan filter tanggal dan nama.
- Status pengisian harian berbasis daftar user terpantau.
- Cache draft menggunakan `localStorage`.
- Quick entry nama, typo hint, duplicate report detection hari ini.
- Export mock ke CSV dan dokumen Word sederhana.
- Placeholder client Supabase.

## Catatan penting

- Detail form saat ini masih placeholder modular karena file Excel acuan belum ada di workspace.
- Pengguna umum tidak login. Itu berarti keamanan edit-by-name di sisi client belum cukup aman untuk produksi.
- Untuk produksi, rekomendasi terbaik adalah menambahkan `edit_token` per laporan harian, atau menggunakan edge function yang membuat sesi edit terbatas.

## Struktur data frontend

- `DraftReport`: state input aktif yang di-autosave.
- `Report`: hasil final yang memuat metadata audit.
- `savedNames`: daftar nama quick entry.

## Arah integrasi Supabase

1. Hubungkan env `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
2. Jalankan file SQL pada `supabase/schema.sql`.
3. Ganti penyimpanan lokal ke query Supabase per fitur:
   - create/update laporan hari ini
   - pencarian histori
   - daftar nama pengisi
   - audit log
4. Tambahkan autentikasi admin dengan Supabase Auth.
5. Pindahkan export berat ke server bila format Word/Excel final menjadi kompleks.

## Catatan akses data

- `reporter_directory` diperlakukan sebagai master data dan tidak dibuka untuk write langsung oleh pengguna anonim.
- Penambahan atau pembaruan nama reporter dari alur submit laporan dilakukan melalui RPC `security definer` agar tetap kompatibel dengan RLS.
- Pendekatan ini dipilih agar anon tetap bisa submit laporan, tetapi write access ke tabel master tetap terkendali dan modular untuk kebutuhan admin di tahap berikutnya.
