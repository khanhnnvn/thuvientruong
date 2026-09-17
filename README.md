# Thư viện Trường học

Hệ thống quản lý thư viện trường học: quản lý sách & ấn phẩm, mượn/trả, đặt trước, phạt, báo cáo — phục vụ Nhà trường, Thủ thư, Giáo viên, Học sinh, Phụ huynh.

- **Tài liệu đặc tả:** [docs/SRS.md](docs/SRS.md)
- **API contract:** [docs/API.md](docs/API.md)
- **Backend:** Go (chi router, pgx/PostgreSQL, JWT) — xem [backend/README.md](backend/README.md)
- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS)
- **Database:** PostgreSQL

## Chạy local

```bash
# 1. Database (đã có sẵn migration ở backend/migrations/0001_init.sql)
createdb thuvien
psql -d thuvien -f backend/migrations/0001_init.sql

# 2. Backend
cd backend
export DATABASE_URL=postgres://localhost:5432/thuvien?sslmode=disable
export JWT_SECRET=$(openssl rand -hex 32)
go run ./cmd/seed   # tạo tài khoản mẫu cho 5 vai trò
go run ./cmd/api    # http://localhost:8190

# 3. Frontend
cd frontend
pnpm install
pnpm dev            # http://localhost:3400 (rewrite /api -> backend)
```

## Triển khai (macOS, tự khởi động khi restart máy)

Xem thư mục [deploy/local-mac/](deploy/local-mac/). Bốn tiến trình chạy nền qua `launchd`:

| Service | Label | Script |
|---|---|---|
| API Go | `com.thuvien.api` | `deploy/local-mac/start-api.sh` |
| Web Next.js | `com.thuvien.web` | `deploy/local-mac/start-web.sh` |
| Cloudflare Tunnel | `com.thuvien.tunnel` | `deploy/local-mac/start-tunnel.sh` |
| Backup DB hàng ngày (3:30 sáng) | `com.thuvien.backup` | `deploy/local-mac/backup.sh` |

Biến môi trường đọc từ `~/.config/thuvien/env` (không commit vào git — chứa `DATABASE_URL`, `JWT_SECRET`, `PORT`, `HTTP_ADDR`).

Domain công khai: **https://thuvien.vietsoftware.vn** (qua Cloudflare Tunnel, tunnel name `thuvien`).

Quản lý service:
```bash
launchctl load ~/Library/LaunchAgents/com.thuvien.api.plist
launchctl load ~/Library/LaunchAgents/com.thuvien.web.plist
launchctl load ~/Library/LaunchAgents/com.thuvien.tunnel.plist
launchctl load ~/Library/LaunchAgents/com.thuvien.backup.plist
```
