package httpapi

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

func (s *Server) listBooks(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	categoryID := r.URL.Query().Get("category_id")
	authorID := r.URL.Query().Get("author_id")
	pubType := r.URL.Query().Get("type")
	page, pageSize, offset := pagination(r)

	var conds []string
	var args []any
	from := "FROM books b"
	if authorID != "" {
		from += " JOIN book_authors ba ON ba.book_id = b.id"
		args = append(args, authorID)
		conds = append(conds, fmt.Sprintf("ba.author_id = $%d", len(args)))
	}
	if q != "" {
		args = append(args, "%"+q+"%")
		conds = append(conds, fmt.Sprintf("(b.title ILIKE $%d OR b.isbn ILIKE $%d)", len(args), len(args)))
	}
	if categoryID != "" {
		args = append(args, categoryID)
		conds = append(conds, fmt.Sprintf("b.category_id = $%d", len(args)))
	}
	if pubType != "" {
		args = append(args, pubType)
		conds = append(conds, fmt.Sprintf("b.publication_type = $%d", len(args)))
	}
	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	var total int
	countQuery := fmt.Sprintf(`SELECT COUNT(DISTINCT b.id) %s %s`, from, where)
	if err := s.pool.QueryRow(r.Context(), countQuery, args...).Scan(&total); err != nil {
		s.internalError(w, r, err)
		return
	}

	args = append(args, pageSize, offset)
	query := fmt.Sprintf(`
		SELECT DISTINCT %s,
			(SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = b.id) AS total_copies,
			(SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = b.id AND bc.status = 'available') AS available_copies
		%s %s
		ORDER BY b.title
		LIMIT $%d OFFSET $%d`, prefixColumns("b", bookColumns), from, where, len(args)-1, len(args))
	rows, err := s.pool.Query(r.Context(), query, args...)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()

	books := []Book{}
	for rows.Next() {
		var b Book
		var total, avail int
		if err := rows.Scan(&b.ID, &b.ISBN, &b.Title, &b.Subtitle, &b.PublicationType, &b.PublisherID, &b.CategoryID, &b.PublishYear,
			&b.Edition, &b.Language, &b.Pages, &b.Description, &b.CoverURL, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt, &total, &avail); err != nil {
			s.internalError(w, r, err)
			return
		}
		b.TotalCopies, b.AvailableCopies = &total, &avail
		books = append(books, b)
	}
	if err := rows.Err(); err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, pagedResponse(books, total, page, pageSize))
}

type bookRequest struct {
	ISBN            string   `json:"isbn"`
	Title           string   `json:"title"`
	Subtitle        string   `json:"subtitle"`
	PublicationType string   `json:"publication_type"`
	PublisherID     *string  `json:"publisher_id"`
	CategoryID      *string  `json:"category_id"`
	PublishYear     *int     `json:"publish_year"`
	Edition         string   `json:"edition"`
	Language        string   `json:"language"`
	Pages           *int     `json:"pages"`
	Description     string   `json:"description"`
	CoverURL        string   `json:"cover_url"`
	AuthorIDs       []string `json:"author_ids"`
}

func (s *Server) createBook(w http.ResponseWriter, r *http.Request) {
	claims := mustClaims(r)
	var req bookRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Tiêu đề sách không được để trống.")
		return
	}
	if req.PublicationType == "" {
		req.PublicationType = "book"
	}
	if req.Language == "" {
		req.Language = "vi"
	}

	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer tx.Rollback(r.Context())

	row := tx.QueryRow(r.Context(), `
		INSERT INTO books (isbn, title, subtitle, publication_type, publisher_id, category_id, publish_year, edition, language, pages, description, cover_url, created_by)
		VALUES (NULLIF($1,''), $2, NULLIF($3,''), $4, $5, $6, $7, NULLIF($8,''), $9, $10, NULLIF($11,''), NULLIF($12,''), $13)
		RETURNING `+bookColumns,
		req.ISBN, req.Title, req.Subtitle, req.PublicationType, req.PublisherID, req.CategoryID, req.PublishYear,
		req.Edition, req.Language, req.Pages, req.Description, req.CoverURL, claims.UserID)
	b, err := scanBook(row)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	for _, aid := range req.AuthorIDs {
		if _, err := tx.Exec(r.Context(), `INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, b.ID, aid); err != nil {
			s.internalError(w, r, err)
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		s.internalError(w, r, err)
		return
	}
	b.AuthorIDs = req.AuthorIDs
	writeJSON(w, http.StatusCreated, b)
}

func (s *Server) getBook(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	row := s.pool.QueryRow(r.Context(), `SELECT `+bookColumns+` FROM books WHERE id = $1`, id)
	b, err := scanBook(row)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy sách.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}

	arows, err := s.pool.Query(r.Context(), `SELECT author_id FROM book_authors WHERE book_id = $1`, id)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	for arows.Next() {
		var aid string
		if err := arows.Scan(&aid); err != nil {
			arows.Close()
			s.internalError(w, r, err)
			return
		}
		b.AuthorIDs = append(b.AuthorIDs, aid)
	}
	arows.Close()

	crows, err := s.pool.Query(r.Context(), `SELECT `+copyColumns+` FROM book_copies WHERE book_id = $1 ORDER BY copy_code`, id)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer crows.Close()
	avail, total := 0, 0
	for crows.Next() {
		c, err := scanCopy(crows)
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		if c.Status == "available" {
			avail++
		}
		total++
		b.Copies = append(b.Copies, c)
	}
	b.TotalCopies, b.AvailableCopies = &total, &avail
	writeJSON(w, http.StatusOK, b)
}

func (s *Server) updateBook(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	var req bookRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer tx.Rollback(r.Context())

	row := tx.QueryRow(r.Context(), `
		UPDATE books SET
			isbn = COALESCE(NULLIF($1,''), isbn),
			title = COALESCE(NULLIF($2,''), title),
			subtitle = CASE WHEN $3 = '' THEN subtitle ELSE $3 END,
			publication_type = COALESCE(NULLIF($4,'')::publication_type, publication_type),
			publisher_id = COALESCE($5, publisher_id),
			category_id = COALESCE($6, category_id),
			publish_year = COALESCE($7, publish_year),
			edition = CASE WHEN $8 = '' THEN edition ELSE $8 END,
			language = COALESCE(NULLIF($9,''), language),
			pages = COALESCE($10, pages),
			description = CASE WHEN $11 = '' THEN description ELSE $11 END,
			cover_url = CASE WHEN $12 = '' THEN cover_url ELSE $12 END,
			updated_at = now()
		WHERE id = $13
		RETURNING `+bookColumns,
		req.ISBN, req.Title, req.Subtitle, req.PublicationType, req.PublisherID, req.CategoryID, req.PublishYear,
		req.Edition, req.Language, req.Pages, req.Description, req.CoverURL, id)
	b, err := scanBook(row)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy sách.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if req.AuthorIDs != nil {
		if _, err := tx.Exec(r.Context(), `DELETE FROM book_authors WHERE book_id = $1`, id); err != nil {
			s.internalError(w, r, err)
			return
		}
		for _, aid := range req.AuthorIDs {
			if _, err := tx.Exec(r.Context(), `INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, aid); err != nil {
				s.internalError(w, r, err)
				return
			}
		}
		b.AuthorIDs = req.AuthorIDs
	}
	if err := tx.Commit(r.Context()); err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (s *Server) deleteBook(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	tag, err := s.pool.Exec(r.Context(), `DELETE FROM books WHERE id = $1`, id)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy sách.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
