package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

func (s *Server) listCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := s.pool.Query(r.Context(), `SELECT id, name, parent_id FROM categories ORDER BY name`)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()
	items := []Category{}
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Name, &c.ParentID); err != nil {
			s.internalError(w, r, err)
			return
		}
		items = append(items, c)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

type categoryRequest struct {
	Name     string  `json:"name"`
	ParentID *string `json:"parent_id"`
}

func (s *Server) createCategory(w http.ResponseWriter, r *http.Request) {
	var req categoryRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Tên danh mục không được để trống.")
		return
	}
	var c Category
	err := s.pool.QueryRow(r.Context(),
		`INSERT INTO categories (name, parent_id) VALUES ($1, $2) RETURNING id, name, parent_id`,
		req.Name, req.ParentID).Scan(&c.ID, &c.Name, &c.ParentID)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

func (s *Server) updateCategory(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	var req categoryRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	var c Category
	err := s.pool.QueryRow(r.Context(),
		`UPDATE categories SET name = COALESCE(NULLIF($1,''), name), parent_id = $2 WHERE id = $3 RETURNING id, name, parent_id`,
		req.Name, req.ParentID, id).Scan(&c.ID, &c.Name, &c.ParentID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy danh mục.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (s *Server) deleteCategory(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	tag, err := s.pool.Exec(r.Context(), `DELETE FROM categories WHERE id = $1`, id)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy danh mục.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
