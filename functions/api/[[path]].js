import { EDUCATION_STAGES, QUESTION_COUNT, normalizeStage, questionsForStage } from "./question-bank.js";

const SESSION_COOKIE = "saif_session";
const SESSION_DAYS = 14;
const ALLOWED_REWARDS = {
  competition: { "1": 350, "2": 280, "3": 400, "4": 300, "5": 500, "6": 650 },
  game: { "0": 80, "1": 100, "2": 120, "3": 150 }
};
const DAILY_CHALLENGES = new Set(["fast-answer", "character", "blurred-image", "image-puzzle", "password", "scrambled-letters", "differences", "memory", "maze", "hidden-treasure"]);
const ACHIEVEMENT_CATEGORIES = new Set(["golden_achievements", "golden_fortress", "noori", "knowledge_station", "golden_minute", "health_first"]);
const EDUCATION_STAGE_SET = new Set(EDUCATION_STAGES);
const GROUP_GAMES = new Map([
  ["who-first","U?U? ?�؟�?�؟�U???"],["dual-battle","?�؟�U?U??�؟�?�؟�U??�؟� ?�؟�U??�؟�U??�؟�?�؟�U??�؟�"],["finish-first","?�؟�U?U?U? U??�؟�U?U?"],["ask-others","?�؟�?�؟�?�؟�U? ??U??�؟�U? ?�؟�?�؟�?�؟�U??�؟�U?"],["smartest-survives","?�؟�U??�؟�U??�؟�?? U?U??�؟�?�؟�U?U?"],
  ["auction","?�؟�U?U??�؟�?�؟�?�؟�"],["answer-owner","U?U? ?�؟�?�؟�?�؟�?�؟� ?�؟�U??�؟�?�؟�?�؟�?�؟�?�؟�??"],["fix-error","?�؟�U?U?U? ?�؟�U??�؟�?�؟�?�؟�"],["who-said","U?U? U??�؟�U?U??�؟�??"],["find-liar","?�؟�U????�؟�U? ?�؟�U?U??�؟�?�؟�?�؟�"],
  ["mystery-box","?�؟�U??�؟�U??�؟�U?U? ?�؟�U????�؟�U??�؟�"],["three-doors","?�؟�U??�؟�?�؟�U??�؟�?�؟� ?�؟�U??�؟�U??�؟�?�؟�?�؟�"],["golden-wheel","?�؟�U??�؟�?�؟�U??�؟� ?�؟�U??�؟�U??�؟�U??�؟�"],["golden-challenge","?�؟�U????�؟�?�؟�U? ?�؟�U??�؟�U??�؟�U?"],["million-points","?�؟�U?U?U?U?U?U? U?U??�؟�?�؟�"]
]);

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "U??�؟�?�؟�?�؟�?�؟� ?�؟�U??�؟�U??�؟�U??�؟�?? ??U??�؟� U??�؟�?�؟�U??�؟�?�؟�" }, 503);
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const method = request.method.toUpperCase();

  try {
    if (method !== "GET" && method !== "HEAD" && !validOrigin(request, url)) {
      return json({ error: "?�؟�U??�؟� ??U??�؟� U??�؟�U?U??�؟�" }, 403);
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
    if (method === "GET" && path === "question-bank") return json({ count: QUESTION_COUNT, stage: normalizeStage(user.education_stage), questions: questionsForStage(user.education_stage, Math.min(100, Number(url.searchParams.get("count")) || 30), Date.now()) });
    if (method === "GET" && path === "manager-instructions") return getManagerInstructions(env);
    if (method === "GET" && path === "journey") return getJourneyProgress(env, user);
    if (method === "GET" && path === "challenge-race") return getChallengeRace(env);
    if (method === "GET" && path === "videos") return listVideos(env, user, false);
    const videoComplete = path.match(/^videos\/(\d+)\/complete$/);
    if (method === "POST" && videoComplete) return completeVideo(env, user, Number(videoComplete[1]));
    if (method === "GET" && path === "achievements") return listAchievementsV2(url, env, user);
    if (method === "GET" && path === "achievements/leaderboards") return achievementLeaderboards(env);
    if (method === "GET" && path === "game-hub") return getGameHub(env, user);
    if (method === "POST" && path === "game-matches") return createGameMatch(request, env, user);
    const gameComplete = path.match(/^game-matches\/(\d+)\/complete$/);
    if (method === "POST" && gameComplete) return completeGameMatch(request, env, user, Number(gameComplete[1]));
    const achievementComplete = path.match(/^achievements\/(\d+)\/complete$/);
    if (method === "POST" && achievementComplete) return completeAchievementV2(request, env, user, Number(achievementComplete[1]));
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
    const majlisDelete = path.match(/^majlis\/(posts|comments)\/(\d+)$/);
    if (method === "DELETE" && majlisDelete) return deleteMajlisItem(env, user, majlisDelete[1] === "posts" ? "post" : "comment", Number(majlisDelete[2]));
    const rewardPurchase = path.match(/^rewards\/(\d+)\/purchase$/);
    if (method === "POST" && rewardPurchase) return purchaseReward(env, user, Number(rewardPurchase[1]));
    if (method === "POST" && path === "store/purchase") return purchaseProduct(request, env, user);
    if (method === "GET" && path === "supervisor/assign") return getSupervisorAssignment(env);
    if (method === "PUT" && path === "supervisor/assign") return setSupervisorAssignment(request, env, user);
    if (method === "GET" && path === "supervisor/evaluation-questions") return listEvaluationQuestions(env);
    if (method === "GET" && path === "supervisor/leaderboard") return getSupervisorLeaderboard(env);
    if (method === "GET" && path === "supervisor/contestants") return listSupervisorContestants(env);
    if (method === "POST" && path === "supervisor/evaluations") return submitEvaluation(request, env, user);
    if (method === "GET" && path === "supervisor/evaluations") return getMyEvaluations(env, user);
    if (method === "GET" && path === "supervisor/platform-score") return getPlatformScore(request, env);
    if (method === "PUT" && path === "supervisor/headhunter-match-type") return setHeadhunterMatchType(request, env);
    const isSupervisor = await checkSupervisor(env, user.id);
    if (path.startsWith("owner/") || path.startsWith("supervisor/admin/")) {
      if (user.role !== "owner" && !isSupervisor) return json({ error: "??U??�؟� U??�؟�?�؟�?�؟�" }, 403);
      if (method === "GET" && path === "owner/registration-requests") return listRequests(env);
      if (method === "GET" && path === "owner/users") return listUsers(env);
      if (method === "GET" && path === "owner/achievement-tasks") return listAchievementTasksV2(env);
      if (method === "GET" && path === "owner/achievement-categories") return listAchievementCategories(env);
      if (method === "GET" && path === "owner/daily-challenge-settings") return listDailyChallengeSettings(env);
      if (method === "GET" && path === "owner/competition-settings") return listCompetitionSettings(env);
      if (method === "GET" && path === "owner/game-settings") return listGameSettings(env);
      if (method === "GET" && path === "owner/manager-instructions") return getManagerInstructions(env);
      if (method === "PUT" && path === "owner/manager-instructions") return updateManagerInstructions(request, env);
      if (method === "GET" && path === "owner/challenge-race") return getChallengeRace(env);
      if (method === "PUT" && path === "owner/challenge-race") return updateChallengeRace(request, env);
      if ((method !== "GET" && path === "owner/videos" || /^owner\/videos\/\d+$/.test(path)) && user.role !== "owner") return json({ error: "إدارة الفيديوهات متاحة لمالك المنصة فقط" }, 403);
      if (method === "GET" && path === "owner/videos") return listVideos(env, user, user.role === "owner");
      if (method === "POST" && path === "owner/videos") return createVideo(request, env, user);
      if (method === "POST" && path === "owner/achievement-tasks") return createAchievementTaskV2(request, env);
      if (method === "POST" && path === "owner/achievement-categories") return createAchievementCategory(request, env);
      if (method === "POST" && path === "owner/users") return createUser(request, env);
      if (method === "POST" && path === "owner/products") return createProduct(request, env);
      if (method === "POST" && path === "owner/rewards") return createReward(request, env);
      if (method === "GET" && path === "owner/reward-orders") return listRewardOrders(env);
      if (method === "GET" && path === "supervisor/admin/evaluation-questions") return listEvaluationQuestions(env);
      if (method === "POST" && path === "supervisor/admin/evaluation-questions") return createEvaluationQuestion(request, env);
      const evalQuestion = path.match(/^supervisor\/admin\/evaluation-questions\/(\d+)$/);
      if (method === "PUT" && evalQuestion) return updateEvaluationQuestion(request, env, Number(evalQuestion[1]));
      if (method === "DELETE" && evalQuestion) return deleteEvaluationQuestion(env, Number(evalQuestion[1]));
      if (method === "GET" && path === "supervisor/admin/evaluations-summary") return getEvaluationsSummary(env);
      const approve = path.match(/^owner\/registration-requests\/(\d+)\/approve$/);
      if (method === "POST" && approve) return approveRequest(request, env, Number(approve[1]));
      const reject = path.match(/^owner\/registration-requests\/(\d+)\/reject$/);
      if (method === "POST" && reject) return rejectRequest(env, Number(reject[1]));
      const remove = path.match(/^owner\/users\/(\d+)$/);
      if (method === "PUT" && remove) return updateUser(request, env, Number(remove[1]));
      if (method === "DELETE" && remove) return deleteUser(env, Number(remove[1]), user.id);
      const achievementTask = path.match(/^owner\/achievement-tasks\/(\d+)$/);
      if (method === "PUT" && achievementTask) return updateAchievementTask(request, env, Number(achievementTask[1]));
      if (method === "DELETE" && achievementTask) return deleteAchievementTask(env, Number(achievementTask[1]));
      const achievementCategory = path.match(/^owner\/achievement-categories\/(\d+)$/);
      if (method === "PUT" && achievementCategory) return updateAchievementCategory(request, env, Number(achievementCategory[1]));
      if (method === "DELETE" && achievementCategory) return deleteAchievementCategory(env, Number(achievementCategory[1]));
      const challengeSetting = path.match(/^owner\/daily-challenge-settings\/([a-z-]+)$/);
      if (method === "PUT" && challengeSetting) return updateDailyChallengeSetting(request, env, challengeSetting[1]);
      const competitionSetting = path.match(/^owner\/competition-settings\/(\d+)$/);
      if (method === "PUT" && competitionSetting) return updateCompetitionSetting(request, env, Number(competitionSetting[1]));
      const gameSetting = path.match(/^owner\/game-settings\/(win_points|million_cap)$/);
      if (method === "PUT" && gameSetting) return updateGameSetting(request, env, gameSetting[1]);
      const removeProduct = path.match(/^owner\/products\/(\d+)$/);
      if (method === "DELETE" && removeProduct) return deleteProduct(env, Number(removeProduct[1]));
      const reward = path.match(/^owner\/rewards\/(\d+)$/);
      if (method === "PUT" && reward) return updateReward(request, env, Number(reward[1]));
      if (method === "DELETE" && reward) return deleteReward(env, Number(reward[1]));
      const video = path.match(/^owner\/videos\/(\d+)$/);
      if (method === "PUT" && video) return updateVideo(request, env, Number(video[1]));
      if (method === "DELETE" && video) return deleteVideo(env, Number(video[1]));
      const deliveredOrder = path.match(/^owner\/reward-orders\/(\d+)\/delivered$/);
      if (method === "PUT" && deliveredOrder) return markRewardOrderDelivered(env, Number(deliveredOrder[1]));
    }
    return json({ error: "?�؟�U?U??�؟�?�؟�?�؟� ??U??�؟� U?U??�؟�U??�؟�" }, 404);
  } catch (error) {
    console.error(error);
    if (path === "setup/owner") {
      const detail = String(error?.message || error).replace(/[\r\n]+/g, " ").slice(0, 220);
      return json({ error: `???�؟�?�؟�?�؟� ?�؟�U??�؟�?�؟�?? ?�؟�U??�؟�?�؟�?�؟�?�؟�: ${detail}` }, 500);
    }
    return json({ error: "?�؟�?�؟�?�؟� ?�؟�?�؟�?�؟� U?U? ?�؟�U??�؟�?�؟�?�؟�U?" }, 500);
  }
}

