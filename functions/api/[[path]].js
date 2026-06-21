const SESSION_COOKIE = "saif_session";
const SESSION_DAYS = 14;
const ALLOWED_REWARDS = {
  competition: { "1": 350, "2": 280, "3": 400, "4": 300, "5": 500, "6": 650 },
  game: { "0": 80, "1": 100, "2": 120, "3": 150 }
};
const DAILY_CHALLENGES = new Set(["fast-answer", "character", "blurred-image", "image-puzzle", "password", "scrambled-letters", "differences", "memory", "maze", "hidden-treasure"]);
const ACHIEVEMENT_CATEGORIES = new Set(["golden_achievements", "golden_fortress", "noori", "knowledge_station", "golden_minute", "health_first"]);

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "قاعدة البيانات غير مربوطة" }, 503);
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const method = request.method.toUpperCase();

  try {
    if (method !== "GET" && method !== "HEAD" && !validOrigin(request, url)) {
      return json({ error: "طلب غير مسموح" }, 403);
    }

    if (method === "GET" && path === "setup/status") return setupStatus(env);
    if (method === "POST" && path === "setup/owner") return setupOwner(request, env);
    if (method === "POST" && path === "auth/login") return login(request, env);
    if (method === "POST" && path === "auth/logout") return logout(request, env);
    if (method === "GET" && path === "auth/me") return getMe(request, env);
    if (method === "POST" && path === "registration-requests") return createRequest(request, env);

    const session = await requireSession(request, env);
    if (session.response) return session.response;
    const user = session.user;

    if (method === "GET" && path === "daily-challenges") return listDailyChallenges(env, user);
    if (method === "GET" && path === "manager-instructions") return getManagerInstructions(env);
    if (method === "GET" && path === "achievements") return listAchievements(url, env, user);
    if (method === "GET" && path === "achievements/leaderboards") return achievementLeaderboards(env);
    const achievementComplete = path.match(/^achievements\/(\d+)\/complete$/);
    if (method === "POST" && achievementComplete) return completeAchievement(request, env, user, Number(achievementComplete[1]));
    const dailyStart = path.match(/^daily-challenges\/([a-z-]+)\/start$/);
    if (method === "POST" && dailyStart) return startDailyChallenge(env, user, dailyStart[1]);
    const dailyComplete = path.match(/^daily-challenges\/([a-z-]+)\/complete$/);
    if (method === "POST" && dailyComplete) return completeDailyChallenge(request, env, user, dailyComplete[1]);
    if (method === "POST" && path === "progress/award") return awardProgress(request, env, user);
    if (method === "GET" && path === "competition-settings") return listCompetitionSettings(env);
    if (method === "GET" && path === "products") return listProducts(env);
    if (method === "GET" && path === "rewards") return listRewards(env);
    if (method === "GET" && path === "majlis") return listMajlis(env, user);
    if (method === "POST" && path === "majlis/posts") return createMajlisPost(request, env, user);
    const majlisComment = path.match(/^majlis\/posts\/(\d+)\/comments$/);
    if (method === "POST" && majlisComment) return createMajlisComment(request, env, user, Number(majlisComment[1]));
    const majlisReaction = path.match(/^majlis\/(posts|comments)\/(\d+)\/reaction$/);
    if (method === "POST" && majlisReaction) return setMajlisReaction(request, env, user, majlisReaction[1] === "posts" ? "post" : "comment", Number(majlisReaction[2]));
    const rewardPurchase = path.match(/^rewards\/(\d+)\/purchase$/);
    if (method === "POST" && rewardPurchase) return purchaseReward(env, user, Number(rewardPurchase[1]));
    if (method === "POST" && path === "store/purchase") return purchaseProduct(request, env, user);
    if (path.startsWith("owner/")) {
      if (user.role !== "owner") return json({ error: "غير مصرح" }, 403);
      if (method === "GET" && path === "owner/registration-requests") return listRequests(env);
      if (method === "GET" && path === "owner/users") return listUsers(env);
      if (method === "GET" && path === "owner/achievement-tasks") return listAchievementTasks(env);
      if (method === "GET" && path === "owner/daily-challenge-settings") return listDailyChallengeSettings(env);
      if (method === "GET" && path === "owner/competition-settings") return listCompetitionSettings(env);
      if (method === "GET" && path === "owner/manager-instructions") return getManagerInstructions(env);
      if (method === "PUT" && path === "owner/manager-instructions") return updateManagerInstructions(request, env);
      if (method === "POST" && path === "owner/achievement-tasks") return createAchievementTask(request, env);
      if (method === "POST" && path === "owner/users") return createUser(request, env);
      if (method === "POST" && path === "owner/products") return createProduct(request, env);
      if (method === "POST" && path === "owner/rewards") return createReward(request, env);
      if (method === "GET" && path === "owner/reward-orders") return listRewardOrders(env);
      const approve = path.match(/^owner\/registration-requests\/(\d+)\/approve$/);
      if (method === "POST" && approve) return approveRequest(request, env, Number(approve[1]));
      const reject = path.match(/^owner\/registration-requests\/(\d+)\/reject$/);
      if (method === "POST" && reject) return rejectRequest(env, Number(reject[1]));
      const remove = path.match(/^owner\/users\/(\d+)$/);
      if (method === "PUT" && remove) return updateUser(request, env, Number(remove[1]));
      if (method === "DELETE" && remove) return deleteUser(env, Number(remove[1]), user.id);
      const achievementTask = path.match(/^owner\/achievement-tasks\/(\d+)$/);
      if (method === "PUT" && achievementTask) return updateAchievementTaskStatus(request, env, Number(achievementTask[1]));
      const challengeSetting = path.match(/^owner\/daily-challenge-settings\/([a-z-]+)$/);
      if (method === "PUT" && challengeSetting) return updateDailyChallengeSetting(request, env, challengeSetting[1]);
      const competitionSetting = path.match(/^owner\/competition-settings\/(\d+)$/);
      if (method === "PUT" && competitionSetting) return updateCompetitionSetting(request, env, Number(competitionSetting[1]));
      const removeProduct = path.match(/^owner\/products\/(\d+)$/);
      if (method === "DELETE" && removeProduct) return deleteProduct(env, Number(removeProduct[1]));
      const reward = path.match(/^owner\/rewards\/(\d+)$/);
      if (method === "PUT" && reward) return updateReward(request, env, Number(reward[1]));
      if (method === "DELETE" && reward) return deleteReward(env, Number(reward[1]));
      const deliveredOrder = path.match(/^owner\/reward-orders\/(\d+)\/delivered$/);
      if (method === "PUT" && deliveredOrder) return markRewardOrderDelivered(env, Number(deliveredOrder[1]));
    }
    return json({ error: "المسار غير موجود" }, 404);
  } catch (error) {
    console.error(error);
    if (path === "setup/owner") {
      const detail = String(error?.message || error).replace(/[\r\n]+/g, " ").slice(0, 220);
      return json({ error: `تعذر إنشاء الحساب: ${detail}` }, 500);
    }
    return json({ error: "حدث خطأ في الخادم" }, 500);
  }
}

