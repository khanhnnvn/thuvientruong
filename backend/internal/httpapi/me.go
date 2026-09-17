package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

func (s *Server) getMe(w http.ResponseWriter, r *http.Request) {
	claims := mustClaims(r)
	row := s.pool.QueryRow(r.Context(), `SELECT `+userColumns+` FROM users WHERE id = $1 AND school_id = $2`, claims.UserID, schoolID(r))
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

type childStatus struct {
	User
	ActiveBorrows int    `json:"active_borrows"`
	OverdueCount  int    `json:"overdue_count"`
	UnpaidFines   string `json:"unpaid_fines_total"`
}

func (s *Server) getMyChildren(w http.ResponseWriter, r *http.Request) {
	claims := mustClaims(r)
	if claims.Role != "parent" {
		writeError(w, http.StatusForbidden, "forbidden", "Chỉ phụ huynh mới có thể xem danh sách con.")
		return
	}

	rows, err := s.pool.Query(r.Context(), `
		SELECT `+prefixColumns("u", userColumns)+`,
			COALESCE((SELECT COUNT(*) FROM borrow_records br WHERE br.user_id = u.id AND br.status IN ('borrowed','overdue')), 0),
			COALESCE((SELECT COUNT(*) FROM borrow_records br WHERE br.user_id = u.id AND br.status = 'overdue'), 0),
			COALESCE((SELECT SUM(f.amount) FROM fines f WHERE f.user_id = u.id AND f.status = 'unpaid'), 0)
		FROM parent_links pl
		JOIN users u ON u.id = pl.student_id
		WHERE pl.parent_id = $1 AND u.school_id = $2
		ORDER BY u.full_name`, claims.UserID, schoolID(r))
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()

	children := []childStatus{}
	for rows.Next() {
		var cs childStatus
		if err := rows.Scan(&cs.ID, &cs.Email, &cs.Phone, &cs.FullName, &cs.Role, &cs.Status, &cs.ClassName, &cs.StudentCode,
			&cs.MaxBorrow, &cs.CreatedAt, &cs.UpdatedAt, &cs.ActiveBorrows, &cs.OverdueCount, &cs.UnpaidFines); err != nil {
			s.internalError(w, r, err)
			return
		}
		children = append(children, cs)
	}
	if err := rows.Err(); err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"children": children})
}

// isParentOf reports whether callerID (a parent) is linked to studentID,
// scoped to the current school so a link can never be used to reach across
// tenants even if the ids happened to collide.
func (s *Server) isParentOf(r *http.Request, parentID, studentID string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(r.Context(),
		`SELECT EXISTS (
			SELECT 1 FROM parent_links pl
			JOIN users s ON s.id = pl.student_id
			WHERE pl.parent_id = $1 AND pl.student_id = $2 AND s.school_id = $3
		)`,
		parentID, studentID, schoolID(r)).Scan(&exists)
	return exists, err
}

// prefixColumns turns "a, b, c" into "alias.a, alias.b, alias.c" so a shared
// column list constant can be reused in a query that joins other tables.
func prefixColumns(alias, cols string) string {
	parts := strings.Split(cols, ",")
	for i, c := range parts {
		parts[i] = alias + "." + strings.TrimSpace(c)
	}
	return strings.Join(parts, ", ")
}
