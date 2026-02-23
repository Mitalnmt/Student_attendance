# Hệ thống điểm danh học sinh

Hệ thống web điểm danh sử dụng **HTML + CSS + Vanilla JS**, **Firebase Realtime Database**, **Firebase Auth**, **face-api.js**, **QRCode.js**, **SheetJS**, **Geolocation API**.

## Cấu trúc thư mục

```
/
├── index.html              # Trang điểm danh (học sinh)
├── register.html           # Đăng ký học sinh
├── teacher-login.html
├── teacher-register.html
├── dashboard.html          # Dashboard giáo viên
├── class.html              # Chi tiết lớp
├── css/
│   └── style.css
├── js/
│   ├── firebase-config.js
│   ├── student.js
│   ├── teacher.js
│   ├── register.js
│   ├── face.js
│   └── utils.js
└── database.rules.json     # Firebase Realtime Database rules
```

## Cài đặt Firebase

1. Đăng nhập [Firebase Console](https://console.firebase.google.com/)
2. Tạo project (hoặc dùng project có sẵn)
3. Bật **Realtime Database** và **Authentication** (Email/Password)
4. Vào **Realtime Database** → Rules, dán nội dung `database.rules.json` (hoặc mở đọc ghi cho test)
5. Thêm domain GitHub Pages vào **Authorized domains** trong Authentication nếu deploy

## Chạy local

Mở bằng Live Server hoặc serve tĩnh (ES modules cần HTTP(S), không chạy được `file://`):

```bash
npx serve .
# hoặc
python -m http.server 8000
```

## Deploy lên GitHub Pages

1. Push code lên GitHub repo
2. Settings → Pages → Source: Deploy from branch
3. Chọn branch `main` (hoặc `master`), folder `/root`
4. Lưu và chờ build. Website sẽ có dạng: `https://username.github.io/repo-name/`

## Luồng sử dụng

### Giáo viên
1. Đăng ký (email, tên, tên trường, mật khẩu)
2. Đăng nhập → Dashboard
3. Tạo lớp → Duyệt học sinh đăng ký → Duyệt cập nhật mặt (nếu có)
4. Mở slot điểm danh 20 phút (cần GPS) → Hiển thị QR
5. Điểm danh thủ công (nếu cần)
6. Xuất Excel

### Học sinh
1. Đăng ký: chọn trường, lớp, nhập MSSV, tên, chụp mặt → Chờ giáo viên duyệt
2. Điểm danh: chọn trường, lớp → Quét QR (hoặc nhập classId_slotId) → Nhập MSSV → Mở camera → Điểm danh

## Công nghệ

- **face-api.js**: Lưu face descriptor (128 số), so sánh Euclidean distance, threshold 0.55
- **QRCode.js**: Tạo mã QR chứa `classId_slotId`
- **SheetJS**: Xuất Excel, mỗi ngày một sheet
- **Geolocation API**: Kiểm tra khoảng cách ≤ 200m khi điểm danh