async function setupOwner(request, env) {
  if (!env.SETUP_TOKEN) return json({ error: "سر الإعداد غير مضبوط" }, 503);
  const body = await readJson(request);
  if (body.setupToken !== env.SETUP_TOKEN) return json({ error: "سر الإعداد غير صحيح" }, 403);
  await archiveLegacyUsersIfNeeded(env);
  await ensureSchema(env);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").first();
  if (existing) return json({ error: "تم إنشاء حساب المالك مسبقًا" }, 409);
  const fields = validateAccount(body);
  if (fields.error) return json({ error: fields.error }, 400);
  const password = await hashPassword(fields.password);
  await env.DB.prepare("INSERT INTO users (name, username, password_hash, password_salt, role, level, points) VALUES (?, ?, ?, ?, 'owner', 0, 0)")
    .bind(fields.name, fields.username, password.hash, password.salt).run();
  return json({ ok: true }, 201);
}

async function archiveLegacyUsersIfNeeded(env) {
  const table = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").first();
  if (!table) return;
  const { results } = await env.DB.prepare("PRAGMA table_info(users)").all();
  const supported = new Set(["id", "name", "username", "password_hash", "password_salt", "role", "level", "points", "status", "created_at"]);
  const incompatible = results.some(column => column.notnull && column.dflt_value == null && !supported.has(column.name));
  if (!incompatible) return;
  if (results.some(column => column.name === "role")) {
    const owner = await env.DB.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").first();
    if (owner) throw new Error("يوجد حساب مالك في جدول قديم؛ أوقفنا الترقية لحماية البيانات");
  }
  const suffix = `legacy_${Date.now()}`;
  for (const tableName of ["purchases", "activity_rewards", "sessions", "users"]) {
    const exists = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(tableName).first();
    if (exists) await env.DB.prepare(`ALTER TABLE ${tableName} RENAME TO ${tableName}_${suffix}`).run();
  }
}

async function setupStatus(env) {
  const status = { databaseBound: Boolean(env.DB), setupTokenConfigured: Boolean(env.SETUP_TOKEN), schemaReady: false, ownerExists: false };
  if (!env.DB) return json(status);
  try {
    const table = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").first();
    status.schemaReady = Boolean(table);
    if (table) status.ownerExists = Boolean(await env.DB.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").first());
  } catch (error) {
    status.databaseError = String(error?.message || error).slice(0, 160);
  }
  return json(status);
}

async function ensureSchema(env) {
  const statements = [
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('owner','student')), level INTEGER NOT NULL DEFAULT 1, points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0), status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS registration_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL COLLATE NOCASE, contact TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT)",
    "CREATE UNIQUE INDEX IF NOT EXISTS registration_pending_username ON registration_requests(username) WHERE status = 'pending'",
    "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id)",
    "CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at)",
    "CREATE TABLE IF NOT EXISTS activity_rewards (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, activity_type TEXT NOT NULL, activity_id TEXT NOT NULL, points INTEGER NOT NULL CHECK (points > 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, activity_type, activity_id))",
    "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL CHECK (price > 0), icon TEXT NOT NULL DEFAULT '🎁', stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id), points_paid INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS rewards (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, image TEXT NOT NULL, amount REAL NOT NULL CHECK (amount > 0), category TEXT NOT NULL CHECK (category IN ('daily','weekly','grand')), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS reward_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, reward_id INTEGER NOT NULL REFERENCES rewards(id), points_paid INTEGER NOT NULL CHECK (points_paid > 0), status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, delivered_at TEXT)",
    "CREATE TABLE IF NOT EXISTS daily_challenge_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, challenge_key TEXT NOT NULL, challenge_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed')), score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0), points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0), duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0), started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT, UNIQUE(user_id, challenge_key, challenge_date))",
    "CREATE INDEX IF NOT EXISTS daily_attempts_user_date ON daily_challenge_attempts(user_id, challenge_date)",
    "CREATE TABLE IF NOT EXISTS daily_challenge_settings (challenge_key TEXT PRIMARY KEY, max_points INTEGER NOT NULL CHECK (max_points BETWEEN 1 AND 10000), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS competition_settings (competition_id INTEGER PRIMARY KEY CHECK (competition_id BETWEEN 1 AND 6), points INTEGER NOT NULL CHECK (points BETWEEN 1 AND 10000), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS site_settings (setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES ('manager_instructions_title', 'رسالة المدير لك اليوم')",
    "INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES ('manager_instructions_body', 'ابدأ يومك بابتسامة، أكمل مهمة واحدة على الأقل، وشارك أصدقاءك كلمة طيبة. نحن نفخر بك!')",
    "CREATE TABLE IF NOT EXISTS achievement_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL CHECK (category IN ('golden_achievements','golden_fortress','noori','knowledge_station','golden_minute','health_first')), points INTEGER NOT NULL CHECK (points > 0), active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), start_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS achievement_tasks_active_date ON achievement_tasks(active, start_date)",
    "CREATE TABLE IF NOT EXISTS achievement_completions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, task_id INTEGER NOT NULL REFERENCES achievement_tasks(id), achievement_date TEXT NOT NULL, points INTEGER NOT NULL CHECK (points > 0), completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, task_id, achievement_date))",
    "CREATE INDEX IF NOT EXISTS achievement_completions_user_date ON achievement_completions(user_id, achievement_date)",
    "CREATE INDEX IF NOT EXISTS achievement_completions_date_points ON achievement_completions(achievement_date, points)",
    "CREATE TRIGGER IF NOT EXISTS achievement_completion_add_points AFTER INSERT ON achievement_completions BEGIN UPDATE users SET points = points + NEW.points WHERE id = NEW.user_id; END",
    "CREATE TABLE IF NOT EXISTS majlis_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text','sticker')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS majlis_posts_created_at ON majlis_posts(created_at DESC)",
    "CREATE TABLE IF NOT EXISTS majlis_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES majlis_posts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, parent_id INTEGER REFERENCES majlis_comments(id) ON DELETE CASCADE, content TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text','sticker')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS majlis_comments_post_id ON majlis_comments(post_id, created_at)",
    "CREATE INDEX IF NOT EXISTS majlis_comments_parent_id ON majlis_comments(parent_id)",
    "CREATE TABLE IF NOT EXISTS majlis_reactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_type TEXT NOT NULL CHECK (target_type IN ('post','comment')), target_id INTEGER NOT NULL, reaction TEXT NOT NULL CHECK (reaction IN ('like','dislike','laugh')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, target_type, target_id))",
    "CREATE INDEX IF NOT EXISTS majlis_reactions_target ON majlis_reactions(target_type, target_id)",
    "INSERT OR IGNORE INTO products (id,name,description,price,icon,stock) VALUES (1,'قسيمة مكتبة','قسيمة لشراء كتاب من المكتبة',1200,'📚',8)",
    "INSERT OR IGNORE INTO products (id,name,description,price,icon,stock) VALUES (2,'كوب الإنجاز','كوب حصري يحمل شعار المنصة',1800,'🏆',4)",
    "INSERT OR IGNORE INTO products (id,name,description,price,icon,stock) VALUES (3,'ساعة ذكية','جائزة للمثابرين وأصحاب الهمم',6500,'⌚',2)",
    "INSERT OR IGNORE INTO products (id,name,description,price,icon,stock) VALUES (4,'حقيبة صيف','حقيبة مرحة للدراسة والمغامرات',3200,'🎒',6)",
    "INSERT OR IGNORE INTO products (id,name,description,price,icon,stock) VALUES (5,'وقت لعب إضافي','30 دقيقة ألعاب تعليمية إضافية',600,'🎮',20)",
    "INSERT OR IGNORE INTO products (id,name,description,price,icon,stock) VALUES (6,'شارة المستكشف','شارة نادرة تظهر في ملفك الشخصي',900,'🧭',12)"
  ];
  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
  await ensureColumns(env, "users", {
    password_hash: "TEXT NOT NULL DEFAULT ''",
    password_salt: "TEXT NOT NULL DEFAULT ''",
    role: "TEXT NOT NULL DEFAULT 'student'",
    level: "INTEGER NOT NULL DEFAULT 1",
    points: "INTEGER NOT NULL DEFAULT 0",
    status: "TEXT NOT NULL DEFAULT 'active'",
    created_at: "TEXT NOT NULL DEFAULT ''"
  });
  await ensureColumns(env, "registration_requests", {
    note: "TEXT NOT NULL DEFAULT ''",
    status: "TEXT NOT NULL DEFAULT 'pending'",
    created_at: "TEXT NOT NULL DEFAULT ''",
    reviewed_at: "TEXT"
  });
  await ensureColumns(env, "products", {
    description: "TEXT NOT NULL DEFAULT ''",
    icon: "TEXT NOT NULL DEFAULT '🎁'",
    stock: "INTEGER NOT NULL DEFAULT 0",
    active: "INTEGER NOT NULL DEFAULT 1",
    created_at: "TEXT NOT NULL DEFAULT ''"
  });
  await ensureColumns(env, "achievement_tasks", {
    end_date: "TEXT"
  });
}