async function setupOwner(request, env) {
  if (!env.SETUP_TOKEN) return json({ error: "?�؟�?�؟� ?�؟�U??�؟�?�؟�?�؟�?�؟�?�؟� ??U??�؟� U??�؟�?�؟�U??�؟�" }, 503);
  const body = await readJson(request);
  if (body.setupToken !== env.SETUP_TOKEN) return json({ error: "?�؟�?�؟� ?�؟�U??�؟�?�؟�?�؟�?�؟�?�؟� ??U??�؟� ?�؟�?�؟�U??�؟�" }, 403);
  await archiveLegacyUsersIfNeeded(env);
  await ensureSchema(env);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").first();
  if (existing) return json({ error: "??U? ?�؟�U??�؟�?�؟�?? ?�؟�?�؟�?�؟�?�؟� ?�؟�U?U??�؟�U?U? U??�؟�?�؟�U?U??�؟�" }, 409);
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
    if (owner) throw new Error("U?U??�؟�?�؟� ?�؟�?�؟�?�؟�?�؟� U??�؟�U?U? U?U? ?�؟�?�؟�U?U? U??�؟�U?U??? ?�؟�U?U?U?U??�؟� ?�؟�U????�؟�U?U??�؟� U??�؟�U??�؟�U??�؟� ?�؟�U??�؟�U??�؟�U??�؟�??");
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
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('owner','student')), education_stage TEXT NOT NULL DEFAULT '', level INTEGER NOT NULL DEFAULT 1, points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0), status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS registration_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL COLLATE NOCASE, contact TEXT NOT NULL, education_stage TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT)",
    "CREATE UNIQUE INDEX IF NOT EXISTS registration_pending_username ON registration_requests(username) WHERE status = 'pending'",
    "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id)",
    "CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at)",
    "CREATE TABLE IF NOT EXISTS game_matches (id INTEGER PRIMARY KEY AUTOINCREMENT, game_key TEXT NOT NULL, game_name TEXT NOT NULL, mode TEXT NOT NULL CHECK (mode IN ('individual','teams')), host_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, rounds INTEGER NOT NULL CHECK (rounds BETWEEN 1 AND 30), timer_seconds INTEGER NOT NULL DEFAULT 0 CHECK (timer_seconds BETWEEN 0 AND 180), max_bet INTEGER NOT NULL DEFAULT 0 CHECK (max_bet >= 0), status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')), winning_sides TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT)",
    "CREATE TABLE IF NOT EXISTS game_match_players (match_id INTEGER NOT NULL REFERENCES game_matches(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, side TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0), is_winner INTEGER NOT NULL DEFAULT 0 CHECK (is_winner IN (0,1)), PRIMARY KEY (match_id,user_id))",
    "CREATE TABLE IF NOT EXISTS game_point_awards (match_id INTEGER NOT NULL REFERENCES game_matches(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, points INTEGER NOT NULL CHECK (points > 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (match_id,user_id))",
    "CREATE TRIGGER IF NOT EXISTS game_award_add_points AFTER INSERT ON game_point_awards BEGIN UPDATE users SET game_points = game_points + NEW.points WHERE id = NEW.user_id; END",
    "CREATE TABLE IF NOT EXISTS official_game_point_awards (match_id INTEGER NOT NULL REFERENCES game_matches(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, points INTEGER NOT NULL CHECK (points > 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (match_id,user_id))",
    "CREATE TRIGGER IF NOT EXISTS official_game_award_add_points AFTER INSERT ON official_game_point_awards BEGIN UPDATE users SET points = points + NEW.points WHERE id = NEW.user_id; END",
    "CREATE TABLE IF NOT EXISTS game_settings (setting_key TEXT PRIMARY KEY, setting_value INTEGER NOT NULL CHECK (setting_value > 0), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "INSERT OR IGNORE INTO game_settings (setting_key,setting_value) VALUES ('win_points',100)",
    "INSERT OR IGNORE INTO game_settings (setting_key,setting_value) VALUES ('million_cap',10000)",
    "CREATE TABLE IF NOT EXISTS activity_rewards (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, activity_type TEXT NOT NULL, activity_id TEXT NOT NULL, points INTEGER NOT NULL CHECK (points > 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, activity_type, activity_id))",
    "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL CHECK (price > 0), icon TEXT NOT NULL DEFAULT '????', stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id), points_paid INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS rewards (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, image TEXT NOT NULL, amount REAL NOT NULL CHECK (amount > 0), category TEXT NOT NULL CHECK (category IN ('daily','weekly','grand')), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS reward_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, reward_id INTEGER NOT NULL REFERENCES rewards(id), points_paid INTEGER NOT NULL CHECK (points_paid > 0), status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, delivered_at TEXT)",
    "CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, beneficiary_level TEXT NOT NULL, video_url TEXT NOT NULL, points INTEGER NOT NULL CHECK (points BETWEEN 1 AND 10000), active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS video_completions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, video_id INTEGER NOT NULL REFERENCES videos(id), points INTEGER NOT NULL CHECK (points > 0), completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, video_id))",
    "CREATE TRIGGER IF NOT EXISTS video_completion_add_points AFTER INSERT ON video_completions BEGIN UPDATE users SET points = points + NEW.points WHERE id = NEW.user_id; END",
    "CREATE TABLE IF NOT EXISTS daily_challenge_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, challenge_key TEXT NOT NULL, challenge_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed')), score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0), points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0), duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0), started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT, UNIQUE(user_id, challenge_key, challenge_date))",
    "CREATE INDEX IF NOT EXISTS daily_attempts_user_date ON daily_challenge_attempts(user_id, challenge_date)",
    "CREATE TABLE IF NOT EXISTS daily_challenge_settings (challenge_key TEXT PRIMARY KEY, max_points INTEGER NOT NULL CHECK (max_points BETWEEN 1 AND 10000), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS competition_settings (competition_id INTEGER PRIMARY KEY CHECK (competition_id BETWEEN 1 AND 6), points INTEGER NOT NULL CHECK (points BETWEEN 1 AND 10000), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS site_settings (setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES ('manager_instructions_title', '?�؟�?�؟�?�؟�U??�؟� ?�؟�U?U??�؟�U??�؟� U?U? ?�؟�U?U?U?U?')",
    "INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES ('manager_instructions_body', '?�؟�?�؟�?�؟�?�؟� U?U?U?U? ?�؟�?�؟�?�؟�???�؟�?�؟�U??�؟�?? ?�؟�U?U?U? U?U?U??�؟� U??�؟�?�؟�?�؟�?�؟� ?�؟�U?U? ?�؟�U??�؟�U?U??? U??�؟�?�؟�?�؟�U? ?�؟�?�؟�?�؟�U??�؟�??U? U?U?U??�؟� ?�؟�U??�؟�?�؟�. U??�؟�U? U?U??�؟�?�؟� ?�؟�U?!')",
    "INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES ('challenge_race_teaser', '0')",
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
    "INSERT OR IGNORE INTO products (id,name,description,price,icon,stock) VALUES (1,'U??�؟�U?U??�؟� U?U????�؟�?�؟�','U??�؟�U?U??�؟� U??�؟�?�؟�?�؟�?? U????�؟�?�؟� U?U? ?�؟�U?U?U????�؟�?�؟�',1200,'????',8)",
    "INSERT OR IGNORE INTO products (id,name,description,price,icon,stock) VALUES (2,'U?U??�؟� ?�؟�U??�؟�U??�؟�?�؟�?�؟�','U?U??�؟� ?�؟�?�؟�?�؟�U? U??�؟�U?U? ?�؟�?�؟�?�؟�?�؟� ?�؟�U?U?U??�؟�?�؟�',1800,'????',4)",
    "INSERT OR IGNORE INTO products (id,name,description,price,icon,stock) VALUES (3,'?�؟�?�؟�?�؟�?�؟� ?�؟�U?U??�؟�','?�؟�?�؟�?�؟�?�؟�?�؟� U?U?U??�؟�?�؟�?�؟�?�؟�U?U? U??�؟�?�؟�?�؟�?�؟�?�؟� ?�؟�U?U?U?U?',6500,'�؟�??',2)",
    "INSERT OR IGNORE INTO products (id,name,description,price,icon,stock) VALUES (4,'?�؟�U?U??�؟�?�؟� ?�؟�U?U?','?�؟�U?U??�؟�?�؟� U??�؟�?�؟�?�؟� U?U??�؟�?�؟�?�؟�?�؟�?�؟� U??�؟�U?U????�؟�U??�؟�?�؟�??',3200,'????',6)",
    "INSERT OR IGNORE INTO products (id,name,description,price,icon,stock) VALUES (5,'U?U??? U??�؟�?�؟� ?�؟�?�؟�?�؟�U?U?','30 ?�؟�U?U?U??�؟� ?�؟�U??�؟�?�؟�?�؟� ???�؟�U?U?U?U??�؟� ?�؟�?�؟�?�؟�U?U??�؟�',600,'???�؟�',20)",
    "INSERT OR IGNORE INTO products (id,name,description,price,icon,stock) VALUES (6,'?�؟�?�؟�?�؟�?�؟� ?�؟�U?U??�؟�??U??�؟�U?','?�؟�?�؟�?�؟�?�؟� U??�؟�?�؟�?�؟�?�؟� ???�؟�U??�؟� U?U? U?U?U?U? ?�؟�U??�؟�?�؟�?�؟�U?',900,'??�؟��؟�',12)"
  ];
  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
  await env.DB.prepare("UPDATE products SET name = 'حقيبة فرفشة', description = 'حقيبة مرحة للدراسة والمغامرات' WHERE id = 4").run();
  await ensureColumns(env, "users", {
    password_hash: "TEXT NOT NULL DEFAULT ''",
    password_salt: "TEXT NOT NULL DEFAULT ''",
    role: "TEXT NOT NULL DEFAULT 'student'",
    education_stage: "TEXT NOT NULL DEFAULT ''",
    level: "INTEGER NOT NULL DEFAULT 1",
    points: "INTEGER NOT NULL DEFAULT 0",
    game_points: "INTEGER NOT NULL DEFAULT 0",
    status: "TEXT NOT NULL DEFAULT 'active'",
    created_at: "TEXT NOT NULL DEFAULT ''"
  });
  await ensureColumns(env, "registration_requests", {
    education_stage: "TEXT NOT NULL DEFAULT ''",
    note: "TEXT NOT NULL DEFAULT ''",
    status: "TEXT NOT NULL DEFAULT 'pending'",
    created_at: "TEXT NOT NULL DEFAULT ''",
    reviewed_at: "TEXT"
  });
  await ensureColumns(env, "products", {
    description: "TEXT NOT NULL DEFAULT ''",
    icon: "TEXT NOT NULL DEFAULT '????'",
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
    return json({ error: "?�؟�?�؟�U? ?�؟�U?U??�؟�???�؟�?�؟�U? ?�؟�U? U?U?U??�؟� ?�؟�U?U??�؟�U??�؟� ??U??�؟� ?�؟�?�؟�U??�؟�?�؟�" }, 401);
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

async function ensureRegistrationStage(env) {
  await ensureColumns(env, "registration_requests", { education_stage: "TEXT NOT NULL DEFAULT ''" });
  await ensureColumns(env, "users", { education_stage: "TEXT NOT NULL DEFAULT ''" });
}

async function createRequest(request, env) {
  await ensureRegistrationStage(env);
  const body = await readJson(request);
  const name = clean(body.name, 80), username = clean(body.username, 40).toLowerCase();
  const contact = clean(body.contact, 40), note = clean(body.note, 300), educationStage = clean(body.educationStage, 40);
  const password = String(body.password || ""), confirmPassword = String(body.confirmPassword || "");
  if (name.length < 3 || !validUsername(username) || contact.length < 7 || !EDUCATION_STAGE_SET.has(educationStage)) return json({ error: "تحقق من الاسم واسم المستخدم ووسيلة التواصل والمرحلة" }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: "U?U?U??�؟� ?�؟�U?U??�؟�U??�؟� U??�؟�?�؟� ?�؟�U? ??U?U?U? 8 ?�؟�?�؟�?�؟�U? ?�؟�U?U? ?�؟�U??�؟�U?U?" }, 400);
  if (password !== confirmPassword) return json({ error: "U?U?U????�؟� ?�؟�U?U??�؟�U??�؟� ??U??�؟� U????�؟�?�؟�?�؟�U???U?U?" }, 400);
  const exists = await env.DB.prepare("SELECT 1 FROM users WHERE username = ? LIMIT 1").bind(username).first();
  if (exists) return json({ error: "?�؟�?�؟�U? ?�؟�U?U??�؟�???�؟�?�؟�U? U??�؟�???�؟�?�؟�U??? ?�؟�?�؟�???�؟� ?�؟�?�؟�U?U??�؟� ?�؟�?�؟�?�؟�" }, 409);
  const passwordData = await hashPassword(password);
  await env.DB.prepare("INSERT INTO users (name, username, password_hash, password_salt, role, level, points, education_stage) VALUES (?, ?, ?, ?, 'student', 1, 0, ?)").bind(name, username, passwordData.hash, passwordData.salt, educationStage).run();
  const user = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
  const sessionId = randomToken(32), expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(await sha256(sessionId), user.id, expires),
    env.DB.prepare("INSERT INTO registration_requests (name, username, contact, education_stage, note, status, reviewed_at) VALUES (?, ?, ?, ?, ?, 'approved', CURRENT_TIMESTAMP)").bind(name, username, contact, educationStage, note)
  ]);
  return json({ user: publicUser(user) }, 201, { "Set-Cookie": sessionCookie(sessionId, SESSION_DAYS * 86400) });
}

async function listRequests(env) {
  await ensureRegistrationStage(env);
  const { results } = await env.DB.prepare("SELECT id, name, username, contact, education_stage, note, status, created_at FROM registration_requests WHERE status = 'pending' ORDER BY created_at DESC").all();
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
    if (String(error).includes("UNIQUE")) return json({ error: "?�؟�?�؟�U? ?�؟�U?U??�؟�???�؟�?�؟�U? U?U??�؟�U??�؟� ?�؟�?�؟�U?U??�؟�U?" }, 409);
    throw error;
  }
}

async function approveRequest(request, env, id) {
  await ensureRegistrationStage(env);
  const pending = await env.DB.prepare("SELECT * FROM registration_requests WHERE id = ? AND status = 'pending'").bind(id).first();
  if (!pending) return json({ error: "?�؟�U??�؟�U??�؟� ??U??�؟� U?U??�؟�U??�؟�" }, 404);
  const body = await readJson(request);
  const fields = validateAccount({ ...body, name: pending.name, username: body.username || pending.username });
  if (fields.error) return json({ error: fields.error }, 400);
  const password = await hashPassword(fields.password);
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (name, username, password_hash, password_salt, role, education_stage, level, points) VALUES (?, ?, ?, ?, 'student', ?, ?, 0)").bind(fields.name, fields.username, password.hash, password.salt, pending.education_stage || "", fields.level),
      env.DB.prepare("UPDATE registration_requests SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(id)
    ]);
    return json({ ok: true });
  } catch (error) {
    if (String(error).includes("UNIQUE")) return json({ error: "?�؟�?�؟�U? ?�؟�U?U??�؟�???�؟�?�؟�U? U?U??�؟�U??�؟� ?�؟�?�؟�U?U??�؟�U?" }, 409);
    throw error;
  }
}

async function rejectRequest(env, id) {
  const result = await env.DB.prepare("UPDATE registration_requests SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "?�؟�U??�؟�U??�؟� ??U??�؟� U?U??�؟�U??�؟�" }, 404);
}

async function deleteUser(env, id, ownerId) {
  if (id === ownerId) return json({ error: "U??�؟� U?U?U?U? ?�؟�?�؟�U? ?�؟�?�؟�?�؟�?�؟� ?�؟�U?U??�؟�U?U? ?�؟�U??�؟�?�؟�U?U?" }, 400);
  const result = await env.DB.prepare("DELETE FROM users WHERE id = ? AND role = 'student'").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "?�؟�U??�؟�?�؟�?�؟�?�؟� ??U??�؟� U?U??�؟�U??�؟�" }, 404);
}

