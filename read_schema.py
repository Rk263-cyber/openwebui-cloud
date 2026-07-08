import sqlite3

conn = sqlite3.connect('D:/AI-Stack/openwebui-data/webui.db')
cursor = conn.cursor()
cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
for t in tables:
    print(f'\n--- Table: {t[0]} ---')
    print(t[1])
