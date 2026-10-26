"""Simple desktop UI for pairing and running the local MySQL connector."""
import json
import queue
import threading
import urllib.error
import urllib.request
import tkinter as tk
from tkinter import ttk, messagebox

from local_connector import request_json
from app.db.adapters.mysql_adapter import MySQLDatabaseAdapter


class ConnectorWindow:
    def __init__(self, root):
        self.root = root
        root.title("Text-to-SQL Local Database Connector")
        root.geometry("560x610")
        root.minsize(520, 560)
        self.messages = queue.Queue()
        self.stop_event = threading.Event()
        self.worker = None
        self.adapter = None
        self.token = None
        self.connection_id = None
        self._build_form()
        root.after(250, self._drain_messages)
        root.protocol("WM_DELETE_WINDOW", self._close)

    def _build_form(self):
        frame = ttk.Frame(self.root, padding=20)
        frame.pack(fill="both", expand=True)
        ttk.Label(frame, text="Connect your local MySQL", font=("Segoe UI", 18, "bold")).pack(anchor="w")
        ttk.Label(frame, text="This connector makes an encrypted outbound connection. Your database password stays on this computer.",
                  wraplength=500).pack(anchor="w", pady=(6, 18))
        self.vars = {}
        fields = [("Backend URL", "http://127.0.0.1:8000"), ("Pairing code", ""),
                  ("MySQL host", "127.0.0.1"), ("Port", "3306"), ("Database", ""), ("Username", "")]
        for label, default in fields:
            ttk.Label(frame, text=label).pack(anchor="w", pady=(5, 2))
            var = tk.StringVar(value=default)
            entry = ttk.Entry(frame, textvariable=var, show="*" if label == "Pairing code" else "")
            entry.pack(fill="x")
            self.vars[label] = var
        ttk.Label(frame, text="MySQL password (kept in memory only)").pack(anchor="w", pady=(7, 2))
        self.password = ttk.Entry(frame, show="•")
        self.password.pack(fill="x")
        buttons = ttk.Frame(frame)
        buttons.pack(fill="x", pady=14)
        self.start_button = ttk.Button(buttons, text="Pair and connect", command=self._start)
        self.start_button.pack(side="left")
        self.stop_button = ttk.Button(buttons, text="Stop", command=self._stop, state="disabled")
        self.stop_button.pack(side="left", padx=8)
        ttk.Label(frame, text="Status").pack(anchor="w")
        self.status = tk.StringVar(value="Not connected")
        ttk.Label(frame, textvariable=self.status).pack(anchor="w", pady=(2, 8))
        self.log = tk.Text(frame, height=8, state="disabled", wrap="word")
        self.log.pack(fill="both", expand=True)

    def _start(self):
        values = {key: value.get().strip() for key, value in self.vars.items()}
        if not all(values[k] for k in ("Backend URL", "Pairing code", "Database", "Username")) or not self.password.get():
            messagebox.showerror("Missing details", "Enter the backend URL, pairing code, MySQL database, username, and password.")
            return
        self.stop_event.clear()
        self.start_button.configure(state="disabled")
        self.stop_button.configure(state="normal")
        args = {**values, "password": self.password.get()}
        self.worker = threading.Thread(target=self._run, args=(args,), daemon=True)
        self.worker.start()

    def _run(self, values):
        try:
            api = values["Backend URL"].rstrip("/") + "/api/v1/connections/local"
            paired = request_json(api + "/pair", {"pair_code": values["Pairing code"]})
            self.connection_id, self.token = paired["connection_id"], paired["agent_token"]
            uri = "mysql+pymysql://{}:{}@{}:{}/{}".format(
                urllib.parse.quote(values["Username"], safe=""), urllib.parse.quote(values["password"], safe=""),
                values["MySQL host"], int(values["Port"]), urllib.parse.quote(values["Database"], safe=""))
            self.adapter = MySQLDatabaseAdapter(self.connection_id, "Desktop MySQL", uri, values["Database"])
            if not self.adapter.test_connection():
                raise RuntimeError("Could not connect to MySQL. Check the host, port, and account. Use a read-only MySQL user.")
            self.messages.put(("status", "Connected — keep this window open while using the database."))
            self.messages.put(("log", "Paired successfully. Waiting for requests from the web app."))
            endpoint = api + "/agent/" + self.connection_id
            while not self.stop_event.is_set():
                try:
                    operation = request_json(endpoint + "/next", token=self.token, timeout=30)
                    if not operation:
                        continue
                    result = self._handle(operation)
                    request_json(endpoint + "/result", {"call_id": operation["call_id"], **result}, token=self.token)
                except (urllib.error.URLError, TimeoutError, OSError) as error:
                    self.messages.put(("log", f"Relay temporarily unavailable: {error}. Retrying."))
                    self.stop_event.wait(3)
        except Exception as error:
            self.messages.put(("error", str(error)))
        finally:
            if self.adapter:
                self.adapter.disconnect()
                self.adapter = None
            self.messages.put(("stopped", "Connector stopped"))

    def _handle(self, operation):
        try:
            op = operation["operation"]
            if op == "ping":
                data = {}
                success = self.adapter.test_connection()
            elif op == "schema":
                data = self.adapter.inspect_schema().model_dump(mode="json")
                success = True
            elif op == "query":
                data = self.adapter.execute_query(operation["sql"], operation.get("params"),
                                                  operation.get("limit"), operation.get("timeout_sec")).model_dump(mode="json")
                success = True
            else:
                return {"success": False, "error": "Unsupported operation."}
            return {"success": success, "data": data}
        except Exception as error:
            return {"success": False, "error": str(error)}

    def _stop(self):
        self.stop_event.set()
        self.stop_button.configure(state="disabled")
        self.status.set("Stopping…")

    def _drain_messages(self):
        while not self.messages.empty():
            kind, value = self.messages.get()
            if kind == "status":
                self.status.set(value)
            elif kind == "log":
                self.log.configure(state="normal")
                self.log.insert("end", value + "\n")
                self.log.see("end")
                self.log.configure(state="disabled")
            elif kind == "error":
                self.status.set("Connection failed")
                self.log.configure(state="normal")
                self.log.insert("end", value + "\n")
                self.log.configure(state="disabled")
            elif kind == "stopped":
                self.status.set(value)
                self.start_button.configure(state="normal")
                self.stop_button.configure(state="disabled")
        self.root.after(250, self._drain_messages)

    def _close(self):
        self.stop_event.set()
        self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    ConnectorWindow(root)
    root.mainloop()