async function ensureColumns(env, table, definitions) {
  const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  const existing = new Set(results.map(column => column.name));
  for (const [name, definition] of Object.entries(definitions)) {
    if (!existing.has(name)) await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
  }
}

async function login(request, env) {
  const body = await readJson(request);
  const username = clean(body.username, 40).toLowerCase();
  const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND status = 'active'").bind(username).first();
  if (!user || !(await verifyPassword(String(body.password || ""), user.password_salt, user.password_hash))) {
    return json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, 401);
  }
  const sessionId = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(new Date().toISOString()),
    env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(await sha256(sessionId), user.id, expires)
  ]);
  return json({ user: publicUser(user) }, 200, { "Set-Cookie": sessionCookie(sessionId, SESSION_DAYS * 86400) });
}

async function logout(request, env) {
  const token = cookie(request, SESSION_COOKIE);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(token)).run();
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
}

async function getMe(request, env) {
  const session = await requireSession(request, env);
  if (session.response) return session.response;
  return json({ user: publicUser(session.user) });
}

async function createRequest(request, env) {
  const body = await readJson(request);
  const name = clean(body.name, 80), username = clean(body.username, 40).toLowerCase();
  const contact = clean(body.contact, 40), note = clean(body.note, 300);
  if (name.length < 3 || !validUsername(username) || contact.length < 7) return json({ error: "تحقق من بيانات الطلب" }, 400);
  const exists = await env.DB.prepare("SELECT 1 FROM users WHERE username = ? UNION SELECT 1 FROM registration_requests WHERE username = ? AND status = 'pending' LIMIT 1").bind(username, username).first();
  if (exists) return json({ error: "اسم المستخدم مستخدم أو لديه طلب سابق" }, 409);
  await env.DB.prepare("INSERT INTO registration_requests (name, username, contact, note) VALUES (?, ?, ?, ?)").bind(name, username, contact, note).run();
  return json({ ok: true }, 201);
}

async function listRequests(env) {
  const { results } = await env.DB.prepare("SELECT id, name, username, contact, note, status, created_at FROM registration_requests WHERE status = 'pending' ORDER BY created_at DESC").all();
  return json({ requests: results });
}

async function listUsers(env) {
  const { results } = await env.DB.prepare("SELECT id, name, username, role, level, points, status, created_at FROM users ORDER BY created_at DESC").all();
  return json({ users: results });
}

async function createUser(request, env) {
  const fields = validateAccount(await readJson(request));
  if (fields.error) return json({ error: fields.error }, 400);
  const password = await hashPassword(fields.password);
  try {
    const result = await env.DB.prepare("INSERT INTO users (name, username, password_hash, password_salt, role, level, points) VALUES (?, ?, ?, ?, 'student', ?, ?)")
      .bind(fields.name, fields.username, password.hash, password.salt, fields.level, fields.points).run();
    return json({ id: result.meta.last_row_id }, 201);
  } catch (error) {
    if (String(error).includes("UNIQUE")) return json({ error: "اسم المستخدم موجود بالفعل" }, 409);
    throw error;
  }
}

async function approveRequest(request, env, id) {
  const pending = await env.DB.prepare("SELECT * FROM registration_requests WHERE id = ? AND status = 'pending'").bind(id).first();
  if (!pending) return json({ error: "الطلب غير موجود" }, 404);
  const body = await readJson(request);
  const fields = validateAccount({ ...body, name: pending.name, username: body.username || pending.username });
  if (fields.error) return json({ error: fields.error }, 400);
  const password = await hashPassword(fields.password);
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (name, username, password_hash, password_salt, role, level, points) VALUES (?, ?, ?, ?, 'student', ?, 0)").bind(fields.name, fields.username, password.hash, password.salt, fields.level),
      env.DB.prepare("UPDATE registration_requests SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(id)
    ]);
    return json({ ok: true });
  } catch (error) {
    if (String(error).includes("UNIQUE")) return json({ error: "اسم المستخدم موجود بالفعل" }, 409);
    throw error;
  }
}

