# API Contract — Hệ thống Thư viện Trường học (Multi-tenant)

Hệ thống phục vụ **nhiều trường học** dùng chung 1 backend, cách ly dữ liệu
theo trường (tenant). Mỗi trường có một `slug` duy nhất và toàn bộ endpoint
nghiệp vụ nằm dưới `/api/v1/:slug/...`. Ngoài ra có một số endpoint **toàn
cục** (không có slug) dùng để đăng ký trường mới và cho tài khoản
`super_admin` quản lý toàn hệ thống.

Base URL: `/api/v1`. Định dạng: JSON. Xác thực: JWT Bearer (access token 15
phút, refresh token 7 ngày, lưu ở HttpOnly cookie, path riêng theo từng
trường: `/api/v1/:slug/auth`, hoặc `/api/v1/super-admin` cho super_admin).

## Vai trò (role)

- `super_admin`: **toàn hệ thống**, `school_id = NULL`, không thuộc trường
  nào, duy nhất một tài khoản (tạo qua `cmd/seed`, không có UI tự đăng ký).
  Không đăng nhập qua `/:slug/...`, dùng route riêng `/api/v1/super-admin/...`.
- `admin` (Nhà trường), `librarian` (Thủ thư), `teacher` (Giáo viên),
  `student` (Học sinh), `parent` (Phụ huynh): thuộc về đúng 1 trường qua
  `school_id`, đăng nhập qua `/api/v1/:slug/auth/login`.

## 1. Khái niệm multi-tenant

- **Tenant = School (trường)**: mỗi trường là một tenant, có `slug` duy nhất
  dùng làm phần đường dẫn URL (ví dụ `truong-demo`, `truong-nguyensieu`). Slug
  do trường tự chọn lúc đăng ký: chỉ gồm chữ thường, số, gạch dưới/gạch ngang,
  3–64 ký tự, duy nhất toàn hệ thống, không được trùng các từ khoá dành riêng
  cho route toàn cục (`schools`, `super-admin`).
- Toàn bộ dữ liệu nghiệp vụ (users trừ super_admin, categories, authors,
  publishers, books, book_copies, borrow_records, reservations, fines,
  notifications, audit_logs) đều thuộc về đúng 1 trường qua cột `school_id`.
  Mọi truy vấn phía backend đều lọc/ghi theo đúng `school_id` được xác định từ
  `:slug` trên URL — dữ liệu của trường A không bao giờ lộ sang trường B.
- JWT của user thường mang thêm claim `school_id`; JWT của `super_admin` có
  `school_id = null`.

## 2. Luồng đăng ký & phê duyệt trường

1. Trường vào trang công khai (frontend) `/dang-ky`, điền: tên trường, slug
   mong muốn, địa chỉ, SĐT/email liên hệ, và thông tin tài khoản quản trị đầu
   tiên (họ tên, email, mật khẩu). Frontend gọi `GET /api/v1/schools/check-slug`
   để kiểm tra slug rảnh trước khi gửi, rồi `POST /api/v1/schools/register`.
2. Backend tạo đồng thời trong **1 transaction** (`BEGIN`/`COMMIT` thật): một
   dòng `schools` với `status='pending'`, và một dòng `users` role=`admin`,
   `school_id` = trường vừa tạo. **Không cấp token đăng nhập ngay** — response
   chỉ là thông báo đã gửi đăng ký, chờ duyệt.
3. `super_admin` đăng nhập `POST /api/v1/super-admin/login`, xem danh sách
   trường theo trạng thái (`pending`/`approved`/`rejected`/`suspended`), duyệt
   (`approved`) hoặc từ chối (`rejected`, kèm lý do) hoặc tạm khoá
   (`suspended`) trường đã duyệt trước đó, hoặc mở lại (`reactivate`) trường
   đang `suspended`.
4. Chỉ khi `schools.status = 'approved'` thì mọi request tới
   `/api/v1/:slug/...` (kể cả `auth/login`) mới được xử lý. Trường
   `pending`/`rejected`/`suspended` → mọi request tới slug đó, bao gồm cả đăng
   nhập, đều bị chặn ngay ở bước phân giải `:slug` với lỗi
   `school_not_approved` kèm `status` thực tế (xem mục 4).

## 3. Middleware phân giải `:slug` và cách ly theo trường

Mọi route dưới `/api/v1/:slug/...` đi qua middleware `resolveSchool` trước
tiên:

- Không tìm thấy `slug` trong bảng `schools` → `404 school_not_found`.
- Tìm thấy nhưng `status != 'approved'` → `403 school_not_approved`, body có
  thêm field `status` (giá trị thực tế: `pending` | `rejected` | `suspended`)
  để frontend hiển thị thông báo phù hợp:
  ```json
  { "error": { "code": "school_not_approved", "message": "...", "status": "pending" } }
  ```