async function getJourneyProgress(env, user) {
  await Promise.all([ensureAchievementsSchema(env), ensureDailyChallengesSchema(env), ensureVideosSchema(env), ensureGameSchema(env), ensureCompetitionSettings(env)]);
  const [achievement, challenge, competition, video, headhunter, headhunterPoints, availableAchievements, availableVideos, competitionTarget, account] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(points),0) AS points FROM achievement_completions WHERE user_id = ?").bind(user.id).first(),
    env.DB.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(points),0) AS points FROM daily_challenge_attempts WHERE user_id = ? AND status = 'completed'").bind(user.id).first(),
    env.DB.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(points),0) AS points FROM activity_rewards WHERE user_id = ? AND activity_type = 'competition'").bind(user.id).first(),
    env.DB.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(points),0) AS points FROM video_completions WHERE user_id = ?").bind(user.id).first(),
    env.DB.prepare("SELECT COUNT(DISTINCT p.match_id) AS count FROM game_match_players p JOIN game_matches m ON m.id = p.match_id WHERE p.user_id = ? AND m.status = 'completed'").bind(user.id).first(),
    env.DB.prepare("SELECT COALESCE(SUM(points),0) AS points FROM (SELECT points FROM game_point_awards WHERE user_id = ? UNION ALL SELECT points FROM official_game_point_awards WHERE user_id = ?)").bind(user.id, user.id).first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM achievement_tasks WHERE active = 1 AND deleted_at IS NULL").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM videos WHERE active = 1 AND (beneficiary_level = ? OR beneficiary_level = 'all')").bind(String(user.education_stage || "")).first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM competition_settings").first(),
    env.DB.prepare("SELECT points, game_points FROM users WHERE id = ?").bind(user.id).first()
  ]);
  const raw = [
    { key: "achievements", label: "إنجازاتي", icon: "✅", count: achievement?.count, points: achievement?.points, target: Math.max(1, Number(availableAchievements?.count || 0)) },
    { key: "challenges", label: "التحديات", icon: "🎯", count: challenge?.count, points: challenge?.points, target: 10 },
    { key: "competitions", label: "المسابقات", icon: "🏆", count: competition?.count, points: competition?.points, target: Math.max(1, Number(competitionTarget?.count || 6)) },
    { key: "episodes", label: "الحلقات", icon: "🎬", count: video?.count, points: video?.points, target: Math.max(1, Number(availableVideos?.count || 0)) },
    { key: "headhunters", label: "مصامخ الرؤوس", icon: "🧠", count: headhunter?.count, points: headhunterPoints?.points, target: 5 }
  ];
  const sections = raw.map(item => ({ ...item, count: Number(item.count || 0), points: Number(item.points || 0), progress: Math.min(100, Math.round(Number(item.count || 0) / item.target * 100)) }));
  const completed = sections.reduce((sum, item) => sum + item.count, 0);
  const earnedPoints = sections.reduce((sum, item) => sum + item.points, 0);
  const progress = Math.round(sections.reduce((sum, item) => sum + item.progress, 0) / sections.length);
  const stage = progress >= 100 ? 4 : progress >= 67 ? 3 : progress >= 34 ? 2 : 1;
  return json({ progress, stage, completed, earnedPoints, accountPoints: Number(account?.points || 0), gamePoints: Number(account?.game_points || 0), sections });
}

async function awardProgress(request, env, user) {
  if (user.role !== "student") return json({ error: "?�؟�?�؟�?�؟�?�؟� ?�؟�U?U??�؟�U?U? U??�؟� U??�؟�U??�؟� U?U??�؟�?�؟�U??�؟�" }, 400);
  const body = await readJson(request), type = String(body.type || ""), id = String(body.id || "");
  let points = ALLOWED_REWARDS[type]?.[id];
  if (type === "competition") {
    await ensureCompetitionSettings(env);
    const setting = await env.DB.prepare("SELECT points FROM competition_settings WHERE competition_id = ?").bind(Number(id)).first();
    points = Number(setting?.points || points || 0);
  }
  if (!points) return json({ error: "U??�؟�?�؟�?�؟� ??U??�؟� ?�؟�?�؟�U??�؟�" }, 400);
  const exists = await env.DB.prepare("SELECT 1 FROM activity_rewards WHERE user_id = ? AND activity_type = ? AND activity_id = ?").bind(user.id, type, id).first();
  if (exists) return json({ error: "??U? ?�؟�?�؟�???�؟�?�؟�?�؟� U??�؟�?�؟� ?�؟�U?U??�؟�?�؟�?�؟� ?�؟�?�؟�?�؟�U?U??�؟�" }, 409);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO activity_rewards (user_id, activity_type, activity_id, points) VALUES (?, ?, ?, ?)").bind(user.id, type, id, points),
    env.DB.prepare("UPDATE users SET points = points + ? WHERE id = ?").bind(points, user.id)
  ]);
  const updated = await env.DB.prepare("SELECT points FROM users WHERE id = ?").bind(user.id).first();
  return json({ points: updated.points, awarded: points });
}

async function updateUser(request, env, id) {
  const existing = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").bind(id).first();
  if (!existing) return json({ error: "?�؟�?�؟�?�؟�?�؟� ?�؟�U?U??�؟�??U?U??�؟� ??U??�؟� U?U??�؟�U??�؟�" }, 404);
  const body = await readJson(request);
  const name = clean(body.name, 80), username = clean(body.username, 40).toLowerCase();
  const level = Math.max(1, Math.min(20, Math.floor(Number(body.level) || 1)));
  const passwordValue = String(body.password || "");
  if (name.length < 3) return json({ error: "?�؟�?�؟�U? ?�؟�U?U??�؟�??U?U??�؟� U??�؟�U??�؟� ?�؟�?�؟�U??�؟�" }, 400);
  if (!validUsername(username)) return json({ error: "?�؟�?�؟�U? ?�؟�U?U??�؟�???�؟�?�؟�U? U??�؟�?�؟� ?�؟�U? U??�؟�??U?U? ?�؟�?�؟�U?U?U??�؟� ?�؟�U??�؟�U?U??�؟�U??�؟� ?�؟�U? ?�؟�?�؟�U??�؟�U?U??�؟�" }, 400);
  if (passwordValue && (passwordValue.length < 8 || passwordValue.length > 128)) return json({ error: "U?U?U??�؟� ?�؟�U?U??�؟�U??�؟� ?�؟�U??�؟�?�؟�U??�؟�?�؟� U??�؟�?�؟� ?�؟�U? ??U?U?U? 8 ?�؟�?�؟�?�؟�U? ?�؟�U?U? ?�؟�U??�؟�U?U?" }, 400);
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
    if (String(error).includes("UNIQUE")) return json({ error: "?�؟�?�؟�U? ?�؟�U?U??�؟�???�؟�?�؟�U? U??�؟�???�؟�?�؟�U? U?U? ?�؟�?�؟�?�؟�?�؟� ?�؟�?�؟�?�؟�" }, 409);
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
  if (!Number.isInteger(id) || id < 1 || id > 6) return json({ error: "?�؟�U?U??�؟�?�؟�?�؟�U??�؟� ??U??�؟� U?U??�؟�U??�؟�?�؟�" }, 404);
  await ensureCompetitionSettings(env);
  const body = await readJson(request), points = Math.floor(Number(body.points));
  if (!Number.isInteger(points) || points < 1 || points > 10000) return json({ error: "?�؟�U?U?U??�؟�?�؟� U??�؟�?�؟� ?�؟�U? ??U?U?U? ?�؟�U?U? 1 U?10000" }, 400);
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
    "CREATE TABLE IF NOT EXISTS achievement_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, category_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL COLLATE NOCASE UNIQUE, icon TEXT NOT NULL DEFAULT '????', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS achievement_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL CHECK (category IN ('golden_achievements','golden_fortress','noori','knowledge_station','golden_minute','health_first')), points INTEGER NOT NULL CHECK (points > 0), active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), start_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "CREATE INDEX IF NOT EXISTS achievement_tasks_active_date ON achievement_tasks(active, start_date)",
    "CREATE TABLE IF NOT EXISTS achievement_completions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, task_id INTEGER NOT NULL REFERENCES achievement_tasks(id), achievement_date TEXT NOT NULL, points INTEGER NOT NULL CHECK (points > 0), completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, task_id, achievement_date))",
    "CREATE INDEX IF NOT EXISTS achievement_completions_user_date ON achievement_completions(user_id, achievement_date)",
    "CREATE INDEX IF NOT EXISTS achievement_completions_date_points ON achievement_completions(achievement_date, points)",
    "CREATE TRIGGER IF NOT EXISTS achievement_completion_add_points AFTER INSERT ON achievement_completions BEGIN UPDATE users SET points = points + NEW.points WHERE id = NEW.user_id; END"
  ];
  for (const statement of statements) await env.DB.prepare(statement).run();
  await ensureColumns(env, "achievement_tasks", { end_date: "TEXT", code: "TEXT", category_id: "INTEGER", deleted_at: "TEXT" });
  const categories = [
    ["golden_achievements", "?�؟�U??�؟�U??�؟�?�؟�?�؟�?�؟�?? ?�؟�U??�؟�U??�؟�U??�؟�", "�؟�?�؟�"], ["golden_fortress", "?�؟�U??�؟�?�؟�U? ?�؟�U??�؟�U??�؟�U?", "????�؟�?"],
    ["noori", "U?U??�؟�U?", "????"], ["knowledge_station", "U??�؟�?�؟�?�؟� ?�؟�U?U??�؟�?�؟�U??�؟�", "????"],
    ["golden_minute", "?�؟�U??�؟�U?U?U??�؟� ?�؟�U??�؟�U??�؟�U??�؟�", "�؟�?�؟��؟�?"], ["health_first", "?�؟�?�؟�??U? ?�؟�U?U??�؟�U?", "????"]
  ];
  await env.DB.batch(categories.map(([key, name, icon]) => env.DB.prepare("INSERT OR IGNORE INTO achievement_categories (category_key, name, icon) VALUES (?, ?, ?)").bind(key, name, icon)));
  await env.DB.prepare("UPDATE achievement_tasks SET category_id = (SELECT id FROM achievement_categories WHERE category_key = achievement_tasks.category) WHERE category_id IS NULL").run();
  await env.DB.prepare("UPDATE achievement_tasks SET code = 'TASK-' || id WHERE code IS NULL OR TRIM(code) = ''").run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS achievement_tasks_code_unique ON achievement_tasks(code COLLATE NOCASE) WHERE deleted_at IS NULL").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS achievement_tasks_category_id ON achievement_tasks(category_id, deleted_at)").run();
}

function validAchievementDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

async function listAchievements(url, env, user) {
  await ensureAchievementsSchema(env);
  const today = riyadhDate();
  const date = String(url.searchParams.get("date") || today);
  if (!validAchievementDate(date) || date > today) return json({ error: "???�؟�?�؟�U??�؟� ?�؟�U??�؟�U??�؟�?�؟�?�؟�?�؟�?? ??U??�؟� ?�؟�?�؟�U??�؟�" }, 400);
  const { results } = await env.DB.prepare(
    "SELECT t.id, t.title, t.description, t.category, t.points, t.start_date, t.end_date, CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS completed, c.completed_at FROM achievement_tasks t LEFT JOIN achievement_completions c ON c.task_id = t.id AND c.user_id = ? AND c.achievement_date = ? WHERE t.start_date <= ? AND (t.end_date IS NULL OR t.end_date >= ?) AND (t.active = 1 OR c.id IS NOT NULL) ORDER BY CASE t.category WHEN 'golden_achievements' THEN 1 WHEN 'golden_fortress' THEN 2 WHEN 'noori' THEN 3 WHEN 'knowledge_station' THEN 4 WHEN 'golden_minute' THEN 5 ELSE 6 END, t.id"
  ).bind(user.id, date, date, date).all();
  const summary = await env.DB.prepare("SELECT COUNT(*) AS completed_count, COALESCE(SUM(points), 0) AS achievement_points FROM achievement_completions WHERE user_id = ?").bind(user.id).first();
  return json({ date, today, tasks: results, summary: { completedCount: Number(summary?.completed_count || 0), points: Number(summary?.achievement_points || 0), badges: achievementBadges(Number(summary?.achievement_points || 0)) } });
}

async function completeAchievement(request, env, user, taskId) {
  if (user.role !== "student") return json({ error: "?�؟�U??�؟�U??�؟�?�؟�?�؟�?�؟�?? U??�؟�?�؟�?�؟�?�؟� U?U?U??�؟�??U?U??�؟�U?U?" }, 400);
  await ensureAchievementsSchema(env);
  const body = await readJson(request);
  const date = String(body.date || riyadhDate());
  const today = riyadhDate();
  if (!validAchievementDate(date) || date > today) return json({ error: "U??�؟� U?U?U?U? ?�؟�?�؟�???�؟�?�؟�?�؟� ?�؟�U??�؟�?�؟�?�؟� ?�؟�???�؟�?�؟�U??�؟� U??�؟�??U??�؟�U?U?" }, 400);
  const task = await env.DB.prepare("SELECT id, points FROM achievement_tasks WHERE id = ? AND active = 1 AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)").bind(taskId, date, date).first();
  if (!task) return json({ error: "?�؟�U?U?U?U??�؟� ??U??�؟� U????�؟�?�؟�?�؟� U?U? U??�؟�?�؟� ?�؟�U????�؟�?�؟�U??�؟�" }, 404);
  const result = await env.DB.prepare("INSERT OR IGNORE INTO achievement_completions (user_id, task_id, achievement_date, points) VALUES (?, ?, ?, ?)").bind(user.id, task.id, date, task.points).run();
  if (!result.meta.changes) return json({ error: "??U? ?�؟�?�؟�???�؟�?�؟�?�؟� U??�؟�?�؟� ?�؟�U??�؟�U??�؟�?�؟�?�؟� ?�؟�?�؟�?�؟�U?U??�؟�" }, 409);
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
  if (title.length < 3 || !ACHIEVEMENT_CATEGORIES.has(category) || !Number.isInteger(points) || points < 1 || points > 10000) return json({ error: "???�؟�U?U? U?U? ?�؟�?�؟�U? ?�؟�U?U?U?U??�؟� U?U??�؟�U?U??�؟� U??�؟�?�؟�?�؟�??U??�؟�" }, 400);
  if (!validAchievementDate(startDate) || (endDate && !validAchievementDate(endDate)) || (endDate && endDate < startDate)) return json({ error: "???�؟�U?U? U?U? ???�؟�?�؟�U??�؟� ?�؟�?�؟�?�؟�U??�؟� U?U?U??�؟�U??�؟� ?�؟�U?U?U?U??�؟�" }, 400);
  const result = await env.DB.prepare("INSERT INTO achievement_tasks (title, description, category, points, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)").bind(title, description, category, points, startDate, endDate || null).run();
  return json({ id: result.meta.last_row_id }, 201);
}