async function rejectRequest(env, id) {
  const result = await env.DB.prepare("UPDATE registration_requests SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "الطلب غير موجود" }, 404);
}

async function deleteUser(env, id, ownerId) {
  if (id === ownerId) return json({ error: "لا يمكن حذف حساب المالك الحالي" }, 400);
  const result = await env.DB.prepare("DELETE FROM users WHERE id = ? AND role = 'student'").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "الحساب غير موجود" }, 404);
}

async function awardProgress(request, env, user) {
  if (user.role !== "student") return json({ error: "حساب المالك لا يجمع نقاطًا" }, 400);
  const body = await readJson(request), type = String(body.type || ""), id = String(body.id || "");
  let points = ALLOWED_REWARDS[type]?.[id];
  if (type === "competition") {
    await ensureCompetitionSettings(env);
    const setting = await env.DB.prepare("SELECT points FROM competition_settings WHERE competition_id = ?").bind(Number(id)).first();
    points = Number(setting?.points || points || 0);
  }
  if (!points) return json({ error: "نشاط غير صالح" }, 400);
  const exists = await env.DB.prepare("SELECT 1 FROM activity_rewards WHERE user_id = ? AND activity_type = ? AND activity_id = ?").bind(user.id, type, id).first();
  if (exists) return json({ error: "تم احتساب هذا النشاط سابقًا" }, 409);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO activity_rewards (user_id, activity_type, activity_id, points) VALUES (?, ?, ?, ?)").bind(user.id, type, id, points),
    env.DB.prepare("UPDATE users SET points = points + ? WHERE id = ?").bind(points, user.id)
  ]);
  const updated = await env.DB.prepare("SELECT points FROM users WHERE id = ?").bind(user.id).first();
  return json({ points: updated.points, awarded: points });
}

async function updateUser(request, env, id) {
  const existing = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").bind(id).first();
  if (!existing) return json({ error: "حساب المستفيد غير موجود" }, 404);
  const body = await readJson(request);
  const name = clean(body.name, 80), username = clean(body.username, 40).toLowerCase();
  const level = Math.max(1, Math.min(20, Math.floor(Number(body.level) || 1)));
  const passwordValue = String(body.password || "");
  if (name.length < 3) return json({ error: "اسم المستفيد قصير جدًا" }, 400);
  if (!validUsername(username)) return json({ error: "اسم المستخدم يجب أن يحتوي حروفًا إنجليزية أو أرقامًا" }, 400);
  if (passwordValue && (passwordValue.length < 8 || passwordValue.length > 128)) return json({ error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" }, 400);
  try {
    if (passwordValue) {
      const password = await hashPassword(passwordValue);
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET name = ?, username = ?, level = ?, password_hash = ?, password_salt = ? WHERE id = ? AND role = 'student'").bind(name, username, level, password.hash, password.salt, id),
        env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id)
      ]);
    } else {
      await env.DB.prepare("UPDATE users SET name = ?, username = ?, level = ? WHERE id = ? AND role = 'student'").bind(name, username, level, id).run();
    }
    return json({ ok: true });
  } catch (error) {
    if (String(error).includes("UNIQUE")) return json({ error: "اسم المستخدم مستخدم في حساب آخر" }, 409);
    throw error;
  }
}

