// Command seed creates a default admin account and a handful of sample
// catalog rows so the API has something to browse right after migration.
// It is idempotent: re-running it skips rows that already exist (matched by
// their unique natural key — email for users, name for authors/publishers,
// title for books).
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/thuvientruong/backend/internal/auth"
	"github.com/thuvientruong/backend/internal/config"
	"github.com/thuvientruong/backend/internal/db"
)

const (
	adminEmail     = "admin@thuvien.local"
	demoSchoolSlug = "truong-demo"
	demoSchoolName = "Trường Demo"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	// super_admin: single system-wide account, no school. Credentials come
	// from the environment with clearly-marked dev defaults (see README) so
	// nothing sensitive is hardcoded for real deployments.
	superAdminEmail := envOr("SEED_SUPERADMIN_EMAIL", "superadmin@thuvien.local")
	superAdminPassword := envOr("SEED_SUPERADMIN_PASSWORD", "SuperAdmin@123")
	if err := ensureSuperAdmin(ctx, pool, superAdminEmail, superAdminPassword); err != nil {
		return err
	}
	log.Printf("super_admin account ready: %s / %s", superAdminEmail, superAdminPassword)

	schoolID, err := ensureSchool(ctx, pool, demoSchoolSlug, demoSchoolName)
	if err != nil {
		return err
	}
	log.Printf("demo school ready: slug=%s (%s)", demoSchoolSlug, schoolID)

	adminPassword := envOr("SEED_ADMIN_PASSWORD", "Admin@123")
	adminID, err := ensureUser(ctx, pool, schoolID, adminEmail, adminPassword, "Quản trị viên", "admin", nil, nil)
	if err != nil {
		return err
	}
	log.Printf("admin account ready: %s / %s", adminEmail, adminPassword)

	if _, err := ensureUser(ctx, pool, schoolID, "thuthu@thuvien.local", "Librarian@123", "Nguyễn Thị Thủ Thư", "librarian", nil, nil); err != nil {
		return err
	}
	log.Printf("librarian account ready: thuthu@thuvien.local / Librarian@123")

	if _, err := ensureUser(ctx, pool, schoolID, "giaovien@thuvien.local", "Teacher@123", "Trần Văn Giáo Viên", "teacher", nil, nil); err != nil {
		return err
	}
	log.Printf("teacher account ready: giaovien@thuvien.local / Teacher@123")

	className, studentCode := "6A1", "HS001"
	studentID, err := ensureUser(ctx, pool, schoolID, "hocsinh@thuvien.local", "Student@123", "Lê Văn Học Sinh", "student", &className, &studentCode)
	if err != nil {
		return err
	}
	log.Printf("student account ready: hocsinh@thuvien.local / Student@123")

	parentID, err := ensureUser(ctx, pool, schoolID, "phuhuynh@thuvien.local", "Parent@123", "Phạm Thị Phụ Huynh", "parent", nil, nil)
	if err != nil {
		return err
	}
	log.Printf("parent account ready: phuhuynh@thuvien.local / Parent@123")
	if _, err := pool.Exec(ctx, `INSERT INTO parent_links (parent_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, parentID, studentID); err != nil {
		return err
	}

	catLit, err := ensureByName(ctx, pool, "categories", schoolID, "Văn học")
	if err != nil {
		return err
	}
	catSci, err := ensureByName(ctx, pool, "categories", schoolID, "Khoa học")
	if err != nil {
		return err
	}
	authorLit, err := ensureByName(ctx, pool, "authors", schoolID, "Nguyễn Nhật Ánh")
	if err != nil {
		return err
	}
	authorSci, err := ensureByName(ctx, pool, "authors", schoolID, "Trịnh Xuân Thuận")
	if err != nil {
		return err
	}
	pubKimDong, err := ensureByName(ctx, pool, "publishers", schoolID, "NXB Kim Đồng")
	if err != nil {
		return err
	}
	pubTre, err := ensureByName(ctx, pool, "publishers", schoolID, "NXB Trẻ")
	if err != nil {
		return err
	}

	if _, err := ensureBook(ctx, pool, schoolID, "Cho tôi xin một vé đi tuổi thơ", catLit, pubKimDong, adminID, []string{authorLit}, 2); err != nil {
		return err
	}
	if _, err := ensureBook(ctx, pool, schoolID, "Mắt biếc", catLit, pubKimDong, adminID, []string{authorLit}, 1); err != nil {
		return err
	}
	if _, err := ensureBook(ctx, pool, schoolID, "Những con đường tơ lụa mới", catSci, pubTre, adminID, []string{authorSci}, 1); err != nil {
		return err
	}

	log.Println("seed complete")
	return nil
}

// ensureSchool looks up the demo school by slug, creating it (pre-approved,
// so the seeded accounts can log in immediately) if missing.
func ensureSchool(ctx context.Context, pool *pgxpool.Pool, slug, name string) (string, error) {
	var id string
	err := pool.QueryRow(ctx, `SELECT id FROM schools WHERE slug = $1`, slug).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	err = pool.QueryRow(ctx, `
		INSERT INTO schools (slug, name, status, approved_at) VALUES ($1, $2, 'approved', now()) RETURNING id`,
		slug, name).Scan(&id)
	return id, err
}

// ensureSuperAdmin creates the single system-wide super_admin account
// (school_id NULL) if it doesn't already exist.
func ensureSuperAdmin(ctx context.Context, pool *pgxpool.Pool, email, password string) error {
	var id string
	err := pool.QueryRow(ctx, `SELECT id FROM users WHERE email = $1 AND role = 'super_admin'`, email).Scan(&id)
	if err == nil {
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO users (email, password_hash, full_name, role, school_id)
		VALUES ($1, $2, $3, 'super_admin', NULL)`,
		email, hash, "Quản trị hệ thống")
	return err
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func ensureUser(ctx context.Context, pool *pgxpool.Pool, schoolID, email, password, fullName, role string, className, studentCode *string) (string, error) {
	var id string
	err := pool.QueryRow(ctx, `SELECT id FROM users WHERE email = $1 AND school_id = $2`, email, schoolID).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return "", err
	}
	err = pool.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, full_name, role, class_name, student_code, school_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		email, hash, fullName, role, className, studentCode, schoolID).Scan(&id)
	return id, err
}

