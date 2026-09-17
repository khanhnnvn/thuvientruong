package httpapi

import "time"

// User mirrors the users table, minus password_hash which never leaves the server.
type User struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	Phone       *string   `json:"phone,omitempty"`
	FullName    string    `json:"full_name"`
	Role        string    `json:"role"`
	Status      string    `json:"status"`
	ClassName   *string   `json:"class_name,omitempty"`
	StudentCode *string   `json:"student_code,omitempty"`
	MaxBorrow   int       `json:"max_borrow"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

const userColumns = `id, email, phone, full_name, role, status, class_name, student_code, max_borrow, created_at, updated_at`

func scanUser(row pgxRow) (User, error) {
	var u User
	err := row.Scan(&u.ID, &u.Email, &u.Phone, &u.FullName, &u.Role, &u.Status, &u.ClassName, &u.StudentCode, &u.MaxBorrow, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

type Category struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	ParentID *string `json:"parent_id,omitempty"`
}

type Author struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Publisher struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Book struct {
	ID              string     `json:"id"`
	ISBN            *string    `json:"isbn,omitempty"`
	Title           string     `json:"title"`
	Subtitle        *string    `json:"subtitle,omitempty"`
	PublicationType string     `json:"publication_type"`
	PublisherID     *string    `json:"publisher_id,omitempty"`
	CategoryID      *string    `json:"category_id,omitempty"`
	PublishYear     *int       `json:"publish_year,omitempty"`
	Edition         *string    `json:"edition,omitempty"`
	Language        string     `json:"language"`
	Pages           *int       `json:"pages,omitempty"`
	Description     *string    `json:"description,omitempty"`
	CoverURL        *string    `json:"cover_url,omitempty"`
	CreatedBy       *string    `json:"created_by,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	AuthorIDs       []string   `json:"author_ids,omitempty"`
	AvailableCopies *int       `json:"available_copies,omitempty"`
	TotalCopies     *int       `json:"total_copies,omitempty"`
	Copies          []BookCopy `json:"copies,omitempty"`
}

const bookColumns = `id, isbn, title, subtitle, publication_type, publisher_id, category_id, publish_year, edition, language, pages, description, cover_url, created_by, created_at, updated_at`

func scanBook(row pgxRow) (Book, error) {
	var b Book
	err := row.Scan(&b.ID, &b.ISBN, &b.Title, &b.Subtitle, &b.PublicationType, &b.PublisherID, &b.CategoryID, &b.PublishYear,
		&b.Edition, &b.Language, &b.Pages, &b.Description, &b.CoverURL, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt)
	return b, err
}

type BookCopy struct {
	ID            string     `json:"id"`
	BookID        string     `json:"book_id"`
	CopyCode      string     `json:"copy_code"`
	ShelfLocation *string    `json:"shelf_location,omitempty"`
	Condition     string     `json:"condition"`
	Status        string     `json:"status"`
	Price         *string    `json:"price,omitempty"`
	AcquiredAt    *time.Time `json:"acquired_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

const copyColumns = `id, book_id, copy_code, shelf_location, condition, status, price, acquired_at, created_at`

func scanCopy(row pgxRow) (BookCopy, error) {
	var c BookCopy
	err := row.Scan(&c.ID, &c.BookID, &c.CopyCode, &c.ShelfLocation, &c.Condition, &c.Status, &c.Price, &c.AcquiredAt, &c.CreatedAt)
	return c, err
}

type BorrowRecord struct {
	ID           string     `json:"id"`
	CopyID       string     `json:"copy_id"`
	UserID       string     `json:"user_id"`
	ApprovedBy   *string    `json:"approved_by,omitempty"`
	BorrowedAt   time.Time  `json:"borrowed_at"`
	DueAt        time.Time  `json:"due_at"`
	ReturnedAt   *time.Time `json:"returned_at,omitempty"`
	RenewedCount int        `json:"renewed_count"`
	Status       string     `json:"status"`
}

const borrowColumns = `id, copy_id, user_id, approved_by, borrowed_at, due_at, returned_at, renewed_count, status`

func scanBorrow(row pgxRow) (BorrowRecord, error) {
	var b BorrowRecord
	err := row.Scan(&b.ID, &b.CopyID, &b.UserID, &b.ApprovedBy, &b.BorrowedAt, &b.DueAt, &b.ReturnedAt, &b.RenewedCount, &b.Status)
	return b, err
}

type Reservation struct {
	ID         string     `json:"id"`
	BookID     string     `json:"book_id"`
	UserID     string     `json:"user_id"`
	Status     string     `json:"status"`
	ReservedAt time.Time  `json:"reserved_at"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
}

const reservationColumns = `id, book_id, user_id, status, reserved_at, expires_at`

func scanReservation(row pgxRow) (Reservation, error) {
	var re Reservation
	err := row.Scan(&re.ID, &re.BookID, &re.UserID, &re.Status, &re.ReservedAt, &re.ExpiresAt)
	return re, err
}

type Fine struct {
	ID             string     `json:"id"`
	BorrowRecordID *string    `json:"borrow_record_id,omitempty"`
	UserID         string     `json:"user_id"`
	Amount         string     `json:"amount"`
	Reason         string     `json:"reason"`
	Status         string     `json:"status"`
	CreatedAt      time.Time  `json:"created_at"`
	PaidAt         *time.Time `json:"paid_at,omitempty"`
}

const fineColumns = `id, borrow_record_id, user_id, amount, reason, status, created_at, paid_at`

func scanFine(row pgxRow) (Fine, error) {
	var f Fine
	err := row.Scan(&f.ID, &f.BorrowRecordID, &f.UserID, &f.Amount, &f.Reason, &f.Status, &f.CreatedAt, &f.PaidAt)
	return f, err
}

type Notification struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	Type      string     `json:"type"`
	Message   string     `json:"message"`
	ReadAt    *time.Time `json:"read_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

const notificationColumns = `id, user_id, type, message, read_at, created_at`

func scanNotification(row pgxRow) (Notification, error) {
	var n Notification
	err := row.Scan(&n.ID, &n.UserID, &n.Type, &n.Message, &n.ReadAt, &n.CreatedAt)
	return n, err
}

// pgxRow is satisfied by both pgx.Row and pgx.Rows, letting scan* helpers work with either.
type pgxRow interface {
	Scan(dest ...any) error
}
