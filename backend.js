const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(bodyParser.json());

// DB 연결
const DB_PATH = path.join(__dirname, "db.sqlite");
const db = new sqlite3.Database(DB_PATH);

// Promise 유틸
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}
function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

// 초기 테이블 생성 및 샘플 데이터
db.serialize(async () => {
  db.run(`PRAGMA foreign_keys = ON;`);

  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    password TEXT,
    points INTEGER DEFAULT 0,
    skin TEXT DEFAULT 'default',
    title TEXT DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    date TEXT,
    time TEXT,
    status TEXT,
    points INTEGER,
    FOREIGN KEY(student_id) REFERENCES students(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS store_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_name TEXT UNIQUE,
    name TEXT,
    cost INTEGER,
    type TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    item_id INTEGER,
    date TEXT,
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(item_id) REFERENCES store_items(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS seating (
    seat_index INTEGER PRIMARY KEY,
    student_id INTEGER,
    FOREIGN KEY(student_id) REFERENCES students(id)
  )`);

  const studentsCount = await getAsync(`SELECT COUNT(*) AS c FROM students`);
  if (studentsCount && studentsCount.c === 0) {
    console.log("Seeding 36 students...");
    const insert = db.prepare(`INSERT INTO students (name, password, points) VALUES (?,?,?)`);
    for (let i = 1; i <= 36; i++) {
      insert.run(`학생${i}`, `pw${i}`, Math.floor(Math.random()*101));
    }
    insert.finalize();
  }

  const itemsCount = await getAsync(`SELECT COUNT(*) AS c FROM store_items`);
  if (itemsCount && itemsCount.c === 0) {
    console.log("Seeding store items...");
    const it = db.prepare(`INSERT INTO store_items (key_name, name, cost, type) VALUES (?,?,?,?)`);
    it.run("desk_red", "책상: 레드 스킨", 200, "skin");
    it.run("desk_blue", "책상: 블루 스킨", 200, "skin");
    it.run("title_star", "칭호: 출석왕", 300, "title");
    it.run("title_helper", "칭호: 도우미", 150, "title");
    it.finalize();
  }

  const seatingCount = await getAsync(`SELECT COUNT(*) AS c FROM seating`);
  if (seatingCount && seatingCount.c === 0) {
    console.log("Seeding seating...");
    const students = await allAsync(`SELECT id FROM students ORDER BY id LIMIT 36`);
    const insertSeat = db.prepare(`INSERT INTO seating (seat_index, student_id) VALUES (?,?)`);
    for (let i = 0; i < 36; i++) {
      const sid = (students[i] && students[i].id) || null;
      insertSeat.run(i, sid);
    }
    insertSeat.finalize();
  }
});

// 관리자 비밀번호 (하드코딩)
const ADMIN_PW = "adminpass";


// === 학생 API ===
app.get("/api/students", async (req, res) => {
  try {
    const students = await allAsync(`SELECT * FROM students ORDER BY id`);
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/students/:id", async (req, res) => {
  try {
    const row = await getAsync(`SELECT * FROM students WHERE id = ?`, [req.params.id]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// === 좌석 API ===
app.get("/api/seating", async (req, res) => {
  try {
    const rows = await allAsync(`
      SELECT s.seat_index, s.student_id, st.id AS sid, st.name, st.points, st.skin, st.title
      FROM seating s
      LEFT JOIN students st ON s.student_id = st.id
      ORDER BY s.seat_index
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/seating", async (req, res) => {
  try {
    const { adminPw, seating } = req.body;
    if (adminPw !== ADMIN_PW) return res.status(403).json({ message: "관리자 비밀번호 불일치" });
    if (!Array.isArray(seating)) return res.status(400).json({ message: "seating 배열 필요" });

    await runAsync("BEGIN TRANSACTION");
    await runAsync("DELETE FROM seating");
    const stmt = db.prepare(`INSERT INTO seating (seat_index, student_id) VALUES (?,?)`);
    for (const s of seating) {
      await new Promise((r, rej) => stmt.run(s.seat_index, s.student_id || null, (e) => (e ? rej(e) : r())));
    }
    stmt.finalize();
    await runAsync("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await runAsync("ROLLBACK").catch(()=>{});
    res.status(500).json({ error: err.message });
  }
});


// === 출석 API ===
// 하루 1회 제한 포함
app.post("/api/attendance", async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ message: "studentId 필요" });

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const existing = await getAsync(
      `SELECT id FROM attendance WHERE student_id = ? AND date = ?`,
      [studentId, today]
    );
    if (existing) {
      return res.json({ success: false, message: "이미 오늘 출석했습니다." });
    }

    const hh = now.getHours();
    const mm = now.getMinutes();
    const total = hh * 60 + mm;

    const t825 = 8 * 60 + 25;
    const t840 = 8 * 60 + 40;

    let points = 0, status = "지각";
    if (total <= t825) { points = 100; status = "출석(정시)"; }
    else if (total <= t840) { points = 50; status = "출석(지각 아님)"; }

    const time = `${hh.toString().padStart(2,"0")}:${mm.toString().padStart(2,"0")}`;

    await runAsync(
      `INSERT INTO attendance (student_id, date, time, status, points) VALUES (?,?,?,?,?)`,
      [studentId, today, time, status, points]
    );

    await runAsync(`UPDATE students SET points = points + ? WHERE id = ?`, [points, studentId]);

    res.json({ success: true, status, points, date: today, time });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/attendance/:studentId", async (req, res) => {
  try {
    const rows = await allAsync(
      `SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC`,
      [req.params.studentId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// === 상점 API ===
app.get("/api/items", async (req, res) => {
  try {
    const items = await allAsync(`SELECT * FROM store_items ORDER BY id`);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/buy", async (req, res) => {
  try {
    const { studentId, itemKey } = req.body;
    if (!studentId || !itemKey) return res.status(400).json({ message: "studentId, itemKey 필요" });

    const student = await getAsync(`SELECT * FROM students WHERE id = ?`, [studentId]);
    const item = await getAsync(`SELECT * FROM store_items WHERE key_name = ?`, [itemKey]);
    if (!student || !item) return res.status(404).json({ message: "학생 또는 아이템 없음" });

    if (student.points < item.cost) return res.json({ success: false, message: "포인트 부족" });

    await runAsync("BEGIN TRANSACTION");
    await runAsync(`UPDATE students SET points = points - ? WHERE id = ?`, [item.cost, studentId]);
    if (item.type === "skin") {
      await runAsync(`UPDATE students SET skin = ? WHERE id = ?`, [item.key_name, studentId]);
    } else if (item.type === "title") {
      await runAsync(`UPDATE students SET title = ? WHERE id = ?`, [item.name, studentId]);
    }
    await runAsync(`INSERT INTO purchases (student_id, item_id, date) VALUES (?,?,?)`, [studentId, item.id, new Date().toISOString()]);
    await runAsync("COMMIT");

    const updated = await getAsync(`SELECT * FROM students WHERE id = ?`, [studentId]);
    res.json({ success: true, message: `${item.name} 구매완료`, student: updated });
  } catch (err) {
    await runAsync("ROLLBACK").catch(()=>{});
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/items", async (req, res) => {
  try {
    const { adminPw, key_name, name, cost, type } = req.body;
    if (adminPw !== ADMIN_PW) return res.status(403).json({ message: "관리자 비밀번호 불일치" });
    await runAsync(`INSERT INTO store_items (key_name, name, cost, type) VALUES (?,?,?,?)`, [key_name, name, cost, type]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// === 출석 CSV 내보내기 (가로=날짜, 세로=이름, 이모지) ===
app.get("/api/export/:year/:month", async (req, res) => {
  try {
    const { year, month } = req.params;
    const prefix = `${year}-${month.toString().padStart(2,"0")}`;

    const students = await allAsync(`SELECT id, name FROM students ORDER BY id`);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) =>
      `${prefix}-${String(i+1).padStart(2,"0")}`
    );

    const records = await allAsync(
      `SELECT student_id, date, status FROM attendance WHERE date LIKE ?`,
      [`${prefix}%`]
    );

    const header = ["이름", ...days];
    const lines = [header.join(",")];

    for (const st of students) {
      const row = [st.name];
      for (const d of days) {
        const rec = records.find(r => r.student_id === st.id && r.date === d);
        if (rec) {
          if (rec.status.startsWith("출석")) row.push("🟢");
          else if (rec.status === "지각") row.push("🟡");
          else row.push("🟢");
        } else {
          row.push("🔴");
        }
      }
      lines.push(row.join(","));
    }

    const csv = lines.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${prefix}_attendance.csv"`);
    res.send(Buffer.from(csv, "utf8"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 서버 시작
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
