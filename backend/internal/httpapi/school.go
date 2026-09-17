package httpapi

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/thuvientruong/backend/internal/auth"
)

// reservedSlugs collides with top-level segments mounted directly under
// /api/v1 (schools, super-admin) or with static top-level routes in the
// Next.js frontend (dang-ky) and must never be assignable to a tenant: the
// API would still route correctly (static beats wildcard) but a school
// living at that slug could never be reached through the web UI.
var reservedSlugs = map[string]bool{
	"schools":     true,
	"super-admin": true,
	"dang-ky":     true,
}

var slugPattern = regexp.MustCompile(`^[a-z0-9_-]{3,64}$`)

func normalizeSlug(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func validSlug(s string) bool {
	return slugPattern.MatchString(s) && !reservedSlugs[s]
}

type registerSchoolRequest struct {
	SchoolName    string `json:"school_name"`
	Slug          string `json:"slug"`
	Address       string `json:"address"`
	ContactPhone  string `json:"contact_phone"`
	ContactEmail  string `json:"contact_email"`
	AdminFullName string `json:"admin_full_name"`
	AdminEmail    string `json:"admin_email"`
	AdminPassword string `json:"admin_password"`
}

// registerSchool is public: anyone can submit a new school for approval. It
// creates the school (status=pending) and its first admin user in a single
// transaction, and never issues a token — the admin can only log in once
// super_admin approves the school.
func (s *Server) registerSchool(w http.ResponseWriter, r *http.Request) {
	var req registerSchoolRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	req.SchoolName = strings.TrimSpace(req.SchoolName)
	req.Slug = normalizeSlug(req.Slug)
	req.AdminFullName = strings.TrimSpace(req.AdminFullName)
	req.AdminEmail = strings.ToLower(strings.TrimSpace(req.AdminEmail))

	if req.SchoolName == "" || req.AdminFullName == "" || req.AdminEmail == "" || req.AdminPassword == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Thiếu thông tin bắt buộc.")
		return
	}
	if !validSlug(req.Slug) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_slug", "Mã trường chỉ gồm chữ thường, số, gạch dưới/gạch ngang, 3-64 ký tự.")
		return
	}
	if len(req.AdminPassword) < 6 {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Mật khẩu phải có ít nhất 6 ký tự.")
		return
	}

	hash, err := auth.HashPassword(req.AdminPassword)
	if err != nil {
		s.internalError(w, r, err)
		return
	}

	ctx := r.Context()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer tx.Rollback(ctx)

	var schoolID string
	err = tx.QueryRow(ctx, `
		INSERT INTO schools (slug, name, address, contact_phone, contact_email, status)
		VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), 'pending')
		RETURNING id`,
		req.Slug, req.SchoolName, req.Address, req.ContactPhone, req.ContactEmail).Scan(&schoolID)
	if isUniqueViolation(err) {
		writeError(w, http.StatusConflict, "slug_taken", "Mã trường này đã được sử dụng.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO users (email, password_hash, full_name, role, school_id)
		VALUES ($1, $2, $3, 'admin', $4)`,
		req.AdminEmail, hash, req.AdminFullName, schoolID)
	if isUniqueViolation(err) {
		writeError(w, http.StatusConflict, "email_taken", "Email quản trị này đã được sử dụng.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		s.internalError(w, r, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"message": "Đã gửi đăng ký, chờ quản trị hệ thống phê duyệt.",
	})
}

func (s *Server) checkSlug(w http.ResponseWriter, r *http.Request) {
	slug := normalizeSlug(r.URL.Query().Get("slug"))
	if !validSlug(slug) {
		writeJSON(w, http.StatusOK, map[string]any{"available": false, "reason": "invalid_format"})
		return
	}
	var exists bool
	if err := s.pool.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM schools WHERE slug = $1)`, slug).Scan(&exists); err != nil {
		s.internalError(w, r, err)
		return
	}
	if exists {
		writeJSON(w, http.StatusOK, map[string]any{"available": false, "reason": "taken"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"available": true})
}

type superAdminLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) superAdminLogin(w http.ResponseWriter, r *http.Request) {
	var req superAdminLoginRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || req.Password == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Vui lòng nhập email và mật khẩu.")
		return
	}

	row := s.pool.QueryRow(r.Context(), `SELECT `+userColumns+`, password_hash FROM users WHERE email = $1 AND role = 'super_admin'`, email)
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

	claims := auth.Claims{UserID: u.ID, Email: u.Email, Role: u.Role, FullName: u.FullName, SchoolID: nil}
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
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookie,
		Value:    refresh,
		Path:     "/api/v1/super-admin",
		MaxAge:   int(auth.RefreshTokenTTL.Seconds()),
		HttpOnly: true,
		Secure:   s.cfg.Production(),
		SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusOK, loginResponse{AccessToken: access, User: u})
}

