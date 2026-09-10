"""Developer-only CLI for inspecting and managing MedCare login data.
This file is intentionally not exposed as a Flask route.
"""
import argparse
from database import get_db


def list_logins(limit=100):
    db = get_db()
    rows = db.execute("""SELECT id, user_id, email, login_timestamp, ip_address, user_agent
                        FROM login_logs ORDER BY id DESC LIMIT ?""", (limit,)).fetchall()
    db.close()
    if not rows:
        print("No login records yet.")
        return
    for r in rows:
        print(f"#{r['id']} | {r['email']} | {r['login_timestamp']} | IP: {r['ip_address'] or '-'}")
        print(f"    {r['user_agent'] or '-'}")


def list_users():
    db = get_db()
    rows = db.execute("SELECT id, first_name, last_name, email, created_at FROM users ORDER BY id DESC").fetchall()
    db.close()
    for r in rows:
        print(f"#{r['id']} | {r['first_name']} {r['last_name']} | {r['email']} | registered: {r['created_at']}")


def delete_login(record_id):
    db = get_db()
    cur = db.execute("DELETE FROM login_logs WHERE id = ?", (record_id,))
    db.commit(); db.close()
    print("Deleted." if cur.rowcount else "Login record not found.")


def clear_logins():
    answer = input("Delete ALL login history? Type YES to confirm: ")
    if answer != "YES":
        print("Cancelled."); return
    db = get_db(); db.execute("DELETE FROM login_logs"); db.commit(); db.close()
    print("All login history deleted.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Developer-only MedCare database manager")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("list"); p.add_argument("--limit", type=int, default=100)
    sub.add_parser("users")
    p = sub.add_parser("delete"); p.add_argument("id", type=int)
    sub.add_parser("clear")
    args = parser.parse_args()
    if args.command == "list": list_logins(args.limit)
    elif args.command == "users": list_users()
    elif args.command == "delete": delete_login(args.id)
    elif args.command == "clear": clear_logins()
