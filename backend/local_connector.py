"""Local MySQL connector agent. Run: python backend/local_connector.py --help"""
import argparse
import getpass
import json
import os
import sys
import time
import urllib.error
import urllib.request
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.adapters.mysql_adapter import MySQLDatabaseAdapter


def request_json(url, payload=None, token=None, timeout=30):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=data, headers=headers, method="POST" if payload is not None else "GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode())


def main():
    parser = argparse.ArgumentParser(description="Connect your local MySQL database to the Text-to-SQL app.")
    parser.add_argument("--api", required=True, help="Backend base URL, e.g. https://api.example.com")
    parser.add_argument("--pair-code", required=True, help="One-time code shown by the app")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3306)
    parser.add_argument("--database", required=True)
    parser.add_argument("--username", required=True)
    args = parser.parse_args()

    password = getpass.getpass("MySQL password (stored only on this computer): ")
    pair = request_json(args.api.rstrip("/") + "/api/v1/connections/local/pair",
                        {"pair_code": args.pair_code})
    connection_id, token = pair["connection_id"], pair["agent_token"]
    uri = "mysql+pymysql://{}:{}@{}:{}/{}".format(
        urllib.parse.quote(args.username, safe=""), urllib.parse.quote(password, safe=""),
        args.host, args.port, urllib.parse.quote(args.database, safe=""))
    adapter = MySQLDatabaseAdapter(connection_id, "Local MySQL", uri, args.database)
    if not adapter.test_connection():
        raise SystemExit("Could not connect to MySQL. Verify the host, port, database, username, and password.")
    print(f"Paired as {connection_id}. Keep this process running while using the database in the app.")
    api = args.api.rstrip("/") + "/api/v1/connections/local/agent/" + connection_id
    while True:
        try:
            operation = request_json(api + "/next", token=token, timeout=30)
            if not operation:
                continue
            try:
                op = operation["operation"]
                if op == "ping":
                    result = {"success": adapter.test_connection(), "data": {}}
                elif op == "schema":
                    result = {"success": True, "data": adapter.inspect_schema().model_dump(mode="json")}
                elif op == "query":
                    data = adapter.execute_query(operation["sql"], operation.get("params"),
                                                 operation.get("limit"), operation.get("timeout_sec"))
                    result = {"success": True, "data": data.model_dump(mode="json")}
                else:
                    result = {"success": False, "error": "Unsupported operation."}
            except Exception as exc:
                result = {"success": False, "error": str(exc)}
            request_json(api + "/result", {"call_id": operation["call_id"], **result}, token=token)
        except KeyboardInterrupt:
            break
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            print(f"Relay temporarily unavailable: {exc}; retrying in 3 seconds.")
            time.sleep(3)
    adapter.disconnect()


if __name__ == "__main__":
    main()
