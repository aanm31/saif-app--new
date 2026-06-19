const SESSION_COOKIE = "saif_session";
const SESSION_DAYS = 14;
const ALLOWED_REWARDS = {
  competition: { "1": 350, "2": 280, "3": 400, "4": 300, "5": 500, "6": 650 },
  game: { "0": 80, "1": 100, "2": 120, "3": 150 }
};

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

    if (method === "POST" && path === "setup/owner") return setupOwner(request, env);
    if (method === "POST" && path === "auth/login") return login(request, env);
    if (method === "POST" && path === "auth/logout") return logout(request, env);
    if (method === "GET" && path === "auth/me") return getMe(request, env);
    if (method === "POST" && path === "registration-requests") return createRequest(request, env);

    const session = await requireSession(request, env);
    if (session.response) return session.response;
    const user = session.user;

    if (method === "POST" && path === "progress/award") return awardProgress(request, env, user);
    if (method === "GET" && path === "products") return listProducts(env);
    if (method === "POST" && path === "store/purchase") return purchaseProduct(request, env, user);
    if (path.startsWith("owner/")) {
      if (user.role !== "owner") return json({ error: "غير مصرح" }, 403);
      if (method === "GET" && path === "owner/registration-requests") return listRequests(env);
      if (method === "GET" && path === "owner/users") return listUsers(env);
      if (method === "POST" && path === "owner/users") return createUser(request, env);
      if (method === "POST" && path === "owner/products") return createProduct(request, env);
      const approve = path.match(/^owner\/registration-requests\/(\d+)\/approve$/);
      if (method === "POST" && approve) return approveRequest(request, env, Number(approve[1]));
      const reject = path.match(/^owner\/registration-requests\/(\d+)\/reject$/);
      if (method === "POST" && reject) return rejectRequest(env, Number(reject[1]));
      const remove = path.match(/^owner\/users\/(\d+)$/);
      if (method === "DELETE" && remove) return deleteUser(env, Number(remove[1]), user.id);
      const removeProduct = path.match(/^owner\/products\/(\d+)$/);
      if (method === "DELETE" && removeProduct) return deleteProduct(env, Number(removeProduct[1]));
    }
    return json({ error: "المسار غير موجود" }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: "حدث خطأ في الخادم" }, 500);
  }
}

async function setupOwner(request, env) {
  if (!env.SETUP_TOKEN) return json({ error: "سر الإعداد غير مضبوط" }, 503);
  const body = await readJson(request);
  if (body.setupToken !== env.SETUP_TOKEN) return json({ error: "سر الإعداد غير صحيح" }, 403);
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
  const points = ALLOWED_REWARDS[type]?.[id];
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

async function listProducts(env) {
  const { results } = await env.DB.prepare("SELECT id, name, description, price, icon, stock FROM products WHERE active = 1 ORDER BY id").all();
  return json({ products: results });
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
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromBase64Url(salt), iterations: 120000 }, key, 256);
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
