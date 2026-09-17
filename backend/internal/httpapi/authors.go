package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

func (s *Server) listAuthors(w http.ResponseWriter, r *http.Request) {
	rows, err := s.pool.Query(r.Context(), `SELECT id, name FROM authors WHERE school_id = $1 ORDER BY name`, schoolID(r))
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()
	items := []Author{}
	for rows.Next() {
		var a Author
		if err := rows.Scan(&a.ID, &a.Name); err != nil {
			s.internalError(w, r, err)
			return
		}
		items = append(items, a)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

type authorRequest struct {
	Name string `json:"name"`
}

func (s *Server) createAuthor(w http.ResponseWriter, r *http.Request) {
	var req authorRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Tên tác giả không được để trống.")
		return
	}
	var a Author
	err := s.pool.QueryRow(r.Context(), `INSERT INTO authors (name, school_id) VALUES ($1, $2) RETURNING id, name`, req.Name, schoolID(r)).Scan(&a.ID, &a.Name)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, a)
}

func (s *Server) updateAuthor(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	var req authorRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	var a Author
	err := s.pool.QueryRow(r.Context(),
		`UPDATE authors SET name = COALESCE(NULLIF($1,''), name) WHERE id = $2 AND school_id = $3 RETURNING id, name`,
		req.Name, id, schoolID(r)).Scan(&a.ID, &a.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy tác giả.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

func (s *Server) deleteAuthor(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	tag, err := s.pool.Exec(r.Context(), `DELETE FROM authors WHERE id = $1 AND school_id = $2`, id, schoolID(r))
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy tác giả.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
