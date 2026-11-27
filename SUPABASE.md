# Bật đồng bộ đám mây (Supabase)

App lưu dữ liệu trong máy như cũ, và **tự đồng bộ lên project Supabase của riêng bạn** để:
- xoá icon, mất máy hay đổi máy vẫn khôi phục được;
- dùng song song iPhone và Android, sửa ở máy này thì máy kia cập nhật.

**Chỉ bạn đọc được dữ liệu.**
- Mỗi bản ghi được mã hoá AES-256 **ngay trên điện thoại**, bằng *mật khẩu mã hoá* bạn tự đặt.
- Supabase chỉ giữ chuỗi đã mã hoá. Kể cả mã bản ghi cũng bị băm, nên máy chủ không biết số tiền, ngày, danh mục hay ghi chú.
- Ngoài ra, bảng dữ liệu được khoá theo tài khoản (Row Level Security).

## 1. Tạo project (làm 1 lần, khoảng 10 phút)

1. Vào https://supabase.com, bấm **Start your project**. Có thể đăng nhập bằng GitHub.
2. Bấm **New project** và điền:
   - Name: `so-chi-tieu`.
   - Database password: bấm *Generate*, rồi lưu lại (app không cần mật khẩu này).
   - Region: **Southeast Asia (Singapore)**.

   Bấm **Create new project** và chờ khoảng 2 phút.
3. Mở **SQL Editor → New query**. Dán toàn bộ nội dung file `supabase/schema.sql` vào, rồi bấm **Run**. Kết quả phải là *Success. No rows returned*.
4. **Tạo tài khoản đăng nhập cho chính bạn:** vào **Authentication → Users → Add user → Create new user**.
   - Nhập email và mật khẩu.
   - Tick **Auto Confirm User**.
5. **Khoá đăng ký để người lạ không tự tạo tài khoản:** vào **Authentication → Sign In / Providers** (ở bản cũ là *Settings*), rồi **tắt** *Allow new users to sign up*. Bấm Save.
6. Lấy thông tin kết nối ở **Project Settings → API Keys** (hoặc nút **Connect** trên đầu trang):
   - **Project URL**: dạng `https://abcdxyz.supabase.co`.
   - **Publishable key**: dạng `sb_publishable_...`. Project cũ thì dùng **anon public key**.

   Hai giá trị này được phép nằm trong app. Chúng không đọc được dữ liệu nếu chưa đăng nhập.
   **Không bao giờ** dùng `service_role` hay *secret key* trong app.

## 2. Bật trên máy đầu tiên (máy đang có dữ liệu)

1. Trong app, bấm **⚙**, kéo xuống mục **Đồng bộ đám mây**.
2. Điền Project URL, Publishable key, email và mật khẩu đăng nhập (đã tạo ở bước 4).
3. Đặt **Mật khẩu mã hoá** (ít nhất 8 ký tự) rồi nhập lại lần nữa.

   ⚠️ **Ghi lại mật khẩu này ở chỗ an toàn**, ví dụ trình quản lý mật khẩu. Quên thì bản trên mây không ai mở được.
4. Bấm **Bật đồng bộ**. Lần đầu app tải lên khoảng 2.000 bản ghi, mất vài chục giây.

## 3. Bật trên máy khác hoặc sau khi cài lại

- Làm giống bước 2, dùng **cùng email và cùng mật khẩu mã hoá**. Ô *nhập lại* có thể để trống.
- Nếu máy đó đã có dữ liệu, app hỏi:
  - **OK**: dùng dữ liệu trên mây. Nên chọn khi cài lại hoặc thêm máy mới.
  - **Huỷ**: gộp dữ liệu trong máy lên mây.

## App đồng bộ khi nào

- Khi mở app, và khi quay lại app sau lúc dùng app khác.
- Vài giây sau mỗi lần bạn thêm, sửa hay xoá.
- Khi có mạng trở lại.
- Khi bấm **⚙ → Đồng bộ ngay**.

Không có mạng thì app vẫn dùng bình thường, có mạng là tự đẩy lên. Nếu hai máy cùng sửa **một khoản** trong lúc chưa đồng bộ, bản đồng bộ sau cùng sẽ thắng.

## Lưu ý

- **Gói miễn phí của Supabase tạm dừng project nếu 7 ngày không có hoạt động.** Dùng app hằng ngày thì sẽ không bị. Nếu bị dừng, vào dashboard bấm **Restore project**, dữ liệu vẫn còn.
- Vẫn nên **xuất file .json hoặc Excel** vài tháng một lần để dự phòng thêm.
- **Tắt đồng bộ** (trong ⚙) chỉ ngắt máy đó. Dữ liệu trên mây vẫn giữ.
- **Quên mật khẩu mã hoá:** dữ liệu trong máy vẫn còn.
  1. Tắt đồng bộ ở mọi máy.
  2. Trong SQL Editor, chạy:
     ```sql
     delete from public.items; delete from public.vault;
     ```
  3. Bật lại đồng bộ với mật khẩu mới, từ máy có dữ liệu đầy đủ nhất.
