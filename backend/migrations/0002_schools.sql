-- Multi-tenant: bảng schools (tenant) + giá trị enum super_admin.
-- Tách riêng migration này khỏi 0003 vì Postgres không cho phép dùng giá trị
-- enum mới thêm (ALTER TYPE ... ADD VALUE) trong cùng transaction/migration
-- đã thêm nó.

CREATE TYPE school_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');

CREATE TABLE schools (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    address             TEXT,
    contact_phone       TEXT,
    contact_email       TEXT,
    status              school_status NOT NULL DEFAULT 'pending',
    rejection_reason    TEXT,
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_schools_status ON schools(status);

-- Vai trò super_admin: tài khoản toàn hệ thống, không thuộc trường nào.
ALTER TYPE user_role ADD VALUE 'super_admin';
