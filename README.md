# Robot Transporter - Technocorner 2026

Web-based dashboard and controller interface for the **Robot Transporter** competing in the **Technocorner 2026** robotics competition at UGM.

🚀 **[Buka Live Simulator / Dashboard di sini!](https://triwahyu45.github.io/RobotTransporter_Technocorner2026/)**

---

## 🌟 Fitur Utama / Key Features

*   **Competition Dashboard**: Monitor telemetri dan status robot secara real-time dari browser.
*   **Interactive Control Interface**: Mendukung kendali robot via keyboard dan virtual joystick.
*   **Low Latency Connection**: Dibuat dengan aset web ringan untuk respon kendali cepat.
*   **Technocorner 2026 Theme**: Desain disesuaikan dengan standar regulasi kompetisi Robot Transporter Technocorner.

---

## 📂 Struktur Project / Project Structure

*   `index.html` - Struktur utama halaman kendali robot.
*   `css/` - File styling untuk layout dashboard.
*   `js/` - Logika kendali dan komunikasi data.
*   `local-server.cjs` - Server backend lokal untuk menjembatani komunikasi web ke mikrokontroler robot.
*   `Web_Assets/` - Aset grafis perlombaan.

---

## 🛠️ Cara Menjalankan Lokal / Local Setup

1. Buka folder proyek ini di komputer Anda.
2. Hubungkan mikrokontroler robot ke komputer (via USB/Serial).
3. Jalankan server lokal untuk menjembatani serial port ke browser:
   ```bash
   node local-server.cjs
   ```
4. Buka file `index.html` di browser Anda untuk mulai mengendalikan robot transporter!\n