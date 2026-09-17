package httpapi

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

func (s *Server) listCopiesForBook(w http.ResponseWriter, r *http.Request) {
	bookID := pathParam(r, "id")
	rows, err := s.pool.Query(r.Context(), `SELECT `+copyColumns+` FROM book_copies WHERE book_id = $1 ORDER BY copy_code`, bookID)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()
	items := []BookCopy{}
	for rows.Next() {
		c, err := scanCopy(rows)
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		items = append(items, c)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

type createCopyRequest struct {
	ShelfLocation string  `json:"shelf_location"`
	Condition     string  `json:"condition"`
	Price         *string `json:"price"`
	AcquiredAt    *string `json:"acquired_at"`
}

func (s *Server) createCopy(w http.ResponseWriter, r *http.Request) {
	bookID := pathParam(r, "id")
	var req createCopyRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Condition == "" {
		req.Condition = "good"
	}
	if len(bookID) < 8 {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy sách.")
		return
	}

	var bookExists bool
	if err := s.pool.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM books WHERE id = $1)`, bookID).Scan(&bookExists); err != nil {
		s.internalError(w, r, err)
		return
	}
	if !bookExists {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy sách.")
		return
	}

	// copy_code is unique across the whole library; retry a few times on the
	// rare race where two staff add a copy to the same book at once.
	var c BookCopy
	for attempt := 0; attempt < 5; attempt++ {
		var seq int
		if err := s.pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM book_copies WHERE book_id = $1`, bookID).Scan(&seq); err != nil {
			s.internalError(w, r, err)
			return
		}
		code := fmt.Sprintf("%s-%03d", strings.ToUpper(bookID[:8]), seq+1+attempt)
		row := s.pool.QueryRow(r.Context(), `
			INSERT INTO book_copies (book_id, copy_code, shelf_location, condition, price, acquired_at)
			VALUES ($1, $2, NULLIF($3,''), $4, $5, $6)
			RETURNING `+copyColumns,
			bookID, code, req.ShelfLocation, req.Condition, req.Price, req.AcquiredAt)
		var err error
		c, err = scanCopy(row)
		if isUniqueViolation(err) {
			continue
		}
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		writeJSON(w, http.StatusCreated, c)
		return
	}
	writeError(w, http.StatusConflict, "conflict", "Không thể tạo mã bản sao, vui lòng thử lại.")
}

type updateCopyRequest struct {
	ShelfLocation *string `json:"shelf_location"`
	Condition     *string `json:"condition"`
	Status        *string `json:"status"`
	Price         *string `json:"price"`
}

func (s *Server) updateCopy(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	var req updateCopyRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	sets := []string{}
	var args []any
	add := func(col string, val any) {
		args = append(args, val)
		sets = append(sets, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	if req.ShelfLocation != nil {
		add("shelf_location", *req.ShelfLocation)
	}
	if req.Condition != nil {
		add("condition", *req.Condition)
	}
	if req.Status != nil {
		add("status", *req.Status)
	}
	if req.Price != nil {
		add("price", *req.Price)
	}
	if len(sets) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Không có trường nào để cập nhật.")
		return
	}
	args = append(args, id)
	query := fmt.Sprintf(`UPDATE book_copies SET %s WHERE id = $%d RETURNING %s`, strings.Join(sets, ", "), len(args), copyColumns)
	row := s.pool.QueryRow(r.Context(), query, args...)
	c, err := scanCopy(row)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy bản sao.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (s *Server) deleteCopy(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	var status string
	err := s.pool.QueryRow(r.Context(), `SELECT status FROM book_copies WHERE id = $1`, id).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy bản sao.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if status == "borrowed" {
		writeError(w, http.StatusConflict, "copy_borrowed", "Không thể xoá bản sao đang được mượn.")
		return
	}
	if _, err := s.pool.Exec(r.Context(), `DELETE FROM book_copies WHERE id = $1`, id); err != nil {
		s.internalError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
