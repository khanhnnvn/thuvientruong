-- Multi-tenant: thêm school_id vào toàn bộ bảng nghiệp vụ, backfill dữ liệu
-- demo hiện có vào 1 trường mặc định, sau đó siết ràng buộc NOT NULL / UNIQUE
-- theo phạm vi trường.

-- 1) Trường mặc định cho dữ liệu demo hiện có.
INSERT INTO schools (slug, name, status, approved_at)
VALUES ('truong-demo', 'Trường Demo', 'approved', now())
ON CONFLICT (slug) DO NOTHING;

-- 2) Thêm cột school_id (nullable trước, backfill xong mới siết NOT NULL).
ALTER TABLE users           ADD COLUMN school_id UUID REFERENCES schools(id);
ALTER TABLE categories      ADD COLUMN school_id UUID REFERENCES schools(id);
ALTER TABLE authors         ADD COLUMN school_id UUID REFERENCES schools(id);
ALTER TABLE publishers      ADD COLUMN school_id UUID REFERENCES schools(id);
ALTER TABLE books           ADD COLUMN school_id UUID REFERENCES schools(id);
ALTER TABLE book_copies     ADD COLUMN school_id UUID REFERENCES schools(id);
ALTER TABLE borrow_records  ADD COLUMN school_id UUID REFERENCES schools(id);
ALTER TABLE reservations    ADD COLUMN school_id UUID REFERENCES schools(id);
ALTER TABLE fines           ADD COLUMN school_id UUID REFERENCES schools(id);
ALTER TABLE notifications   ADD COLUMN school_id UUID REFERENCES schools(id);
ALTER TABLE audit_logs      ADD COLUMN school_id UUID REFERENCES schools(id);

-- 3) Backfill toàn bộ dữ liệu hiện có (trước migration này chỉ có 1 trường) vào
--    trường demo. Tất cả user hiện có là user thường (không có super_admin cũ).
DO $$
DECLARE demo_id UUID;
BEGIN
    SELECT id INTO demo_id FROM schools WHERE slug = 'truong-demo';

    UPDATE users          SET school_id = demo_id WHERE school_id IS NULL;
    UPDATE categories     SET school_id = demo_id WHERE school_id IS NULL;
    UPDATE authors        SET school_id = demo_id WHERE school_id IS NULL;
    UPDATE publishers     SET school_id = demo_id WHERE school_id IS NULL;
    UPDATE books          SET school_id = demo_id WHERE school_id IS NULL;
    UPDATE book_copies    SET school_id = demo_id WHERE school_id IS NULL;
    UPDATE borrow_records SET school_id = demo_id WHERE school_id IS NULL;
    UPDATE reservations   SET school_id = demo_id WHERE school_id IS NULL;
    UPDATE fines          SET school_id = demo_id WHERE school_id IS NULL;
    UPDATE notifications  SET school_id = demo_id WHERE school_id IS NULL;
    UPDATE audit_logs     SET school_id = demo_id WHERE school_id IS NULL;
END $$;

-- 4) Siết NOT NULL cho mọi bảng trừ users (users.school_id NULL dành cho super_admin).
ALTER TABLE categories      ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE authors         ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE publishers      ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE books           ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE book_copies     ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE borrow_records  ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE reservations    ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE fines           ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE notifications   ALTER COLUMN school_id SET NOT NULL;
-- audit_logs.user_id is nullable (system actions) so we allow school_id NULL there too,
-- but backfill above already filled every existing row; keep it NOT NULL for consistency
-- going forward since every audit entry from now on belongs to exactly one school.
ALTER TABLE audit_logs      ALTER COLUMN school_id SET NOT NULL;

-- users.school_id: NULL chỉ dành cho super_admin.
ALTER TABLE users ADD CONSTRAINT users_school_role_chk CHECK (
    (role = 'super_admin' AND school_id IS NULL) OR
    (role <> 'super_admin' AND school_id IS NOT NULL)
);

-- 5) Ràng buộc duy nhất theo phạm vi trường thay cho ràng buộc toàn cục cũ.

-- users.email: duy nhất trong phạm vi 1 trường cho user thường, và duy nhất
-- toàn cục cho super_admin (school_id NULL nên không thể gộp vào 1 index duy nhất).
ALTER TABLE users DROP CONSTRAINT users_email_key;
CREATE UNIQUE INDEX users_school_email_key ON users (school_id, email) WHERE role <> 'super_admin';
CREATE UNIQUE INDEX users_super_admin_email_key ON users (email) WHERE role = 'super_admin';

-- publishers.name: duy nhất trong phạm vi 1 trường.
ALTER TABLE publishers DROP CONSTRAINT publishers_name_key;
CREATE UNIQUE INDEX publishers_school_name_key ON publishers (school_id, name);

-- book_copies.copy_code: mỗi trường tự quản lý mã vạch riêng.
ALTER TABLE book_copies DROP CONSTRAINT book_copies_copy_code_key;
CREATE UNIQUE INDEX book_copies_school_copy_code_key ON book_copies (school_id, copy_code);

-- 6) Index tra cứu theo trường cho các bảng hay lọc theo school_id.
CREATE INDEX idx_users_school_id ON users(school_id);
CREATE INDEX idx_categories_school_id ON categories(school_id);
CREATE INDEX idx_authors_school_id ON authors(school_id);
CREATE INDEX idx_publishers_school_id ON publishers(school_id);
CREATE INDEX idx_books_school_id ON books(school_id);
CREATE INDEX idx_book_copies_school_id ON book_copies(school_id);
CREATE INDEX idx_borrow_records_school_id ON borrow_records(school_id);
CREATE INDEX idx_reservations_school_id ON reservations(school_id);
CREATE INDEX idx_fines_school_id ON fines(school_id);
CREATE INDEX idx_notifications_school_id ON notifications(school_id);
CREATE INDEX idx_audit_logs_school_id ON audit_logs(school_id);
