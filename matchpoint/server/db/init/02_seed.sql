-- ============================================================================
-- 1. ПОЛЬЗОВАТЕЛИ (6 ролей + дополнительные игроки, всего 14)
-- Пароль для всех аккаунтов: password
-- ============================================================================
INSERT INTO users (email, password_hash, role, status, ban_until) VALUES
    ('admin@matchpoint.dev',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin',     'active', NULL), -- id: 1
    ('mod@matchpoint.dev',      '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'moderator', 'active', NULL), -- id: 2
    ('org@matchpoint.dev',      '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'organizer', 'active', NULL), -- id: 3
    ('captain@matchpoint.dev',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain',   'active', NULL), -- id: 4
    ('player@matchpoint.dev',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player',    'active', NULL), -- id: 5
    ('guest@matchpoint.dev',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guest',     'active', NULL), -- id: 6
    ('dota_cap@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain',   'active', NULL), -- id: 7
    ('hack_cap@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain',   'active', NULL), -- id: 8
    ('awper@matchpoint.dev',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player',    'active', NULL), -- id: 9
    ('supp@matchpoint.dev',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player',    'active', NULL), -- id: 10
    ('front@matchpoint.dev',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player',    'active', NULL), -- id: 11
    ('mldev@matchpoint.dev',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player',    'active', NULL), -- id: 12
    ('toxic@matchpoint.dev',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player',    'muted',  NOW() + INTERVAL '3 days'), -- id: 13
    ('rifler@matchpoint.dev',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player',    'active', NULL); -- id: 14

-- ============================================================================
-- 2. ПРОФИЛИ (14 анкет)
-- ============================================================================
INSERT INTO profiles (user_id, nickname, avatar_url, prime_time, bio, contacts, external_links, trust_score) VALUES
    (1,  'AdminRoot',    'https://api.dicebear.com/9.x/identicon/svg?seed=AdminRoot',    '18:00-23:00', 'Администратор платформы MatchPoint.',
         '{"telegram": "@mp_admin"}'::jsonb, '{"github": "https://github.com/mp-admin"}'::jsonb, 5.00),
    (2,  'ModWatch',     'https://api.dicebear.com/9.x/identicon/svg?seed=ModWatch',     '17:00-22:00', 'Слежу за порядком в чатах и на турнирах.',
         '{"discord": "modwatch#0001"}'::jsonb, '{"steam": "https://steamcommunity.com/id/modwatch"}'::jsonb, 4.95),
    (3,  'OrgCyber',     'https://api.dicebear.com/9.x/identicon/svg?seed=OrgCyber',     '12:00-21:00', 'Организатор локальных LAN-турниров и хакатонов.',
         '{"telegram": "@org_cyber"}'::jsonb, '{"faceit": "https://www.faceit.com/en/players/OrgCyber"}'::jsonb, 4.90),
    (4,  'KuroCap',      'https://api.dicebear.com/9.x/identicon/svg?seed=KuroCap',      '20:00-01:00', 'Капитан и IGL в CS2, собираю стабильный стак под турики.',
         '{"discord": "kurocap", "telegram": "@kurocap"}'::jsonb, '{"steam": "https://steamcommunity.com/id/kurocap", "faceit": "https://www.faceit.com/en/players/KuroCap"}'::jsonb, 4.85),
    (5,  'ShadowStep',   'https://api.dicebear.com/9.x/identicon/svg?seed=ShadowStep',   '21:00-02:00', 'Играю CS2 по вечерам, параллельно ищу команду на зимний хакатон (Backend).',
         '{"discord": "shadowstep", "telegram": "@shadowstep_dev"}'::jsonb, '{"steam": "https://steamcommunity.com/id/shadowstep", "github": "https://github.com/shadowstep"}'::jsonb, 4.90),
    (6,  'GuestDemo',    'https://api.dicebear.com/9.x/identicon/svg?seed=GuestDemo',    '19:00-22:00', 'Тестовый гостевой профиль.',
         '{}'::jsonb, '{}'::jsonb, 5.00),
    (7,  'AegisMind',    'https://api.dicebear.com/9.x/identicon/svg?seed=AegisMind',    '19:00-00:00', 'Мидер 5200 MMR, ищу адекватных тиммейтов на боевой кубок.',
         '{"discord": "aegismind"}'::jsonb, '{"steam": "https://steamcommunity.com/id/aegismind"}'::jsonb, 4.80),
    (8,  'PyArchitect',  'https://api.dicebear.com/9.x/identicon/svg?seed=PyArchitect',  '22:00-03:00', 'Пишу бэкенд на Python/Node.js, собираю команду на CodeJam.',
         '{"telegram": "@py_architect"}'::jsonb, '{"github": "https://github.com/pyarchitect"}'::jsonb, 5.00),
    (9,  'ColdFlick',    'https://api.dicebear.com/9.x/identicon/svg?seed=ColdFlick',    '20:00-01:00', 'Мейн AWP, 10 lvl Faceit. Без тильта, чёткая инфа.',
         '{"discord": "coldflick"}'::jsonb, '{"steam": "https://steamcommunity.com/id/coldflick", "faceit": "https://www.faceit.com/en/players/ColdFlick"}'::jsonb, 4.95),
    (10, 'WardMaster',   'https://api.dicebear.com/9.x/identicon/svg?seed=WardMaster',   '18:30-23:30', 'Позиция 5 в Dota 2. Делаю стаки, покупаю смоки, не ворую крипов.',
         '{"discord": "wardmaster"}'::jsonb, '{"steam": "https://steamcommunity.com/id/wardmaster"}'::jsonb, 4.90),
    (11, 'PixelCraft',   'https://api.dicebear.com/9.x/identicon/svg?seed=PixelCraft',   '19:00-00:00', 'Фронтендер (JS/HTML/CSS), по выходным катаю CS2.',
         '{"telegram": "@pixelcraft_js", "discord": "pixelcraft"}'::jsonb, '{"github": "https://github.com/pixelcraft"}'::jsonb, 4.75),
    (12, 'TensorFlowed', 'https://api.dicebear.com/9.x/identicon/svg?seed=TensorFlowed', '20:00-02:00', 'ML-инженер на хакатоны и четвёрка в Доту для разгрузки мозга.',
         '{"telegram": "@tensor_ml"}'::jsonb, '{"github": "https://github.com/tensorflowed"}'::jsonb, 4.85),
    (13, 'TiltKing',     'https://api.dicebear.com/9.x/identicon/svg?seed=TiltKing',     '23:00-04:00', 'Всегда иду мид или Б, тиммейты виноваты.',
         '{"discord": "tiltking99"}'::jsonb, '{"steam": "https://steamcommunity.com/id/tiltking"}'::jsonb, 2.10),
    (14, 'HeadTap',      'https://api.dicebear.com/9.x/identicon/svg?seed=HeadTap',      '20:00-00:00', 'Опорник / рифлер, знаю раскид на всех картах маппула.',
         '{"discord": "headtap_cs"}'::jsonb, '{"faceit": "https://www.faceit.com/en/players/HeadTap"}'::jsonb, 4.80);

-- ============================================================================
-- 3. СПРАВОЧНИКИ (Дисциплины, роли, ранги, локации)
-- ============================================================================
INSERT INTO disciplines (name, category) VALUES
    ('CS2',          'esports'), -- id: 1
    ('Dota 2',       'esports'), -- id: 2
    ('Хакатон / IT', 'it');      -- id: 3

INSERT INTO discipline_roles (discipline_id, name) VALUES
    -- CS2 (id: 1..5)
    (1, 'AWPer'),             -- 1
    (1, 'Entry Fragger'),     -- 2
    (1, 'Rifler'),            -- 3
    (1, 'Support'),           -- 4
    (1, 'IGL'),               -- 5
    -- Dota 2 (id: 6..10)
    (2, 'Carry (Pos 1)'),     -- 6
    (2, 'Mid (Pos 2)'),       -- 7
    (2, 'Offlane (Pos 3)'),   -- 8
    (2, 'Soft Support (Pos 4)'), -- 9
    (2, 'Hard Support (Pos 5)'), -- 10
    -- Хакатон / IT (id: 11..15)
    (3, 'Backend'),           -- 11
    (3, 'Frontend'),          -- 12
    (3, 'ML / Data Science'), -- 13
    (3, 'UI/UX Designer'),    -- 14
    (3, 'Team Lead / Pitch'); -- 15

INSERT INTO ranks (discipline_id, name, sort_order) VALUES
    -- CS2 (id: 1..4)
    (1, 'Faceit 3–4 lvl', 1),      -- 1
    (1, 'Faceit 5–7 lvl', 2),      -- 2
    (1, 'Faceit 8–9 lvl', 3),      -- 3
    (1, 'Faceit 10 lvl',  4),      -- 4
    -- Dota 2 (id: 5..8)
    (2, 'Legend (3000+ MMR)',  1), -- 5
    (2, 'Ancient (4000+ MMR)', 2), -- 6
    (2, 'Divine (5000+ MMR)',  3), -- 7
    (2, 'Immortal (6000+ MMR)',4), -- 8
    -- Хакатон / IT (id: 9..11)
    (3, 'Junior',          1),     -- 9
    (3, 'Middle',          2),     -- 10
    (3, 'Senior / Призёр', 3);     -- 11

INSERT INTO locations (city, venue_name, address, lat, lng, is_verified) VALUES
    ('Гродно', 'CyberArena Grodno',     'ул. Советская 18',     53.6834, 23.8342, TRUE), -- id: 1
    ('Минск',  'Meta Arena',            'пр-т Победителей 84',  53.9362, 27.5105, TRUE), -- id: 2
    ('Гродно', 'Технопарк / Коворкинг', 'ул. Горького 91А',     53.7042, 23.8166, TRUE); -- id: 3

-- ============================================================================
-- 4. ПРИВЯЗКА ПРОФИЛЕЙ К ДИСЦИПЛИНАМ (для фильтров свайпов)
-- ============================================================================
INSERT INTO profile_disciplines (profile_id, discipline_id, role_id, rank_id) VALUES
    (1,  3, 11, 11),
    (2,  1, 4,  2),
    (3,  1, 5,  3),
    (4,  1, 5,  3),
    (5,  1, 2,  2),
    (5,  3, 11, 10),
    (6,  2, 6,  5),
    (7,  2, 7,  7),
    (8,  3, 11, 10),
    (8,  2, 8,  6),
    (9,  1, 1,  4),
    (10, 2, 10, 7),
    (11, 3, 12, 10),
    (11, 1, 3,  2),
    (12, 3, 13, 10),
    (12, 2, 9,  6),
    (13, 1, 2,  2),
    (14, 1, 3,  3);

-- ============================================================================
-- 5. СВАЙПЫ, МЭТЧИ И РЕПУТАЦИЯ (Trust Factor)
-- ============================================================================
INSERT INTO swipes (from_user_id, to_user_id, is_like) VALUES
    -- Взаимные лайки
    (5,  9,  TRUE),
    (9,  5,  TRUE),
    (5,  11, TRUE),
    (11, 5,  TRUE),
    (7,  10, TRUE),
    (10, 7,  TRUE),
    -- Односторонние (если зайти под player@matchpoint.dev и лайкнуть HeadTap (id:14) -> сразу будет Match!)
    (14, 5,  TRUE),
    (5,  13, FALSE),
    (8,  12, TRUE);

INSERT INTO matches (user1_id, user2_id) VALUES
    (5, 9),
    (5, 11),
    (7, 10);

INSERT INTO trust_ratings (from_user_id, to_user_id, score, comment) VALUES
    (5, 9,  5, 'Отличный AWP, спокойная инфа'),
    (9, 5,  5, 'Хорошо открывает точки, не тильтует'),
    (7, 10, 5, 'Варды по кд, комфортно играть'),
    (5, 13, 1, 'Руинил раунды и кричал в войс');

-- ============================================================================
-- 6. КОМАНДЫ И УЧАСТНИКИ (3 команды: CS2, Dota 2, Хакатон)
-- ============================================================================
INSERT INTO teams (captain_id, discipline_id, name, description, looking_for_role_id) VALUES
    (4, 1, 'Grodno Five',      'Стак по CS2 на зимний LAN, тренируемся 4 раза в неделю.', 2),  -- id: 1 (ищут Entry Fragger)
    (7, 2, 'Radiant Stack',    'Команда по Dota 2 на 5000+ MMR, нужен сильный керри.',    6),  -- id: 2 (ищут Carry)
    (8, 3, 'NullPointer Crew', 'Собираем веб-сервис на CodeJam, нужен UI/UX дизайнер.',   14); -- id: 3 (ищут UI/UX)

INSERT INTO team_members (team_id, user_id, role_id, status) VALUES
    -- Grodno Five
    (1, 4,  5,  'accepted'),
    (1, 9,  1,  'accepted'),
    (1, 14, 3,  'accepted'),
    (1, 5,  2,  'pending'),
    -- Radiant Stack
    (2, 7,  7,  'accepted'),
    (2, 10, 10, 'accepted'),
    (2, 12, 9,  'accepted'),
    -- NullPointer Crew
    (3, 8,  11, 'accepted'),
    (3, 11, 12, 'accepted'),
    (3, 12, 13, 'accepted');

-- ============================================================================
-- 7. ИВЕНТЫ (1 киберспорт + 1 хакатон), РЕГИСТРАЦИИ И МАТЧ СЕТКИ
-- ============================================================================
INSERT INTO events (organizer_id, discipline_id, location_id, event_type, title, description, start_at, max_participants, status, details) VALUES
    (
        3, 1, 1, 'esports',
        'MatchPoint Winter Cup: CS2 5x5',
        'Открытый LAN-турнир по Counter-Strike 2. Групповой этап + плей-офф Single Elimination.',
        '2026-12-12 12:00:00+03',
        16,
        'open',
        '{
            "format": "5x5",
            "bracket_type": "single_elimination",
            "prize_pool": "1500 BYN",
            "map_pool": ["Mirage", "Inferno", "Ancient", "Anubis", "Nuke"]
        }'::jsonb
    ), -- id: 1
    (
        3, 3, 3, 'hackathon',
        'Winter CodeJam 2026',
        '36-часовой хакатон для студентов и разработчиков: от идеи до рабочего прототипа.',
        '2026-12-19 10:00:00+03',
        20,
        'open',
        '{
            "tracks": ["Web & SaaS", "AI / ML", "GameDev"],
            "tech_stack": ["Node.js", "Python", "PostgreSQL", "HTML/CSS/JS"],
            "team_size_limit": 4,
            "submission_deadline": "2026-12-20T18:00:00+03:00"
        }'::jsonb
    ); -- id: 2

INSERT INTO event_registrations (event_id, user_id, team_id) VALUES
    (1, NULL, 1),    -- id: 1 (Команда Grodno Five на CS2 турнир)
    (1, 11,   NULL), -- id: 2 (Соло-заявка / микс на CS2 турнир)
    (2, NULL, 3),    -- id: 3 (Команда NullPointer Crew на Хакатон)
    (2, 5,    NULL); -- id: 4 (ShadowStep соло на Хакатон)

-- Спорный матч в сетке для проверки арбитража судьёй
INSERT INTO tournament_matches (event_id, round, participant1_id, participant2_id, score, proof_url, status, winner_id) VALUES
    (1, 1, 1, 2, '13:11', 'https://example.com/proofs/match1_scoreboard.png', 'disputed', NULL);

-- ============================================================================
-- 8. ЖАЛОБЫ (для панели модератора)
-- ============================================================================
INSERT INTO reports (reporter_id, target_user_id, reason, status, moderator_id, action_taken) VALUES
    (5, 13, 'Оскорбления в голосовом чате во время игры', 'resolved', 2,    'mute'),
    (9, 13, 'Фейковый ранг и токсичное описание профиля', 'open',     NULL, NULL);