async function ensureCompetitionSettings(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS competition_settings (competition_id INTEGER PRIMARY KEY CHECK (competition_id BETWEEN 1 AND 6), points INTEGER NOT NULL CHECK (points BETWEEN 1 AND 10000), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  const defaults = [350,280,400,300,500,650];
  await env.DB.batch(defaults.map((points, index) => env.DB.prepare("INSERT OR IGNORE INTO competition_settings (competition_id, points) VALUES (?, ?)").bind(index + 1, points)));
}

async function listCompetitionSettings(env) {
  await ensureCompetitionSettings(env);
  const { results } = await env.DB.prepare("SELECT competition_id, points, updated_at FROM competition_settings ORDER BY competition_id").all();
  return json({ settings: results });
}

async function updateCompetitionSetting(request, env, id) {
  if (!Number.isInteger(id) || id < 1 || id > 6) return json({ error: "المسابقة غير موجودة" }, 404);
  await ensureCompetitionSettings(env);
  const body = await readJson(request), points = Math.floor(Number(body.points));
  if (!Number.isInteger(points) || points < 1 || points > 10000) return json({ error: "النقاط يجب أن تكون بين 1 و10000" }, 400);
  await env.DB.prepare("UPDATE competition_settings SET points = ?, updated_at = CURRENT_TIMESTAMP WHERE competition_id = ?").bind(points, id).run();
  return json({ ok: true, competitionId: id, points });
}

function riyadhDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function ensureDailyChallengesSchema(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS daily_challenge_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, challenge_key TEXT NOT NULL, challenge_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed')), score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0), points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0), duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0), started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT, UNIQUE(user_id, challenge_key, challenge_date))").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS daily_attempts_user_date ON daily_challenge_attempts(user_id, challenge_date)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS daily_challenge_settings (challenge_key TEXT PRIMARY KEY, max_points INTEGER NOT NULL CHECK (max_points BETWEEN 1 AND 10000), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  const defaults = {"fast-answer":150,"character":120,"blurred-image":110,"image-puzzle":130,"password":100,"scrambled-letters":140,"differences":120,"memory":110,"maze":130,"hidden-treasure":150};
  await env.DB.batch(Object.entries(defaults).map(([key, points]) => env.DB.prepare("INSERT OR IGNORE INTO daily_challenge_settings (challenge_key, max_points) VALUES (?, ?)").bind(key, points)));
}

async function ensureAchievementsSchema(env) {
  const statements = [
    "CREATE TABLE IF NOT EXISTS achievement_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL CHECK (category IN ('golden_achievements','golden_fortress','noori','knowledge_station','golden_minute','health_first')), points INTEGER NOT NULL CHECK (points > 0), active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), start_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS achievement_tasks_active_date ON achievement_tasks(active, start_date)",
    "CREATE TABLE IF NOT EXISTS achievement_completions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, task_id INTEGER NOT NULL REFERENCES achievement_tasks(id), achievement_date TEXT NOT NULL, points INTEGER NOT NULL CHECK (points > 0), completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, task_id, achievement_date))",
    "CREATE INDEX IF NOT EXISTS achievement_completions_user_date ON achievement_completions(user_id, achievement_date)",
    "CREATE INDEX IF NOT EXISTS achievement_completions_date_points ON achievement_completions(achievement_date, points)",
    "CREATE TRIGGER IF NOT EXISTS achievement_completion_add_points AFTER INSERT ON achievement_completions BEGIN UPDATE users SET points = points + NEW.points WHERE id = NEW.user_id; END"
  ];
  for (const statement of statements) await env.DB.prepare(statement).run();
  await ensureColumns(env, "achievement_tasks", { end_date: "TEXT" });
}

function validAchievementDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

async function listAchievements(url, env, user) {
  await ensureAchievementsSchema(env);
  const today = riyadhDate();
  const date = String(url.searchParams.get("date") || today);
  if (!validAchievementDate(date) || date > today) return json({ error: "تاريخ الإنجازات غير صالح" }, 400);
  const { results } = await env.DB.prepare(
    "SELECT t.id, t.title, t.description, t.category, t.points, t.start_date, t.end_date, CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS completed, c.completed_at FROM achievement_tasks t LEFT JOIN achievement_completions c ON c.task_id = t.id AND c.user_id = ? AND c.achievement_date = ? WHERE t.start_date <= ? AND (t.end_date IS NULL OR t.end_date >= ?) AND (t.active = 1 OR c.id IS NOT NULL) ORDER BY CASE t.category WHEN 'golden_achievements' THEN 1 WHEN 'golden_fortress' THEN 2 WHEN 'noori' THEN 3 WHEN 'knowledge_station' THEN 4 WHEN 'golden_minute' THEN 5 ELSE 6 END, t.id"
  ).bind(user.id, date, date, date).all();
  const summary = await env.DB.prepare("SELECT COUNT(*) AS completed_count, COALESCE(SUM(points), 0) AS achievement_points FROM achievement_completions WHERE user_id = ?").bind(user.id).first();
  return json({ date, today, tasks: results, summary: { completedCount: Number(summary?.completed_count || 0), points: Number(summary?.achievement_points || 0), badges: achievementBadges(Number(summary?.achievement_points || 0)) } });
}

async function completeAchievement(request, env, user, taskId) {
  if (user.role !== "student") return json({ error: "الإنجازات مخصصة للمستفيدين" }, 400);
  await ensureAchievementsSchema(env);
  const body = await readJson(request);
  const date = String(body.date || riyadhDate());
  const today = riyadhDate();
  if (!validAchievementDate(date) || date > today) return json({ error: "لا يمكن احتساب إنجاز بتاريخ مستقبلي" }, 400);
  const task = await env.DB.prepare("SELECT id, points FROM achievement_tasks WHERE id = ? AND active = 1 AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)").bind(taskId, date, date).first();
  if (!task) return json({ error: "المهمة غير متاحة في هذا التاريخ" }, 404);
  const result = await env.DB.prepare("INSERT OR IGNORE INTO achievement_completions (user_id, task_id, achievement_date, points) VALUES (?, ?, ?, ?)").bind(user.id, task.id, date, task.points).run();
  if (!result.meta.changes) return json({ error: "تم احتساب هذا الإنجاز سابقًا" }, 409);
  const updated = await env.DB.prepare("SELECT points FROM users WHERE id = ?").bind(user.id).first();
  return json({ ok: true, awarded: Number(task.points), points: Number(updated.points) }, 201);
}

async function listAchievementTasks(env) {
  await ensureAchievementsSchema(env);
  const { results } = await env.DB.prepare("SELECT id, title, description, category, points, active, start_date, end_date, created_at FROM achievement_tasks ORDER BY active DESC, category, id DESC").all();
  return json({ tasks: results });
}

async function createAchievementTask(request, env) {
  await ensureAchievementsSchema(env);
  const body = await readJson(request);
  const title = clean(body.title, 100), description = clean(body.description, 300), category = String(body.category || "");
  const points = Math.floor(Number(body.points));
  const startDate = String(body.startDate || riyadhDate()), endDate = String(body.endDate || "");
  if (title.length < 3 || !ACHIEVEMENT_CATEGORIES.has(category) || !Number.isInteger(points) || points < 1 || points > 10000) return json({ error: "تحقق من اسم المهمة وقسمها ودرجتها" }, 400);
  if (!validAchievementDate(startDate) || (endDate && !validAchievementDate(endDate)) || (endDate && endDate < startDate)) return json({ error: "تحقق من تاريخ بداية ونهاية المهمة" }, 400);
  const result = await env.DB.prepare("INSERT INTO achievement_tasks (title, description, category, points, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)").bind(title, description, category, points, startDate, endDate || null).run();
  return json({ id: result.meta.last_row_id }, 201);
}

async function updateAchievementTaskStatus(request, env, taskId) {
  await ensureAchievementsSchema(env);
  const body = await readJson(request);
  if (typeof body.active !== "boolean") return json({ error: "حالة المهمة غير صالحة" }, 400);
  const result = await env.DB.prepare("UPDATE achievement_tasks SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(body.active ? 1 : 0, taskId).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "المهمة غير موجودة" }, 404);
}

function achievementBadges(points) {
  return [
    { id: "starter", name: "بداية الإنجاز", icon: "🌱", threshold: 50 },
    { id: "persistent", name: "المثابر", icon: "🥉", threshold: 200 },
    { id: "golden", name: "المنجز الذهبي", icon: "🥇", threshold: 500 },
    { id: "legend", name: "أسطورة الإنجاز", icon: "🏆", threshold: 1000 }
  ].map(badge => ({ ...badge, earned: points >= badge.threshold }));
}

function dateDaysAgo(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

async function achievementRanking(env, startDate = "", endDate = "", limit = 10) {
  let where = "WHERE u.role = 'student' AND u.status = 'active'";
  const binds = [];
  if (startDate) { where += " AND c.achievement_date >= ?"; binds.push(startDate); }
  if (endDate) { where += " AND c.achievement_date <= ?"; binds.push(endDate); }
  const statement = env.DB.prepare(`SELECT u.id, u.name, u.username, SUM(c.points) AS points FROM achievement_completions c JOIN users u ON u.id = c.user_id ${where} GROUP BY u.id, u.name, u.username ORDER BY points DESC, MIN(c.completed_at), u.id LIMIT ?`).bind(...binds, limit);
  const { results } = await statement.all();
  return results.map((entry, index) => ({ ...entry, points: Number(entry.points), rank: index + 1 }));
}

async function achievementLeaderboards(env) {
  await ensureAchievementsSchema(env);
  const today = riyadhDate();
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const weekStart = dateDaysAgo(today, weekday);
  const stageStart = `${today.slice(0, 7)}-01`;
  const [daily, weekly, stage, general] = await Promise.all([
    achievementRanking(env, today, today, 5),
    achievementRanking(env, weekStart, today, 5),
    achievementRanking(env, stageStart, today, 5),
    achievementRanking(env, "", "", 10)
  ]);
  return json({ today, weekStart, stageStart, daily, weekly, stage, general, heroes: { daily: daily[0] || null, weekly: weekly[0] || null, stage: stage[0] || null, highest: general[0] || null } });
}

async function listDailyChallenges(env, user) {
  await ensureDailyChallengesSchema(env);
  const date = riyadhDate();
  const [attemptRows, settingRows] = await env.DB.batch([
    env.DB.prepare("SELECT challenge_key, status, score, points, duration_ms FROM daily_challenge_attempts WHERE user_id = ? AND challenge_date = ?").bind(user.id, date),
    env.DB.prepare("SELECT challenge_key, max_points FROM daily_challenge_settings ORDER BY challenge_key")
  ]);
  return json({ date, level: user.level || 1, attempts: attemptRows.results, settings: settingRows.results });
}

async function listDailyChallengeSettings(env) {
  await ensureDailyChallengesSchema(env);
  const { results } = await env.DB.prepare("SELECT challenge_key, max_points, updated_at FROM daily_challenge_settings ORDER BY challenge_key").all();
  return json({ settings: results });
}

async function updateDailyChallengeSetting(request, env, key) {
  if (!DAILY_CHALLENGES.has(key)) return json({ error: "التحدي غير موجود" }, 404);
  await ensureDailyChallengesSchema(env);
  const body = await readJson(request), points = Math.floor(Number(body.maxPoints));
  if (!Number.isInteger(points) || points < 1 || points > 10000) return json({ error: "النقاط يجب أن تكون بين 1 و10000" }, 400);
  await env.DB.prepare("INSERT INTO daily_challenge_settings (challenge_key, max_points, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(challenge_key) DO UPDATE SET max_points = excluded.max_points, updated_at = CURRENT_TIMESTAMP").bind(key, points).run();
  return json({ ok: true, challengeKey: key, maxPoints: points });
}

async function startDailyChallenge(env, user, key) {
  if (user.role !== "student") return json({ error: "التحديات مخصصة للمستفيدين" }, 400);
  if (!DAILY_CHALLENGES.has(key)) return json({ error: "التحدي غير موجود" }, 404);
  await ensureDailyChallengesSchema(env);
  const date = riyadhDate();
  try {
    await env.DB.prepare("INSERT INTO daily_challenge_attempts (user_id, challenge_key, challenge_date) VALUES (?, ?, ?)").bind(user.id, key, date).run();
    return json({ ok: true, date }, 201);
  } catch (error) {
    if (String(error).includes("UNIQUE")) return json({ error: "دخلت هذا التحدي اليوم، تتجدد المحاولة غدًا" }, 409);
    throw error;
  }
}

async function completeDailyChallenge(request, env, user, key) {
  if (!DAILY_CHALLENGES.has(key)) return json({ error: "التحدي غير موجود" }, 404);
  await ensureDailyChallengesSchema(env);
  const body = await readJson(request), date = riyadhDate();
  const score = Math.max(0, Math.min(100, Math.floor(Number(body.score) || 0)));
  const duration = Math.max(0, Math.min(3600000, Math.floor(Number(body.durationMs) || 0)));
  const setting = await env.DB.prepare("SELECT max_points FROM daily_challenge_settings WHERE challenge_key = ?").bind(key).first();
  const maxPoints = Number(setting?.max_points || 100);
  const points = Math.max(1, Math.min(maxPoints, Math.round(maxPoints * score / 100)));
  const result = await env.DB.prepare("UPDATE daily_challenge_attempts SET status = 'completed', score = ?, points = ?, duration_ms = ?, completed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND challenge_key = ? AND challenge_date = ? AND status = 'started'").bind(score, points, duration, user.id, key, date).run();
  if (!result.meta.changes) return json({ error: "لا توجد محاولة مفتوحة لهذا التحدي" }, 409);
  await env.DB.prepare("UPDATE users SET points = points + ? WHERE id = ?").bind(points, user.id).run();
  const updated = await env.DB.prepare("SELECT points FROM users WHERE id = ?").bind(user.id).first();
  return json({ ok: true, awarded: points, points: updated.points });
}

async function ensureMajlisSchema(env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS majlis_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text','sticker')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS majlis_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES majlis_posts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, parent_id INTEGER REFERENCES majlis_comments(id) ON DELETE CASCADE, content TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text','sticker')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS majlis_reactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_type TEXT NOT NULL CHECK (target_type IN ('post','comment')), target_id INTEGER NOT NULL, reaction TEXT NOT NULL CHECK (reaction IN ('like','dislike','laugh')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, target_type, target_id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS majlis_comments_post_id ON majlis_comments(post_id, created_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS majlis_reactions_target ON majlis_reactions(target_type, target_id)")
  ]);
}

async function listMajlis(env, user) {
  await ensureMajlisSchema(env);
  const [postRows, commentRows, reactionRows] = await env.DB.batch([
    env.DB.prepare("SELECT p.id, p.user_id, p.content, p.content_type, p.created_at, u.name AS author, u.role, u.level FROM majlis_posts p JOIN users u ON u.id = p.user_id WHERE u.status = 'active' ORDER BY p.created_at DESC, p.id DESC LIMIT 100"),
    env.DB.prepare("SELECT c.id, c.post_id, c.user_id, c.parent_id, c.content, c.content_type, c.created_at, u.name AS author, u.role, u.level FROM majlis_comments c JOIN users u ON u.id = c.user_id JOIN majlis_posts p ON p.id = c.post_id WHERE u.status = 'active' ORDER BY c.created_at, c.id"),
    env.DB.prepare("SELECT target_type, target_id, reaction, COUNT(*) AS count, MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mine FROM majlis_reactions GROUP BY target_type, target_id, reaction").bind(user.id)
  ]);
  const reactions = {};
  for (const row of reactionRows.results) {
    const key = `${row.target_type}:${row.target_id}`;
    reactions[key] ||= { like: 0, dislike: 0, laugh: 0, mine: null };
    reactions[key][row.reaction] = Number(row.count);
    if (row.mine) reactions[key].mine = row.reaction;
  }
  return json({ posts: postRows.results, comments: commentRows.results, reactions });
}

function validateMajlisContent(body) {
  const type = body.type === "sticker" ? "sticker" : "text";
  const content = clean(body.content, type === "sticker" ? 40 : 1200);
  if (!content) return { error: "اكتب السالفة أو اختر ملصقًا" };
  return { content, type };
}

async function createMajlisPost(request, env, user) {
  await ensureMajlisSchema(env);
  const value = validateMajlisContent(await readJson(request));
  if (value.error) return json({ error: value.error }, 400);
  const result = await env.DB.prepare("INSERT INTO majlis_posts (user_id, content, content_type) VALUES (?, ?, ?)").bind(user.id, value.content, value.type).run();
  return json({ id: result.meta.last_row_id }, 201);
}

async function createMajlisComment(request, env, user, postId) {
  await ensureMajlisSchema(env);
  const body = await readJson(request), value = validateMajlisContent(body);
  if (value.error) return json({ error: value.error }, 400);
  const post = await env.DB.prepare("SELECT id FROM majlis_posts WHERE id = ?").bind(postId).first();
  if (!post) return json({ error: "السالفة غير موجودة" }, 404);
  const parentId = body.parentId ? Number(body.parentId) : null;
  if (parentId) {
    const parent = await env.DB.prepare("SELECT id FROM majlis_comments WHERE id = ? AND post_id = ?").bind(parentId, postId).first();
    if (!parent) return json({ error: "التعليق الذي ترد عليه غير موجود" }, 404);
  }
  const result = await env.DB.prepare("INSERT INTO majlis_comments (post_id, user_id, parent_id, content, content_type) VALUES (?, ?, ?, ?, ?)").bind(postId, user.id, parentId, value.content, value.type).run();
  return json({ id: result.meta.last_row_id }, 201);
}

async function setMajlisReaction(request, env, user, targetType, targetId) {
  await ensureMajlisSchema(env);
  const reaction = String((await readJson(request)).reaction || "");
  if (!new Set(["like", "dislike", "laugh"]).has(reaction)) return json({ error: "التفاعل غير صالح" }, 400);
  const table = targetType === "post" ? "majlis_posts" : "majlis_comments";
  const target = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(targetId).first();
  if (!target) return json({ error: "المشاركة غير موجودة" }, 404);
  const current = await env.DB.prepare("SELECT reaction FROM majlis_reactions WHERE user_id = ? AND target_type = ? AND target_id = ?").bind(user.id, targetType, targetId).first();
  if (current?.reaction === reaction) {
    await env.DB.prepare("DELETE FROM majlis_reactions WHERE user_id = ? AND target_type = ? AND target_id = ?").bind(user.id, targetType, targetId).run();
    return json({ ok: true, reaction: null });
  }
  await env.DB.prepare("INSERT INTO majlis_reactions (user_id, target_type, target_id, reaction) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, target_type, target_id) DO UPDATE SET reaction = excluded.reaction, created_at = CURRENT_TIMESTAMP").bind(user.id, targetType, targetId, reaction).run();
  return json({ ok: true, reaction });
}

async function listProducts(env) {
  const { results } = await env.DB.prepare("SELECT id, name, description, price, icon, stock FROM products WHERE active = 1 ORDER BY id").all();
  return json({ products: results });
}

async function listRewards(env) {
  await ensureRewardsSchema(env);
  const { results } = await env.DB.prepare("SELECT id, name, image, amount, category FROM rewards WHERE active = 1 ORDER BY CASE category WHEN 'daily' THEN 1 WHEN 'weekly' THEN 2 ELSE 3 END, id DESC").all();
  return json({ rewards: results });
}

async function purchaseReward(env, user, rewardId) {
  if (user.role !== "student") return json({ error: "حساب المالك لا يشتري الجوائز" }, 400);
  await ensureRewardOrdersSchema(env);
  const reward = await env.DB.prepare("SELECT id, name, amount FROM rewards WHERE id = ? AND active = 1").bind(rewardId).first();
  const freshUser = await env.DB.prepare("SELECT points FROM users WHERE id = ? AND status = 'active'").bind(user.id).first();
  if (!reward) return json({ error: "الجائزة غير متاحة" }, 404);
  const cost = Math.floor(Number(reward.amount));
  if (!freshUser || freshUser.points < cost) return json({ error: "رصيدك لا يكفي لشراء هذه الجائزة" }, 409);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET points = points - ? WHERE id = ? AND points >= ?").bind(cost, user.id, cost),
    env.DB.prepare("INSERT INTO reward_orders (user_id, reward_id, points_paid) VALUES (?, ?, ?)").bind(user.id, reward.id, cost)
  ]);
  return json({ ok: true, points: freshUser.points - cost, message: "تم الطلب، ستصلك الجائزة قريبًا" }, 201);
}