// ensureByName looks up a row by its unique "name" column (scoped to
// schoolID) in one of the small lookup tables, inserting it if missing.
// table is a fixed literal from this file only, never user input, so
// building the query with fmt.Sprintf here is safe.
func ensureByName(ctx context.Context, pool *pgxpool.Pool, table, schoolID, name string) (string, error) {
	var id string
	err := pool.QueryRow(ctx, fmt.Sprintf(`SELECT id FROM %s WHERE name = $1 AND school_id = $2`, table), name, schoolID).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	err = pool.QueryRow(ctx, fmt.Sprintf(`INSERT INTO %s (name, school_id) VALUES ($1, $2) RETURNING id`, table), name, schoolID).Scan(&id)
	return id, err
}

func ensureBook(ctx context.Context, pool *pgxpool.Pool, schoolID, title, categoryID, publisherID, createdBy string, authorIDs []string, copies int) (string, error) {
	var id string
	err := pool.QueryRow(ctx, `SELECT id FROM books WHERE title = $1 AND school_id = $2`, title, schoolID).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	err = pool.QueryRow(ctx, `
		INSERT INTO books (title, category_id, publisher_id, created_by, school_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		title, categoryID, publisherID, createdBy, schoolID).Scan(&id)
	if err != nil {
		return "", err
	}
	for _, aid := range authorIDs {
		if _, err := pool.Exec(ctx, `INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, aid); err != nil {
			return "", err
		}
	}
	for i := 0; i < copies; i++ {
		code := fmt.Sprintf("%s-%03d", id[:8], i+1)
		if _, err := pool.Exec(ctx, `
			INSERT INTO book_copies (book_id, copy_code, price, school_id) VALUES ($1, $2, $3, $4) ON CONFLICT (school_id, copy_code) DO NOTHING`,
			id, code, "50000.00", schoolID); err != nil {
			return "", err
		}
	}
	return id, nil
}
