// Package httpapi wires the chi router and implements every /api/v1 handler.
package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/thuvientruong/backend/internal/auth"
	"github.com/thuvientruong/backend/internal/config"
)

type Server struct {
	cfg  config.Config
	pool *pgxpool.Pool
	auth *auth.Auth
	log  *slog.Logger
}

type Deps struct {
	Config config.Config
	Pool   *pgxpool.Pool
	Auth   *auth.Auth
	Log    *slog.Logger
}

func New(d Deps) *Server {
	log := d.Log
	if log == nil {
		log = slog.Default()
	}
	return &Server{cfg: d.Config, pool: d.Pool, auth: d.Auth, log: log}
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(s.logRequests, s.recoverPanics, s.cors)

	r.Get("/healthz", s.health)

	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/login", s.login)
		r.Post("/auth/refresh", s.refresh)
		r.Post("/auth/logout", s.logout)

		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)

			r.Get("/me", s.getMe)
			r.Get("/me/children", s.getMyChildren)

			// Users
			r.Route("/users", func(r chi.Router) {
				r.With(s.requireRole("admin", "librarian")).Get("/", s.listUsers)
				r.With(s.requireRole("admin", "librarian")).Post("/", s.createUser)
				r.With(s.requireRole("admin", "librarian")).Get("/{id}", s.getUser)
				r.With(s.requireRole("admin")).Patch("/{id}", s.updateUser)
				r.With(s.requireRole("admin")).Post("/{id}/reset-password", s.resetPassword)
				r.With(s.requireRole("admin")).Post("/{id}/link-parent", s.linkParent)
			})

			// Categories
			r.Route("/categories", func(r chi.Router) {
				r.Get("/", s.listCategories)
				r.With(s.requireRole("admin", "librarian")).Post("/", s.createCategory)
				r.With(s.requireRole("admin", "librarian")).Patch("/{id}", s.updateCategory)
				r.With(s.requireRole("admin", "librarian")).Delete("/{id}", s.deleteCategory)
			})

			// Authors
			r.Route("/authors", func(r chi.Router) {
				r.Get("/", s.listAuthors)
				r.With(s.requireRole("admin", "librarian")).Post("/", s.createAuthor)
				r.With(s.requireRole("admin", "librarian")).Patch("/{id}", s.updateAuthor)
				r.With(s.requireRole("admin", "librarian")).Delete("/{id}", s.deleteAuthor)
			})

			// Publishers
			r.Route("/publishers", func(r chi.Router) {
				r.Get("/", s.listPublishers)
				r.With(s.requireRole("admin", "librarian")).Post("/", s.createPublisher)
				r.With(s.requireRole("admin", "librarian")).Patch("/{id}", s.updatePublisher)
				r.With(s.requireRole("admin", "librarian")).Delete("/{id}", s.deletePublisher)
			})

			// Books & copies
			r.Route("/books", func(r chi.Router) {
				r.Get("/", s.listBooks)
				r.With(s.requireRole("admin", "librarian")).Post("/", s.createBook)
				r.Get("/{id}", s.getBook)
				r.With(s.requireRole("admin", "librarian")).Patch("/{id}", s.updateBook)
				r.With(s.requireRole("admin", "librarian")).Delete("/{id}", s.deleteBook)

				r.Get("/{id}/copies", s.listCopiesForBook)
				r.With(s.requireRole("admin", "librarian")).Post("/{id}/copies", s.createCopy)
			})
			r.Route("/copies", func(r chi.Router) {
				r.With(s.requireRole("admin", "librarian")).Patch("/{id}", s.updateCopy)
				r.With(s.requireRole("admin", "librarian")).Delete("/{id}", s.deleteCopy)
			})

			// Borrow
			r.Route("/borrow", func(r chi.Router) {
				r.With(s.requireRole("admin", "librarian")).Post("/", s.createBorrow)
				r.Get("/", s.listBorrow)
				r.Get("/{id}", s.getBorrow)
				r.With(s.requireRole("admin", "librarian")).Post("/{id}/return", s.returnBorrow)
				r.Post("/{id}/renew", s.renewBorrow)
			})

			// Reservations
			r.Route("/reservations", func(r chi.Router) {
				r.With(s.requireRole("teacher", "student")).Post("/", s.createReservation)
				r.Patch("/{id}", s.updateReservation)
				r.Get("/", s.listReservations)
			})

			// Fines
			r.Route("/fines", func(r chi.Router) {
				r.Get("/", s.listFines)
				r.With(s.requireRole("admin", "librarian")).Post("/{id}/pay", s.payFine)
				r.With(s.requireRole("admin", "librarian")).Post("/{id}/waive", s.waiveFine)
			})

			// Notifications
			r.Route("/notifications", func(r chi.Router) {
				r.Get("/", s.listNotifications)
				r.Post("/{id}/read", s.readNotification)
			})

			// Reports
			r.Route("/reports", func(r chi.Router) {
				r.Use(s.requireRole("admin", "librarian"))
				r.Get("/overview", s.reportOverview)
				r.Get("/overdue", s.reportOverdue)
				r.Get("/popular-books", s.reportPopularBooks)
			})
		})

		r.NotFound(func(w http.ResponseWriter, r *http.Request) {
			writeError(w, http.StatusNotFound, "not_found", "Không tìm thấy.")
		})
		r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Phương thức không được hỗ trợ.")
		})
	})
	return r
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	status, code := "ok", http.StatusOK
	body := map[string]any{}
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	if err := s.pool.Ping(ctx); err != nil {
		status, code = "degraded", http.StatusServiceUnavailable
		body["postgres"] = err.Error()
	}
	body["status"] = status
	writeJSON(w, code, body)
}
