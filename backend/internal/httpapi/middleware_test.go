package httpapi

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/thuvientruong/backend/internal/auth"
	"github.com/thuvientruong/backend/internal/config"
)

func testServer() *Server {
	return New(Deps{
		Config: config.Config{CORSOrigin: "http://localhost:3400"},
		Auth:   auth.New("test-secret-at-least-16-bytes"),
		Log:    slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
}

func TestRequireAuth_MissingToken(t *testing.T) {
	s := testServer()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
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
	s := testServer()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	req.Header.Set("Authorization", "Bearer not-a-real-token")
	rec := httptest.NewRecorder()

	s.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRequireRole_Forbidden(t *testing.T) {
	s := testServer()
	tok, err := s.auth.IssueAccessToken(auth.Claims{UserID: "u1", Role: "student", Email: "s@example.com", FullName: "Học Sinh"})
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()

	s.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for student listing users, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestUnknownRoute_NotFound(t *testing.T) {
	s := testServer()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/does-not-exist", nil)
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
	s := testServer()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
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
