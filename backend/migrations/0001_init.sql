-- Thư viện trường học - schema khởi tạo
-- Quy ước: mọi id là UUID (gen_random_uuid), timestamptz cho thời gian, snake_case.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'librarian', 'teacher', 'student', 'parent');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'disabled');
CREATE TYPE publication_type AS ENUM ('book', 'magazine', 'journal', 'newspaper', 'thesis', 'other');
CREATE TYPE copy_status AS ENUM ('available', 'borrowed', 'reserved', 'lost', 'damaged', 'retired');
CREATE TYPE copy_condition AS ENUM ('new', 'good', 'worn', 'damaged');
CREATE TYPE borrow_status AS ENUM ('borrowed', 'returned', 'overdue', 'lost');
CREATE TYPE reservation_status AS ENUM ('pending', 'ready', 'fulfilled', 'cancelled', 'expired');
CREATE TYPE fine_status AS ENUM ('unpaid', 'paid', 'waived');
CREATE TYPE fine_reason AS ENUM ('overdue', 'lost', 'damaged');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    phone           TEXT,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    role            user_role NOT NULL,
    status          user_status NOT NULL DEFAULT 'active',
    class_name      TEXT,               -- lớp học, chỉ dùng cho student
    student_code    TEXT,               -- mã học sinh, chỉ dùng cho student
    max_borrow      INT NOT NULL DEFAULT 3,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phụ huynh <-> học sinh (nhiều-nhiều: một phụ huynh có thể theo dõi nhiều con)
CREATE TABLE parent_links (
    parent_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (parent_id, student_id)
);

CREATE TABLE publishers (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name    TEXT UNIQUE NOT NULL
);

CREATE TABLE authors (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name    TEXT NOT NULL
);

CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE books (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    isbn                TEXT,
    title               TEXT NOT NULL,
    subtitle            TEXT,
    publication_type    publication_type NOT NULL DEFAULT 'book',
    publisher_id        UUID REFERENCES publishers(id) ON DELETE SET NULL,
    category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
    publish_year        INT,
    edition             TEXT,
    language            TEXT NOT NULL DEFAULT 'vi',
    pages               INT,
    description         TEXT,
    cover_url           TEXT,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE book_authors (
    book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, author_id)
);

-- Mỗi ấn bản vật lý cụ thể (bản sao) của một đầu sách
CREATE TABLE book_copies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id         UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    copy_code       TEXT UNIQUE NOT NULL,   -- mã vạch / số đăng ký cá biệt
    shelf_location  TEXT,
    condition       copy_condition NOT NULL DEFAULT 'good',
    status          copy_status NOT NULL DEFAULT 'available',
    price           NUMERIC(12,2),
    acquired_at     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE borrow_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    copy_id         UUID NOT NULL REFERENCES book_copies(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    approved_by     UUID REFERENCES users(id),
    borrowed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at          TIMESTAMPTZ NOT NULL,
    returned_at     TIMESTAMPTZ,
    renewed_count   INT NOT NULL DEFAULT 0,
    status          borrow_status NOT NULL DEFAULT 'borrowed'
);

CREATE TABLE reservations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id     UUID NOT NULL REFERENCES books(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    status      reservation_status NOT NULL DEFAULT 'pending',
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ
);

CREATE TABLE fines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borrow_record_id    UUID REFERENCES borrow_records(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    amount              NUMERIC(12,2) NOT NULL,
    reason              fine_reason NOT NULL,
    status              fine_status NOT NULL DEFAULT 'unpaid',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at             TIMESTAMPTZ
);

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    message     TEXT NOT NULL,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    action      TEXT NOT NULL,
    entity      TEXT NOT NULL,
    entity_id   UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_books_title ON books USING gin (to_tsvector('simple', title));
CREATE INDEX idx_book_copies_book_id ON book_copies(book_id);
CREATE INDEX idx_book_copies_status ON book_copies(status);
CREATE INDEX idx_borrow_records_user_id ON borrow_records(user_id);
CREATE INDEX idx_borrow_records_status ON borrow_records(status);
CREATE INDEX idx_reservations_book_id ON reservations(book_id);
CREATE INDEX idx_fines_user_id ON fines(user_id);
