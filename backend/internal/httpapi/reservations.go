package httpapi

import (
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
)

type createReservationRequest struct {
	BookID string `json:"book_id"`
}

func (s *Server) createReservation(w http.ResponseWriter, r *http.Request) {
	claims := mustClaims(r)
	var req createReservationRequest
	if !decodeJSON(w, r, &req) || req.BookID == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Thiếu book_id.")
		return
	}

	ctx := r.Context()
	var bookExists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM books WHERE id = $1)`, req.BookID).Scan(&bookExists); err != nil {
		s.internalError(w, r, err)
		return
	}
	if !bookExists {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy sách.")
		return
	}

	var availableCopies int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM book_copies WHERE book_id = $1 AND status = 'available'`, req.BookID).Scan(&availableCopies); err != nil {
		s.internalError(w, r, err)
		return
	}
	if availableCopies > 0 {
		writeError(w, http.StatusConflict, "copies_available", "Sách vẫn còn bản sao sẵn có, không cần đặt trước.")
		return
	}

	var already bool
	if err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM reservations WHERE book_id = $1 AND user_id = $2 AND status IN ('pending','ready'))`,
		req.BookID, claims.UserID).Scan(&already); err != nil {
		s.internalError(w, r, err)
		return
	}
	if already {
		writeError(w, http.StatusConflict, "already_reserved", "Bạn đã đặt trước sách này rồi.")
		return
	}

	row := s.pool.QueryRow(ctx, `INSERT INTO reservations (book_id, user_id) VALUES ($1, $2) RETURNING `+reservationColumns,
		req.BookID, claims.UserID)
	res, err := scanReservation(row)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, res)
}

type updateReservationRequest struct {
	Status string `json:"status"`
}

var staffReservationStatuses = []string{"ready", "fulfilled", "cancelled"}

func (s *Server) updateReservation(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	claims := mustClaims(r)
	var req updateReservationRequest
	if !decodeJSON(w, r, &req) || req.Status == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Thiếu status.")
		return
	}

	ctx := r.Context()
	row := s.pool.QueryRow(ctx, `SELECT `+reservationColumns+` FROM reservations WHERE id = $1`, id)
	res, err := scanReservation(row)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy đặt trước.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}

	isStaff := claims.Role == "admin" || claims.Role == "librarian"
	switch {
	case isStaff:
		if !slices.Contains(staffReservationStatuses, req.Status) {
			writeError(w, http.StatusUnprocessableEntity, "invalid_status", "Trạng thái không hợp lệ.")
			return
		}
	case claims.UserID == res.UserID:
		if req.Status != "cancelled" {
			writeError(w, http.StatusForbidden, "forbidden", "Bạn chỉ có thể huỷ đặt trước của chính mình.")
			return
		}
	default:
		writeError(w, http.StatusForbidden, "forbidden", "Bạn không có quyền cập nhật đặt trước này.")
		return
	}

	row = s.pool.QueryRow(ctx, `UPDATE reservations SET status = $1 WHERE id = $2 RETURNING `+reservationColumns, req.Status, id)
	updated, err := scanReservation(row)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) listReservations(w http.ResponseWriter, r *http.Request) {
	claims := mustClaims(r)
	userID := r.URL.Query().Get("user_id")
	bookID := r.URL.Query().Get("book_id")
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
			writeError(w, http.StatusForbidden, "forbidden", "Bạn không có quyền xem đặt trước này.")
			return
		}
	}

	var conds []string
	var args []any
	if userID != "" {
		args = append(args, userID)
		conds = append(conds, fmt.Sprintf("user_id = $%d", len(args)))
	}
	if bookID != "" {
		args = append(args, bookID)
		conds = append(conds, fmt.Sprintf("book_id = $%d", len(args)))
	}
	if status != "" {
		args = append(args, status)
		conds = append(conds, fmt.Sprintf("status = $%d", len(args)))
	}
	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}
	rows, err := s.pool.Query(r.Context(), fmt.Sprintf(`SELECT %s FROM reservations %s ORDER BY reserved_at DESC`, reservationColumns, where), args...)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()
	items := []Reservation{}
	for rows.Next() {
		res, err := scanReservation(rows)
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		items = append(items, res)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
