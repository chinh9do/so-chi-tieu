# Sổ chi tiêu

App ghi chi tiêu cá nhân. Có tổng kết theo tháng và năm, sổ tiền cưới riêng, theo dõi thay nhớt.

- **Một bộ code, chạy ở hai nơi:**
  - **iPhone:** dùng dạng PWA (cài từ Safari lên màn hình chính).
  - **Android:** dùng file APK cài riêng, hoặc cũng dùng PWA như iPhone.
- **Dữ liệu nằm trong máy.** Có thể bật thêm **đồng bộ đám mây mã hoá đầu-cuối** qua Supabase của riêng bạn (xem [SUPABASE.md](SUPABASE.md)), để dùng nhiều máy và không sợ mất dữ liệu.
- **Chuyển máy:** bật đồng bộ, hoặc xuất file `.json` (hay Excel) rồi nhập vào máy mới.

> ⚠️ Repo này để **công khai** (GitHub Pages miễn phí yêu cầu vậy). **Không bao giờ** đưa file dữ liệu (`chi-tieu-data.json`, file `.xlsx`, file sao lưu) lên đây. `.gitignore` đã chặn sẵn các file này.

## Cấu trúc

```
www/                  Toàn bộ app (HTML/JS, chạy offline)
  index.html          Giao diện
  app.js              Logic, lưu trữ IndexedDB, xuất/nhập JSON + Excel
  sw.js               Service worker (cache offline) — đổi VERSION khi sửa code
  vendor/             SheetJS (đọc/ghi Excel)
  fonts/ icons/
resources/android/    Icon cho bản Android
supabase/schema.sql   Bảng dữ liệu cho đồng bộ đám mây (chạy trong Supabase)
.github/workflows/
  pages.yml           Đưa www/ lên GitHub Pages (link cho iPhone)
  android.yml         Build file APK Android
capacitor.config.json, package.json, package-lock.json
```

## 1. Đưa lên GitHub (làm một lần)

1. Tạo repo mới, chọn **Public**, đặt tên ví dụ `so-chi-tieu`.
2. Giải nén file zip rồi đưa toàn bộ nội dung lên repo. Có hai cách:
   - **Dùng git:**
     ```
     git init
     git add .
     git commit -m "init"
     git branch -M main
     git remote add origin https://github.com/<user>/so-chi-tieu.git
     git push -u origin main
     ```
   - **Không dùng git:** trên trang repo chọn *Add file → Upload files*, rồi kéo thả **cả thư mục**. Nhớ kéo cả thư mục `.github`.
3. Vào **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions**.
4. Vào tab **Actions**, chạy workflow **"Đưa app lên GitHub Pages"** (nếu nó chưa tự chạy). Khi xong, app có địa chỉ `https://<user>.github.io/so-chi-tieu/`.

## 2. Cài trên iPhone

1. Mở link trên bằng **Safari** (không dùng Chrome).
2. Bấm nút **Chia sẻ**, chọn **Thêm vào MH chính**.
3. Mở app **từ icon trên màn hình chính**.

   Lưu ý: trên iOS, app ở màn hình chính có kho dữ liệu **riêng**, khác với tab Safari. Vì vậy phải nhập dữ liệu ở trong app.
4. Chép file `chi-tieu-data.json` vào iPhone. Cách tiện nhất từ Windows là mở iCloud Drive trên web (icloud.com), hoặc gửi qua Zalo/email rồi lưu vào ứng dụng **Tệp**.
5. Trong app: bấm **⚙ → Nhập dữ liệu từ file → chọn file**.

## 3. Build APK cho Android

1. Vào repo **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `KEYSTORE_PASSWORD`
   - Value: một mật khẩu tự đặt. **Ghi lại mật khẩu này.**
2. Vào **Actions → "Build APK Android" → Run workflow**. Mất khoảng 5–10 phút.
3. Mở lần chạy vừa xong, tải artifact **so-chi-tieu-apk** về rồi giải nén.
4. **Chỉ lần build đầu tiên** còn có thêm file `KEYSTORE_B64.txt`:
   - Tạo thêm secret `KEYSTORE_B64`, dán toàn bộ nội dung file đó vào.
   - Sau đó xoá artifact đi.

   Làm vậy để các bản cập nhật sau được ký **cùng một khoá**. Nhờ đó bạn cài đè lên bản cũ được mà không mất dữ liệu. Nếu khoá khác, Android bắt gỡ app cũ, và gỡ app là **mất dữ liệu**.
5. Chép `so-chi-tieu.apk` vào điện thoại, mở file và cho phép *Cài ứng dụng không rõ nguồn gốc*.

Trên Android cũng có thể dùng bản PWA: mở link bằng Chrome, chọn menu **⋮**, rồi **Cài đặt ứng dụng**.

## 4. Sao lưu và chuyển máy

Các thao tác dưới đây đều nằm trong **⚙**:

- **Sao lưu (.json):** file đầy đủ nhất, dùng để chuyển sang máy khác (iPhone ↔ Android ↔ máy tính).
- **Xuất Excel:** file gồm các sheet *Giao dịch, Tổng tháng, Tổng năm, Tiền cưới, Thay nhớt, Ghi chú tháng*. Mở được bằng Excel hay Google Sheets, và **nhập ngược lại vào app được**.
- **Nhập dữ liệu:** chọn *Thay thế toàn bộ* hoặc *Gộp*. Khi gộp, các bản ghi trùng mã sẽ lấy theo file.

App sẽ nhắc nếu đã quá 30 ngày chưa sao lưu. Nên lưu file sao lưu vào iCloud Drive hoặc Google Drive.

**Mất dữ liệu khi nào:** khi gỡ app hoặc xoá icon khỏi màn hình chính, hoặc khi xoá dữ liệu trang web trong Cài đặt Safari/Chrome. Vì vậy hãy sao lưu đều.

## 5. Sửa code

- Chạy thử trên máy tính:
  ```
  npx http-server www -p 8080
  ```
  rồi mở `http://localhost:8080`. Có thể dùng Live Server của VS Code thay thế.
- Mỗi lần sửa file trong `www/`, **tăng `VERSION` trong `www/sw.js`**. Nếu không, iPhone sẽ giữ bản cũ trong cache.
- Đẩy code lên nhánh `main`: Pages tự cập nhật, APK tự build lại.

## Định dạng dữ liệu (JSON, version 1)

```json
{
  "app": "so-chi-tieu", "version": 1,
  "categories":   [{ "id": "an", "name": "Ăn uống hằng ngày", "group": "Thiết yếu" }],
  "transactions": [{ "id": "...", "date": "2026-11-26", "cat": "an", "amount": 45000, "note": "(20 + 25)" }],
  "weddings":     [{ "id": "...", "date": null, "name": "Bảo mti", "amount": 500000, "group": "MTI", "note": "", "link": "", "txId": null }],
  "oil":          [{ "id": "...", "date": "2026-11-01", "approx": false, "odo": 22064, "next": 24200, "cost": null, "note": "", "txId": null }],
  "monthNotes":   [{ "id": "...", "month": "2025-09", "text": "trọ mới 3tr" }],
  "settings":     { "odometer": 22064, "odometerDate": "2026-11-01", "oilInterval": 3000, "lastBackup": null }
}
```

- Số tiền tính bằng **đồng**. Khi nhập trong app thì gõ theo **nghìn**, ví dụ `45` = 45.000đ, `1,5tr` = 1.500.000đ, `20+30` = 50.000đ.
- `txId` nối một đám cưới hoặc một lần thay nhớt với khoản chi tương ứng, để không bị tính hai lần.
