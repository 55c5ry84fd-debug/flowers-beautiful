require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "sekretny-klyuch-po-umolchaniyu";

// База данных (создастся сама)
const db = new Database("flowers.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    cart TEXT DEFAULT '[]',
    favorites TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(cors());
app.use(express.json());

// --- Регистрация ---
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 4) {
      return res.status(400).json({ error: "Заполни всё, пароль от 4 символов" });
    }
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
    if (existing) return res.status(409).json({ error: "Такой email уже есть" });

    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
    ).run(name, email.toLowerCase(), hash);

    const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: result.lastInsertRowid, name, email: email.toLowerCase() } });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// --- Вход ---
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
    if (!user) return res.status(401).json({ error: "Неверный email или пароль" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Неверный email или пароль" });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// --- Проверка токена ---
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return res.status(401).json({ error: "Нужен токен" });
  try {
    const payload = jwt.verify(header.split(" ")[1], JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Токен недействителен" });
  }
}

// --- Защищенные маршруты ---
app.get("/api/me", auth, (req, res) => {
  const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(req.userId);
  res.json(user);
});

app.get("/api/cart", auth, (req, res) => {
  const user = db.prepare("SELECT cart FROM users WHERE id = ?").get(req.userId);
  res.json(JSON.parse(user.cart || "[]"));
});

app.post("/api/cart", auth, (req, res) => {
  db.prepare("UPDATE users SET cart = ? WHERE id = ?").run(JSON.stringify(req.body.cart || []), req.userId);
  res.json({ ok: true });
});

app.get("/api/favorites", auth, (req, res) => {
  const user = db.prepare("SELECT favorites FROM users WHERE id = ?").get(req.userId);
  res.json(JSON.parse(user.favorites || "[]"));
});

app.post("/api/favorites", auth, (req, res) => {
  db.prepare("UPDATE users SET favorites = ? WHERE id = ?").run(JSON.stringify(req.body.favorites || []), req.userId);
  res.json({ ok: true });
});

// Запуск
app.listen(PORT, () => console.log(`Сервер работает на порту ${PORT}`));