async function updateAchievementTaskStatus(request, env, taskId) {
  await ensureAchievementsSchema(env);
  const body = await readJson(request);
  if (typeof body.active !== "boolean") return json({ error: "?�؟�?�؟�U??�؟� ?�؟�U?U?U?U??�؟� ??U??�؟� ?�؟�?�؟�U??�؟�?�؟�" }, 400);
  const result = await env.DB.prepare("UPDATE achievement_tasks SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(body.active ? 1 : 0, taskId).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "?�؟�U?U?U?U??�؟� ??U??�؟� U?U??�؟�U??�؟�?�؟�" }, 404);
}

async function listAchievementsV2(url, env, user) {
  await ensureAchievementsSchema(env);
  const today = riyadhDate(), date = String(url.searchParams.get("date") || today);
  if (!validAchievementDate(date) || date > today) return json({ error: "???�؟�?�؟�U??�؟� ?�؟�U??�؟�U??�؟�?�؟�?�؟�?�؟�?? ??U??�؟� ?�؟�?�؟�U??�؟�" }, 400);
  const { results } = await env.DB.prepare("SELECT t.id, t.code, t.title, t.description, CAST(t.category_id AS TEXT) AS category, ac.name AS category_name, ac.icon AS category_icon, t.points, t.start_date, t.end_date, CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS completed, c.completed_at FROM achievement_tasks t JOIN achievement_categories ac ON ac.id = t.category_id LEFT JOIN achievement_completions c ON c.task_id = t.id AND c.user_id = ? AND c.achievement_date = ? WHERE t.deleted_at IS NULL AND t.start_date <= ? AND (t.end_date IS NULL OR t.end_date >= ?) AND (t.active = 1 OR c.id IS NOT NULL) ORDER BY ac.id, t.id").bind(user.id, date, date, date).all();
  const categories = [...new Map(results.map(task => [task.category, { id: Number(task.category), name: task.category_name, icon: task.category_icon }])).values()];
  const summary = await env.DB.prepare("SELECT COUNT(*) AS completed_count, COALESCE(SUM(points), 0) AS achievement_points FROM achievement_completions WHERE user_id = ?").bind(user.id).first();
  const points = Number(summary?.achievement_points || 0);
  return json({ date, today, categories, tasks: results, summary: { completedCount: Number(summary?.completed_count || 0), points, badges: achievementBadges(points) } });
}

async function completeAchievementV2(request, env, user, taskId) {
  if (user.role !== "student") return json({ error: "?�؟�U??�؟�U??�؟�?�؟�?�؟�?�؟�?? U??�؟�?�؟�?�؟�?�؟� U?U?U??�؟�??U?U??�؟�U?U?" }, 400);
  await ensureAchievementsSchema(env);
  const body = await readJson(request), date = String(body.date || riyadhDate()), today = riyadhDate();
  if (!validAchievementDate(date) || date > today) return json({ error: "U??�؟� U?U?U?U? ?�؟�?�؟�???�؟�?�؟�?�؟� ?�؟�U??�؟�?�؟�?�؟� ?�؟�???�؟�?�؟�U??�؟� U??�؟�??U??�؟�U?U?" }, 400);
  const task = await env.DB.prepare("SELECT id, points FROM achievement_tasks WHERE id = ? AND deleted_at IS NULL AND active = 1 AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)").bind(taskId, date, date).first();
  if (!task) return json({ error: "?�؟�U?U?U?U??�؟� ??U??�؟� U????�؟�?�؟�?�؟� U?U? U??�؟�?�؟� ?�؟�U????�؟�?�؟�U??�؟�" }, 404);
  const result = await env.DB.prepare("INSERT OR IGNORE INTO achievement_completions (user_id, task_id, achievement_date, points) VALUES (?, ?, ?, ?)").bind(user.id, task.id, date, task.points).run();
  if (!result.meta.changes) return json({ error: "??U? ?�؟�?�؟�???�؟�?�؟�?�؟� U??�؟�?�؟� ?�؟�U??�؟�U??�؟�?�؟�?�؟� ?�؟�?�؟�?�؟�U?U??�؟�" }, 409);
  const updated = await env.DB.prepare("SELECT points FROM users WHERE id = ?").bind(user.id).first();
  return json({ ok: true, awarded: Number(task.points), points: Number(updated.points) }, 201);
}

async function listAchievementTasksV2(env) {
  await ensureAchievementsSchema(env);
  const today = riyadhDate();
  const { results } = await env.DB.prepare("SELECT t.id, t.code, t.title, t.description, t.category_id, ac.name AS category_name, ac.icon AS category_icon, t.points, t.active, t.start_date, t.end_date, t.created_at, CASE WHEN t.active = 0 THEN 'inactive' WHEN t.start_date > ? THEN 'scheduled' WHEN t.end_date IS NOT NULL AND t.end_date < ? THEN 'ended' ELSE 'active' END AS status FROM achievement_tasks t JOIN achievement_categories ac ON ac.id = t.category_id WHERE t.deleted_at IS NULL ORDER BY t.id DESC").bind(today, today).all();
  const { results: categories } = await env.DB.prepare("SELECT c.id, c.name, c.icon, COUNT(t.id) AS task_count FROM achievement_categories c LEFT JOIN achievement_tasks t ON t.category_id = c.id AND t.deleted_at IS NULL GROUP BY c.id ORDER BY c.id").all();
  return json({ tasks: results, categories, today });
}

function validAchievementTaskInput(body) {
  const value = {
    title: clean(body.title, 100), description: clean(body.description, 300), code: clean(body.code, 40).toUpperCase(),
    categoryId: Math.floor(Number(body.categoryId)), points: Math.floor(Number(body.points)),
    startDate: String(body.startDate || ""), endDate: String(body.endDate || "")
  };
  const ok = value.title.length >= 3 && /^[A-Z0-9_-]{2,40}$/.test(value.code) && Number.isInteger(value.categoryId) && Number.isInteger(value.points) && value.points >= 1 && value.points <= 10000 && validAchievementDate(value.startDate) && (!value.endDate || (validAchievementDate(value.endDate) && value.endDate >= value.startDate));
  return { ok, value };
}

async function createAchievementTaskV2(request, env) {
  await ensureAchievementsSchema(env);
  const { ok, value } = validAchievementTaskInput(await readJson(request));
  if (!ok) return json({ error: "???�؟�U?U? U?U? ?�؟�U??�؟�U??�؟� U??�؟�?�؟�U? ?�؟�U?U?U?U??�؟� U??�؟�U?U??�؟�U? U??�؟�U??�؟�?�؟�?�؟�?�؟� U??�؟�U???U??�؟�?�؟�U??�؟�" }, 400);
  const category = await env.DB.prepare("SELECT category_key FROM achievement_categories WHERE id = ?").bind(value.categoryId).first();
  if (!category) return json({ error: "?�؟�U?U??�؟�U? ?�؟�U?U??�؟�?�؟�?�؟� ??U??�؟� U?U??�؟�U??�؟�" }, 400);
  const duplicate = await env.DB.prepare("SELECT id FROM achievement_tasks WHERE code = ? COLLATE NOCASE AND deleted_at IS NULL").bind(value.code).first();
  if (duplicate) return json({ error: "?�؟�U??�؟� ?�؟�U?U?U?U??�؟� U??�؟�???�؟�?�؟�U? U??�؟�?�؟�U?U??�؟�" }, 409);
  const legacyCategory = ACHIEVEMENT_CATEGORIES.has(category.category_key) ? category.category_key : "golden_achievements";
  const result = await env.DB.prepare("INSERT INTO achievement_tasks (code, title, description, category, category_id, points, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(value.code, value.title, value.description, legacyCategory, value.categoryId, value.points, value.startDate, value.endDate || null).run();
  return json({ id: result.meta.last_row_id }, 201);
}

async function updateAchievementTask(request, env, taskId) {
  await ensureAchievementsSchema(env);
  const body = await readJson(request);
  const current = await env.DB.prepare("SELECT id FROM achievement_tasks WHERE id = ? AND deleted_at IS NULL").bind(taskId).first();
  if (!current) return json({ error: "?�؟�U?U?U?U??�؟� ??U??�؟� U?U??�؟�U??�؟�?�؟�" }, 404);
  if (Object.keys(body).length === 1 && typeof body.active === "boolean") {
    await env.DB.prepare("UPDATE achievement_tasks SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(body.active ? 1 : 0, taskId).run();
    return json({ ok: true });
  }
  const { ok, value } = validAchievementTaskInput(body);
  if (!ok) return json({ error: "???�؟�U?U? U?U? ?�؟�U??�؟�U??�؟�?? ?�؟�U?U?U?U??�؟�" }, 400);
  const category = await env.DB.prepare("SELECT category_key FROM achievement_categories WHERE id = ?").bind(value.categoryId).first();
  if (!category) return json({ error: "?�؟�U?U??�؟�U? ?�؟�U?U??�؟�?�؟�?�؟� ??U??�؟� U?U??�؟�U??�؟�" }, 400);
  const duplicate = await env.DB.prepare("SELECT id FROM achievement_tasks WHERE code = ? COLLATE NOCASE AND id <> ? AND deleted_at IS NULL").bind(value.code, taskId).first();
  if (duplicate) return json({ error: "?�؟�U??�؟� ?�؟�U?U?U?U??�؟� U??�؟�???�؟�?�؟�U? U??�؟�?�؟�U?U??�؟�" }, 409);
  const legacyCategory = ACHIEVEMENT_CATEGORIES.has(category.category_key) ? category.category_key : "golden_achievements";
  await env.DB.prepare("UPDATE achievement_tasks SET code = ?, title = ?, description = ?, category = ?, category_id = ?, points = ?, start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(value.code, value.title, value.description, legacyCategory, value.categoryId, value.points, value.startDate, value.endDate || null, taskId).run();
  return json({ ok: true });
}

async function deleteAchievementTask(env, taskId) {
  await ensureAchievementsSchema(env);
  const result = await env.DB.prepare("UPDATE achievement_tasks SET active = 0, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL").bind(taskId).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "?�؟�U?U?U?U??�؟� ??U??�؟� U?U??�؟�U??�؟�?�؟�" }, 404);
}

async function listAchievementCategories(env) {
  await ensureAchievementsSchema(env);
  const { results } = await env.DB.prepare("SELECT c.id, c.name, c.icon, COUNT(t.id) AS task_count FROM achievement_categories c LEFT JOIN achievement_tasks t ON t.category_id = c.id AND t.deleted_at IS NULL GROUP BY c.id ORDER BY c.id").all();
  return json({ categories: results });
}

async function createAchievementCategory(request, env) {
  await ensureAchievementsSchema(env);
  const body = await readJson(request), name = clean(body.name, 60), icon = clean(body.icon, 8) || "????";
  if (name.length < 2) return json({ error: "?�؟�U????�؟� ?�؟�?�؟�U?U??�؟� ?�؟�?�؟�U??�؟�U??�؟� U?U?U??�؟�U?" }, 400);
  const exists = await env.DB.prepare("SELECT id FROM achievement_categories WHERE name = ? COLLATE NOCASE").bind(name).first();
  if (exists) return json({ error: "?�؟�?�؟�U? ?�؟�U?U??�؟�U? U?U??�؟�U??�؟� U??�؟�?�؟�U?U??�؟�" }, 409);
  const result = await env.DB.prepare("INSERT INTO achievement_categories (category_key, name, icon) VALUES (?, ?, ?)").bind(`custom_${Date.now().toString(36)}`, name, icon).run();
  return json({ id: result.meta.last_row_id }, 201);
}

async function updateAchievementCategory(request, env, categoryId) {
  await ensureAchievementsSchema(env);
  const body = await readJson(request), name = clean(body.name, 60), icon = clean(body.icon, 8) || "????";
  if (name.length < 2) return json({ error: "?�؟�U????�؟� ?�؟�?�؟�U?U??�؟� ?�؟�?�؟�U??�؟�U??�؟� U?U?U??�؟�U?" }, 400);
  const exists = await env.DB.prepare("SELECT id FROM achievement_categories WHERE name = ? COLLATE NOCASE AND id <> ?").bind(name, categoryId).first();
  if (exists) return json({ error: "?�؟�?�؟�U? ?�؟�U?U??�؟�U? U?U??�؟�U??�؟� U??�؟�?�؟�U?U??�؟�" }, 409);
  const result = await env.DB.prepare("UPDATE achievement_categories SET name = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(name, icon, categoryId).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "?�؟�U?U??�؟�U? ??U??�؟� U?U??�؟�U??�؟�" }, 404);
}

async function deleteAchievementCategory(env, categoryId) {
  await ensureAchievementsSchema(env);
  const used = await env.DB.prepare("SELECT COUNT(*) AS count FROM achievement_tasks WHERE category_id = ? AND deleted_at IS NULL").bind(categoryId).first();
  if (Number(used?.count || 0) > 0) return json({ error: "U??�؟� U?U?U?U? ?�؟�?�؟�U? U??�؟�U? U??�؟�???�؟�?�؟� ?�؟�U?U??�؟�U? U??�؟�?�؟�U??�؟�" }, 409);
  const result = await env.DB.prepare("DELETE FROM achievement_categories WHERE id = ?").bind(categoryId).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "?�؟�U?U??�؟�U? ??U??�؟� U?U??�؟�U??�؟�" }, 404);
}

function achievementBadges(points) {
  return [
    { id: "starter", name: "?�؟�?�؟�?�؟�U??�؟� ?�؟�U??�؟�U??�؟�?�؟�?�؟�", icon: "???�؟�", threshold: 50 },
    { id: "persistent", name: "?�؟�U?U??�؟�?�؟�?�؟�?�؟�", icon: "??�؟�?", threshold: 200 },
    { id: "golden", name: "?�؟�U?U?U??�؟�?�؟� ?�؟�U??�؟�U??�؟�U?", icon: "??�؟�?", threshold: 500 },
    { id: "legend", name: "?�؟�?�؟�?�؟�U??�؟�?�؟� ?�؟�U??�؟�U??�؟�?�؟�?�؟�", icon: "????", threshold: 1000 }
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
  const stage = normalizeStage(user.education_stage);
  const seed = Number(date.replaceAll("-", "")) + Number(user.id) * 97;
  return json({ date, level: user.level || 1, stage, questionBankCount: QUESTION_COUNT, questions: questionsForStage(stage, 40, seed), attempts: attemptRows.results, settings: settingRows.results });
}

async function listDailyChallengeSettings(env) {
  await ensureDailyChallengesSchema(env);
  const { results } = await env.DB.prepare("SELECT challenge_key, max_points, updated_at FROM daily_challenge_settings ORDER BY challenge_key").all();
  return json({ settings: results });
}

async function updateDailyChallengeSetting(request, env, key) {
  if (!DAILY_CHALLENGES.has(key)) return json({ error: "?�؟�U????�؟�?�؟�U? ??U??�؟� U?U??�؟�U??�؟�" }, 404);
  await ensureDailyChallengesSchema(env);
  const body = await readJson(request), points = Math.floor(Number(body.maxPoints));
  if (!Number.isInteger(points) || points < 1 || points > 10000) return json({ error: "?�؟�U?U?U??�؟�?�؟� U??�؟�?�؟� ?�؟�U? ??U?U?U? ?�؟�U?U? 1 U?10000" }, 400);
  await env.DB.prepare("INSERT INTO daily_challenge_settings (challenge_key, max_points, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(challenge_key) DO UPDATE SET max_points = excluded.max_points, updated_at = CURRENT_TIMESTAMP").bind(key, points).run();
  return json({ ok: true, challengeKey: key, maxPoints: points });
}

async function startDailyChallenge(env, user, key) {
  if (user.role !== "student") return json({ error: "?�؟�U????�؟�?�؟�U??�؟�?? U??�؟�?�؟�?�؟�?�؟� U?U?U??�؟�??U?U??�؟�U?U?" }, 400);
  if (!DAILY_CHALLENGES.has(key)) return json({ error: "?�؟�U????�؟�?�؟�U? ??U??�؟� U?U??�؟�U??�؟�" }, 404);
  await ensureDailyChallengesSchema(env);
  const date = riyadhDate();
  try {
    await env.DB.prepare("INSERT INTO daily_challenge_attempts (user_id, challenge_key, challenge_date) VALUES (?, ?, ?)").bind(user.id, key, date).run();
    return json({ ok: true, date }, 201);
  } catch (error) {
    if (String(error).includes("UNIQUE")) return json({ error: "?�؟�?�؟�U??? U??�؟�?�؟� ?�؟�U????�؟�?�؟�U? ?�؟�U?U?U?U??? ?????�؟�?�؟�?�؟� ?�؟�U?U??�؟�?�؟�U?U??�؟� ???�؟�U??�؟�" }, 409);
    throw error;
  }
}

async function completeDailyChallenge(request, env, user, key) {
  if (!DAILY_CHALLENGES.has(key)) return json({ error: "?�؟�U????�؟�?�؟�U? ??U??�؟� U?U??�؟�U??�؟�" }, 404);
  await ensureDailyChallengesSchema(env);
  const body = await readJson(request), date = riyadhDate();
  const score = Math.max(0, Math.min(100, Math.floor(Number(body.score) || 0)));
  const duration = Math.max(0, Math.min(3600000, Math.floor(Number(body.durationMs) || 0)));
  const setting = await env.DB.prepare("SELECT max_points FROM daily_challenge_settings WHERE challenge_key = ?").bind(key).first();
  const maxPoints = Number(setting?.max_points || 100);
  const points = Math.max(1, Math.min(maxPoints, Math.round(maxPoints * score / 100)));
  const result = await env.DB.prepare("UPDATE daily_challenge_attempts SET status = 'completed', score = ?, points = ?, duration_ms = ?, completed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND challenge_key = ? AND challenge_date = ? AND status = 'started'").bind(score, points, duration, user.id, key, date).run();
  if (!result.meta.changes) return json({ error: "U??�؟� ??U??�؟�?�؟� U??�؟�?�؟�U?U??�؟� U?U???U??�؟�?�؟� U?U??�؟�?�؟� ?�؟�U????�؟�?�؟�U?" }, 409);
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
  await ensureColumns(env, "majlis_posts", { image_data: "TEXT NOT NULL DEFAULT ''" });
  await ensureColumns(env, "majlis_comments", { image_data: "TEXT NOT NULL DEFAULT ''" });
}

async function listMajlis(env, user) {
  await ensureMajlisSchema(env);
  const [postRows, commentRows, reactionRows] = await env.DB.batch([
    env.DB.prepare("SELECT p.id, p.user_id, p.content, p.content_type, p.image_data, p.created_at, u.name AS author, u.role, u.level FROM majlis_posts p JOIN users u ON u.id = p.user_id WHERE u.status = 'active' ORDER BY p.created_at DESC, p.id DESC LIMIT 100"),
    env.DB.prepare("SELECT c.id, c.post_id, c.user_id, c.parent_id, c.content, c.content_type, c.image_data, c.created_at, u.name AS author, u.role, u.level FROM majlis_comments c JOIN users u ON u.id = c.user_id JOIN majlis_posts p ON p.id = c.post_id WHERE u.status = 'active' ORDER BY c.created_at, c.id"),
    env.DB.prepare("SELECT target_type, target_id, reaction, COUNT(*) AS count, MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mine FROM majlis_reactions GROUP BY target_type, target_id, reaction").bind(user.id)
  ]);
  const reactions = {};
  for (const row of reactionRows.results) {
    const key = `${row.target_type}:${row.target_id}`;
    reactions[key] ||= { like: 0, dislike: 0, laugh: 0, mine: null };
    reactions[key][row.reaction] = Number(row.count);
    if (row.mine) reactions[key].mine = row.reaction;
  }
  return json({ posts: postRows.results.map(item => ({ ...item, can_delete: user.role === "owner" || item.user_id === user.id })), comments: commentRows.results.map(item => ({ ...item, can_delete: user.role === "owner" || item.user_id === user.id })), reactions });
}

function validateMajlisContent(body) {
  const type = body.type === "sticker" ? "sticker" : "text";
  const content = clean(body.content, type === "sticker" ? 40 : 1200);
  const image = String(body.image || "");
  if (image && (image.length > 700000 || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(image))) return { error: "?�؟�?�؟�???�؟� ?�؟�U??�؟�?�؟� PNG ?�؟�U? JPG ?�؟�U? WebP ?�؟�?�؟�?�؟�U? U??�؟� U????�؟�?�؟�U??�؟� 500 U?U?U?U??�؟�?�؟�U???" };
  if (!content && !image) return { error: "?�؟�U????�؟� ?�؟�U??�؟�?�؟�U?U??�؟� ?�؟�U? ?�؟�?�؟�U? ?�؟�U??�؟�?�؟�" };
  return { content, type, image };
}

async function createMajlisPost(request, env, user) {
  await ensureMajlisSchema(env);
  const value = validateMajlisContent(await readJson(request));
  if (value.error) return json({ error: value.error }, 400);
  const result = await env.DB.prepare("INSERT INTO majlis_posts (user_id, content, content_type, image_data) VALUES (?, ?, ?, ?)").bind(user.id, value.content, value.type, value.image).run();
  return json({ id: result.meta.last_row_id }, 201);
}

async function createMajlisComment(request, env, user, postId) {
  await ensureMajlisSchema(env);
  const body = await readJson(request), value = validateMajlisContent(body);
  if (value.error) return json({ error: value.error }, 400);
  const post = await env.DB.prepare("SELECT id FROM majlis_posts WHERE id = ?").bind(postId).first();
  if (!post) return json({ error: "?�؟�U??�؟�?�؟�U?U??�؟� ??U??�؟� U?U??�؟�U??�؟�?�؟�" }, 404);
  const parentId = body.parentId ? Number(body.parentId) : null;
  if (parentId) {
    const parent = await env.DB.prepare("SELECT id FROM majlis_comments WHERE id = ? AND post_id = ?").bind(parentId, postId).first();
    if (!parent) return json({ error: "?�؟�U????�؟�U?U?U? ?�؟�U??�؟�U? ???�؟�?�؟� ?�؟�U?U?U? ??U??�؟� U?U??�؟�U??�؟�" }, 404);
  }
  const result = await env.DB.prepare("INSERT INTO majlis_comments (post_id, user_id, parent_id, content, content_type, image_data) VALUES (?, ?, ?, ?, ?, ?)").bind(postId, user.id, parentId, value.content, value.type, value.image).run();
  return json({ id: result.meta.last_row_id }, 201);
}

async function setMajlisReaction(request, env, user, targetType, targetId) {
  await ensureMajlisSchema(env);
  const reaction = String((await readJson(request)).reaction || "");
  if (!new Set(["like", "dislike", "laugh"]).has(reaction)) return json({ error: "?�؟�U???U??�؟�?�؟�U? ??U??�؟� ?�؟�?�؟�U??�؟�" }, 400);
  const table = targetType === "post" ? "majlis_posts" : "majlis_comments";
  const target = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(targetId).first();
  if (!target) return json({ error: "?�؟�U?U??�؟�?�؟�?�؟�U??�؟� ??U??�؟� U?U??�؟�U??�؟�?�؟�" }, 404);
  const current = await env.DB.prepare("SELECT reaction FROM majlis_reactions WHERE user_id = ? AND target_type = ? AND target_id = ?").bind(user.id, targetType, targetId).first();
  if (current?.reaction === reaction) {
    await env.DB.prepare("DELETE FROM majlis_reactions WHERE user_id = ? AND target_type = ? AND target_id = ?").bind(user.id, targetType, targetId).run();
    return json({ ok: true, reaction: null });
  }
  await env.DB.prepare("INSERT INTO majlis_reactions (user_id, target_type, target_id, reaction) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, target_type, target_id) DO UPDATE SET reaction = excluded.reaction, created_at = CURRENT_TIMESTAMP").bind(user.id, targetType, targetId, reaction).run();
  return json({ ok: true, reaction });
}

async function deleteMajlisItem(env, user, targetType, targetId) {
  await ensureMajlisSchema(env);
  const table = targetType === "post" ? "majlis_posts" : "majlis_comments";
  const item = await env.DB.prepare(`SELECT user_id FROM ${table} WHERE id = ?`).bind(targetId).first();
  if (!item) return json({ error: "?�؟�U?U??�؟�?�؟�?�؟�U??�؟� ??U??�؟� U?U??�؟�U??�؟�?�؟�" }, 404);
  if (user.role !== "owner" && Number(item.user_id) !== Number(user.id)) return json({ error: "U??�؟� U?U?U?U?U? ?�؟�?�؟�U? U??�؟�?�؟�?�؟�U??�؟� ?�؟�?�؟�U? ?�؟�?�؟�?�؟�" }, 403);
  if (targetType === "post") {
    await env.DB.prepare("DELETE FROM majlis_reactions WHERE target_type = 'comment' AND target_id IN (SELECT id FROM majlis_comments WHERE post_id = ?)").bind(targetId).run();
  } else {
    await env.DB.prepare("WITH RECURSIVE descendants(id) AS (SELECT id FROM majlis_comments WHERE id = ? UNION ALL SELECT c.id FROM majlis_comments c JOIN descendants d ON c.parent_id = d.id) DELETE FROM majlis_reactions WHERE target_type = 'comment' AND target_id IN (SELECT id FROM descendants)").bind(targetId).run();
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM majlis_reactions WHERE target_type = ? AND target_id = ?").bind(targetType, targetId),
    env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(targetId)
  ]);
  return json({ ok: true });
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
  if (user.role !== "student") return json({ error: "?�؟�?�؟�?�؟�?�؟� ?�؟�U?U??�؟�U?U? U??�؟� U??�؟�???�؟�U? ?�؟�U??�؟�U??�؟�?�؟�?�؟�" }, 400);
  await ensureRewardOrdersSchema(env);
  const reward = await env.DB.prepare("SELECT id, name, amount FROM rewards WHERE id = ? AND active = 1").bind(rewardId).first();
  const freshUser = await env.DB.prepare("SELECT points FROM users WHERE id = ? AND status = 'active'").bind(user.id).first();
  if (!reward) return json({ error: "?�؟�U??�؟�?�؟�?�؟�?�؟�?�؟� ??U??�؟� U????�؟�?�؟�?�؟�" }, 404);
  const cost = Math.floor(Number(reward.amount));
  if (!freshUser || freshUser.points < cost) return json({ error: "?�؟�?�؟�U??�؟�U? U??�؟� U?U?U?U? U??�؟�?�؟�?�؟�?? U??�؟�U? ?�؟�U??�؟�?�؟�?�؟�?�؟�?�؟�" }, 409);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET points = points - ? WHERE id = ? AND points >= ?").bind(cost, user.id, cost),
    env.DB.prepare("INSERT INTO reward_orders (user_id, reward_id, points_paid) VALUES (?, ?, ?)").bind(user.id, reward.id, cost)
  ]);
  return json({ ok: true, points: freshUser.points - cost, message: "??U? ?�؟�U??�؟�U??�؟�?? ?�؟�???�؟�U?U? ?�؟�U??�؟�?�؟�?�؟�?�؟�?�؟� U??�؟�U??�؟�U??�؟�" }, 201);
}

