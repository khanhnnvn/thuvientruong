package httpapi

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/thuvientruong/backend/internal/auth"
	"github.com/thuvientruong/backend/internal/config"
	"github.com/thuvientruong/backend/internal/db"
)

// Resolving a tenant from :slug requires a database lookup (school_not_found
// vs school_not_approved vs ok), so these tests run against a real database
// instead of the DB-less httptest setup used before multi-tenancy. They
// target the same local dev database documented in ../../README.md; if it
// isn't reachable (e.g. in an environment with no Postgres), the whole suite
// skips rather than failing spuriously.
const testDatabaseURL = "postgres://thuvien:moitinhdau142@localhost:5432/thuvien?sslmode=disable"

func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		url = testDatabaseURL
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	pool, err := db.Connect(ctx, url)
	if err != nil {
		t.Skipf("skipping: no test database reachable: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func testServer(t *testing.T) *Server {
	t.Helper()
	return New(Deps{
		Config: config.Config{CORSOrigin: "http://localhost:3400"},
		Pool:   testPool(t),
		Auth:   auth.New("test-secret-at-least-16-bytes"),
		Log:    slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
}

// demoSchool fetches the id/slug of the seeded approved demo school that
// every fixture in this file relies on (created by migrations/0003 and
// cmd/seed). Tests skip if it isn't present rather than trying to create it.
func demoSchool(t *testing.T, s *Server) School {
	t.Helper()
	row := s.pool.QueryRow(context.Background(), `SELECT `+schoolColumns+` FROM schools WHERE slug = 'truong-demo'`)
	sc, err := scanSchool(row)
	if err != nil {
		t.Skipf("skipping: demo school not found (run migrations): %v", err)
	}
	return sc
}

func TestResolveSchool_NotFound(t *testing.T) {
	s := testServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/this-slug-does-not-exist-xyz/me", nil)
	rec := httptest.NewRecorder()

	s.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, rec.Body.String())
	}
	if !containsErrorCode(rec.Body.String(), "school_not_found") {
		t.Fatalf("expected school_not_found error code in body: %s", rec.Body.String())
	}
}

func TestRequireAuth_MissingToken(t *testing.T) {
	s := testServer(t)
	sc := demoSchool(t, s)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/"+sc.Slug+"/me", nil)
	rec := httptest.NewRecorder()

	s.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
	if !containsErrorCode(rec.Body.String(), "unauthorized") {
		t.Fatalf("expected unauthorized error code in body: %s", rec.Body.String())
	}
}

func TestRequireAuth_InvalidToken(t *testing.T) {
	s := testServer(t)
	sc := demoSchool(t, s)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/"+sc.Slug+"/me", nil)
	req.Header.Set("Authorization", "Bearer not-a-real-token")
	rec := httptest.NewRecorder()

	s.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRequireAuth_SchoolMismatch(t *testing.T) {
	s := testServer(t)
	sc := demoSchool(t, s)
	otherSchoolID := "00000000-0000-0000-0000-000000000000"
	tok, err := s.auth.IssueAccessToken(auth.Claims{UserID: "u1", Role: "admin", Email: "a@example.com", FullName: "Admin", SchoolID: &otherSchoolID})
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/"+sc.Slug+"/me", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()

	s.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for cross-school token, got %d: %s", rec.Code, rec.Body.String())
	}
	if !containsErrorCode(rec.Body.String(), "school_mismatch") {
		t.Fatalf("expected school_mismatch error code in body: %s", rec.Body.String())
	}
}

func TestRequireRole_Forbidden(t *testing.T) {
	s := testServer(t)
	sc := demoSchool(t, s)
	tok, err := s.auth.IssueAccessToken(auth.Claims{UserID: "u1", Role: "student", Email: "s@example.com", FullName: "Học Sinh", SchoolID: &sc.ID})
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/"+sc.Slug+"/users/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()

	s.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for student listing users, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSuperAdminRoute_RequiresSuperAdminRole(t *testing.T) {
	s := testServer(t)
	tok, err := s.auth.IssueAccessToken(auth.Claims{UserID: "u1", Role: "admin", Email: "a@example.com", FullName: "Admin"})
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/super-admin/schools/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()

	s.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-super-admin, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestUnknownRoute_NotFound(t *testing.T) {
	s := testServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/schools/does-not-exist", nil)
	rec := httptest.NewRecorder()

	s.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
	if !containsErrorCode(rec.Body.String(), "not_found") {
		t.Fatalf("expected not_found error code in body: %s", rec.Body.String())
	}
}

func TestLogin_RejectsMissingFields(t *testing.T) {
	s := testServer(t)
	sc := demoSchool(t, s)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/"+sc.Slug+"/auth/login", nil)
	req.Body = http.NoBody
	rec := httptest.NewRecorder()

	s.Routes().ServeHTTP(rec, req)

	// Decoding an empty body fails before any field validation runs.
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty login body, got %d: %s", rec.Code, rec.Body.String())
	}
}

func containsErrorCode(body, code string) bool {
	return strings.Contains(body, `"code":"`+code+`"`)
}