- Hợp lệ (`approved`) → nạp `school_id` vào context request; mọi handler bên
  dưới lọc/ghi theo đúng `school_id` này.

Sau `resolveSchool`, các route yêu cầu đăng nhập còn đi qua `requireAuth`:
JWT hợp lệ **và** `school_id` trong JWT phải khớp với `school_id` của
`:slug` đang truy cập, nếu không → `403 school_mismatch` (chống một tài
khoản của trường này dùng token để truy cập dữ liệu trường khác, kể cả khi id
tài nguyên đoán được).

## Auth (theo trường — `/api/v1/:slug/auth/...`)

- `POST /:slug/auth/login` `{email, password}` → `{access_token, user}` + set
  cookie `refresh_token` (path `/api/v1/:slug/auth`). Chỉ user thuộc đúng
  trường đó, role khác `super_admin`, mới đăng nhập được ở đây.
- `POST /:slug/auth/refresh` (đọc cookie) → `{access_token}`
- `POST /:slug/auth/logout` → xoá cookie
- `GET /:slug/me` → hồ sơ người dùng hiện tại
- `GET /:slug/me/children` (parent) → danh sách học sinh được liên kết + tình
  trạng mượn/phạt

## Users (admin, librarian read-only trừ tạo học sinh/gv) — `/api/v1/:slug/users`

- `GET /:slug/users?role=&q=&page=`
- `POST /:slug/users` (admin) — tạo tài khoản (luôn gán vào trường hiện tại)
- `GET /:slug/users/:id`
- `PATCH /:slug/users/:id`
- `POST /:slug/users/:id/reset-password` (admin)
- `POST /:slug/users/:id/link-parent` `{parent_id}` (admin) — cả hai tài
  khoản phải cùng thuộc trường đang truy cập

## Danh mục (categories, authors, publishers) — `/api/v1/:slug/...`

CRUD chuẩn, quyền librarian/admin ghi, mọi role đọc. Mọi bản ghi thuộc về
đúng 1 trường; danh mục cha (`categories.parent_id`) phải cùng trường.

- `GET/POST /:slug/categories`, `PATCH/DELETE /:slug/categories/:id`
- `GET/POST /:slug/authors`, `PATCH/DELETE /:slug/authors/:id`
- `GET/POST /:slug/publishers`, `PATCH/DELETE /:slug/publishers/:id`

## Sách & ấn phẩm (books) — `/api/v1/:slug/books`

- `GET /:slug/books?q=&category_id=&author_id=&type=&page=` — tìm kiếm/lọc,
  chỉ trong phạm vi trường hiện tại
- `POST /:slug/books` (librarian/admin) — `publisher_id`/`category_id`/
  `author_ids` phải thuộc cùng trường, nếu không trả `422 invalid_request`
- `GET /:slug/books/:id` — kèm danh sách bản sao (copies) và trạng thái sẵn có
- `PATCH /:slug/books/:id`, `DELETE /:slug/books/:id` (librarian/admin)

## Bản sao (book copies) — `/api/v1/:slug/...`

- `GET /:slug/books/:id/copies`
- `POST /:slug/books/:id/copies` (librarian/admin) — thêm bản sao mới, sinh
  `copy_code` duy nhất **trong phạm vi trường** (không còn duy nhất toàn hệ
  thống)
- `PATCH /:slug/copies/:id` (librarian/admin) — cập nhật tình trạng/vị trí
- `DELETE /:slug/copies/:id` (librarian/admin, chỉ khi không đang mượn)

## Mượn / Trả (borrow) — `/api/v1/:slug/borrow`

- `POST /:slug/borrow` (librarian) `{copy_id, user_id, due_at?}` — mặc định
  due_at = +14 ngày; `copy_id`/`user_id` phải thuộc trường hiện tại
- `POST /:slug/borrow/:id/return` (librarian)
- `POST /:slug/borrow/:id/renew` (librarian/self nếu chưa quá hạn và chưa bị
  đặt trước)
- `GET /:slug/borrow?user_id=&status=&overdue=true&page=`
- `GET /:slug/borrow/:id`

Quy tắc nghiệp vụ (không đổi so với trước multi-tenant):

- Không cho mượn nếu user đang mượn ≥ `max_borrow` bản chưa trả, hoặc còn
  phạt `unpaid`.
- Hạn mượn mặc định: student/teacher 14 ngày, tối đa gia hạn 1 lần (+7 ngày)
  nếu không có ai đặt trước.

## Đặt trước (reservations) — `/api/v1/:slug/reservations`

- `POST /:slug/reservations` `{book_id}` (self) — chỉ khi hết bản sẵn có,
  `book_id` phải thuộc trường hiện tại