async function listRewardOrders(env) {
  await ensureRewardOrdersSchema(env);
  const { results } = await env.DB.prepare("SELECT o.id, o.points_paid, o.status, o.created_at, o.delivered_at, u.name AS user_name, u.username, r.name AS reward_name, r.image AS reward_image FROM reward_orders o JOIN users u ON u.id = o.user_id JOIN rewards r ON r.id = o.reward_id ORDER BY CASE o.status WHEN 'pending' THEN 1 ELSE 2 END, o.created_at DESC").all();
  return json({ orders: results });
}

async function markRewardOrderDelivered(env, id) {
  await ensureRewardOrdersSchema(env);
  const result = await env.DB.prepare("UPDATE reward_orders SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "?�؟�U??�؟�U??�؟� ??U??�؟� U?U??�؟�U??�؟� ?�؟�U? ??U? ???�؟�U?U?U?U?" }, 404);
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
  return result.meta.changes ? json({ ok: true }) : json({ error: "?�؟�U??�؟�?�؟�?�؟�?�؟�?�؟� ??U??�؟� U?U??�؟�U??�؟�?�؟�" }, 404);
}

async function deleteReward(env, id) {
  await ensureRewardsSchema(env);
  const result = await env.DB.prepare("UPDATE rewards SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "?�؟�U??�؟�?�؟�?�؟�?�؟�?�؟� ??U??�؟� U?U??�؟�U??�؟�?�؟�" }, 404);
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
  if (name.length < 2) return { error: "?�؟�?�؟�?�؟�U? ?�؟�?�؟�U? ?�؟�U??�؟�?�؟�?�؟�?�؟�?�؟�" };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return { error: "?�؟�?�؟�?�؟�U? ??U?U?U??�؟� ?�؟�?�؟�U??�؟�?�؟� ?�؟�?�؟�U?U?U??�؟�?�؟�" };
  if (!["daily", "weekly", "grand"].includes(category)) return { error: "?�؟�?�؟�???�؟� ???�؟�U?U?U? ?�؟�U??�؟�?�؟�?�؟�?�؟�?�؟�" };
  if (image.length > 900000 || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(image)) return { error: "?�؟�?�؟�U??�؟� ?�؟�U??�؟�?�؟� PNG ?�؟�U? JPG ?�؟�U? WebP ?�؟�?�؟�?�؟�U? ?�؟�??U??�؟�" };
  return { name, image, amount, category };
}

async function ensureVideosSchema(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, beneficiary_level TEXT NOT NULL, video_url TEXT NOT NULL, points INTEGER NOT NULL CHECK (points BETWEEN 1 AND 10000), active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS video_completions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, video_id INTEGER NOT NULL REFERENCES videos(id), points INTEGER NOT NULL CHECK (points > 0), completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, video_id))").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS video_completions_user ON video_completions(user_id, completed_at DESC)").run();
  await env.DB.prepare("CREATE TRIGGER IF NOT EXISTS video_completion_add_points AFTER INSERT ON video_completions BEGIN UPDATE users SET points = points + NEW.points WHERE id = NEW.user_id; END").run();
}

