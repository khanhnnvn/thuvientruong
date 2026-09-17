package httpapi

import (
	"crypto/rand"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/thuvientruong/backend/internal/auth"
)

var validRoles = []string{"admin", "librarian", "teacher", "student", "parent"}

func (s *Server) listUsers(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	page, pageSize, offset := pagination(r)

	args := []any{schoolID(r)}
	conds := []string{"school_id = $1"}
	if role != "" {
		args = append(args, role)
		conds = append(conds, fmt.Sprintf("role = $%d", len(args)))
	}
	if q != "" {
		args = append(args, "%"+q+"%")
		conds = append(conds, fmt.Sprintf("(full_name ILIKE $%d OR email ILIKE $%d OR student_code ILIKE $%d)", len(args), len(args), len(args)))
	}
	where := "WHERE " + strings.Join(conds, " AND ")

	var total int
	if err := s.pool.QueryRow(r.Context(), "SELECT COUNT(*) FROM users "+where, args...).Scan(&total); err != nil {
		s.internalError(w, r, err)
		return
	}

	args = append(args, pageSize, offset)
	query := fmt.Sprintf(`SELECT %s FROM users %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		userColumns, where, len(args)-1, len(args))
	rows, err := s.pool.Query(r.Context(), query, args...)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()

	users := []User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, pagedResponse(users, total, page, pageSize))
}

type createUserRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	FullName    string `json:"full_name"`
	Role        string `json:"role"`
	Phone       string `json:"phone"`
	ClassName   string `json:"class_name"`
	StudentCode string `json:"student_code"`
	MaxBorrow   *int   `json:"max_borrow"`
}

func (s *Server) createUser(w http.ResponseWriter, r *http.Request) {
	claims := mustClaims(r)
	var req createUserRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.FullName = strings.TrimSpace(req.FullName)
	if req.Email == "" || req.Password == "" || req.FullName == "" || req.Role == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Thiếu thông tin bắt buộc.")
		return
	}
	if !slices.Contains(validRoles, req.Role) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_role", "Vai trò không hợp lệ.")
		return
	}
	if claims.Role == "librarian" && req.Role != "student" && req.Role != "teacher" {
		writeError(w, http.StatusForbidden, "forbidden", "Thủ thư chỉ được tạo tài khoản học sinh hoặc giáo viên.")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Mật khẩu phải có ít nhất 6 ký tự.")
		return
	}
	maxBorrow := 3
	if req.MaxBorrow != nil {
		maxBorrow = *req.MaxBorrow
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		s.internalError(w, r, err)
		return
	}

	row := s.pool.QueryRow(r.Context(), `
		INSERT INTO users (email, phone, password_hash, full_name, role, class_name, student_code, max_borrow, school_id)
		VALUES ($1, NULLIF($2,''), $3, $4, $5, NULLIF($6,''), NULLIF($7,''), $8, $9)
		RETURNING `+userColumns,
		req.Email, req.Phone, hash, req.FullName, req.Role, req.ClassName, req.StudentCode, maxBorrow, schoolID(r))
	u, err := scanUser(row)
	if isUniqueViolation(err) {
		writeError(w, http.StatusConflict, "email_taken", "Email đã được sử dụng.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, u)
}

func (s *Server) getUser(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	row := s.pool.QueryRow(r.Context(), `SELECT `+userColumns+` FROM users WHERE id = $1 AND school_id = $2`, id, schoolID(r))
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy người dùng.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, u)
}

type updateUserRequest struct {
	FullName    *string `json:"full_name"`
	Phone       *string `json:"phone"`
	Role        *string `json:"role"`
	Status      *string `json:"status"`
	ClassName   *string `json:"class_name"`
	StudentCode *string `json:"student_code"`
	MaxBorrow   *int    `json:"max_borrow"`
}

func (s *Server) updateUser(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	var req updateUserRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Role != nil && !slices.Contains(validRoles, *req.Role) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_role", "Vai trò không hợp lệ.")
		return
	}
	if req.Status != nil && !slices.Contains([]string{"active", "suspended", "disabled"}, *req.Status) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_status", "Trạng thái không hợp lệ.")
		return
	}

	sets := []string{"updated_at = now()"}
	var args []any
	add := func(col string, val any) {
		args = append(args, val)
		sets = append(sets, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	if req.FullName != nil {
		add("full_name", *req.FullName)
	}
	if req.Phone != nil {
		add("phone", *req.Phone)
	}
	if req.Role != nil {
		add("role", *req.Role)
	}
	if req.Status != nil {
		add("status", *req.Status)
	}
	if req.ClassName != nil {
		add("class_name", *req.ClassName)
	}
	if req.StudentCode != nil {
		add("student_code", *req.StudentCode)
	}
	if req.MaxBorrow != nil {
		add("max_borrow", *req.MaxBorrow)
	}

	args = append(args, id, schoolID(r))
	query := fmt.Sprintf(`UPDATE users SET %s WHERE id = $%d AND school_id = $%d RETURNING %s`, strings.Join(sets, ", "), len(args)-1, len(args), userColumns)
	row := s.pool.QueryRow(r.Context(), query, args...)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy người dùng.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, u)
}

type resetPasswordRequest struct {
	NewPassword string `json:"new_password"`
}

func (s *Server) resetPassword(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	var req resetPasswordRequest
	_ = decodeJSON(w, r, &req) // body is optional; ignore decode failure on empty body
	password := req.NewPassword
	generated := false
	if password == "" {
		password = randomPassword()
		generated = true
	} else if len(password) < 6 {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Mật khẩu phải có ít nhất 6 ký tự.")
		return
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	tag, err := s.pool.Exec(r.Context(), `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 AND school_id = $3`, hash, id, schoolID(r))
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy người dùng.")
		return
	}
	resp := map[string]any{"ok": true}
	if generated {
		resp["new_password"] = password
	}
	writeJSON(w, http.StatusOK, resp)
}

func randomPassword() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
	b := make([]byte, 10)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(b)
}

type linkParentRequest struct {
	ParentID string `json:"parent_id"`
}

func (s *Server) linkParent(w http.ResponseWriter, r *http.Request) {
	studentID := pathParam(r, "id")
	var req linkParentRequest
	if !decodeJSON(w, r, &req) || req.ParentID == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Thiếu parent_id.")
		return
	}

	sid := schoolID(r)
	var studentRole, parentRole string
	if err := s.pool.QueryRow(r.Context(), `SELECT role FROM users WHERE id = $1 AND school_id = $2`, studentID, sid).Scan(&studentRole); errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy học sinh.")
		return
	} else if err != nil {
		s.internalError(w, r, err)
		return
	}
	if studentRole != "student" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Tài khoản này không phải học sinh.")
		return
	}
	if err := s.pool.QueryRow(r.Context(), `SELECT role FROM users WHERE id = $1 AND school_id = $2`, req.ParentID, sid).Scan(&parentRole); errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy phụ huynh.")
		return
	} else if err != nil {
		s.internalError(w, r, err)
		return
	}
	if parentRole != "parent" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Tài khoản liên kết không phải phụ huynh.")
		return
	}

	_, err := s.pool.Exec(r.Context(),
		`INSERT INTO parent_links (parent_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		req.ParentID, studentID)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
