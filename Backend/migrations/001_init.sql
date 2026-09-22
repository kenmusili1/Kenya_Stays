-- KenyaStays production schema.
-- Run via `npm run migrate` (see scripts/migrate.js). Safe to run multiple
-- times: every statement is guarded with IF NOT EXISTS / ON CONFLICT.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS accounts (
    account_id      SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'OWNER', 'ADMIN', 'CUSTOMER CARE')),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    -- Only meaningful for OWNER accounts. NULL for every other role.
    approved        BOOLEAN,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS properties (
    property_id       SERIAL PRIMARY KEY,
    owner_id           INTEGER NOT NULL REFERENCES accounts(account_id),
    approved           BOOLEAN NOT NULL DEFAULT FALSE,
    name               TEXT NOT NULL,
    location           TEXT NOT NULL,
    city               TEXT NOT NULL,
    latitude           DOUBLE PRECISION NOT NULL,
    longitude          DOUBLE PRECISION NOT NULL,
    nightly_rate       NUMERIC(12, 2) NOT NULL CHECK (nightly_rate > 0),
    max_guests         INTEGER NOT NULL CHECK (max_guests > 0),
    accommodation      TEXT NOT NULL,
    available          BOOLEAN NOT NULL DEFAULT TRUE,
    unavailable_dates  DATE[] NOT NULL DEFAULT '{}',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id       SERIAL PRIMARY KEY,
    customer_id       INTEGER NOT NULL REFERENCES accounts(account_id),
    property_id       INTEGER NOT NULL REFERENCES properties(property_id),
    owner_id          INTEGER NOT NULL REFERENCES accounts(account_id),
    location          TEXT NOT NULL,
    check_in          DATE NOT NULL,
    check_out         DATE NOT NULL,
    guests            INTEGER NOT NULL CHECK (guests > 0),
    accommodation     TEXT NOT NULL,
    amount            NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status            TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'declined', 'confirmed', 'refunded')),
    payment_status    TEXT NOT NULL DEFAULT 'pending'
                          CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    special_request   TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (check_out > check_in)
);

CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_owner_id ON bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON bookings(property_id);

CREATE TABLE IF NOT EXISTS payment_requests (
    payment_request_id    SERIAL PRIMARY KEY,
    booking_id             INTEGER NOT NULL REFERENCES bookings(booking_id),
    customer_id            INTEGER NOT NULL REFERENCES accounts(account_id),
    amount                 NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency               TEXT NOT NULL DEFAULT 'KES',
    method                 TEXT,
    provider               TEXT NOT NULL DEFAULT 'PAYHERO',
    internal_reference     TEXT NOT NULL UNIQUE,
    payhero_reference      TEXT,
    checkout_request_id    TEXT,
    payhero_transaction_id TEXT,
    -- The state machine this whole project exists to protect. See
    -- src/payments/paymentService.js - every write to this column outside
    -- this migration goes through a guarded, atomic UPDATE ... WHERE
    -- status NOT IN (...) so a stale/duplicate/replayed callback, or a
    -- race with the STK-push response, can never move a payment out of a
    -- terminal state except the one sanctioned SUCCESS -> REFUNDED path.
    status                  TEXT NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN (
                                    'PENDING', 'STK_INITIATED', 'PROCESSING',
                                    'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'
                                )),
    phone_number            TEXT,
    callback_data           JSONB,
    payhero_status           TEXT,
    result_code              INTEGER,
    result_description       TEXT,
    failure_reason            TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at                   TIMESTAMPTZ,
    refunded_at               TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_booking_id ON payment_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_payhero_reference ON payment_requests(payhero_reference);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id  SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES accounts(account_id),
    booking_id        INTEGER REFERENCES bookings(booking_id),
    title             TEXT NOT NULL,
    message           TEXT NOT NULL,
    type              TEXT NOT NULL,
    is_read           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

CREATE TABLE IF NOT EXISTS customer_care_messages (
    message_id      SERIAL PRIMARY KEY,
    customer_id      INTEGER REFERENCES accounts(account_id),
    name             TEXT NOT NULL,
    email            TEXT NOT NULL,
    phone            TEXT NOT NULL,
    subject          TEXT NOT NULL,
    message          TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'NEW'
                         CHECK (status IN ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED')),
    assigned_agent   TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