async function listVideos(env, user, ownerView = false) {
  await ensureVideosSchema(env);
  const sql = ownerView
    ? "SELECT v.*, CASE WHEN v.active = 1 THEN 0 ELSE 1 END AS completed FROM videos v ORDER BY v.active DESC, v.id DESC"
    : "SELECT v.id, v.title, v.beneficiary_level, v.video_url, v.points, EXISTS(SELECT 1 FROM video_completions c WHERE c.video_id = v.id AND c.user_id = ?) AS completed FROM videos v WHERE v.active = 1 AND (v.beneficiary_level = ? OR v.beneficiary_level = 'all') ORDER BY v.id DESC";
  const query = ownerView ? env.DB.prepare(sql) : env.DB.prepare(sql).bind(user.id, String(user.education_stage || ""));
  const { results } = await query.all();
  return json({ videos: results });
}

function validateVideoInput(body) {
  const title = clean(body.title, 120), beneficiaryLevel = clean(body.beneficiaryLevel, 40);
  const videoUrl = String(body.videoUrl || "").trim().slice(0, 1000), points = Math.floor(Number(body.points));
  let validUrl = false;
  try { const url = new URL(videoUrl); validUrl = url.protocol === "https:" || url.protocol === "http:"; } catch {}
  if (title.length < 2 || !beneficiaryLevel || !validUrl || !Number.isInteger(points) || points < 1 || points > 10000) return { error: "تحقق من اسم المادة والمستوى ورابط الفيديو والنقاط" };
  return { title, beneficiaryLevel, videoUrl, points };
}

async function createVideo(request, env, user) {
  await ensureVideosSchema(env);
  const video = validateVideoInput(await readJson(request));
  if (video.error) return json({ error: video.error }, 400);
  const result = await env.DB.prepare("INSERT INTO videos (title, beneficiary_level, video_url, points, created_by) VALUES (?, ?, ?, ?, ?)").bind(video.title, video.beneficiaryLevel, video.videoUrl, video.points, user.id).run();
  return json({ id: result.meta.last_row_id, ok: true }, 201);
}

async function updateVideo(request, env, id) {
  await ensureVideosSchema(env);
  const body = await readJson(request);
  if (Object.keys(body).length === 1 && typeof body.active === "boolean") {
    const result = await env.DB.prepare("UPDATE videos SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(body.active ? 1 : 0, id).run();
    return result.meta.changes ? json({ ok: true }) : json({ error: "المقطع غير موجود" }, 404);
  }
  const video = validateVideoInput(body);
  if (video.error) return json({ error: video.error }, 400);
  const result = await env.DB.prepare("UPDATE videos SET title = ?, beneficiary_level = ?, video_url = ?, points = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(video.title, video.beneficiaryLevel, video.videoUrl, video.points, id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "المقطع غير موجود" }, 404);
}

async function deleteVideo(env, id) {
  await ensureVideosSchema(env);
  const result = await env.DB.prepare("UPDATE videos SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "المقطع غير موجود" }, 404);
}

async function completeVideo(env, user, videoId) {
  if (user.role !== "student") return json({ error: "المشاهدة مخصصة للمستفيدين" }, 400);
  await ensureVideosSchema(env);
  const video = await env.DB.prepare("SELECT id, points FROM videos WHERE id = ? AND active = 1 AND (beneficiary_level = ? OR beneficiary_level = 'all')").bind(videoId, String(user.education_stage || "")).first();
  if (!video) return json({ error: "المقطع غير متاح لمستواك" }, 404);
  const result = await env.DB.prepare("INSERT OR IGNORE INTO video_completions (user_id, video_id, points) VALUES (?, ?, ?)").bind(user.id, video.id, video.points).run();
  const updated = await env.DB.prepare("SELECT points FROM users WHERE id = ?").bind(user.id).first();
  return json({ ok: true, awarded: result.meta.changes ? Number(video.points) : 0, alreadyCompleted: !result.meta.changes, points: Number(updated?.points || 0) });
}

async function purchaseProduct(request, env, user) {
  if (user.role !== "student") return json({ error: "?�؟�?�؟�?�؟�?�؟� ?�؟�U?U??�؟�U?U? U??�؟� U??�؟�???�؟�U? U?U? ?�؟�U?U????�؟�?�؟�" }, 400);
  const body = await readJson(request), productId = Number(body.productId);
  const product = await env.DB.prepare("SELECT * FROM products WHERE id = ? AND active = 1").bind(productId).first();
  const freshUser = await env.DB.prepare("SELECT points FROM users WHERE id = ?").bind(user.id).first();
  if (!product || product.stock < 1) return json({ error: "?�؟�U?U?U????�؟� ??U??�؟� U???U?U??�؟�" }, 409);
  if (freshUser.points < product.price) return json({ error: "?�؟�?�؟�U??�؟�U? U??�؟� U?U?U?U?" }, 409);
  await env.DB.batch([
    env.DB.prepare("UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0").bind(product.id),
    env.DB.prepare("UPDATE users SET points = points - ? WHERE id = ? AND points >= ?").bind(product.price, user.id, product.price),
    env.DB.prepare("INSERT INTO purchases (user_id, product_id, points_paid) VALUES (?, ?, ?)").bind(user.id, product.id, product.price)
  ]);
  return json({ ok: true, points: freshUser.points - product.price });
}

async function createProduct(request, env) {
  const body = await readJson(request), name = clean(body.name, 100), description = clean(body.description, 300);
  const price = Math.floor(Number(body.price)), stock = Math.floor(Number(body.stock)), icon = clean(body.icon, 12) || "????";
  if (!name || price < 1 || stock < 0) return json({ error: "???�؟�U?U? U?U? ?�؟�U??�؟�U??�؟�?? ?�؟�U?U?U????�؟�" }, 400);
  const result = await env.DB.prepare("INSERT INTO products (name, description, price, icon, stock) VALUES (?, ?, ?, ?, ?)").bind(name, description, price, icon, stock).run();
  return json({ id: result.meta.last_row_id }, 201);
}

async function deleteProduct(env, id) {
  const result = await env.DB.prepare("UPDATE products SET active = 0 WHERE id = ?").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "?�؟�U?U?U????�؟� ??U??�؟� U?U??�؟�U??�؟�" }, 404);
}

async function ensureSiteSettings(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS site_settings (setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES ('manager_instructions_title', ?)").bind("?�؟�?�؟�?�؟�U??�؟� ?�؟�U?U??�؟�U??�؟� U?U? ?�؟�U?U?U?U?"),
    env.DB.prepare("INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES ('manager_instructions_body', ?)").bind("?�؟�?�؟�?�؟�?�؟� U?U?U?U? ?�؟�?�؟�?�؟�???�؟�?�؟�U??�؟�?? ?�؟�U?U?U? U?U?U??�؟� U??�؟�?�؟�?�؟�?�؟� ?�؟�U?U? ?�؟�U??�؟�U?U??? U??�؟�?�؟�?�؟�U? ?�؟�?�؟�?�؟�U??�؟�??U? U?U?U??�؟� ?�؟�U??�؟�?�؟�. U??�؟�U? U?U??�؟�?�؟� ?�؟�U?!")
  ]);
  await env.DB.prepare("INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES ('challenge_race_teaser', '0')").run();
}

async function getChallengeRace(env) {
  await ensureSiteSettings(env);
  const setting = await env.DB.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'challenge_race_teaser'").first();
  const teaser = setting?.setting_value === "1";
  if (teaser) return json({ teaser: true, message: "???�؟�U??�؟�U??�؟� ?�؟�?�؟�U??�؟�U? ?�؟�U?U??�؟�?�؟�?�؟�" });
  const { results } = await env.DB.prepare("SELECT id, name, points FROM users WHERE role = 'student' AND status = 'active' ORDER BY points DESC, name COLLATE NOCASE ASC, id ASC").all();
  return json({ teaser: false, participants: results.map((participant, index) => ({ ...participant, rank: index + 1 })) });
}

async function updateChallengeRace(request, env) {
  await ensureSiteSettings(env);
  const body = await readJson(request);
  if (typeof body.teaser !== "boolean") return json({ error: "?�؟�?�؟�U??�؟� ?�؟�?�؟�?�؟�U? ?�؟�U????�؟�?�؟�U? ??U??�؟� ?�؟�?�؟�U??�؟�?�؟�" }, 400);
  await env.DB.prepare("INSERT INTO site_settings (setting_key, setting_value, updated_at) VALUES ('challenge_race_teaser', ?, CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP").bind(body.teaser ? "1" : "0").run();
  return json({ ok: true, teaser: body.teaser });
}

async function getManagerInstructions(env) {
  await ensureSiteSettings(env);
  const { results } = await env.DB.prepare("SELECT setting_key, setting_value, updated_at FROM site_settings WHERE setting_key IN ('manager_instructions_title','manager_instructions_body')").all();
  const values = Object.fromEntries(results.map(row => [row.setting_key, row.setting_value]));
  return json({
    title: values.manager_instructions_title || "?�؟�?�؟�?�؟�U??�؟� ?�؟�U?U??�؟�U??�؟� U?U? ?�؟�U?U?U?U?",
    body: values.manager_instructions_body || "",
    updatedAt: results.map(row => row.updated_at).sort().at(-1) || null
  });
}

async function updateManagerInstructions(request, env) {
  await ensureSiteSettings(env);
  const body = await readJson(request);
  const title = clean(body.title, 90), instructions = clean(body.body, 700);
  if (title.length < 3) return json({ error: "?�؟�U????�؟� ?�؟�U?U??�؟�U?U??�؟� U??�؟�?�؟�?�؟�U??�؟� U?U????�؟�U?U?U??�؟�??" }, 400);
  if (instructions.length < 3) return json({ error: "?�؟�U????�؟� ???�؟�U?U?U??�؟�?? ?�؟�U?U??�؟�U??�؟�" }, 400);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO site_settings (setting_key, setting_value, updated_at) VALUES ('manager_instructions_title', ?, CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP").bind(title),
    env.DB.prepare("INSERT INTO site_settings (setting_key, setting_value, updated_at) VALUES ('manager_instructions_body', ?, CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP").bind(instructions)
  ]);
  return json({ ok: true, title, body: instructions });
}

async function ensureGameSchema(env) {
  await ensureColumns(env, "users", { game_points: "INTEGER NOT NULL DEFAULT 0" });
  for (const statement of [
    "CREATE TABLE IF NOT EXISTS game_matches (id INTEGER PRIMARY KEY AUTOINCREMENT, game_key TEXT NOT NULL, game_name TEXT NOT NULL, mode TEXT NOT NULL CHECK (mode IN ('individual','teams')), host_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, rounds INTEGER NOT NULL CHECK (rounds BETWEEN 1 AND 30), timer_seconds INTEGER NOT NULL DEFAULT 0 CHECK (timer_seconds BETWEEN 0 AND 180), max_bet INTEGER NOT NULL DEFAULT 0 CHECK (max_bet >= 0), status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')), winning_sides TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT)",
    "CREATE TABLE IF NOT EXISTS game_match_players (match_id INTEGER NOT NULL REFERENCES game_matches(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, side TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0), is_winner INTEGER NOT NULL DEFAULT 0 CHECK (is_winner IN (0,1)), PRIMARY KEY (match_id,user_id))",
    "CREATE TABLE IF NOT EXISTS game_point_awards (match_id INTEGER NOT NULL REFERENCES game_matches(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, points INTEGER NOT NULL CHECK (points > 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (match_id,user_id))",
    "CREATE TRIGGER IF NOT EXISTS game_award_add_points AFTER INSERT ON game_point_awards BEGIN UPDATE users SET game_points = game_points + NEW.points WHERE id = NEW.user_id; END",
    "CREATE TABLE IF NOT EXISTS game_settings (setting_key TEXT PRIMARY KEY, setting_value INTEGER NOT NULL CHECK (setting_value > 0), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    "INSERT OR IGNORE INTO game_settings (setting_key,setting_value) VALUES ('win_points',100)",
    "INSERT OR IGNORE INTO game_settings (setting_key,setting_value) VALUES ('million_cap',10000)"
  ]) await env.DB.prepare(statement).run();
  await ensureColumns(env, "game_matches", { match_type: "TEXT NOT NULL DEFAULT 'standard'" });
}

