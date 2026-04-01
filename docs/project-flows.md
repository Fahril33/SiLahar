# Project Flows

- User membuka halaman isi laporan.
- Sistem menampilkan daftar nama yang pernah tercatat mengisi laporan.
- User mengetik nama.
- Sistem melakukan pengecekan async ke database apakah nama pernah tercatat.
- Jika nama belum tercatat, sistem akan mempertimbangkan penambahannya saat submit.
- User mengisi laporan untuk hari berjalan.
- User menambahkan aktivitas per baris.
- User memilih jam mulai dan jam selesai lewat input waktu.
- User mengunggah maksimal 1 foto bukti untuk setiap aktivitas.
- User melihat preview dokumen secara live.
- Jika laporan untuk nama yang sama pada hari yang sama sudah ada, sistem mengarahkan ke alur update.
- Saat submit, laporan disimpan ke database.
- Saat submit, nama pengisi di-upsert ke `reporter_directory`.
- `reporter_directory` menjadi sumber daftar nama yang pernah mengisi.
- Halaman histori memuat data laporan dari database.
- Halaman status memuat daftar nama dari `reporter_directory` dan mencocokkan status isi berdasarkan laporan pada tanggal tertentu.
- Export Excel dan Word mengikuti template dokumen yang sedang dipakai.
