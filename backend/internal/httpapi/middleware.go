package httpapi

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/thuvientruong/backend/internal/auth"
)

type ctxKey int

const (
	ctxClaims ctxKey = iota
	ctxSchool
)

func claimsFrom(ctx context.Context) (auth.Claims, bool) {
	c, ok := ctx.Value(ctxClaims).(auth.Claims)
	return c, ok
}

// mustClaims returns the caller's claims. It must only be called from a
// handler mounted behind requireAuth, which guarantees they are present.
func mustClaims(r *http.Request) auth.Claims {
	c, _ := claimsFrom(r.Context())
	return c
}

func schoolFrom(ctx context.Context) (School, bool) {
	sc, ok := ctx.Value(ctxSchool).(School)
	return sc, ok
}

// mustSchool returns the tenant resolved for this request. It must only be
// called from a handler mounted behind resolveSchool, which guarantees it is
// present.
func mustSchool(r *http.Request) School {
	sc, _ := schoolFrom(r.Context())
	return sc
}

// schoolID is a convenience for the common case of just needing the id of
// the tenant scoping the current request.
func schoolID(r *http.Request) string {
	return mustSchool(r).ID
}

const refreshCookie = "refresh_token"

// resolveSchool reads the :slug URL parameter, looks up the matching school
// and attaches it to the request context. It must be mounted on every
// school-scoped route group, including the public auth endpoints, since an
// unapproved school must never allow login either.
func (s *Server) resolveSchool(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "slug")
		row := s.pool.QueryRow(r.Context(), `SELECT `+schoolColumns+` FROM schools WHERE slug = $1`, slug)
		sc, err := scanSchool(row)
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "school_not_found", "Không tìm thấy trường.")
			return
		}
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		if sc.Status != "approved" {
			writeJSON(w, http.StatusForbidden, map[string]any{
				"error": map[string]any{
					"code":    "school_not_approved",
					"message": "Trường chưa được kích hoạt hoặc đang bị khoá.",
					"status":  sc.Status,
				},
			})
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxSchool, sc)))
	})
}

// requireAuth verifies the Authorization: Bearer <token> access token and
// attaches its claims to the request context. It performs no database
// lookup — role and identity come straight from the signed token. When
// mounted behind resolveSchool, it additionally rejects tokens whose
// school_id does not match the school in the URL, preventing a user of one
// school from ever acting against another school's data with their token.
func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		token, ok := strings.CutPrefix(h, "Bearer ")
		if !ok || token == "" {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Vui lòng đăng nhập.")
			return
		}
		claims, err := s.auth.ParseAccessToken(token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.")
			return
		}
		if sc, ok := schoolFrom(r.Context()); ok {
			if claims.SchoolID == nil || *claims.SchoolID != sc.ID {
				writeError(w, http.StatusForbidden, "school_mismatch", "Tài khoản này không thuộc trường đang truy cập.")
				return
			}
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxClaims, claims)))
	})
}

// requireSuperAdmin verifies the Authorization: Bearer <token> access token
// belongs to the single system-wide super_admin account. Mounted only on
// /api/v1/super-admin/* routes, which have no :slug and no school context.
func (s *Server) requireSuperAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		token, ok := strings.CutPrefix(h, "Bearer ")
		if !ok || token == "" {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Vui lòng đăng nhập.")
			return
		}
		claims, err := s.auth.ParseAccessToken(token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.")
			return
		}
		if claims.Role != "super_admin" {
			writeError(w, http.StatusForbidden, "forbidden", "Bạn không có quyền thực hiện thao tác này.")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxClaims, claims)))
	})
}

// requireRole must be chained after requireAuth.
func (s *Server) requireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := mustClaims(r)
			if !slices.Contains(roles, claims.Role) {
				writeError(w, http.StatusForbidden, "forbidden", "Bạn không có quyền thực hiện thao tác này.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", s.cfg.CORSOrigin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Vary", "Origin")
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	if w.status == 0 {
		w.status = code
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(b)
}

func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			next.ServeHTTP(w, r)
			return
		}
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w}
		next.ServeHTTP(sw, r)
		s.log.Info("http", "method", r.Method, "path", r.URL.Path, "status", sw.status,
			"duration_ms", time.Since(start).Milliseconds())
	})
}

func (s *Server) recoverPanics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				s.log.Error("panic", "path", r.URL.Path, "panic", rec)
				writeError(w, http.StatusInternalServerError, "internal_error", "Đã xảy ra lỗi, vui lòng thử lại sau.")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
