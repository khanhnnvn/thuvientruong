package httpapi

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/thuvientruong/backend/internal/auth"
)

type ctxKey int

const ctxClaims ctxKey = iota

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

const refreshCookie = "refresh_token"

// requireAuth verifies the Authorization: Bearer <token> access token and
// attaches its claims to the request context. It performs no database
// lookup — role and identity come straight from the signed token.
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