async function listRewardOrders(env) {
  await ensureRewardOrdersSchema(env);
  const { results } = await env.DB.prepare("SELECT o.id, o.points_paid, o.status, o.created_at, o.delivered_at, u.name AS user_name, u.username, r.name AS reward_name, r.image AS reward_image FROM reward_orders o JOIN users u ON u.id = o.user_id JOIN rewards r ON r.id = o.reward_id ORDER BY CASE o.status WHEN 'pending' THEN 1 ELSE 2 END, o.created_at DESC").all();
  return json({ orders: results });
}

async function markRewardOrderDelivered(env, id) {
  await ensureRewardOrdersSchema(env);
  const result = await env.DB.prepare("UPDATE reward_orders SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "الطلب غير موجود أو تم تسليمه" }, 404);
}

async function createReward(request, env) {
  await ensureRewardsSchema(env);
  const reward = validateReward(await readJson(request));
  if (reward.error) return json({ error: reward.error }, 400);
  const result = await env.DB.prepare("INSERT INTO rewards (name, image, amount, category) VALUES (?, ?, ?, ?)")
    .bind(reward.name, reward.image, reward.amount, reward.category).run();
  return json({ id: result.meta.last_row_id }, 201);
}

async function updateReward(request, env, id) {
  await ensureRewardsSchema(env);
  const reward = validateReward(await readJson(request));
  if (reward.error) return json({ error: reward.error }, 400);
  const result = await env.DB.prepare("UPDATE rewards SET name = ?, image = ?, amount = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND active = 1")
    .bind(reward.name, reward.image, reward.amount, reward.category, id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "الجائزة غير موجودة" }, 404);
}

