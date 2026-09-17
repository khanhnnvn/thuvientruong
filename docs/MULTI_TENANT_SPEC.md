# Chuyển đổi sang mô hình đa trường (multi-tenant)

Tài liệu này đặc tả thay đổi kiến trúc để một hệ thống phục vụ nhiều trường học độc lập, mỗi trường truy cập qua URL riêng dạng `/truong_nguyensieu`, `/truong_maidich`, cách ly dữ liệu theo trường (tenant), và có một tài khoản **super_admin** duy nhất ở cấp toàn hệ thống để duyệt đăng ký trường mới.

## 1. Khái niệm

- **Tenant = School (trường)**: mỗi trường là một tenant, có `slug` duy nhất dùng làm phần đường dẫn URL (ví dụ `truong_nguyensieu`). Slug do trường tự chọn lúc đăng ký, chỉ gồm chữ thường/số/gạch dưới/gạch ngang, duy nhất toàn hệ thống.
- **super_admin**: vai trò mới, KHÔNG thuộc trường nào (`school_id = NULL`), quản lý toàn hệ thống, duy nhất một tài khoản (seed thủ công, không có UI tự đăng ký). Không đăng nhập qua `/:slug/...`, có route riêng `/super-admin`.
- Toàn bộ dữ liệu nghiệp vụ hiện có (users trừ super_admin, categories, authors, publishers, books, book_copies, borrow_records, reservations, fines, notifications, audit_logs) đều thuộc về đúng 1 trường qua cột `school_id`.

## 2. Luồng đăng ký & phê duyệt trường

1. Trường vào trang công khai `/dang-ky`, điền: tên trường, slug mong muốn, địa chỉ, SĐT/email liên hệ, và thông tin tài khoản quản trị đầu tiên (họ tên, email, mật khẩu).
2. Backend tạo đồng thời trong 1 transaction: `schools` row với `status='pending'`, và `users` row role=`admin`, `school_id` = trường vừa tạo. Không cấp token đăng nhập ngay.
3. super_admin đăng nhập `/super-admin`, xem danh sách trường theo trạng thái (`pending`/`approved`/`rejected`/`suspended`), duyệt (`approved`) hoặc từ chối (`rejected`, kèm lý do) hoặc tạm khoá (`suspended`) trường đã duyệt trước đó.
4. Chỉ khi `schools.status = 'approved'` thì user thuộc trường đó mới đăng nhập được ở `/:slug/login`. Trường `pending`/`rejected`/`suspended` → đăng nhập trả lỗi rõ ràng theo trạng thái.

## 3. Thay đổi cơ sở dữ liệu (migration mới, tiếp theo 0001_init.sql)

### Bảng mới `schools`
```
id UUID PK, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
address TEXT, contact_phone TEXT, contact_email TEXT,
status school_status ENUM('pending','approved','rejected','suspended') DEFAULT 'pending',
rejection_reason TEXT, approved_by UUID REFERENCES users(id), approved_at TIMESTAMPTZ,
created_at TIMESTAMPTZ DEFAULT now()
```

### Cột `school_id UUID REFERENCES schools(id)` thêm vào
`users, categories, authors, publishers, books, book_copies, borrow_records, reservations, fines, notifications, audit_logs`

- Với `users`: `school_id` **NULLABLE**, ràng buộc CHECK: `(role = 'super_admin' AND school_id IS NULL) OR (role <> 'super_admin' AND school_id IS NOT NULL)`.
- Với các bảng còn lại: `school_id NOT NULL` sau khi backfill.
- `user_role` enum thêm giá trị `super_admin` (chạy ALTER TYPE ADD VALUE ở statement/migration riêng, tách khỏi statement dùng giá trị đó trong cùng transaction để tránh lỗi Postgres).

### Ràng buộc duy nhất cần sửa lại theo phạm vi trường
- `users.email`: trước đây UNIQUE toàn cục → đổi thành UNIQUE theo `(school_id, email)` cho user thường, và UNIQUE riêng theo `email` cho `role='super_admin'` (dùng partial unique index).
- `publishers.name`: UNIQUE toàn cục → UNIQUE theo `(school_id, name)`.
- `book_copies.copy_code`: UNIQUE toàn cục → cân nhắc đổi thành UNIQUE theo `(school_id, copy_code)` (mỗi trường tự quản lý mã vạch riêng).

### Backfill dữ liệu demo hiện có
Migration phải tạo 1 trường mặc định (ví dụ `slug='truong-demo'`, `name='Trường Demo'`, `status='approved'`) và gán toàn bộ dữ liệu hiện có (users trừ super_admin nếu có, categories, authors, publishers, books, book_copies, borrow_records, reservations, fines, notifications, audit_logs) vào `school_id` của trường này, TRƯỚC KHI thêm ràng buộc NOT NULL.

### Seed
Cập nhật `cmd/seed`: thêm 1 tài khoản `super_admin` cố định (email/mật khẩu cấu hình qua env, không hardcode), giữ nguyên seed dữ liệu mẫu nhưng gán vào trường demo `truong-demo`.

