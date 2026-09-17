# API Contract — Hệ thống Thư viện Trường học

Base URL: `/api/v1`. Định dạng: JSON. Xác thực: JWT Bearer (access token 15 phút, refresh token 7 ngày, lưu ở HttpOnly cookie).

## Vai trò (role)
`admin` (Nhà trường), `librarian` (Thủ thư), `teacher` (Giáo viên), `student` (Học sinh), `parent` (Phụ huynh).

## Auth
- `POST /auth/login` `{email, password}` → `{access_token, user}` + set cookie `refresh_token`
- `POST /auth/refresh` (đọc cookie) → `{access_token}`
- `POST /auth/logout` → xoá cookie
- `GET /me` → hồ sơ người dùng hiện tại
- `GET /me/children` (parent) → danh sách học sinh được liên kết + tình trạng mượn/phạt

## Users (admin, librarian read-only trừ tạo học sinh/gv)
- `GET /users?role=&q=&page=`
- `POST /users` (admin) — tạo tài khoản
- `GET /users/:id`
- `PATCH /users/:id`
- `POST /users/:id/reset-password` (admin)
- `POST /users/:id/link-parent` `{parent_id}` (admin)

## Danh mục (categories, authors, publishers) — CRUD chuẩn, quyền librarian/admin ghi, mọi role đọc
- `GET/POST /categories`, `PATCH/DELETE /categories/:id`
- `GET/POST /authors`, `PATCH/DELETE /authors/:id`
- `GET/POST /publishers`, `PATCH/DELETE /publishers/:id`

## Sách & ấn phẩm (books)
- `GET /books?q=&category_id=&author_id=&type=&page=` — tìm kiếm/lọc, public cho user đã đăng nhập
- `POST /books` (librarian/admin)
- `GET /books/:id` — kèm danh sách bản sao (copies) và trạng thái sẵn có
- `PATCH /books/:id`, `DELETE /books/:id` (librarian/admin)

## Bản sao (book copies)
- `GET /books/:id/copies`
- `POST /books/:id/copies` (librarian/admin) — thêm bản sao mới, sinh copy_code
- `PATCH /copies/:id` (librarian/admin) — cập nhật tình trạng/vị trí
- `DELETE /copies/:id` (librarian/admin, chỉ khi không đang mượn)

## Mượn / Trả (borrow)
- `POST /borrow` (librarian) `{copy_id, user_id, due_at?}` — mặc định due_at = +14 ngày
- `POST /borrow/:id/return` (librarian)
- `POST /borrow/:id/renew` (librarian/self nếu chưa quá hạn và chưa bị đặt trước)
- `GET /borrow?user_id=&status=&overdue=true&page=`
- `GET /borrow/:id`

Quy tắc nghiệp vụ:
- Không cho mượn nếu user đang mượn ≥ `max_borrow` bản chưa trả, hoặc còn phạt `unpaid`.
- Hạn mượn mặc định: student/teacher 14 ngày, tối đa gia hạn 1 lần (+7 ngày) nếu không có ai đặt trước.

## Đặt trước (reservations)
- `POST /reservations` `{book_id}` (self) — chỉ khi hết bản sẵn có
- `PATCH /reservations/:id` `{status}` (cancel bởi self, ready/fulfilled bởi librarian)
- `GET /reservations?user_id=&book_id=&status=`

## Phạt (fines)
- `GET /fines?user_id=&status=`
- `POST /fines/:id/pay` (librarian) — đánh dấu đã thu tiền mặt
- `POST /fines/:id/waive` (admin/librarian)
- Sinh tự động: quá hạn trả → fine `overdue` (theo số ngày trễ); mất/hư sách → fine `lost`/`damaged` bằng giá bìa `book_copies.price`.

## Thông báo (notifications)
- `GET /notifications` (self) — nhắc hạn trả, sách đặt trước đã sẵn sàng
- `POST /notifications/:id/read`

## Báo cáo (reports — librarian/admin)
- `GET /reports/overview` — tổng số sách/bản sao, đang mượn, quá hạn, phạt chưa thu
- `GET /reports/overdue`
- `GET /reports/popular-books?from=&to=`

## Mã lỗi chuẩn
`{ "error": { "code": "string", "message": "string" } }`, HTTP 400/401/403/404/409/422/500.

## Phân quyền tóm tắt
| Nhóm | Đọc catalog | Mượn/trả (thao tác) | Quản lý sách | Quản lý user | Báo cáo |
|---|---|---|---|---|---|
| admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| librarian | ✓ | ✓ | ✓ | tạo student/teacher | ✓ |
| teacher | ✓ | tự đặt trước | – | – | – |
| student | ✓ | tự đặt trước | – | – | – |
| parent | ✓ (chỉ xem) | – | – | – | xem của con |