async function deleteReward(env, id) {
  await ensureRewardsSchema(env);
  const result = await env.DB.prepare("UPDATE rewards SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "الجائزة غير موجودة" }, 404);
}

async function ensureRewardsSchema(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS rewards (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, image TEXT NOT NULL, amount REAL NOT NULL CHECK (amount > 0), category TEXT NOT NULL CHECK (category IN ('daily','weekly','grand')), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}

async function ensureRewardOrdersSchema(env) {
  await ensureRewardsSchema(env);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS reward_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, reward_id INTEGER NOT NULL REFERENCES rewards(id), points_paid INTEGER NOT NULL CHECK (points_paid > 0), status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, delivered_at TEXT)").run();
}

function validateReward(body) {
  const name = clean(body.name, 100), image = String(body.image || ""), amount = Math.floor(Number(body.amount));
  const category = String(body.category || "");
  if (name.length < 2) return { error: "أدخل اسم الجائزة" };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return { error: "أدخل تكلفة صحيحة بالنقاط" };
  if (!["daily", "weekly", "grand"].includes(category)) return { error: "اختر تصنيف الجائزة" };
  if (image.length > 900000 || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(image)) return { error: "ارفع صورة PNG أو JPG أو WebP بحجم صغير" };
  return { name, image, amount, category };
}

async function purchaseProduct(request, env, user) {
  if (user.role !== "student") return json({ error: "حساب المالك لا يشتري من المتجر" }, 400);
  const body = await readJson(request), productId = Number(body.productId);
  const product = await env.DB.prepare("SELECT * FROM products WHERE id = ? AND active = 1").bind(productId).first();
  const freshUser = await env.DB.prepare("SELECT points FROM users WHERE id = ?").bind(user.id).first();
  if (!product || product.stock < 1) return json({ error: "المنتج غير متوفر" }, 409);
  if (freshUser.points < product.price) return json({ error: "رصيدك لا يكفي" }, 409);
  await env.DB.batch([
    env.DB.prepare("UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0").bind(product.id),
    env.DB.prepare("UPDATE users SET points = points - ? WHERE id = ? AND points >= ?").bind(product.price, user.id, product.price),
    env.DB.prepare("INSERT INTO purchases (user_id, product_id, points_paid) VALUES (?, ?, ?)").bind(user.id, product.id, product.price)
  ]);
  return json({ ok: true, points: freshUser.points - product.price });
}

async function createProduct(request, env) {
  const body = await readJson(request), name = clean(body.name, 100), description = clean(body.description, 300);
  const price = Math.floor(Number(body.price)), stock = Math.floor(Number(body.stock)), icon = clean(body.icon, 12) || "🎁";
  if (!name || price < 1 || stock < 0) return json({ error: "تحقق من بيانات المنتج" }, 400);
  const result = await env.DB.prepare("INSERT INTO products (name, description, price, icon, stock) VALUES (?, ?, ?, ?, ?)").bind(name, description, price, icon, stock).run();
  return json({ id: result.meta.last_row_id }, 201);
}

async function deleteProduct(env, id) {
  const result = await env.DB.prepare("UPDATE products SET active = 0 WHERE id = ?").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "المنتج غير موجود" }, 404);
}