func (s *Server) listSchools(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	page, pageSize, offset := pagination(r)

	var conds []string
	var args []any
	if status != "" {
		args = append(args, status)
		conds = append(conds, "status = $"+strconv.Itoa(len(args)))
	}
	if q != "" {
		args = append(args, "%"+q+"%")
		conds = append(conds, "(name ILIKE $"+strconv.Itoa(len(args))+" OR slug ILIKE $"+strconv.Itoa(len(args))+")")
	}
	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	var total int
	if err := s.pool.QueryRow(r.Context(), "SELECT COUNT(*) FROM schools "+where, args...).Scan(&total); err != nil {
		s.internalError(w, r, err)
		return
	}

	args = append(args, pageSize, offset)
	query := "SELECT " + schoolColumns + " FROM schools " + where + " ORDER BY created_at DESC LIMIT $" + strconv.Itoa(len(args)-1) + " OFFSET $" + strconv.Itoa(len(args))
	rows, err := s.pool.Query(r.Context(), query, args...)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()
	items := []School{}
	for rows.Next() {
		sc, err := scanSchool(rows)
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		items = append(items, sc)
	}
	writeJSON(w, http.StatusOK, pagedResponse(items, total, page, pageSize))
}

func (s *Server) getSchoolByID(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	row := s.pool.QueryRow(r.Context(), `SELECT `+schoolColumns+` FROM schools WHERE id = $1`, id)
	sc, err := scanSchool(row)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy trường.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, sc)
}

// transitionSchool moves a school from one of fromStatuses into toStatus,
// optionally setting extra columns (e.g. rejection_reason, approved_by/at),
// and 409s if the school isn't currently in an allowed starting state.
func (s *Server) transitionSchool(w http.ResponseWriter, r *http.Request, fromStatuses []string, toStatus string, extraSet string, extraArgs ...any) {
	id := pathParam(r, "id")
	ctx := r.Context()

	var current string
	if err := s.pool.QueryRow(ctx, `SELECT status FROM schools WHERE id = $1`, id).Scan(&current); errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy trường.")
		return
	} else if err != nil {
		s.internalError(w, r, err)
		return
	}
	allowed := false
	for _, f := range fromStatuses {
		if current == f {
			allowed = true
			break
		}
	}
	if !allowed {
		writeError(w, http.StatusConflict, "invalid_state", "Trường không ở trạng thái phù hợp cho thao tác này.")
		return
	}

	args := append(append([]any{}, extraArgs...), toStatus, id)
	query := "UPDATE schools SET status = $" + strconv.Itoa(len(args)-1) + extraSet + " WHERE id = $" + strconv.Itoa(len(args)) + " RETURNING " + schoolColumns
	row := s.pool.QueryRow(ctx, query, args...)
	sc, err := scanSchool(row)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, sc)
}

func (s *Server) approveSchool(w http.ResponseWriter, r *http.Request) {
	claims := mustClaims(r)
	s.transitionSchool(w, r, []string{"pending", "rejected", "suspended"}, "approved",
		", rejection_reason = NULL, approved_by = $1, approved_at = now()", claims.UserID)
}

type rejectSchoolRequest struct {
	Reason string `json:"reason"`
}

func (s *Server) rejectSchool(w http.ResponseWriter, r *http.Request) {
	var req rejectSchoolRequest
	_ = decodeJSON(w, r, &req)
	s.transitionSchool(w, r, []string{"pending"}, "rejected", ", rejection_reason = $1", req.Reason)
}

func (s *Server) suspendSchool(w http.ResponseWriter, r *http.Request) {
	s.transitionSchool(w, r, []string{"approved"}, "suspended", "")
}

func (s *Server) reactivateSchool(w http.ResponseWriter, r *http.Request) {
	s.transitionSchool(w, r, []string{"suspended"}, "approved", "")
}
