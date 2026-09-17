package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

var errParentOutOfScope = errors.New("parent category belongs to a different school")

func (s *Server) listCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := s.pool.Query(r.Context(), `SELECT id, name, parent_id FROM categories WHERE school_id = $1 ORDER BY name`, schoolID(r))
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
	if err := s.checkParentCategoryScope(r, req.ParentID); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Danh mục cha không hợp lệ.")
		return
	}
	var c Category
	err := s.pool.QueryRow(r.Context(),
		`INSERT INTO categories (name, parent_id, school_id) VALUES ($1, $2, $3) RETURNING id, name, parent_id`,
		req.Name, req.ParentID, schoolID(r)).Scan(&c.ID, &c.Name, &c.ParentID)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

// checkParentCategoryScope returns an error if parentID is set but does not
// name a category belonging to the current school.
func (s *Server) checkParentCategoryScope(r *http.Request, parentID *string) error {
	if parentID == nil {
		return nil
	}
	var exists bool
	if err := s.pool.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM categories WHERE id = $1 AND school_id = $2)`,
		*parentID, schoolID(r)).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return errParentOutOfScope
	}
	return nil
}

func (s *Server) updateCategory(w http.ResponseWriter, r *http.Request) {
	id := pathParam(r, "id")
	var req categoryRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := s.checkParentCategoryScope(r, req.ParentID); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_request", "Danh mục cha không hợp lệ.")
		return
	}
	var c Category
	err := s.pool.QueryRow(r.Context(),
		`UPDATE categories SET name = COALESCE(NULLIF($1,''), name), parent_id = $2 WHERE id = $3 AND school_id = $4 RETURNING id, name, parent_id`,
		req.Name, req.ParentID, id, schoolID(r)).Scan(&c.ID, &c.Name, &c.ParentID)
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
	tag, err := s.pool.Exec(r.Context(), `DELETE FROM categories WHERE id = $1 AND school_id = $2`, id, schoolID(r))
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
