-- ============================================================================
-- 1. ПОЛЬЗОВАТЕЛИ (6 ролей + дополнительные игроки и капитаны, всего 44)
-- Пароль для всех аккаунтов: password
-- ============================================================================
INSERT INTO users (email, password_hash, role, status, ban_until) VALUES
    ('admin@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active', NULL),
    ('mod@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'moderator', 'active', NULL),
    ('org@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'organizer', 'active', NULL),
    ('captain@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('player@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('guest@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'guest', 'active', NULL),
    ('dota_cap@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('hack_cap@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('awper@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('supp@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('front@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('mldev@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('toxic@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'muted', NOW() + INTERVAL '3 days'),
    ('rifler@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('sniper@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('invoker@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('clutch@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('mirage_cap@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('roshan_cap@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('gocraft@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('figmawave@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('pitch@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('storm_cap@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('neural_cap@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('flashb@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('carry9k@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('iglpro@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('roamer@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('anchor@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('cap_brest@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('cap_inferno@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('cap_dire@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('cap_ancient@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('cap_clutch@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('rustdev@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('reactui@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('cvml@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('uxpro@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('fullstack@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'player', 'active', NULL),
    ('hack_fin@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('hack_game@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('hack_edu@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('hack_sec@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL),
    ('hack_pitch@matchpoint.dev', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'captain', 'active', NULL);

-- ============================================================================
-- 2. ПРОФИЛИ (44 анкет)
-- ============================================================================
INSERT INTO profiles (user_id, nickname, avatar_url, prime_time, bio, contacts, external_links, trust_score) VALUES
    (1, 'AdminRoot', 'https://api.dicebear.com/9.x/identicon/svg?seed=AdminRoot', '18:00-23:00', 'Администратор платформы MatchPoint.', '{"telegram":"@mp_admin"}'::jsonb, '{"github":"https://github.com/mp-admin"}'::jsonb, 5.00),
    (2, 'ModWatch', 'https://api.dicebear.com/9.x/identicon/svg?seed=ModWatch', '17:00-22:00', 'Слежу за порядком в чатах и на турнирах.', '{"discord":"modwatch#0001"}'::jsonb, '{"steam":"https://steamcommunity.com/id/modwatch"}'::jsonb, 4.95),
    (3, 'OrgCyber', 'https://api.dicebear.com/9.x/identicon/svg?seed=OrgCyber', '12:00-21:00', 'Организатор локальных LAN-турниров и хакатонов.', '{"telegram":"@org_cyber"}'::jsonb, '{"faceit":"https://www.faceit.com/en/players/OrgCyber"}'::jsonb, 4.90),
    (4, 'KuroCap', 'https://api.dicebear.com/9.x/identicon/svg?seed=KuroCap', '20:00-01:00', 'Капитан и IGL в CS2, собираю стабильный стак под турики.', '{"discord":"kurocap","telegram":"@kurocap"}'::jsonb, '{"steam":"https://steamcommunity.com/id/kurocap","faceit":"https://www.faceit.com/en/players/KuroCap"}'::jsonb, 4.85),
    (5, 'ShadowStep', 'https://api.dicebear.com/9.x/identicon/svg?seed=ShadowStep', '21:00-02:00', 'Играю CS2 по вечерам, параллельно ищу команду на зимний хакатон (Backend).', '{"discord":"shadowstep","telegram":"@shadowstep_dev"}'::jsonb, '{"steam":"https://steamcommunity.com/id/shadowstep","github":"https://github.com/shadowstep"}'::jsonb, 4.90),
    (6, 'GuestDemo', 'https://api.dicebear.com/9.x/identicon/svg?seed=GuestDemo', '19:00-22:00', 'Тестовый гостевой профиль.', '{}'::jsonb, '{}'::jsonb, 5.00),
    (7, 'AegisMind', 'https://api.dicebear.com/9.x/identicon/svg?seed=AegisMind', '19:00-00:00', 'Мидер 5200 MMR, ищу адекватных тиммейтов на боевой кубок.', '{"discord":"aegismind"}'::jsonb, '{"steam":"https://steamcommunity.com/id/aegismind"}'::jsonb, 4.80),
    (8, 'PyArchitect', 'https://api.dicebear.com/9.x/identicon/svg?seed=PyArchitect', '22:00-03:00', 'Пишу бэкенд на Python/Node.js, собираю команду на CodeJam.', '{"telegram":"@py_architect"}'::jsonb, '{"github":"https://github.com/pyarchitect"}'::jsonb, 5.00),
    (9, 'ColdFlick', 'https://api.dicebear.com/9.x/identicon/svg?seed=ColdFlick', '20:00-01:00', 'Мейн AWP, 10 lvl Faceit. Без тильта, чёткая инфа.', '{"discord":"coldflick"}'::jsonb, '{"steam":"https://steamcommunity.com/id/coldflick","faceit":"https://www.faceit.com/en/players/ColdFlick"}'::jsonb, 4.95),
    (10, 'WardMaster', 'https://api.dicebear.com/9.x/identicon/svg?seed=WardMaster', '18:30-23:30', 'Позиция 5 в Dota 2. Делаю стаки, покупаю смоки, не ворую крипов.', '{"discord":"wardmaster"}'::jsonb, '{"steam":"https://steamcommunity.com/id/wardmaster"}'::jsonb, 4.90),
    (11, 'PixelCraft', 'https://api.dicebear.com/9.x/identicon/svg?seed=PixelCraft', '19:00-00:00', 'Фронтендер (JS/HTML/CSS), по выходным катаю CS2.', '{"telegram":"@pixelcraft_js","discord":"pixelcraft"}'::jsonb, '{"github":"https://github.com/pixelcraft"}'::jsonb, 4.75),
    (12, 'TensorFlowed', 'https://api.dicebear.com/9.x/identicon/svg?seed=TensorFlowed', '20:00-02:00', 'ML-инженер на хакатоны и четвёрка в Доту для разгрузки мозга.', '{"telegram":"@tensor_ml"}'::jsonb, '{"github":"https://github.com/tensorflowed"}'::jsonb, 4.85),
    (13, 'TiltKing', 'https://api.dicebear.com/9.x/identicon/svg?seed=TiltKing', '23:00-04:00', 'Всегда иду мид или Б, тиммейты виноваты.', '{"discord":"tiltking99"}'::jsonb, '{"steam":"https://steamcommunity.com/id/tiltking"}'::jsonb, 2.10),
    (14, 'HeadTap', 'https://api.dicebear.com/9.x/identicon/svg?seed=HeadTap', '20:00-00:00', 'Опорник / рифлер, знаю раскид на всех картах маппула.', '{"discord":"headtap_cs"}'::jsonb, '{"faceit":"https://www.faceit.com/en/players/HeadTap"}'::jsonb, 4.80),
    (15, 'SniperNova', 'https://api.dicebear.com/9.x/identicon/svg?seed=SniperNova', '20:00-01:00', 'AWP 2600 ELO на Faceit, стабильные опен-фраги на Mirage и Ancient.', '{"discord":"snipernova","telegram":"@sniper_nova"}'::jsonb, '{"faceit":"https://www.faceit.com/en/players/SniperNova","steam":"https://steamcommunity.com/id/snipernova"}'::jsonb, 4.92),
    (16, 'InvokerGod', 'https://api.dicebear.com/9.x/identicon/svg?seed=InvokerGod', '19:00-00:00', 'Мидер 6400 MMR (Invoker, Storm, Ember). Ищу активную четвёрку и капитана.', '{"discord":"invokergod"}'::jsonb, '{"steam":"https://steamcommunity.com/id/invokergod"}'::jsonb, 4.88),
    (17, 'ClutchFox', 'https://api.dicebear.com/9.x/identicon/svg?seed=ClutchFox', '18:30-23:30', 'Энтри-фраггер без тильта, 9 lvl Faceit. Готов катать пракки и турниры.', '{"discord":"clutchfox","telegram":"@clutch_fox"}'::jsonb, '{"faceit":"https://www.faceit.com/en/players/ClutchFox"}'::jsonb, 4.95),
    (18, 'MirageCap', 'https://api.dicebear.com/9.x/identicon/svg?seed=MirageCap', '20:00-01:00', 'Капитан стака Minsk Mirage (CS2). Разбираем демки, готовимся к LAN.', '{"discord":"miragecap","telegram":"@minsk_mirage"}'::jsonb, '{"faceit":"https://www.faceit.com/en/players/MirageCap"}'::jsonb, 4.90),
    (19, 'RoshanLead', 'https://api.dicebear.com/9.x/identicon/svg?seed=RoshanLead', '19:00-00:00', 'Собираем состав по Dota 2 на Battle Cup и открытые квалификации.', '{"discord":"roshanlead"}'::jsonb, '{"steam":"https://steamcommunity.com/id/roshanlead"}'::jsonb, 4.84),
    (20, 'GoCraft', 'https://api.dicebear.com/9.x/identicon/svg?seed=GoCraft', '20:00-02:00', 'Backend-разработчик (Go, PostgreSQL, Docker). Призёр 3 студенческих хакатонов.', '{"telegram":"@gocraft_dev"}'::jsonb, '{"github":"https://github.com/gocraft"}'::jsonb, 4.96),
    (21, 'FigmaWave', 'https://api.dicebear.com/9.x/identicon/svg?seed=FigmaWave', '18:30-23:30', 'UI/UX дизайнер и верстальщик. Быстро собираю кликабельные прототипы и дизайн-системы.', '{"telegram":"@figma_wave","discord":"figmawave"}'::jsonb, '{"github":"https://github.com/figmawave"}'::jsonb, 4.91),
    (22, 'PitchMaster', 'https://api.dicebear.com/9.x/identicon/svg?seed=PitchMaster', '19:00-00:00', 'Тимлид и продакт на хакатоны: архитектура, презентация и защита перед жюри.', '{"telegram":"@pitch_master"}'::jsonb, '{"github":"https://github.com/pitchmaster"}'::jsonb, 4.87),
    (23, 'StormLead', 'https://api.dicebear.com/9.x/identicon/svg?seed=StormLead', '20:00-02:00', 'Собираем веб-платформу на Winter CodeJam, нужен сильный фронтендер.', '{"telegram":"@bytestorm_lab"}'::jsonb, '{"github":"https://github.com/bytestorm-lab"}'::jsonb, 4.93),
    (24, 'NeuralCap', 'https://api.dicebear.com/9.x/identicon/svg?seed=NeuralCap', '22:00-03:00', 'Делаем AI-ассистента для геймеров, ищем ML-инженера в команду.', '{"telegram":"@neuralforge_ai"}'::jsonb, '{"github":"https://github.com/neuralforge-ai"}'::jsonb, 4.89),
    (25, 'FlashBang', 'https://api.dicebear.com/9.x/identicon/svg?seed=FlashBang', '20:00-01:00', 'Саппорт в CS2: идеальные флешки под выход, знаю все смоки на Inferno и Anubis.', '{"discord":"flashbang_cs"}'::jsonb, '{"faceit":"https://www.faceit.com/en/players/FlashBang"}'::jsonb, 4.94),
    (26, 'PhantomFarm', 'https://api.dicebear.com/9.x/identicon/svg?seed=PhantomFarm', '19:00-00:00', 'Керри 5800 MMR (PA, Morph, Void). Фармлю стабильно, слушаю коллы капитана.', '{"discord":"phantomfarm","telegram":"@phantom_dota"}'::jsonb, '{"steam":"https://steamcommunity.com/id/phantomfarm"}'::jsonb, 4.86),
    (27, 'TacticMind', 'https://api.dicebear.com/9.x/identicon/svg?seed=TacticMind', '20:00-00:00', 'IGL в CS2, 2400 ELO. Люблю структурные раунды и спокойную коммуникацию.', '{"discord":"tacticmind"}'::jsonb, '{"faceit":"https://www.faceit.com/en/players/TacticMind"}'::jsonb, 4.97),
    (28, 'SmokeGank', 'https://api.dicebear.com/9.x/identicon/svg?seed=SmokeGank', '18:30-23:30', 'Четвёрка в Dota 2 (Rubick, Earth Spirit, Tusk). Всегда на рунах и гангах мида.', '{"discord":"smokegank"}'::jsonb, '{"steam":"https://steamcommunity.com/id/smokegank"}'::jsonb, 4.91),
    (29, 'SiteAnchor', 'https://api.dicebear.com/9.x/identicon/svg?seed=SiteAnchor', '22:00-03:00', 'Опорник Б в CS2 (7 lvl Faceit). Держу плэнт до последнего, играю поздно вечером.', '{"discord":"siteanchor"}'::jsonb, '{"steam":"https://steamcommunity.com/id/siteanchor"}'::jsonb, 4.82),
    (30, 'BrestIGL', 'https://api.dicebear.com/9.x/identicon/svg?seed=BrestIGL', '20:00-01:00', 'Собираем крепкий состав по CS2 на ESEA Open и локальные LAN.', '{"discord":"brest_igl","telegram":"@brest_cs2"}'::jsonb, '{"faceit":"https://www.faceit.com/en/players/BrestIGL"}'::jsonb, 4.93),
    (31, 'InfernoBoss', 'https://api.dicebear.com/9.x/identicon/svg?seed=InfernoBoss', '19:00-00:00', 'Команда 8-10 lvl Faceit, тренируемся 3 раза в неделю с тренером.', '{"discord":"infernoboss"}'::jsonb, '{"faceit":"https://www.faceit.com/en/players/InfernoBoss"}'::jsonb, 4.89),
    (32, 'DireDraft', 'https://api.dicebear.com/9.x/identicon/svg?seed=DireDraft', '18:30-23:30', 'Драфтер и капитан Dota 2 стака, играем каждые выходные Battle Cup.', '{"discord":"diredraft"}'::jsonb, '{"steam":"https://steamcommunity.com/id/diredraft"}'::jsonb, 4.90),
    (33, 'RuneControl', 'https://api.dicebear.com/9.x/identicon/svg?seed=RuneControl', '20:00-02:00', 'Ищем стабильную пятёрку в сыгранный Dota 2 ростер 4500+ MMR.', '{"discord":"runecontrol"}'::jsonb, '{"steam":"https://steamcommunity.com/id/runecontrol"}'::jsonb, 4.85),
    (34, 'OvertimeCap', 'https://api.dicebear.com/9.x/identicon/svg?seed=OvertimeCap', '20:00-00:00', 'Ночной CS2 микс на фейсит и студенческую лигу.', '{"discord":"overtimecap"}'::jsonb, '{"faceit":"https://www.faceit.com/en/players/OvertimeCap"}'::jsonb, 4.88),
    (35, 'Rustacean', 'https://api.dicebear.com/9.x/identicon/svg?seed=Rustacean', '20:00-02:00', 'Пишу быстрые сервисы на Rust и Node.js, поднимаю Docker и CI/CD за 15 минут.', '{"telegram":"@rustacean_by"}'::jsonb, '{"github":"https://github.com/rustacean-by"}'::jsonb, 4.98),
    (36, 'CssWizard', 'https://api.dicebear.com/9.x/identicon/svg?seed=CssWizard', '19:00-00:00', 'Frontend (React, TypeScript, CSS-анимации). Люблю пиксель-арт и адаптивную вёрстку.', '{"telegram":"@css_wizard","discord":"csswizard"}'::jsonb, '{"github":"https://github.com/csswizard"}'::jsonb, 4.92),
    (37, 'VisionNet', 'https://api.dicebear.com/9.x/identicon/svg?seed=VisionNet', '20:00-01:00', 'Computer Vision & LLM инженер (PyTorch, FastAPI). Сделаю рабочий ML-бэкенд на хакатон.', '{"telegram":"@vision_net_ml"}'::jsonb, '{"github":"https://github.com/visionnet-ml"}'::jsonb, 4.95),
    (38, 'PixelMuse', 'https://api.dicebear.com/9.x/identicon/svg?seed=PixelMuse', '18:30-23:30', 'Product & UI/UX дизайнер: Figma, интерактивные макеты, презентации для жюри.', '{"telegram":"@pixel_muse_ux"}'::jsonb, '{"github":"https://github.com/pixelmuse"}'::jsonb, 4.90),
    (39, 'ApiBuilder', 'https://api.dicebear.com/9.x/identicon/svg?seed=ApiBuilder', '22:00-03:00', 'Junior+ Backend/Fullstack (Python, Express, SQL). Быстро учусь, готов тащить задачи ночью.', '{"telegram":"@apibuilder_dev"}'::jsonb, '{"github":"https://github.com/apibuilder"}'::jsonb, 4.84),
    (40, 'FinTechLead', 'https://api.dicebear.com/9.x/identicon/svg?seed=FinTechLead', '19:00-00:00', 'Собираем команду на FinTech-трек хакатона, есть идея и готовая архитектура.', '{"telegram":"@fintech_lead"}'::jsonb, '{"github":"https://github.com/fintech-squad"}'::jsonb, 4.94),
    (41, 'GameJamCap', 'https://api.dicebear.com/9.x/identicon/svg?seed=GameJamCap', '20:00-02:00', 'Делаем браузерную 16-битную игру на GameDev-трек, нужен дизайнер/художник.', '{"telegram":"@gamejam_cap","discord":"gamejamcap"}'::jsonb, '{"github":"https://github.com/gamejam-crew"}'::jsonb, 4.91),
    (42, 'EduTechBoss', 'https://api.dicebear.com/9.x/identicon/svg?seed=EduTechBoss', '18:30-23:30', 'Строим AI-тренажёр для студентов, нужен сильный Backend на Node/Python.', '{"telegram":"@edutech_boss"}'::jsonb, '{"github":"https://github.com/edutech-lab"}'::jsonb, 4.89),
    (43, 'CyberSecCap', 'https://api.dicebear.com/9.x/identicon/svg?seed=CyberSecCap', '20:00-01:00', 'Команда на CTF и Web-трек, ищем фронтендера для дашборда мониторинга.', '{"telegram":"@cybersec_cap"}'::jsonb, '{"github":"https://github.com/cybersec-team"}'::jsonb, 4.96),
    (44, 'StartupCrew', 'https://api.dicebear.com/9.x/identicon/svg?seed=StartupCrew', '19:00-00:00', 'Два разраба + ML готовы к CodeJam, нужен тимлид/питчер на защиту проекта.', '{"telegram":"@startup_crew_by"}'::jsonb, '{"github":"https://github.com/startup-crew"}'::jsonb, 4.87);

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
    (1, 'Faceit 3–4 lvl',  1),     -- 1
    (1, 'Faceit 5–7 lvl',  2),     -- 2
    (1, 'Faceit 8–9 lvl',  3),     -- 3
    (1, 'Faceit 10 lvl',   4),     -- 4
    -- Dota 2 (id: 5..8)
    (2, 'Legend (3000+ MMR)',   1), -- 5
    (2, 'Ancient (4000+ MMR)',  2), -- 6
    (2, 'Divine (5000+ MMR)',   3), -- 7
    (2, 'Immortal (6000+ MMR)', 4), -- 8
    -- Хакатон / IT (id: 9..11)
    (3, 'Junior / Студент', 1),    -- 9
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
    (1, 3, 11, 11),
    (2, 1, 4, 2),
    (3, 1, 5, 3),
    (4, 1, 5, 3),
    (5, 1, 2, 2),
    (5, 3, 11, 10),
    (6, 2, 6, 5),
    (7, 2, 7, 7),
    (8, 3, 11, 10),
    (8, 2, 8, 6),
    (9, 1, 1, 4),
    (10, 2, 10, 7),
    (11, 3, 12, 10),
    (11, 1, 3, 2),
    (12, 3, 13, 10),
    (12, 2, 9, 6),
    (13, 1, 2, 2),
    (14, 1, 3, 3),
    (15, 1, 1, 4),
    (16, 2, 7, 8),
    (17, 1, 2, 3),
    (18, 1, 5, 4),
    (19, 2, 10, 7),
    (20, 3, 11, 11),
    (21, 3, 14, 10),
    (22, 3, 15, 11),
    (23, 3, 11, 10),
    (24, 3, 13, 11),
    (25, 1, 4, 3),
    (26, 2, 6, 7),
    (27, 1, 5, 4),
    (28, 2, 9, 7),
    (29, 1, 3, 2),
    (30, 1, 5, 3),
    (31, 1, 5, 4),
    (32, 2, 10, 7),
    (33, 2, 7, 6),
    (34, 1, 3, 3),
    (35, 3, 11, 11),
    (36, 3, 12, 10),
    (37, 3, 13, 11),
    (38, 3, 14, 10),
    (39, 3, 11, 9),
    (40, 3, 15, 11),
    (41, 3, 12, 10),
    (42, 3, 13, 10),
    (43, 3, 11, 11),
    (44, 3, 11, 10);

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
-- 6. КОМАНДЫ И УЧАСТНИКИ (13 команд: CS2, Dota 2, Хакатон)
-- ============================================================================
INSERT INTO teams (captain_id, discipline_id, name, description, looking_for_role_id) VALUES
    (4, 1, 'Grodno Five', 'Стак по CS2 на зимний LAN, тренируемся 4 раза в неделю.', 2),
    (7, 2, 'Radiant Stack', 'Команда по Dota 2 на 5000+ MMR, нужен сильный керри.', 6),
    (8, 3, 'NullPointer Crew', 'Собираем веб-сервис на CodeJam, нужен UI/UX дизайнер.', 14),
    (30, 1, 'Brest Syndicate', 'Сыгранная четвёрка CS2 на ESEA Open, ищем стабильного AWPer 8+ lvl.', 1),
    (31, 1, 'Inferno Kings', 'Тренировки 3 раза в неделю + разбор демок, нужен Entry Fragger.', 2),
    (32, 2, 'Dire Wolves', 'Состав на Battle Cup (5000+ MMR), ищем сильного мидера (Pos 2).', 7),
    (33, 2, 'Rune Guardians', 'Дружный стак 4500+ MMR без тильта, нужна пятёрка (Hard Support).', 10),
    (34, 1, 'Overtime Five', 'Студенческая команда по CS2 на зимний кубок, ищем рифлера.', 3),
    (40, 3, 'FinFlow Squad', 'Делаем скоринг-сервис на FinTech-трек, нужен ML / Data Science.', 13),
    (41, 3, 'PixelForge Jam', 'Собираем 16-битную веб-игру за 36 часов, ищем UI/UX дизайнера.', 14),
    (42, 3, 'CampusAI Lab', 'AI-помощник для подготовки к экзаменам, нужен Backend (Node/Python).', 11),
    (43, 3, 'ZeroDay Shield', 'Дашборд безопасности на Web-трек, ищем Frontend-разработчика.', 12),
    (44, 3, 'ShipFast Crew', 'Сильный тех-стек уже собран, нужен Team Lead / Pitch для защиты.', 15);

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
    (3, 12, 13, 'accepted'),
    -- Капитаны остальных команд (id 4..13)
    (4, 30, 5, 'accepted'),
    (5, 31, 5, 'accepted'),
    (6, 32, 10, 'accepted'),
    (7, 33, 7, 'accepted'),
    (8, 34, 3, 'accepted'),
    (9, 40, 15, 'accepted'),
    (10, 41, 12, 'accepted'),
    (11, 42, 13, 'accepted'),
    (12, 43, 11, 'accepted'),
    (13, 44, 11, 'accepted');

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