- `PATCH /:slug/reservations/:id` `{status}` (cancel bởi self, ready/fulfilled
  bởi librarian)
- `GET /:slug/reservations?user_id=&book_id=&status=`

## Phạt (fines) — `/api/v1/:slug/fines`

- `GET /:slug/fines?user_id=&status=`
- `POST /:slug/fines/:id/pay` (librarian) — đánh dấu đã thu tiền mặt
- `POST /:slug/fines/:id/waive` (admin/librarian)
- Sinh tự động: quá hạn trả → fine `overdue` (theo số ngày trễ); mất/hư sách
  → fine `lost`/`damaged` bằng giá bìa `book_copies.price`.

## Thông báo (notifications) — `/api/v1/:slug/notifications`

- `GET /:slug/notifications` (self) — nhắc hạn trả, sách đặt trước đã sẵn sàng
- `POST /:slug/notifications/:id/read`

## Báo cáo (reports — librarian/admin) — `/api/v1/:slug/reports`

- `GET /:slug/reports/overview` — tổng số sách/bản sao, đang mượn, quá hạn,
  phạt chưa thu **trong phạm vi trường hiện tại**
- `GET /:slug/reports/overdue`
- `GET /:slug/reports/popular-books?from=&to=`

## 4. Endpoint TOÀN CỤC (không có `:slug`)

### Đăng ký / tra cứu trường (public)

- `POST /api/v1/schools/register` — đăng ký trường mới. Body:
  ```json
  {
    "school_name": "string",
    "slug": "string",
    "address": "string?",
    "contact_phone": "string?",
    "contact_email": "string?",
    "admin_full_name": "string",
    "admin_email": "string",
    "admin_password": "string"
  }
  ```
  Trả `201` + `{"ok": true, "message": "..."}`, **không** trả token. Lỗi:
  `422 invalid_request` / `invalid_slug` (định dạng slug sai), `409 slug_taken`,
  `409 email_taken`.
- `GET /api/v1/schools/check-slug?slug=` — kiểm tra slug còn trống. Trả
  `{"available": true}` hoặc `{"available": false, "reason": "taken" | "invalid_format"}`.

### super_admin

- `POST /api/v1/super-admin/login` `{email, password}` — chỉ chấp nhận tài
  khoản `role='super_admin'` → `{access_token, user}` + cookie `refresh_token`
  (path `/api/v1/super-admin`).
- `GET /api/v1/super-admin/schools?status=&q=&page=` — danh sách trường.
- `GET /api/v1/super-admin/schools/:id` — chi tiết 1 trường.
- `POST /api/v1/super-admin/schools/:id/approve` — cho phép từ `pending`,
  `rejected` hoặc `suspended`.
- `POST /api/v1/super-admin/schools/:id/reject` `{reason}` — chỉ từ `pending`.
- `POST /api/v1/super-admin/schools/:id/suspend` — chỉ từ `approved`.
- `POST /api/v1/super-admin/schools/:id/reactivate` — chỉ từ `suspended`
  (chuyển về `approved`).
- Chuyển trạng thái không hợp lệ (vd. approve một trường đang `approved`) →
  `409 invalid_state`.

Tất cả các endpoint `/api/v1/super-admin/schools/...` yêu cầu
`Authorization: Bearer <access_token>` của tài khoản `super_admin` (không có
khái niệm `:slug` ở nhánh này).

## Mã lỗi chuẩn

`{ "error": { "code": "string", "message": "string" } }`, HTTP
400/401/403/404/409/422/500. Mã lỗi riêng cho multi-tenant:

| Code | HTTP | Ý nghĩa |
|---|---|---|
| `school_not_found` | 404 | `:slug` không tồn tại |
| `school_not_approved` | 403 | Trường tồn tại nhưng chưa `approved` (kèm `status` thực tế: `pending`/`rejected`/`suspended`) |
| `school_mismatch` | 403 | JWT hợp lệ nhưng `school_id` không khớp `:slug` đang truy cập |
| `slug_taken` | 409 | Slug đã được trường khác đăng ký |
| `invalid_slug` | 422 | Slug sai định dạng |

## Phân quyền tóm tắt (trong phạm vi 1 trường)

| Nhóm | Đọc catalog | Mượn/trả (thao tác) | Quản lý sách | Quản lý user | Báo cáo |
|---|---|---|---|---|---|
| admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| librarian | ✓ | ✓ | ✓ | tạo student/teacher | ✓ |
| teacher | ✓ | tự đặt trước | – | – | – |
| student | ✓ | tự đặt trước | – | – | – |
| parent | ✓ (chỉ xem) | – | – | – | xem của con |

`super_admin` không tham gia nghiệp vụ trong trường nào — chỉ quản lý vòng
đời trường (duyệt/từ chối/khoá/mở lại) ở nhánh `/api/v1/super-admin/...`.
