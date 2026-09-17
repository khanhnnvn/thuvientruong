package httpapi

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/thuvientruong/backend/internal/auth"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	AccessToken string `json:"access_token"`
	User        User   `json:"user"`
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	sc := mustSchool(r)
	var req loginRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || req.Password == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Vui lòng nhập email và mật khẩu.")
		return
	}

	// role <> 'super_admin' is implied by scoping to a school_id, but stated
	// explicitly so a super_admin account can never authenticate through a
	// tenant login endpoint even if it somehow shared a school_id.
	row := s.pool.QueryRow(r.Context(),
		`SELECT `+userColumns+`, password_hash FROM users WHERE email = $1 AND school_id = $2 AND role <> 'super_admin'`,
		email, sc.ID)
	var u User
	var hash string
	err := row.Scan(&u.ID, &u.Email, &u.Phone, &u.FullName, &u.Role, &u.Status, &u.ClassName, &u.StudentCode,
		&u.MaxBorrow, &u.CreatedAt, &u.UpdatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		auth.BurnPasswordCheck(req.Password)
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Email hoặc mật khẩu không đúng.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if !auth.CheckPassword(hash, req.Password) {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Email hoặc mật khẩu không đúng.")
		return
	}
	if u.Status != "active" {
		writeError(w, http.StatusForbidden, "account_disabled", "Tài khoản của bạn hiện không hoạt động.")
		return
	}

	claims := auth.Claims{UserID: u.ID, Email: u.Email, Role: u.Role, FullName: u.FullName, SchoolID: &sc.ID}
	access, err := s.auth.IssueAccessToken(claims)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	refresh, err := s.auth.IssueRefreshToken(claims)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	s.setRefreshCookie(w, sc.Slug, refresh)
	writeJSON(w, http.StatusOK, loginResponse{AccessToken: access, User: u})
}

func (s *Server) setRefreshCookie(w http.ResponseWriter, slug, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookie,
		Value:    value,
		Path:     "/api/v1/" + slug + "/auth",
		MaxAge:   int(auth.RefreshTokenTTL / time.Second),
		HttpOnly: true,
		Secure:   s.cfg.Production(),
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Server) refresh(w http.ResponseWriter, r *http.Request) {
	sc := mustSchool(r)
	c, err := r.Cookie(refreshCookie)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Vui lòng đăng nhập lại.")
		return
	}
	claims, err := s.auth.ParseRefreshToken(c.Value)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.")
		return
	}
	if claims.SchoolID == nil || *claims.SchoolID != sc.ID {
		writeError(w, http.StatusForbidden, "school_mismatch", "Tài khoản này không thuộc trường đang truy cập.")
		return
	}

	// Re-check the account is still active before minting a fresh access token.
	row := s.pool.QueryRow(r.Context(), `SELECT `+userColumns+` FROM users WHERE id = $1 AND school_id = $2`, claims.UserID, sc.ID)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && u.Status != "active") {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Tài khoản không còn hoạt động.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}

	fresh := auth.Claims{UserID: u.ID, Email: u.Email, Role: u.Role, FullName: u.FullName, SchoolID: &sc.ID}
	access, err := s.auth.IssueAccessToken(fresh)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"access_token": access})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	sc := mustSchool(r)
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookie,
		Value:    "",
		Path:     "/api/v1/" + sc.Slug + "/auth",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.cfg.Production(),
		SameSite: http.SameSiteLaxMode,
	})
	w.WriteHeader(http.StatusNoContent)
}