async function listGameSettings(env) {
  await ensureGameSchema(env);
  const { results } = await env.DB.prepare("SELECT setting_key,setting_value,updated_at FROM game_settings ORDER BY setting_key").all();
  return json({ settings: results });
}

async function updateGameSetting(request, env, key) {
  await ensureGameSchema(env);
  const body = await readJson(request), value = Math.floor(Number(body.value));
  const limit = key === "million_cap" ? 1000000 : 10000;
  if (!Number.isInteger(value) || value < 1 || value > limit) return json({ error: `?�؟�U?U?U?U??�؟� U??�؟�?�؟� ?�؟�U? ??U?U?U? ?�؟�U?U? 1 U?${limit}` }, 400);
  await env.DB.prepare("INSERT INTO game_settings (setting_key,setting_value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP").bind(key,value).run();
  return json({ ok: true, key, value });
}

async function gameHubData(env, user) {
  const [fresh, users, matches, settings] = await Promise.all([
    env.DB.prepare("SELECT game_points FROM users WHERE id = ?").bind(user.id).first(),
    env.DB.prepare("SELECT id,name,level,education_stage FROM users WHERE role = 'student' AND status = 'active' ORDER BY name").all(),
    env.DB.prepare("SELECT m.id,m.game_key,m.game_name,m.mode,m.match_type,m.status,m.rounds,m.created_at,COUNT(p.user_id) player_count,GROUP_CONCAT(CASE WHEN p.is_winner=1 THEN u.name END,'، ') winners FROM game_matches m JOIN game_match_players mine ON mine.match_id=m.id AND mine.user_id=? JOIN game_match_players p ON p.match_id=m.id JOIN users u ON u.id=p.user_id GROUP BY m.id ORDER BY m.id DESC LIMIT 12").bind(user.id).all(),
    env.DB.prepare("SELECT setting_key,setting_value FROM game_settings").all()
  ]);
  const config = Object.fromEntries(settings.results.map(row => [row.setting_key, Number(row.setting_value)]));
  return { balance: Number(fresh?.game_points || 0), stage: normalizeStage(user.education_stage), questionBankCount: QUESTION_COUNT, users: users.results, matches: matches.results, settings: { winPoints: config.win_points || 100, millionCap: config.million_cap || 10000 } };
}

async function getGameHub(env, user) {
  if (user.role !== "student") return json({ error: "?�؟�U??�؟�U??�؟�?�؟�?�؟� ?�؟�U??�؟�U??�؟�?�؟�U??�؟� U??�؟�?�؟�?�؟�?�؟� U?U?U??�؟�??U?U??�؟�U?U?" }, 400);
  await ensureGameSchema(env);
  return json(await gameHubData(env, user));
}

async function createGameMatch(request, env, user) {
  if (user.role !== "student") return json({ error: "?�؟�U??�؟�U??�؟�?�؟�?�؟� ?�؟�U??�؟�U??�؟�?�؟�U??�؟� U??�؟�?�؟�?�؟�?�؟� U?U?U??�؟�??U?U??�؟�U?U?" }, 400);
  await ensureGameSchema(env);
  const body = await readJson(request), gameKey = clean(body.gameKey, 40), mode = body.mode;
  const supervisor = await checkSupervisor(env, user.id);
  const requestedType = String(body.matchType || "standard"), matchType = supervisor ? requestedType : "standard";
  if (supervisor && !["friendly", "official"].includes(matchType)) return json({ error: "اختر مباراة ودية أو رسمية" }, 400);
  const rounds = Math.floor(Number(body.rounds)), timer = Math.floor(Number(body.timer || 0)), maxBet = Math.floor(Number(body.maxBet || 0));
  if (!GROUP_GAMES.has(gameKey) || !["individual","teams"].includes(mode) || rounds < 1 || rounds > 30 || timer < 0 || timer > 180 || maxBet < 0) return json({ error: "?�؟�?�؟�?�؟�?�؟�?�؟�?�؟�?? ?�؟�U????�؟�?�؟�U? ??U??�؟� ?�؟�?�؟�U??�؟�?�؟�" }, 400);
  const players = Array.isArray(body.players) ? body.players.map(item => ({ userId: Number(item.userId), side: clean(item.side, 20) })) : [];
  if (players.length < 2 || players.length > 20 || new Set(players.map(item => item.userId)).size !== players.length || !players.some(item => item.userId === user.id)) return json({ error: "???�؟�U?U? U?U? U??�؟�?�؟�U??�؟� ?�؟�U?U??�؟�?�؟�?�؟�U?U?U?" }, 400);
  if (mode === "individual" && players.some(item => item.side !== String(item.userId))) return json({ error: "?�؟�?�؟�?�؟�?�؟�?�؟� ?�؟�U??�؟�U??�؟�?�؟�?�؟� ??U??�؟� ?�؟�?�؟�U??�؟�" }, 400);
  if (mode === "teams" && (players.some(item => !["A","B"].includes(item.side)) || players.filter(item => item.side === "A").length < 2 || players.filter(item => item.side === "B").length < 2)) return json({ error: "?�؟�?�؟�???�؟� ?�؟�?�؟�?�؟�U?U? ?�؟�U?U? ?�؟�U??�؟�U?U? U?U? U?U? U??�؟�U?U?" }, 400);
  const ids = players.map(item => item.userId), placeholders = ids.map(() => "?").join(",");
  const active = await env.DB.prepare(`SELECT id,name,education_stage FROM users WHERE role='student' AND status='active' AND id IN (${placeholders})`).bind(...ids).all();
  if (active.results.length !== players.length) return json({ error: "?�؟�?�؟�?�؟� ?�؟�U?U??�؟�?�؟�?�؟�U?U?U? ??U??�؟� U????�؟�?�؟�" }, 409);
  const result = await env.DB.prepare("INSERT INTO game_matches (game_key,game_name,mode,host_user_id,rounds,timer_seconds,max_bet,match_type) VALUES (?,?,?,?,?,?,?,?)").bind(gameKey, GROUP_GAMES.get(gameKey), mode, user.id, rounds, timer, maxBet, matchType).run();
  const matchId = Number(result.meta.last_row_id);
  await env.DB.batch(players.map(item => env.DB.prepare("INSERT INTO game_match_players (match_id,user_id,side) VALUES (?,?,?)").bind(matchId,item.userId,item.side)));
  const names = new Map(active.results.map(item => [Number(item.id), item.name]));
  const stageIndexes = active.results.map(item => Math.max(0, EDUCATION_STAGES.indexOf(normalizeStage(item.education_stage))));
  const averageStage = EDUCATION_STAGES[Math.round(stageIndexes.reduce((sum, value) => sum + value, 0) / stageIndexes.length)] || normalizeStage(user.education_stage);
  const questions = questionsForStage(averageStage, Math.min(30, rounds), matchId * 101 + Date.now());
  const sides = mode === "teams" ? ["A","B"].map(side => ({ key: side, name: side === "A" ? "?�؟�U?U??�؟�U?U? ?�؟�U??�؟�U?U?" : "?�؟�U?U??�؟�U?U? ?�؟�U??�؟�?�؟�U?U?", members: players.filter(item => item.side === side).map(item => names.get(item.userId)) })) : players.map(item => ({ key: item.side, name: names.get(item.userId), members: [names.get(item.userId)] }));
  return json({ match: { id: matchId, gameKey, gameName: GROUP_GAMES.get(gameKey), icon: "🧠", mode, matchType, stage: averageStage, questions, rounds, timer, maxBet, sides } }, 201);
}

async function completeGameMatch(request, env, user, matchId) {
  await ensureGameSchema(env);
  const match = await env.DB.prepare("SELECT * FROM game_matches WHERE id=? AND host_user_id=?").bind(matchId,user.id).first();
  if (!match) return json({ error: "?�؟�U?U??�؟�?�؟�?�؟�?�؟�?�؟� ??U??�؟� U?U??�؟�U??�؟�?�؟� ?�؟�U? U??�؟�?? U?U??�؟�?�؟�U??�؟�" }, 404);
  if (match.status === "completed") return json({ error: "??U? ?�؟�?�؟�???�؟�?�؟�?�؟� U???U??�؟�?�؟� U??�؟�U? ?�؟�U?U??�؟�?�؟�?�؟�?�؟�?�؟� U??�؟�?�؟�U??�؟�U?" }, 409);
  const body = await readJson(request), scores = body.scores && typeof body.scores === "object" ? body.scores : {};
  const roster = await env.DB.prepare("SELECT p.user_id,p.side,u.name FROM game_match_players p JOIN users u ON u.id=p.user_id WHERE p.match_id=?").bind(matchId).all();
  const sides = [...new Set(roster.results.map(item => item.side))];
  const cleanScores = Object.fromEntries(sides.map(side => [side, Math.floor(Number(scores[side]))]));
  if (sides.some(side => !Number.isInteger(cleanScores[side]) || cleanScores[side] < 0 || cleanScores[side] > 10000) || !Object.values(cleanScores).some(Number)) return json({ error: "?�؟�?�؟�?�؟�?�؟�?? ?�؟�U?U??�؟�?�؟�?�؟�?�؟�?�؟� ??U??�؟� ?�؟�?�؟�U??�؟�?�؟�" }, 400);
  const best = Math.max(...Object.values(cleanScores)), winningSides = sides.filter(side => cleanScores[side] === best);
  const settingKey = match.game_key === "million-points" ? "million_cap" : "win_points";
  const setting = await env.DB.prepare("SELECT setting_value FROM game_settings WHERE setting_key=?").bind(settingKey).first();
  const award = Number(setting?.setting_value || (settingKey === "million_cap" ? 10000 : 100));
  const winners = roster.results.filter(item => winningSides.includes(item.side));
  const statements = roster.results.map(item => env.DB.prepare("UPDATE game_match_players SET score=?,is_winner=? WHERE match_id=? AND user_id=?").bind(cleanScores[item.side],winningSides.includes(item.side)?1:0,matchId,item.user_id));
  if (match.match_type === "official") statements.push(...winners.map(item => env.DB.prepare("INSERT OR IGNORE INTO official_game_point_awards (match_id,user_id,points) VALUES (?,?,?)").bind(matchId,item.user_id,award)));
  if (match.match_type === "standard") statements.push(...winners.map(item => env.DB.prepare("INSERT OR IGNORE INTO game_point_awards (match_id,user_id,points) VALUES (?,?,?)").bind(matchId,item.user_id,award)));
  statements.push(env.DB.prepare("UPDATE game_matches SET status='completed',winning_sides=?,completed_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'").bind(winningSides.join(","),matchId));
  await env.DB.batch(statements);
  const hub = await gameHubData(env,user);
  return json({ ok: true, awarded: match.match_type === "friendly" ? 0 : award, matchType: match.match_type, winners: winners.map(item => item.name), balance: hub.balance, matches: hub.matches });
}

async function ensureSupervisorSchema(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS supervisor_evaluation_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, question_text TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 1 CHECK (score >= 1), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS supervisor_evaluations (id INTEGER PRIMARY KEY AUTOINCREMENT, evaluator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, supervisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, question_id INTEGER NOT NULL REFERENCES supervisor_evaluation_questions(id), score INTEGER NOT NULL CHECK (score >= 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(evaluator_id, supervisor_id, question_id))").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS supervisor_evaluations_supervisor ON supervisor_evaluations(supervisor_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS supervisor_evaluations_evaluator ON supervisor_evaluations(evaluator_id)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS supervisor_activity_metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, supervisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, metric_key TEXT NOT NULL, metric_value INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(supervisor_id, metric_key))").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS supervisor_assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, supervisor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, ended_at TEXT)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS supervisor_assignments_supervisor ON supervisor_assignments(supervisor_id, started_at DESC)").run();
}

async function checkSupervisor(env, userId) {
  const setting = await env.DB.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'current_supervisor_id'").first();
  return Number(setting?.setting_value || 0) === Number(userId);
}

async function getSupervisorAssignment(env) {
  await ensureSiteSettings(env);
  const setting = await env.DB.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'current_supervisor_id'").first();
  const supervisorId = Number(setting?.setting_value || 0);
  if (!supervisorId) return json({ supervisor: null });
  const sup = await env.DB.prepare("SELECT id, name, username, role, level, points FROM users WHERE id = ? AND status = 'active'").bind(supervisorId).first();
  if (!sup) return json({ supervisor: null });
  const assignedAt = await env.DB.prepare("SELECT updated_at FROM site_settings WHERE setting_key = 'current_supervisor_id'").first();
  return json({ supervisor: { ...sup, assignedAt: assignedAt?.updated_at || null } });
}

async function setSupervisorAssignment(request, env, user) {
  if (user.role !== "owner") return json({ error: "ط؛ظٹط� ظ…ط�ط�ط�" }, 403);
  const body = await readJson(request);
  const supervisorId = Math.floor(Number(body.supervisorId || 0));
  if (supervisorId) {
    const sup = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND role = 'student' AND status = 'active'").bind(supervisorId).first();
    if (!sup) return json({ error: "?�؟�U?U??�؟�???�؟�?�؟�U? ??U??�؟� U?U??�؟�U??�؟�" }, 404);
  }
  await ensureSupervisorSchema(env);
  await env.DB.prepare("UPDATE supervisor_assignments SET ended_at = CURRENT_TIMESTAMP WHERE ended_at IS NULL").run();
  if (supervisorId) await env.DB.prepare("INSERT INTO supervisor_assignments (supervisor_id, assigned_by) VALUES (?, ?)").bind(supervisorId, user.id).run();
  await env.DB.prepare("INSERT INTO site_settings (setting_key, setting_value, updated_at) VALUES ('current_supervisor_id', ?, CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP").bind(String(supervisorId)).run();
  const sup = supervisorId ? await env.DB.prepare("SELECT id, name, username, role, level, points FROM users WHERE id = ?").bind(supervisorId).first() : null;
  return json({ ok: true, supervisor: sup || null });
}

async function listEvaluationQuestions(env) {
  await ensureSupervisorSchema(env);
  const { results } = await env.DB.prepare("SELECT id, question_text, score, active, created_at FROM supervisor_evaluation_questions ORDER BY id").all();
  return json({ questions: results });
}

