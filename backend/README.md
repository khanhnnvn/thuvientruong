# Thư viện Trường học — Backend

API Go cho hệ thống Quản lý Thư viện Trường học, **đa trường (multi-tenant)**:
nhiều trường học dùng chung 1 hệ thống, mỗi trường truy cập qua
`/api/v1/:slug/...` và dữ liệu được cách ly theo `school_id`. Xem hợp đồng API
đầy đủ (đã hợp nhất cả phần multi-tenant) tại `../docs/API.md`, đặc tả gốc của
thay đổi kiến trúc tại `../docs/MULTI_TENANT_SPEC.md`, và schema tại
`migrations/0001_init.sql` + `migrations/0002_schools.sql` +
`migrations/0003_school_scoping.sql`.

## Công nghệ

- Go 1.26, module `github.com/thuvientruong/backend`
- [chi](https://github.com/go-chi/chi) router
- [pgx/v5](https://github.com/jackc/pgx) (`pgxpool`) — SQL thuần, không dùng ORM
- [golang-jwt/v5](https://github.com/golang-jwt/jwt) — access token (15 phút) + refresh token (7 ngày, cookie HttpOnly)
- `golang.org/x/crypto/bcrypt` — hash mật khẩu

## Cấu trúc thư mục

```
cmd/api/     entrypoint HTTP API (go run ./cmd/api)
cmd/seed/    script tạo tài khoản mẫu + dữ liệu mẫu (go run ./cmd/seed)
internal/config/   đọc cấu hình từ biến môi trường
internal/db/       kết nối pgxpool
internal/auth/     hash mật khẩu, phát hành/xác minh JWT
internal/httpapi/  router chi + toàn bộ handler, chia theo domain
migrations/        schema SQL (đã áp dụng thủ công vào DB, không tự động chạy khi start)
```

## Biến môi trường

| Biến | Bắt buộc | Mặc định | Ghi chú |
|---|---|---|---|
| `DATABASE_URL` | Nên đặt | `postgres://localhost:5432/thuvien?sslmode=disable` | Chuỗi kết nối PostgreSQL |
| `JWT_SECRET` | Bắt buộc khi `APP_ENV` khác `development`/`test` | secret dev không an toàn | Khoá ký JWT, tối thiểu 16 ký tự |
| `HTTP_ADDR` | Không | `:8190` | Địa chỉ HTTP server lắng nghe |
| `CORS_ORIGIN` | Không | `http://localhost:3400` | Origin frontend được phép gọi API (cùng lúc chỉ 1 origin) |
| `APP_ENV` | Không | `development` | `development`, `test`, hoặc `production` |
| `SEED_ADMIN_PASSWORD` | Không (chỉ dùng cho `cmd/seed`) | `Admin@123` | Mật khẩu admin trường demo khi seed lần đầu |
| `SEED_SUPERADMIN_EMAIL` | Không (chỉ dùng cho `cmd/seed`) | `superadmin@thuvien.local` | Email tài khoản super_admin |
| `SEED_SUPERADMIN_PASSWORD` | Không (chỉ dùng cho `cmd/seed`) | `SuperAdmin@123` | Mật khẩu tài khoản super_admin — **đổi giá trị này trước khi deploy thật** |

Không có mật khẩu hay secret nào được hardcode trong code; tất cả đọc từ biến môi trường (các giá trị mặc định ở trên chỉ áp dụng cho môi trường dev).

## Chạy thử

```bash
export DATABASE_URL="postgres://thuvien:moitinhdau142@localhost:5432/thuvien?sslmode=disable"
export JWT_SECRET="doi-secret-nay-truoc-khi-len-production-1234567890"

# Áp dụng migration thủ công theo đúng thứ tự (ứng dụng không tự chạy migration khi khởi động):
psql "$DATABASE_URL" -f migrations/0001_init.sql
psql "$DATABASE_URL" -f migrations/0002_schools.sql
psql "$DATABASE_URL" -f migrations/0003_school_scoping.sql

go run ./cmd/seed   # tạo super_admin + trường demo (truong-demo) + tài khoản/dữ liệu mẫu trong trường đó
go run ./cmd/api    # chạy API tại :8190 (hoặc theo HTTP_ADDR)
```

Kiểm tra nhanh:

```bash
curl http://localhost:8190/healthz

# Đăng nhập admin của trường demo (mọi endpoint nghiệp vụ nằm dưới /api/v1/:slug/...)
curl -X POST http://localhost:8190/api/v1/truong-demo/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@thuvien.local","password":"Admin@123"}'

# Đăng nhập super_admin (route toàn cục, không có slug)
curl -X POST http://localhost:8190/api/v1/super-admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@thuvien.local","password":"SuperAdmin@123"}'
```

## Tài khoản mẫu (tạo bởi `go run ./cmd/seed`)

| Vai trò | Trường | Email | Mật khẩu |
|---|---|---|---|
| super_admin | — (toàn hệ thống) | `superadmin@thuvien.local` | `SuperAdmin@123` (hoặc `SEED_SUPERADMIN_PASSWORD`) |
| admin | `truong-demo` | `admin@thuvien.local` | `Admin@123` (hoặc `SEED_ADMIN_PASSWORD`) |
| librarian | `truong-demo` | `thuthu@thuvien.local` | `Librarian@123` |
| teacher | `truong-demo` | `giaovien@thuvien.local` | `Teacher@123` |
| student | `truong-demo` | `hocsinh@thuvien.local` | `Student@123` |
| parent | `truong-demo` | `phuhuynh@thuvien.local` | `Parent@123` (đã liên kết với học sinh ở trên) |

super_admin đăng nhập ở `POST /api/v1/super-admin/login` (không có slug); các
tài khoản còn lại đăng nhập ở `POST /api/v1/truong-demo/auth/login`.

Script idempotent: chạy lại không tạo trùng (khớp theo email/tên, trong đúng phạm vi trường).

## Ghi chú thiết kế / giới hạn đã biết

- Access token là JWT không trạng thái (stateless), mang sẵn `role` để middleware
  phân quyền không cần truy vấn DB mỗi request. Hệ quả: nếu admin khoá một tài
  khoản, access token đã phát hành trước đó vẫn còn hiệu lực tối đa 15 phút.
- Refresh token cũng là JWT (cookie HttpOnly, path `/api/v1/auth`), không lưu
  server-side nên không có cơ chế thu hồi chủ động ngoài hết hạn tự nhiên (7 ngày).
- Mức phạt quá hạn (`fines.reason = 'overdue'`) dùng đơn giá cố định
  2.000đ/ngày trễ — con số này không được quy định trong `docs/API.md`, có thể
  chỉnh trong hằng số `fineRatePerDayVN` (`internal/httpapi/borrow.go`).
- `copy_code` được sinh tự động dạng `<8 ký tự đầu của book_id>-<số thứ tự>`.

## Test

```bash
go test ./...
```

Bao gồm test cho `internal/auth` (hash/verify mật khẩu, phát hành và xác minh
JWT access/refresh, từ chối token sai loại hoặc sai secret) và test
`internal/httpapi` dùng `httptest` cho middleware xác thực/phân quyền, cách ly
theo trường (`school_mismatch`, `school_not_found`) và định dạng lỗi chuẩn.

Từ khi có multi-tenant, việc phân giải `:slug` (`resolveSchool`) luôn cần tra
bảng `schools`, nên các test trong `internal/httpapi` kết nối tới CSDL Postgres
dev thật (mặc định cùng chuỗi kết nối trong mục "Chạy thử" ở trên, ghi đè được
qua biến `DATABASE_URL`) và dựa vào trường `truong-demo` do migration/seed tạo
sẵn. Nếu không kết nối được CSDL, các test này tự `Skip` thay vì fail.
