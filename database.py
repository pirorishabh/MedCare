"""SQLite persistence for DoctorTalk."""
import os, sqlite3, json
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "medassist.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def _add_column(conn, table, column, definition):
    cols = {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

def init_db():
    conn = get_db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        date_of_birth TEXT, password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'patient', specialization TEXT,
        license_number TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS login_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
        email TEXT NOT NULL, login_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        ip_address TEXT, user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
        role TEXT NOT NULL, content TEXT NOT NULL, language TEXT DEFAULT 'en-IN',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS medical_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL,
        filename TEXT NOT NULL, stored_path TEXT NOT NULL, extracted_text TEXT,
        analysis TEXT, status TEXT NOT NULL DEFAULT 'uploaded',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL, title TEXT NOT NULL, specialty TEXT,
        notes TEXT, appointment_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'requested', room_id TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS video_signals (
        room_id TEXT PRIMARY KEY, offer TEXT, answer TEXT,
        caller_candidates TEXT DEFAULT '[]', callee_candidates TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_login_logs_timestamp ON login_logs(login_timestamp);
    CREATE INDEX IF NOT EXISTS idx_chat_user_time ON chat_messages(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_appt_doctor_time ON appointments(doctor_id, appointment_time);
    CREATE INDEX IF NOT EXISTS idx_report_patient ON medical_reports(patient_id);
    """)
    # Upgrade databases created by the previous version.
    _add_column(conn, 'users', 'role', "TEXT NOT NULL DEFAULT 'patient'")
    _add_column(conn, 'users', 'specialization', 'TEXT')
    _add_column(conn, 'users', 'license_number', 'TEXT')
    conn.commit(); conn.close()

def create_user(first_name, last_name, email, date_of_birth, password, role='patient', specialization='', license_number=''):
    conn = get_db()
    try:
        cur = conn.execute("""INSERT INTO users
          (first_name,last_name,email,date_of_birth,password_hash,role,specialization,license_number)
          VALUES (?,?,?,?,?,?,?,?)""",
          (first_name.strip(), last_name.strip(), email.strip().lower(), date_of_birth,
           generate_password_hash(password), role, specialization.strip(), license_number.strip()))
        conn.commit(); return cur.lastrowid
    finally: conn.close()

def authenticate_user(email, password, role=None):
    conn = get_db()
    try:
        q = "SELECT * FROM users WHERE email=? COLLATE NOCASE"
        args=[email.strip()]
        if role:
            q += " AND role=?"; args.append(role)
        user=conn.execute(q,args).fetchone()
        return user if user and check_password_hash(user['password_hash'],password) else None
    finally: conn.close()

def record_login(user_id,email,ip_address,user_agent):
    conn=get_db()
    try:
        conn.execute("INSERT INTO login_logs(user_id,email,ip_address,user_agent) VALUES(?,?,?,?)",
                     (user_id,email,ip_address,user_agent[:1000] if user_agent else ''))
        conn.commit()
    finally: conn.close()

def add_chat_message(user_id, role, content, language='en-IN'):
    conn=get_db();
    try:
        conn.execute("INSERT INTO chat_messages(user_id,role,content,language) VALUES(?,?,?,?)",
                     (user_id,role,content,language)); conn.commit()
    finally: conn.close()

def get_chat_messages(user_id, limit=100):
    conn=get_db()
    try:
        rows=conn.execute("SELECT role,content,language,created_at FROM chat_messages WHERE user_id=? ORDER BY id DESC LIMIT ?",(user_id,limit)).fetchall()
        return [dict(r) for r in reversed(rows)]
    finally: conn.close()

def list_doctors():
    conn=get_db()
    try:
        return [dict(r) for r in conn.execute("SELECT id,first_name,last_name,email,specialization,license_number FROM users WHERE role='doctor' ORDER BY first_name,last_name").fetchall()]
    finally: conn.close()

def create_appointment(patient_id,doctor_id,title,specialty,notes,appointment_time):
    import uuid
    room_id='doctor-talk-'+uuid.uuid4().hex[:12]
    conn=get_db()
    try:
        cur=conn.execute("""INSERT INTO appointments(patient_id,doctor_id,title,specialty,notes,appointment_time,room_id)
        VALUES(?,?,?,?,?,?,?)""",(patient_id,doctor_id,title,specialty,notes,appointment_time,room_id))
        conn.commit(); return cur.lastrowid,room_id
    finally: conn.close()