async function createEvaluationQuestion(request, env) {
  await ensureSupervisorSchema(env);
  const body = await readJson(request);
  const questionText = clean(body.questionText, 500);
  const score = Math.floor(Number(body.score));
  if (questionText.length < 3) return json({ error: "U??�؟� ?�؟�U??�؟�?�؟�?�؟�U? U??�؟�U??�؟� ?�؟�?�؟�?�؟�U?" }, 400);
  if (!Number.isInteger(score) || score < 1 || score > 100) return json({ error: "?�؟�U??�؟�?�؟�?�؟�?�؟� U??�؟�?�؟� ?�؟�U? ??U?U?U? ?�؟�U?U? 1 U?100" }, 400);
  const result = await env.DB.prepare("INSERT INTO supervisor_evaluation_questions (question_text, score) VALUES (?, ?)").bind(questionText, score).run();
  return json({ id: result.meta.last_row_id }, 201);
}

async function updateEvaluationQuestion(request, env, id) {
  await ensureSupervisorSchema(env);
  const existing = await env.DB.prepare("SELECT id FROM supervisor_evaluation_questions WHERE id = ?").bind(id).first();
  if (!existing) return json({ error: "?�؟�U??�؟�?�؟�?�؟�U? ??U??�؟� U?U??�؟�U??�؟�" }, 404);
  const body = await readJson(request);
  if (Object.keys(body).length === 1 && typeof body.active === "boolean") {
    await env.DB.prepare("UPDATE supervisor_evaluation_questions SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(body.active ? 1 : 0, id).run();
    return json({ ok: true });
  }
  const questionText = clean(body.questionText, 500);
  const score = Math.floor(Number(body.score));
  if (questionText.length < 3) return json({ error: "U??�؟� ?�؟�U??�؟�?�؟�?�؟�U? U??�؟�U??�؟� ?�؟�?�؟�?�؟�U?" }, 400);
  if (!Number.isInteger(score) || score < 1 || score > 100) return json({ error: "?�؟�U??�؟�?�؟�?�؟�?�؟� U??�؟�?�؟� ?�؟�U? ??U?U?U? ?�؟�U?U? 1 U?100" }, 400);
  await env.DB.prepare("UPDATE supervisor_evaluation_questions SET question_text = ?, score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(questionText, score, id).run();
  return json({ ok: true });
}

async function deleteEvaluationQuestion(env, id) {
  await ensureSupervisorSchema(env);
  const result = await env.DB.prepare("DELETE FROM supervisor_evaluation_questions WHERE id = ?").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: "?�؟�U??�؟�?�؟�?�؟�U? ??U??�؟� U?U??�؟�U??�؟�" }, 404);
}

async function submitEvaluation(request, env, user) {
  if (user.role !== "student") return json({ error: "?�؟�U???U?U?U?U? U??�؟�?�؟�?�؟� U?U?U????�؟�?�؟�?�؟�U?U?U?" }, 400);
  await ensureSupervisorSchema(env);
  const body = await readJson(request);
  const supervisorId = Math.floor(Number(body.supervisorId));
  const answers = Array.isArray(body.answers) ? body.answers : [];
  if (Number(user.id) === supervisorId) return json({ error: "لا يمكن للمشرف تقييم نفسه" }, 403);
  if (!supervisorId) return json({ error: "?�؟�?�؟�???�؟� ?�؟�U?U??�؟�?�؟�U? ?�؟�U?U??�؟�?�؟�?�؟� ??U?U?U?U?U?" }, 400);
  const isSup = await checkSupervisor(env, supervisorId);
  if (!isSup) return json({ error: "?�؟�U?U??�؟�?�؟�U? ??U??�؟� U?U??�؟�U??�؟�" }, 404);
  if (answers.length === 0) return json({ error: "U?U? U???U? ??U??�؟�U?U? ?�؟�U? ?�؟�?�؟�?�؟�?�؟�?�؟�??" }, 400);
  for (const answer of answers) {
    const qId = Math.floor(Number(answer.questionId));
    const score = Math.floor(Number(answer.score));
    if (!qId || !Number.isInteger(score) || score < 0) continue;
    const question = await env.DB.prepare("SELECT id, score FROM supervisor_evaluation_questions WHERE id = ? AND active = 1").bind(qId).first();
    if (!question) continue;
    const maxScore = Number(question.score);
    await env.DB.prepare("INSERT INTO supervisor_evaluations (evaluator_id, supervisor_id, question_id, score) VALUES (?, ?, ?, ?) ON CONFLICT(evaluator_id, supervisor_id, question_id) DO UPDATE SET score = excluded.score, created_at = CURRENT_TIMESTAMP")
      .bind(user.id, supervisorId, qId, Math.min(score, maxScore)).run();
  }
  return json({ ok: true });
}

async function getMyEvaluations(env, user) {
  await ensureSupervisorSchema(env);
  const isSupervisor = await checkSupervisor(env, user.id);
  if (isSupervisor) {
    const { results } = await env.DB.prepare("SELECT e.id, e.evaluator_id, e.question_id, e.score, e.created_at, u.name AS evaluator_name, q.question_text, q.score AS max_score FROM supervisor_evaluations e JOIN users u ON u.id = e.evaluator_id JOIN supervisor_evaluation_questions q ON q.id = e.question_id WHERE e.supervisor_id = ? ORDER BY e.created_at DESC").bind(user.id).all();
    return json({ evaluations: results });
  }
  const { results } = await env.DB.prepare("SELECT e.id, e.supervisor_id, e.question_id, e.score, e.created_at, u.name AS supervisor_name, q.question_text, q.score AS max_score FROM supervisor_evaluations e JOIN users u ON u.id = e.supervisor_id JOIN supervisor_evaluation_questions q ON q.id = e.question_id WHERE e.evaluator_id = ? ORDER BY e.created_at DESC").bind(user.id).all();
  return json({ evaluations: results });
}

async function listSupervisorContestants(env) {
  await ensureSupervisorSchema(env);
  const { results } = await env.DB.prepare("SELECT DISTINCT u.id, u.name, u.username, u.level FROM users u LEFT JOIN supervisor_assignments a ON a.supervisor_id = u.id LEFT JOIN supervisor_evaluations e ON e.supervisor_id = u.id WHERE u.status = 'active' AND (a.id IS NOT NULL OR e.id IS NOT NULL OR CAST(u.id AS TEXT) = (SELECT setting_value FROM site_settings WHERE setting_key = 'current_supervisor_id')) ORDER BY u.name").all();
  return json({ supervisors: results });
}

async function getEvaluationsSummary(env) {
  await ensureSupervisorSchema(env);
  const { results } = await env.DB.prepare("SELECT e.supervisor_id, u.name AS supervisor_name, SUM(e.score) AS total_score, COUNT(DISTINCT e.evaluator_id) AS evaluator_count, COUNT(e.id) AS answer_count FROM supervisor_evaluations e JOIN users u ON u.id = e.supervisor_id GROUP BY e.supervisor_id, u.name ORDER BY total_score DESC").all();
  return json({ summary: results });
}

async function calculateSupervisorMetrics(env, supervisorId) {
  const [additions, interactions, competitions, official, challenges, participants, activity, achievements] = await Promise.all([
    env.DB.prepare("SELECT (SELECT COUNT(*) FROM majlis_posts WHERE user_id = ?) + (SELECT COUNT(*) FROM majlis_comments WHERE user_id = ?) AS value").bind(supervisorId, supervisorId).first(),
    env.DB.prepare("SELECT COUNT(*) AS value FROM majlis_reactions WHERE user_id = ?").bind(supervisorId).first(),
    env.DB.prepare("SELECT COUNT(*) AS value FROM game_matches WHERE host_user_id = ? AND status = 'completed'").bind(supervisorId).first(),
    env.DB.prepare("SELECT COUNT(*) AS value FROM game_matches WHERE host_user_id = ? AND status = 'completed' AND match_type = 'official'").bind(supervisorId).first(),
    env.DB.prepare("SELECT COUNT(*) AS value FROM daily_challenge_attempts WHERE user_id = ? AND status = 'completed'").bind(supervisorId).first(),
    env.DB.prepare("SELECT COUNT(DISTINCT p.user_id) AS value FROM game_matches m JOIN game_match_players p ON p.match_id = m.id WHERE m.host_user_id = ?").bind(supervisorId).first(),
    env.DB.prepare("SELECT COUNT(DISTINCT day) AS value FROM (SELECT DATE(created_at) day FROM majlis_posts WHERE user_id = ? UNION SELECT DATE(created_at) day FROM majlis_comments WHERE user_id = ? UNION SELECT DATE(created_at) day FROM game_matches WHERE host_user_id = ?)").bind(supervisorId, supervisorId, supervisorId).first(),
    env.DB.prepare("SELECT COUNT(*) AS value FROM achievement_completions WHERE user_id = ?").bind(supervisorId).first()
  ]);
  return { additions: Number(additions?.value || 0), interactions: Number(interactions?.value || 0), competitions_supervised: Number(competitions?.value || 0), official_competitions: Number(official?.value || 0), challenges_done: Number(challenges?.value || 0), participants_count: Number(participants?.value || 0), activity_level: Number(activity?.value || 0), achievement_level: Number(achievements?.value || 0) };
}

function supervisorPlatformScore(metrics) {
  return metrics.additions * 10 + metrics.interactions * 5 + metrics.competitions_supervised * 20 + metrics.official_competitions * 30 + metrics.challenges_done * 15 + metrics.participants_count * 3 + metrics.activity_level * 8 + metrics.achievement_level * 25;
}

async function getPlatformScore(request, env) {
  const url = new URL(request.url);
  const supervisorId = Math.floor(Number(url.searchParams.get("supervisor_id") || 0));
  if (!supervisorId) return json({ error: "U??�؟�?�؟�U? ?�؟�U?U??�؟�?�؟�U? U??�؟�U?U??�؟�" }, 400);
  await ensureSupervisorSchema(env);
  const isSup = await checkSupervisor(env, supervisorId);
  if (!isSup) return json({ error: "?�؟�U?U??�؟�?�؟�U? ??U??�؟� U?U??�؟�U??�؟�" }, 404);
  const metrics = await calculateSupervisorMetrics(env, supervisorId);
  return json({ platformScore: supervisorPlatformScore(metrics), metrics });
}

async function getSupervisorLeaderboard(env) {
  await ensureSupervisorSchema(env);
  const setting = await env.DB.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'current_supervisor_id'").first();
  const currentId = Number(setting?.setting_value || 0);
  const pastIds = await env.DB.prepare("SELECT supervisor_id FROM supervisor_assignments UNION SELECT supervisor_id FROM supervisor_evaluations").all();
  const supervisorIds = new Set([currentId, ...pastIds.results.map(r => Number(r.supervisor_id))].filter(Boolean));
  const supervisors = [];
  for (const sid of supervisorIds) {
    const s = await env.DB.prepare("SELECT id, name, username, level FROM users WHERE id = ? AND status = 'active'").bind(sid).first();
    if (s) supervisors.push(s);
  }
  const leaderboard = [];
  for (const sup of supervisors) {
    const evalResult = await env.DB.prepare("SELECT COALESCE(SUM(score), 0) AS total FROM supervisor_evaluations WHERE supervisor_id = ?").bind(sup.id).first();
    const contestantScore = Number(evalResult?.total || 0);
    const metrics = await calculateSupervisorMetrics(env, sup.id);
    const platformScore = supervisorPlatformScore(metrics);
    const totalScore = contestantScore + platformScore;
    leaderboard.push({ id: sup.id, name: sup.name, username: sup.username, level: sup.level, contestantScore, platformScore, totalScore });
  }
  leaderboard.sort((a, b) => b.totalScore - a.totalScore);
  const ranked = leaderboard.map((entry, index) => ({ ...entry, rank: index + 1 }));
  return json({ leaderboard: ranked });
}

async function setHeadhunterMatchType(request, env) {
  const body = await readJson(request);
  const matchType = String(body.matchType || "friendly");
  if (!["friendly", "official"].includes(matchType)) return json({ error: "U?U??�؟� ?�؟�U?U??�؟�?�؟�?�؟�?�؟�?�؟� ??U??�؟� ?�؟�?�؟�U??�؟�" }, 400);
  return json({ ok: true, matchType });
}

async function requireSession(request, env) {
  const token = cookie(request, SESSION_COOKIE);
  if (!token) return { response: json({ error: "U??�؟�?�؟� ???�؟�?�؟�U?U? ?�؟�U??�؟�?�؟�U?U?" }, 401) };
  const user = await env.DB.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active'")
    .bind(await sha256(token), new Date().toISOString()).first();
  return user ? { user } : { response: json({ error: "?�؟�U???U??? ?�؟�U??�؟�?�؟� ?�؟�U??�؟�?�؟�U?U?" }, 401, { "Set-Cookie": sessionCookie("", 0) }) };
}

function validateAccount(body) {
  const name = clean(body.name, 80), username = clean(body.username, 40).toLowerCase();
  const password = String(body.password || ""), level = Math.max(1, Math.min(20, Number(body.level) || 1));
  const points = Math.max(0, Math.min(1000000, Number(body.points) || 0));
  if (name.length < 3) return { error: "?�؟�U??�؟�?�؟�U? U??�؟�U??�؟� ?�؟�?�؟�U??�؟�" };
  if (!validUsername(username)) return { error: "?�؟�?�؟�U? ?�؟�U?U??�؟�???�؟�?�؟�U? U??�؟�?�؟� ?�؟�U? U??�؟�??U?U? ?�؟�?�؟�U?U?U??�؟� ?�؟�U??�؟�U?U??�؟�U??�؟� ?�؟�U? ?�؟�?�؟�U??�؟�U?U??�؟�" };
  if (password.length < 8 || password.length > 128) return { error: "U?U?U??�؟� ?�؟�U?U??�؟�U??�؟� U??�؟�?�؟� ?�؟�U? ??U?U?U? 8 ?�؟�?�؟�?�؟�U? ?�؟�U?U? ?�؟�U??�؟�U?U?" };
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
function publicUser(user) { return { id: user.id, name: user.name, username: user.username, role: user.role, educationStage: user.education_stage || "", level: user.level, points: user.points, status: user.status }; }
function validOrigin(request, url) { const origin = request.headers.get("Origin"); return !origin || origin === url.origin; }
function cookie(request, name) { const match = request.headers.get("Cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)); return match ? decodeURIComponent(match[1]) : ""; }
function sessionCookie(value, maxAge) { return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`; }
async function readJson(request) { try { return await request.json(); } catch { return {}; } }
function json(data, status = 200, headers = {}) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } }); }
