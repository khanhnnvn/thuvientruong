package httpapi

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

func (s *Server) listFines(w http.ResponseWriter, r *http.Request) {
	claims := mustClaims(r)
	userID := r.URL.Query().Get("user_id")
	status := r.URL.Query().Get("status")

	isStaff := claims.Role == "admin" || claims.Role == "librarian"
	if !isStaff {
		if userID == "" {
			userID = claims.UserID
		}
		ok, err := s.authorizedForUser(r, userID)
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		if !ok {
			writeError(w, http.StatusForbidden, "forbidden", "Bạn không có quyền xem khoản phạt này.")
			return
		}
	}

	args := []any{schoolID(r)}
	conds := []string{"school_id = $1"}
	if userID != "" {
		args = append(args, userID)
		conds = append(conds, fmt.Sprintf("user_id = $%d", len(args)))
	}
	if status != "" {
		args = append(args, status)
		conds = append(conds, fmt.Sprintf("status = $%d", len(args)))
	}
	where := "WHERE " + strings.Join(conds, " AND ")
	rows, err := s.pool.Query(r.Context(), fmt.Sprintf(`SELECT %s FROM fines %s ORDER BY created_at DESC`, fineColumns, where), args...)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()
	items := []Fine{}
	for rows.Next() {
		f, err := scanFine(rows)
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		items = append(items, f)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) payFine(w http.ResponseWriter, r *http.Request) {
	s.settleFine(w, r, "paid")
}

func (s *Server) waiveFine(w http.ResponseWriter, r *http.Request) {
	s.settleFine(w, r, "waived")
}

func (s *Server) settleFine(w http.ResponseWriter, r *http.Request, newStatus string) {
	id := pathParam(r, "id")
	row := s.pool.QueryRow(r.Context(), `SELECT `+fineColumns+` FROM fines WHERE id = $1 AND school_id = $2`, id, schoolID(r))
	f, err := scanFine(row)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy khoản phạt.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if f.Status != "unpaid" {
		writeError(w, http.StatusConflict, "invalid_state", "Khoản phạt này đã được xử lý.")
		return
	}
	row = s.pool.QueryRow(r.Context(),
		`UPDATE fines SET status = $1, paid_at = now() WHERE id = $2 RETURNING `+fineColumns, newStatus, id)
	updated, err := scanFine(row)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}