## 4. Thay đổi cấu trúc API

Toàn bộ endpoint nghiệp vụ hiện có (trong `docs/API.md` cũ) chuyển từ prefix `/api/v1/...` sang **`/api/v1/:slug/...`** — middleware đọc `:slug` từ URL, tra `schools` theo slug:
- Không tìm thấy slug → 404 `school_not_found`.
- Tìm thấy nhưng `status != 'approved'` → 403 `school_not_approved` (kèm status thực tế để frontend hiển thị thông báo phù hợp).
- Hợp lệ → nạp `school_id` vào context, mọi query bên dưới lọc/ghi theo đúng `school_id` này. JWT của user cũng mang `school_id`; nếu `school_id` trong JWT khác `school_id` của `:slug` đang truy cập → 403 (chống truy cập chéo trường).

### Endpoint TOÀN CỤC (không có slug)
- `POST /api/v1/schools/register` — đăng ký trường mới (public). Body: `{school_name, slug, address?, contact_phone?, contact_email?, admin_full_name, admin_email, admin_password}`. Trả 201 + thông báo chờ duyệt, KHÔNG trả token.
- `GET /api/v1/schools/check-slug?slug=` — kiểm tra slug còn trống (public, dùng khi điền form đăng ký).
- `POST /api/v1/super-admin/login` — đăng nhập super_admin (kiểm tra `role='super_admin'`).
- `GET /api/v1/super-admin/schools?status=&q=&page=` — danh sách trường.
- `GET /api/v1/super-admin/schools/:id` — chi tiết 1 trường.
- `POST /api/v1/super-admin/schools/:id/approve`
- `POST /api/v1/super-admin/schools/:id/reject` `{reason}`
- `POST /api/v1/super-admin/schools/:id/suspend`
- `POST /api/v1/super-admin/schools/:id/reactivate` (suspended → approved)

### Endpoint THEO TRƯỜNG (giữ nguyên nghiệp vụ cũ, chỉ thêm prefix `:slug`)
`/api/v1/:slug/auth/login`, `/auth/refresh`, `/auth/logout`, `/me`, `/me/children`, `/users...`, `/categories...`, `/authors...`, `/publishers...`, `/books...`, `/copies...`, `/borrow...`, `/reservations...`, `/fines...`, `/notifications...`, `/reports...` — logic nghiệp vụ và phân quyền giữ nguyên như `docs/API.md` hiện tại, chỉ bổ sung lọc theo `school_id`.

## 5. Thay đổi Frontend (Next.js)

- Cấu trúc route mới: `app/[slug]/login/page.tsx`, `app/[slug]/(app)/...` (di chuyển toàn bộ trang hiện có từ `app/(app)/...` vào đây, giữ nguyên logic, chỉ sửa mọi lời gọi API để chèn `slug` vào đường dẫn: `/api/v1/${slug}/...`).
- Trang mới `app/dang-ky/page.tsx` — form đăng ký trường công khai, gọi `POST /api/v1/schools/register`, kiểm tra slug rảnh qua `GET /api/v1/schools/check-slug` (debounce khi gõ), sau khi gửi thành công hiển thị màn "Đã gửi đăng ký, chờ quản trị hệ thống phê duyệt".
- Trang mới `app/super-admin/login/page.tsx` và `app/super-admin/(dashboard)/page.tsx` — layout riêng biệt (không dùng sidebar trường), danh sách trường dạng bảng có lọc theo trạng thái, nút Duyệt/Từ chối (modal nhập lý do)/Tạm khoá/Mở lại.
- Trang gốc `app/page.tsx` (route `/`) — landing đơn giản: giới thiệu ngắn, nút "Đăng ký cho trường của bạn" (→ `/dang-ky`), ô nhập "Mã trường" để chuyển hướng tới `/:slug/login`, link nhỏ tới `/super-admin/login`.
- Middleware (`proxy.ts`) cập nhật: route `/:slug/(app)/*` yêu cầu đăng nhập đúng session của đúng `slug` đó (lưu `slug` kèm token khi đăng nhập, nếu session thuộc slug khác thì buộc đăng xuất/chuyển hướng lại `/:slug/login`); route `/super-admin/*` (trừ `/super-admin/login`) yêu cầu session super_admin riêng.
- `next.config.ts`: KHÔNG cần đổi rewrite (`/api/:path*` → backend giữ nguyên), vì slug đã nằm trong chính đường dẫn `/api/v1/:slug/...` mà frontend gọi.

## 6. Việc KHÔNG đổi
Toàn bộ enum trạng thái nghiệp vụ (borrow_status, fine_status, reservation_status...), quy tắc mượn/trả/phạt/đặt trước, phân quyền 5 vai trò trong phạm vi 1 trường — giữ nguyên y như `docs/API.md` gốc, chỉ bọc thêm lớp cách ly theo trường.