async function ensureSiteSettings(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS site_settings (setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES ('manager_instructions_title', ?)").bind("رسالة المدير لك اليوم"),
    env.DB.prepare("INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES ('manager_instructions_body', ?)").bind("ابدأ يومك بابتسامة، أكمل مهمة واحدة على الأقل، وشارك أصدقاءك كلمة طيبة. نحن نفخر بك!")
  ]);
}

async function getManagerInstructions(env) {
  await ensureSiteSettings(env);
  const { results } = await env.DB.prepare("SELECT setting_key, setting_value, updated_at FROM site_settings WHERE setting_key IN ('manager_instructions_title','manager_instructions_body')").all();
  const values = Object.fromEntries(results.map(row => [row.setting_key, row.setting_value]));
  return json({
    title: values.manager_instructions_title || "رسالة المدير لك اليوم",
    body: values.manager_instructions_body || "",
    updatedAt: results.map(row => row.updated_at).sort().at(-1) || null
  });
}

async function updateManagerInstructions(request, env) {
  await ensureSiteSettings(env);
  const body = await readJson(request);
  const title = clean(body.title, 90), instructions = clean(body.body, 700);
  if (title.length < 3) return json({ error: "اكتب عنوانًا واضحًا للتعليمات" }, 400);
  if (instructions.length < 3) return json({ error: "اكتب تعليمات المدير" }, 400);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO site_settings (setting_key, setting_value, updated_at) VALUES ('manager_instructions_title', ?, CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP").bind(title),
    env.DB.prepare("INSERT INTO site_settings (setting_key, setting_value, updated_at) VALUES ('manager_instructions_body', ?, CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP").bind(instructions)
  ]);
  return json({ ok: true, title, body: instructions });
}

async function requireSession(request, env) {
  const token = cookie(request, SESSION_COOKIE);
  if (!token) return { response: json({ error: "يجب تسجيل الدخول" }, 401) };
  const user = await env.DB.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active'")
    .bind(await sha256(token), new Date().toISOString()).first();
  return user ? { user } : { response: json({ error: "انتهت جلسة الدخول" }, 401, { "Set-Cookie": sessionCookie("", 0) }) };
}

function validateAccount(body) {
  const name = clean(body.name, 80), username = clean(body.username, 40).toLowerCase();
  const password = String(body.password || ""), level = Math.max(1, Math.min(20, Number(body.level) || 1));
  const points = Math.max(0, Math.min(1000000, Number(body.points) || 0));
  if (name.length < 3) return { error: "الاسم قصير جدًا" };
  if (!validUsername(username)) return { error: "اسم المستخدم يجب أن يحتوي حروفًا إنجليزية أو أرقامًا" };
  if (password.length < 8 || password.length > 128) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" };
  return { name, username, password, level, points };
}

async function hashPassword(password, salt = randomToken(16)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromBase64Url(salt), iterations: 20000 }, key, 256);
  return { salt, hash: toBase64Url(new Uint8Array(bits)) };
}
async function verifyPassword(password, salt, expected) { const value = await hashPassword(password, salt); return constantTime(value.hash, expected); }
async function sha256(value) { const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return toBase64Url(new Uint8Array(hash)); }
function randomToken(bytes) { const value = new Uint8Array(bytes); crypto.getRandomValues(value); return toBase64Url(value); }
function toBase64Url(bytes) { let value = ""; for (const byte of bytes) value += String.fromCharCode(byte); return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function fromBase64Url(value) { const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4); return Uint8Array.from(atob(base64), char => char.charCodeAt(0)); }
function constantTime(a, b) { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
function validUsername(value) { return /^[a-z0-9_.-]{3,40}$/i.test(value); }
function clean(value, max) { return String(value || "").trim().slice(0, max); }
function publicUser(user) { return { id: user.id, name: user.name, username: user.username, role: user.role, level: user.level, points: user.points }; }
function validOrigin(request, url) { const origin = request.headers.get("Origin"); return !origin || origin === url.origin; }
function cookie(request, name) { const match = request.headers.get("Cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)); return match ? decodeURIComponent(match[1]) : ""; }
function sessionCookie(value, maxAge) { return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`; }
async function readJson(request) { try { return await request.json(); } catch { return {}; } }
function json(data, status = 200, headers = {}) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } }); }
