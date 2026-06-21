PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'student')),
  level INTEGER NOT NULL DEFAULT 1,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  game_points INTEGER NOT NULL DEFAULT 0 CHECK (game_points >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registration_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL COLLATE NOCASE,
  contact TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS registration_pending_username
ON registration_requests(username) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS game_matches (id INTEGER PRIMARY KEY AUTOINCREMENT, game_key TEXT NOT NULL, game_name TEXT NOT NULL, mode TEXT NOT NULL CHECK (mode IN ('individual','teams')), host_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, rounds INTEGER NOT NULL CHECK (rounds BETWEEN 1 AND 30), timer_seconds INTEGER NOT NULL DEFAULT 0 CHECK (timer_seconds BETWEEN 0 AND 180), max_bet INTEGER NOT NULL DEFAULT 0 CHECK (max_bet >= 0), status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')), winning_sides TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT);
CREATE TABLE IF NOT EXISTS game_match_players (match_id INTEGER NOT NULL REFERENCES game_matches(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, side TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0), is_winner INTEGER NOT NULL DEFAULT 0 CHECK (is_winner IN (0,1)), PRIMARY KEY (match_id,user_id));
CREATE TABLE IF NOT EXISTS game_point_awards (match_id INTEGER NOT NULL REFERENCES game_matches(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, points INTEGER NOT NULL CHECK (points > 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (match_id,user_id));
CREATE TRIGGER IF NOT EXISTS game_award_add_points AFTER INSERT ON game_point_awards BEGIN UPDATE users SET game_points = game_points + NEW.points WHERE id = NEW.user_id; END;
CREATE TABLE IF NOT EXISTS game_settings (setting_key TEXT PRIMARY KEY, setting_value INTEGER NOT NULL CHECK (setting_value > 0), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO game_settings (setting_key,setting_value) VALUES ('win_points',100),('million_cap',10000);

CREATE TABLE IF NOT EXISTS activity_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  points INTEGER NOT NULL CHECK (points > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, activity_type, activity_id)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK (price > 0),
  icon TEXT NOT NULL DEFAULT '🎁',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  points_paid INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  image TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL CHECK (category IN ('daily', 'weekly', 'grand')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reward_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id INTEGER NOT NULL REFERENCES rewards(id),
  points_paid INTEGER NOT NULL CHECK (points_paid > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT
);

CREATE TABLE IF NOT EXISTS daily_challenge_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_key TEXT NOT NULL,
  challenge_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed')),
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE(user_id, challenge_key, challenge_date)
);

CREATE INDEX IF NOT EXISTS daily_attempts_user_date
ON daily_challenge_attempts(user_id, challenge_date);

CREATE TABLE IF NOT EXISTS daily_challenge_settings (
  challenge_key TEXT PRIMARY KEY,
  max_points INTEGER NOT NULL CHECK (max_points BETWEEN 1 AND 10000),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO daily_challenge_settings (challenge_key, max_points) VALUES
  ('fast-answer', 150), ('character', 120), ('blurred-image', 110),
  ('image-puzzle', 130), ('password', 100), ('scrambled-letters', 140),
  ('differences', 120), ('memory', 110), ('maze', 130), ('hidden-treasure', 150);

CREATE TABLE IF NOT EXISTS competition_settings (
  competition_id INTEGER PRIMARY KEY CHECK (competition_id BETWEEN 1 AND 6),
  points INTEGER NOT NULL CHECK (points BETWEEN 1 AND 10000),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES
  ('manager_instructions_title', 'رسالة المدير لك اليوم'),
  ('manager_instructions_body', 'ابدأ يومك بابتسامة، أكمل مهمة واحدة على الأقل، وشارك أصدقاءك كلمة طيبة. نحن نفخر بك!');

INSERT OR IGNORE INTO competition_settings (competition_id, points) VALUES
  (1, 350), (2, 280), (3, 400), (4, 300), (5, 500), (6, 650);

CREATE TABLE IF NOT EXISTS achievement_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('golden_achievements', 'golden_fortress', 'noori', 'knowledge_station', 'golden_minute', 'health_first')),
  points INTEGER NOT NULL CHECK (points > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  start_date TEXT NOT NULL,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS achievement_tasks_active_date
ON achievement_tasks(active, start_date);

CREATE TABLE IF NOT EXISTS achievement_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES achievement_tasks(id),
  achievement_date TEXT NOT NULL,
  points INTEGER NOT NULL CHECK (points > 0),
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, task_id, achievement_date)
);

CREATE INDEX IF NOT EXISTS achievement_completions_user_date
ON achievement_completions(user_id, achievement_date);

CREATE INDEX IF NOT EXISTS achievement_completions_date_points
ON achievement_completions(achievement_date, points);

CREATE TRIGGER IF NOT EXISTS achievement_completion_add_points
AFTER INSERT ON achievement_completions
BEGIN
  UPDATE users SET points = points + NEW.points WHERE id = NEW.user_id;
END;

CREATE TABLE IF NOT EXISTS majlis_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'sticker')),
  image_data TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS majlis_posts_created_at ON majlis_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS majlis_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES majlis_posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES majlis_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'sticker')),
  image_data TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS majlis_comments_post_id ON majlis_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS majlis_comments_parent_id ON majlis_comments(parent_id);

CREATE TABLE IF NOT EXISTS majlis_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id INTEGER NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike', 'laugh')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS majlis_reactions_target ON majlis_reactions(target_type, target_id);

INSERT OR IGNORE INTO products (id, name, description, price, icon, stock) VALUES
  (1, 'قسيمة مكتبة', 'قسيمة لشراء كتاب من المكتبة', 1200, '📚', 8),
  (2, 'كوب الإنجاز', 'كوب حصري يحمل شعار المنصة', 1800, '🏆', 4),
  (3, 'ساعة ذكية', 'جائزة للمثابرين وأصحاب الهمم', 6500, '⌚', 2),
  (4, 'حقيبة صيف', 'حقيبة مرحة للدراسة والمغامرات', 3200, '🎒', 6),
  (5, 'وقت لعب إضافي', '30 دقيقة ألعاب تعليمية إضافية', 600, '🎮', 20),
  (6, 'شارة المستكشف', 'شارة نادرة تظهر في ملفك الشخصي', 900, '🧭', 12);
