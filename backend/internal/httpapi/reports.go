package httpapi

import (
	"net/http"
	"time"
)

func (s *Server) reportOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var totalBooks, totalCopies, borrowedNow, overdueNow, unpaidFinesCount int
	var unpaidFinesTotal string

	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM books`).Scan(&totalBooks); err != nil {
		s.internalError(w, r, err)
		return
	}
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM book_copies`).Scan(&totalCopies); err != nil {
		s.internalError(w, r, err)
		return
	}
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM borrow_records WHERE status IN ('borrowed','overdue')`).Scan(&borrowedNow); err != nil {
		s.internalError(w, r, err)
		return
	}
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM borrow_records WHERE status IN ('borrowed','overdue') AND due_at < now()`).Scan(&overdueNow); err != nil {
		s.internalError(w, r, err)
		return
	}
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*), COALESCE(SUM(amount),0) FROM fines WHERE status = 'unpaid'`).Scan(&unpaidFinesCount, &unpaidFinesTotal); err != nil {
		s.internalError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"total_books":        totalBooks,
		"total_copies":       totalCopies,
		"currently_borrowed": borrowedNow,
		"overdue":            overdueNow,
		"unpaid_fines_count": unpaidFinesCount,
		"unpaid_fines_total": unpaidFinesTotal,
	})
}

type overdueRow struct {
	BorrowID  string    `json:"borrow_id"`
	UserID    string    `json:"user_id"`
	UserName  string    `json:"user_name"`
	BookTitle string    `json:"book_title"`
	CopyCode  string    `json:"copy_code"`
	DueAt     time.Time `json:"due_at"`
	DaysLate  int       `json:"days_late"`
}

func (s *Server) reportOverdue(w http.ResponseWriter, r *http.Request) {
	rows, err := s.pool.Query(r.Context(), `
		SELECT br.id, u.id, u.full_name, b.title, bc.copy_code, br.due_at,
			GREATEST(0, CEIL(EXTRACT(EPOCH FROM (now() - br.due_at)) / 86400))::int AS days_late
		FROM borrow_records br
		JOIN users u ON u.id = br.user_id
		JOIN book_copies bc ON bc.id = br.copy_id
		JOIN books b ON b.id = bc.book_id
		WHERE br.status IN ('borrowed','overdue') AND br.due_at < now()
		ORDER BY br.due_at`)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()
	items := []overdueRow{}
	for rows.Next() {
		var o overdueRow
		if err := rows.Scan(&o.BorrowID, &o.UserID, &o.UserName, &o.BookTitle, &o.CopyCode, &o.DueAt, &o.DaysLate); err != nil {
			s.internalError(w, r, err)
			return
		}
		items = append(items, o)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

type popularBookRow struct {
	BookID      string `json:"book_id"`
	Title       string `json:"title"`
	BorrowCount int    `json:"borrow_count"`
}

func (s *Server) reportPopularBooks(w http.ResponseWriter, r *http.Request) {
	from := parseDateOrZero(r.URL.Query().Get("from"))
	to := parseDateOrZero(r.URL.Query().Get("to"))
	if to.IsZero() {
		to = time.Now()
	}

	rows, err := s.pool.Query(r.Context(), `
		SELECT b.id, b.title, COUNT(*) AS borrow_count
		FROM borrow_records br
		JOIN book_copies bc ON bc.id = br.copy_id
		JOIN books b ON b.id = bc.book_id
		WHERE br.borrowed_at >= $1 AND br.borrowed_at <= $2
		GROUP BY b.id, b.title
		ORDER BY borrow_count DESC
		LIMIT 20`, from, to)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()
	items := []popularBookRow{}
	for rows.Next() {
		var p popularBookRow
		if err := rows.Scan(&p.BookID, &p.Title, &p.BorrowCount); err != nil {
			s.internalError(w, r, err)
			return
		}
		items = append(items, p)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "from": from, "to": to})
}

func parseDateOrZero(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t
	}
	return time.Time{}
}
