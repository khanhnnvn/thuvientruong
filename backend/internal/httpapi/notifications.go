package httpapi

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
)

func (s *Server) listNotifications(w http.ResponseWriter, r *http.Request) {
	claims := mustClaims(r)
	rows, err := s.pool.Query(r.Context(), `SELECT `+notificationColumns+` FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`, claims.UserID)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	defer rows.Close()
	items := []Notification{}
	for rows.Next() {
		n, err := scanNotification(rows)
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		items = append(items, n)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) readNotification(w http.ResponseWriter, r *http.Request) {
	claims := mustClaims(r)
	id := pathParam(r, "id")
	row := s.pool.QueryRow(r.Context(),
		`UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL RETURNING `+notificationColumns,
		id, claims.UserID)
	n, err := scanNotification(row)
	if errors.Is(err, pgx.ErrNoRows) {
		// Either it doesn't exist, isn't the caller's, or was already read —
		// fetch to tell "not found" apart from "already read" without leaking
		// other users' notifications.
		var exists bool
		if err := s.pool.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM notifications WHERE id = $1 AND user_id = $2)`, id, claims.UserID).Scan(&exists); err != nil {
			s.internalError(w, r, err)
			return
		}
		if !exists {
			writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy thông báo.")
			return
		}
		row := s.pool.QueryRow(r.Context(), `SELECT `+notificationColumns+` FROM notifications WHERE id = $1`, id)
		n, err = scanNotification(row)
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, n)
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, n)
}
