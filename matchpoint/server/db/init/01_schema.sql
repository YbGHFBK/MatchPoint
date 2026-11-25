-- 1. Пользователи и доступ
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'player'
        CHECK (role IN ('guest', 'player', 'captain', 'organizer', 'moderator', 'admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'muted', 'temp_banned', 'perm_banned')),
    ban_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Профили игроков
CREATE TABLE profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    nickname VARCHAR(100) UNIQUE NOT NULL,
    avatar_url TEXT,
    prime_time VARCHAR(50),
    bio TEXT,
    contacts JSONB NOT NULL DEFAULT '{}'::jsonb,
    external_links JSONB NOT NULL DEFAULT '{}'::jsonb,
    trust_score NUMERIC(3, 2) NOT NULL DEFAULT 5.00
);

-- 3. Оценки репутации (Trust Factor)
CREATE TABLE trust_ratings (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (from_user_id, to_user_id),
    CHECK (from_user_id <> to_user_id)
);

-- 4. Справочники (Игры / IT-направления, роли, ранги, локации)
CREATE TABLE disciplines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('esports', 'it'))
);

CREATE TABLE discipline_roles (
    id SERIAL PRIMARY KEY,
    discipline_id INTEGER NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    UNIQUE (discipline_id, name)
);

CREATE TABLE ranks (
    id SERIAL PRIMARY KEY,
    discipline_id INTEGER NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE (discipline_id, name)
);

CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    city VARCHAR(100) NOT NULL,
    venue_name VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE
);

-- 5. Связь профиля с дисциплинами (для фильтров свайпов)
CREATE TABLE profile_disciplines (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    discipline_id INTEGER NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES discipline_roles(id) ON DELETE SET NULL,
    rank_id INTEGER REFERENCES ranks(id) ON DELETE SET NULL,
    UNIQUE (profile_id, discipline_id)
);

-- 6. Система свайпов и мэтчи
CREATE TABLE swipes (
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_like BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (from_user_id, to_user_id),
    CHECK (from_user_id <> to_user_id)
);

CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user1_id, user2_id),
    CHECK (user1_id < user2_id)
);

-- 7. Команды (Капитан)
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    captain_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discipline_id INTEGER NOT NULL REFERENCES disciplines(id) ON DELETE RESTRICT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    looking_for_role_id INTEGER REFERENCES discipline_roles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE team_members (
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES discipline_roles(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'kicked')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

-- 8. Ивенты и турниры (отдельная логика через event_type + JSONB)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    discipline_id INTEGER NOT NULL REFERENCES disciplines(id) ON DELETE RESTRICT,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('esports', 'hackathon')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    max_participants INTEGER NOT NULL DEFAULT 16,
    status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'ongoing', 'finished', 'cancelled')),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE event_registrations (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_single_participant CHECK (
        (user_id IS NOT NULL AND team_id IS NULL) OR
        (user_id IS NULL AND team_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX idx_event_reg_user
    ON event_registrations (event_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_event_reg_team
    ON event_registrations (event_id, team_id) WHERE team_id IS NOT NULL;

CREATE TABLE tournament_matches (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    round INTEGER NOT NULL DEFAULT 1,
    participant1_id INTEGER REFERENCES event_registrations(id) ON DELETE SET NULL,
    participant2_id INTEGER REFERENCES event_registrations(id) ON DELETE SET NULL,
    score VARCHAR(50),
    proof_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'disputed', 'confirmed')),
    winner_id INTEGER REFERENCES event_registrations(id) ON DELETE SET NULL
);

-- 9. Модерация (жалобы)
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'resolved', 'dismissed')),
    moderator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action_taken VARCHAR(20)
        CHECK (action_taken IN ('none', 'warn', 'mute', 'temp_ban', 'perm_ban')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Логи аудита действий модераторов и администраторов
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(60) NOT NULL,
    target_type VARCHAR(40) NOT NULL,
    target_id INTEGER,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

-- Базовые индексы под частые выборки
CREATE INDEX idx_profile_disc_lookup ON profile_disciplines (discipline_id, role_id, rank_id);
CREATE INDEX idx_swipes_to_user ON swipes (to_user_id, is_like);
CREATE INDEX idx_events_type_status ON events (event_type, status, start_at);
CREATE INDEX idx_reports_status ON reports (status);