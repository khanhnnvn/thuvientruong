package httpapi

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	defaultLoanDays  = 14
	renewExtraDays   = 7
	fineRatePerDayVN = 2000 // VND per day overdue; not specified precisely in the API contract.
)

// authorizedForUser reports whether the caller may act on/view records
// belonging to targetUserID: staff always can, the owner can act on their own
// records, and a parent can view (not act on) their linked child's records.
func (s *Server) authorizedForUser(r *http.Request, targetUserID string) (bool, error) {
	claims := mustClaims(r)
	if claims.Role == "admin" || claims.Role == "librarian" {
		return true, nil
	}
	if claims.UserID == targetUserID {
		return true, nil
	}
	if claims.Role == "parent" {
		return s.isParentOf(r, claims.UserID, targetUserID)
	}
	return false, nil
}

type createBorrowRequest struct {
	CopyID string  `json:"copy_id"`
	UserID string  `json:"user_id"`
	DueAt  *string `json:"due_at"`
}

func (s *Server) createBorrow(w http.ResponseWriter, r *http.Request) {
	claims := mustClaims(r)
	var req createBorrowRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.CopyID == "" || req.UserID == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Thiếu copy_id hoặc user_id.")
		return
	}

	sid := schoolID(r)
	ctx := r.Context()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer tx.Rollback(ctx)

	var copyStatus string
	if err := tx.QueryRow(ctx, `SELECT status FROM book_copies WHERE id = $1 AND school_id = $2 FOR UPDATE`, req.CopyID, sid).Scan(&copyStatus); errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy bản sao.")
		return
	} else if err != nil {
		s.internalError(w, r, err)
		return
	}
	if copyStatus != "available" {
		writeError(w, http.StatusConflict, "copy_unavailable", "Bản sao hiện không sẵn sàng để cho mượn.")
		return
	}

	var userStatus string
	var maxBorrow int
	if err := tx.QueryRow(ctx, `SELECT status, max_borrow FROM users WHERE id = $1 AND school_id = $2`, req.UserID, sid).Scan(&userStatus, &maxBorrow); errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy người mượn.")
		return
	} else if err != nil {
		s.internalError(w, r, err)
		return
	}
	if userStatus != "active" {
		writeError(w, http.StatusForbidden, "account_disabled", "Tài khoản người mượn hiện không hoạt động.")
		return
	}

	var activeCount int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM borrow_records WHERE user_id = $1 AND status IN ('borrowed','overdue')`, req.UserID).Scan(&activeCount); err != nil {
		s.internalError(w, r, err)
		return
	}
	if activeCount >= maxBorrow {
		writeError(w, http.StatusConflict, "max_borrow_reached", "Người dùng đã mượn đủ số lượng tối đa cho phép.")
		return
	}

	var unpaidFines int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM fines WHERE user_id = $1 AND status = 'unpaid'`, req.UserID).Scan(&unpaidFines); err != nil {
		s.internalError(w, r, err)
		return
	}
	if unpaidFines > 0 {
		writeError(w, http.StatusConflict, "unpaid_fine", "Người dùng còn khoản phạt chưa thanh toán.")
		return
	}

	dueAt := time.Now().AddDate(0, 0, defaultLoanDays)
	if req.DueAt != nil && *req.DueAt != "" {
		parsed, err := time.Parse(time.RFC3339, *req.DueAt)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, "invalid_request", "due_at không đúng định dạng ISO 8601.")
			return
		}
		dueAt = parsed
	}

	row := tx.QueryRow(ctx, `
		INSERT INTO borrow_records (copy_id, user_id, approved_by, due_at, school_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING `+borrowColumns,
		req.CopyID, req.UserID, claims.UserID, dueAt, sid)
	b, err := scanBorrow(row)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if _, err := tx.Exec(ctx, `UPDATE book_copies SET status = 'borrowed' WHERE id = $1`, req.CopyID); err != nil {
		s.internalError(w, r, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, b)
}

type returnBorrowRequest struct {
	Lost      bool   `json:"lost"`
	Damaged   bool   `json:"damaged"`
	Condition string `json:"condition"`
}

