package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

func (s *Server) listPublishers(w http.ResponseWriter, r *http.Request) {
	rows, err := s.pool.Query(r.Context(), `SELECT id, name FROM publishers ORDER BY name`)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()
	items := []Publisher{}
	for rows.Next() {
		var p Publisher
		if err := rows.Scan(&p.ID, &p.Name); err != nil {
			s.internalError(w, r, err)
			return
		}
		items = append(items, p)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

type publisherRequest struct {
	Name string `json:"name"`
}

func (s *Server) createPublisher(w http.ResponseWriter, r *http.Request) {
	var req publisherRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Tên nhà xuất bản không được để trống.")
		return
	}
	var p Publisher
	err := s.pool.QueryRow(r.Context(), `INSERT INTO publishers (name) VALUES ($1) RETURNING id, name`, req.Name).Scan(&p.ID, &p.Name)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (s *Server) updatePublisher(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	var req publisherRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	var p Publisher
	err := s.pool.QueryRow(r.Context(),
		`UPDATE publishers SET name = COALESCE(NULLIF($1,''), name) WHERE id = $2 RETURNING id, name`,
		req.Name, id).Scan(&p.ID, &p.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy nhà xuất bản.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) deletePublisher(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	tag, err := s.pool.Exec(r.Context(), `DELETE FROM publishers WHERE id = $1`, id)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy nhà xuất bản.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
