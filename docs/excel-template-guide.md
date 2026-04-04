# Excel Template Guide

Dokumen ini menjelaskan cara menyiapkan template `.xlsx` agar kompatibel dengan export Excel client-side SiLahar.

## Template Aktif Saat Ini

Template acuan: `Template Laporan Harian.xlsx`

## Mapping Cell

| Data aplikasi | Cell template | Catatan |
| --- | --- | --- |
| Nama pelapor | `D5` | Cell hasil merge `D5:K5` |
| Hari / tanggal dokumen | `D6` | Cell hasil merge `D6:K6` |
| Nomor aktivitas | `B9`, `B10`, ... | Row `9` adalah template row yang diduplikasi |
| Detail aktivitas | `C9`, `C10`, ... | Merge ulang per row ke `C:H` |
| Jam mulai | `I9`, `I10`, ... |  |
| Separator waktu | `J9`, `J10`, ... | Diisi `-` oleh sistem |
| Jam selesai | `K9`, `K10`, ... | Sistem menambahkan suffix `WITA` |
| Foto dokumentasi | `L9:N9`, `L10:N10`, ... | Merge ulang per row ke `L:N` |
| Nama Koordinator Tim | `B17` + offset | Offset = jumlah aktivitas - 1 |
| NIP Koordinator Tim | `B18` + offset |  |
| Nama Kepala Bidang | `I17` + offset |  |
| Jabatan Kepala Bidang | `I18` + offset |  |
| NIP Kepala Bidang | `I19` + offset |  |
| Nomor catatan | `B21`, `B22`, ... + offset | Offset = jumlah aktivitas - 1 |
| Isi catatan | `C21`, `C22`, ... + offset |  |

## Aturan Baris Dinamis

- Row `9` adalah satu-satunya baris aktivitas yang dianggap sebagai `template row`.
- Jika aktivitas lebih dari 1, sistem menduplikasi row `9` sebanyak `jumlahAktivitas - 1` dengan mode `insert`, sehingga section `PERSETUJUAN` dan `CAT.` otomatis turun.
- Setelah row diduplikasi, sistem merge ulang `C:H` dan `L:N` pada setiap row aktivitas tambahan karena ExcelJS tidak otomatis membawa merge range ke row hasil duplicate.
- Notes mulai dari row `21` dan ikut digeser berdasarkan offset aktivitas.

## Penulisan Variabel di Template

Untuk template versi sekarang, sistem **tidak membaca placeholder string** seperti `{{nama}}` atau `${nama}` dari workbook. Nilai ditulis berdasarkan **alamat cell tetap** di kode mapper.

Jika ingin template tetap mudah dibaca editor:

- Boleh tulis placeholder deskriptif di cell target, misalnya `{{nama_pelapor}}` di `D5`, `{{hari_tanggal}}` di `D6`, `{{detail_aktivitas}}` di `C9`, dan `{{foto_dokumentasi}}` di `L9`.
- Saat export, placeholder itu akan ditimpa oleh data asli.
- Jangan mengubah posisi row `9`, `17`, dan `21` tanpa ikut memperbarui konstanta layout di `src/lib/excel/excelMapper.ts`.

## Jika Ingin Lebih Fleksibel

Kalau nanti template ingin bebas pindah layout tanpa ubah kode cell satu per satu, opsi terbaik adalah memakai **Named Range** Excel, misalnya:

- `reporter_name`
- `report_date_text`
- `activity_template_row`
- `approval_coordinator_name`
- `notes_start_row`

Namun implementasi saat ini masih coordinate-based agar lebih sederhana dan stabil terhadap template master yang sudah ada.