func (s *Server) returnBorrow(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	var req returnBorrowRequest
	_ = decodeJSON(w, r, &req)

	sid := schoolID(r)
	ctx := r.Context()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, `SELECT `+borrowColumns+` FROM borrow_records WHERE id = $1 AND school_id = $2 FOR UPDATE`, id, sid)
	b, err := scanBorrow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy phiếu mượn.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if b.Status == "returned" {
		writeError(w, http.StatusConflict, "already_returned", "Phiếu mượn này đã được trả.")
		return
	}

	now := time.Now()
	if _, err := tx.Exec(ctx, `UPDATE borrow_records SET status = 'returned', returned_at = $1 WHERE id = $2`, now, id); err != nil {
		s.internalError(w, r, err)
		return
	}

	// Overdue fine, regardless of condition on return.
	if now.After(b.DueAt) {
		daysLate := int(math.Ceil(now.Sub(b.DueAt).Hours() / 24))
		amount := fmt.Sprintf("%.2f", float64(daysLate)*fineRatePerDayVN)
		if _, err := tx.Exec(ctx, `INSERT INTO fines (borrow_record_id, user_id, amount, reason, school_id) VALUES ($1, $2, $3, 'overdue', $4)`,
			b.ID, b.UserID, amount, sid); err != nil {
			s.internalError(w, r, err)
			return
		}
	}

	var bookID string
	newCopyStatus := "available"
	switch {
	case req.Lost:
		newCopyStatus = "lost"
	case req.Damaged:
		newCopyStatus = "damaged"
	}
	if req.Lost || req.Damaged {
		var price *string
		if err := tx.QueryRow(ctx, `SELECT book_id, price FROM book_copies WHERE id = $1`, b.CopyID).Scan(&bookID, &price); err != nil {
			s.internalError(w, r, err)
			return
		}
		amount := "0.00"
		if price != nil {
			amount = *price
		}
		reason := "damaged"
		if req.Lost {
			reason = "lost"
		}
		if _, err := tx.Exec(ctx, `INSERT INTO fines (borrow_record_id, user_id, amount, reason, school_id) VALUES ($1, $2, $3, $4, $5)`,
			b.ID, b.UserID, amount, reason, sid); err != nil {
			s.internalError(w, r, err)
			return
		}
		if _, err := tx.Exec(ctx, `UPDATE book_copies SET status = $1 WHERE id = $2`, newCopyStatus, b.CopyID); err != nil {
			s.internalError(w, r, err)
			return
		}
	} else {
		condition := req.Condition
		if _, err := tx.Exec(ctx, `UPDATE book_copies SET status = 'available', condition = COALESCE(NULLIF($1,'')::copy_condition, condition) WHERE id = $2`,
			condition, b.CopyID); err != nil {
			s.internalError(w, r, err)
			return
		}
		if err := tx.QueryRow(ctx, `SELECT book_id FROM book_copies WHERE id = $1`, b.CopyID).Scan(&bookID); err != nil {
			s.internalError(w, r, err)
			return
		}
		// A copy is now available: promote the oldest pending reservation, if any.
		var resID, resUserID string
		err := tx.QueryRow(ctx, `SELECT id, user_id FROM reservations WHERE book_id = $1 AND school_id = $2 AND status = 'pending' ORDER BY reserved_at LIMIT 1 FOR UPDATE`, bookID, sid).
			Scan(&resID, &resUserID)
		if err == nil {
			expires := now.AddDate(0, 0, 3)
			if _, err := tx.Exec(ctx, `UPDATE reservations SET status = 'ready', expires_at = $1 WHERE id = $2`, expires, resID); err != nil {
				s.internalError(w, r, err)
				return
			}
			if _, err := tx.Exec(ctx, `INSERT INTO notifications (user_id, type, message, school_id) VALUES ($1, 'reservation_ready', 'Sách bạn đặt trước đã sẵn sàng để nhận.', $2)`, resUserID, sid); err != nil {
				s.internalError(w, r, err)
				return
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			s.internalError(w, r, err)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		s.internalError(w, r, err)
		return
	}

	row = s.pool.QueryRow(ctx, `SELECT `+borrowColumns+` FROM borrow_records WHERE id = $1`, id)
	updated, err := scanBorrow(row)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) renewBorrow(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	claims := mustClaims(r)
	sid := schoolID(r)
	ctx := r.Context()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, `SELECT `+borrowColumns+` FROM borrow_records WHERE id = $1 AND school_id = $2 FOR UPDATE`, id, sid)
	b, err := scanBorrow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy phiếu mượn.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}

	isStaff := claims.Role == "admin" || claims.Role == "librarian"
	if !isStaff && claims.UserID != b.UserID {
		writeError(w, http.StatusForbidden, "forbidden", "Bạn không có quyền gia hạn phiếu mượn này.")
		return
	}
	if b.Status != "borrowed" {
		writeError(w, http.StatusConflict, "invalid_state", "Chỉ có thể gia hạn phiếu mượn đang mượn.")
		return
	}
	now := time.Now()
	if now.After(b.DueAt) {
		writeError(w, http.StatusConflict, "overdue", "Không thể gia hạn phiếu mượn đã quá hạn.")
		return
	}
	if b.RenewedCount >= 1 {
		writeError(w, http.StatusConflict, "renew_limit_reached", "Phiếu mượn này đã được gia hạn tối đa 1 lần.")
		return
	}

	var bookID string
	if err := tx.QueryRow(ctx, `SELECT book_id FROM book_copies WHERE id = $1`, b.CopyID).Scan(&bookID); err != nil {
		s.internalError(w, r, err)
		return
	}
	var reserved bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM reservations WHERE book_id = $1 AND status IN ('pending','ready'))`, bookID).Scan(&reserved); err != nil {
		s.internalError(w, r, err)
		return
	}
	if reserved {
		writeError(w, http.StatusConflict, "book_reserved", "Sách đang có người đặt trước, không thể gia hạn.")
		return
	}

	newDue := b.DueAt.AddDate(0, 0, renewExtraDays)
	row = tx.QueryRow(ctx, `UPDATE borrow_records SET due_at = $1, renewed_count = renewed_count + 1 WHERE id = $2 RETURNING `+borrowColumns,
		newDue, id)
	updated, err := scanBorrow(row)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) listBorrow(w http.ResponseWriter, r *http.Request) {
	claims := mustClaims(r)
	userID := r.URL.Query().Get("user_id")
	status := r.URL.Query().Get("status")
	overdue := r.URL.Query().Get("overdue") == "true"
	page, pageSize, offset := pagination(r)

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
			writeError(w, http.StatusForbidden, "forbidden", "Bạn không có quyền xem phiếu mượn này.")
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
	if overdue {
		conds = append(conds, "status IN ('borrowed','overdue') AND due_at < now()")
	}
	where := "WHERE " + strings.Join(conds, " AND ")

	var total int
	if err := s.pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM borrow_records `+where, args...).Scan(&total); err != nil {
		s.internalError(w, r, err)
		return
	}
	args = append(args, pageSize, offset)
	query := fmt.Sprintf(`SELECT %s FROM borrow_records %s ORDER BY borrowed_at DESC LIMIT $%d OFFSET $%d`,
		borrowColumns, where, len(args)-1, len(args))
	rows, err := s.pool.Query(r.Context(), query, args...)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()
	items := []BorrowRecord{}
	for rows.Next() {
		b, err := scanBorrow(rows)
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		items = append(items, b)
	}
	writeJSON(w, http.StatusOK, pagedResponse(items, total, page, pageSize))
}

func (s *Server) getBorrow(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	row := s.pool.QueryRow(r.Context(), `SELECT `+borrowColumns+` FROM borrow_records WHERE id = $1 AND school_id = $2`, id, schoolID(r))
	b, err := scanBorrow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy phiếu mượn.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	ok, err := s.authorizedForUser(r, b.UserID)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if !ok {
		writeError(w, http.StatusForbidden, "forbidden", "Bạn không có quyền xem phiếu mượn này.")
		return
	}
	writeJSON(w, http.StatusOK, b)
}
