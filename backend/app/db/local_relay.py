"""In-process RPC broker for outbound local database agents.

For production, run the API/relay as a persistent service. The broker is deliberately
process-local and is not suitable for horizontally scaled/serverless deployments.
"""
from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass, field
from queue import Empty, Queue
from typing import Any, Dict, Optional


@dataclass
class PendingCall:
    event: threading.Event = field(default_factory=threading.Event)
    result: Optional[Dict[str, Any]] = None


class LocalAgentRelay:
    def __init__(self):
        self._lock = threading.RLock()
        self._tokens: Dict[str, str] = {}  # connection id -> SHA256 token hash
        self._queues: Dict[str, Queue] = {}
        self._calls: Dict[str, PendingCall] = {}
        self._pair_codes: Dict[str, tuple[str, float]] = {}
        self._online_at: Dict[str, float] = {}

    def create_pairing_code(self, connection_id: str, token_hash: str) -> str:
        code = secrets.token_urlsafe(8)
        with self._lock:
            self._pair_codes[code] = (connection_id, time.time() + 600)
            self._tokens[connection_id] = token_hash
            self._queues[connection_id] = Queue()
        return code

    def redeem_pairing_code(self, code: str) -> Optional[str]:
        with self._lock:
            item = self._pair_codes.pop(code, None)
            if not item or item[1] < time.time():
                return None
            return item[0]

    def authenticate_agent(self, connection_id: str, token_hash: str) -> bool:
        import hmac
        with self._lock:
            expected = self._tokens.get(connection_id)
            return bool(expected and hmac.compare_digest(expected, token_hash))

    def submit(self, connection_id: str, operation: Dict[str, Any], timeout: float = 30) -> Dict[str, Any]:
        with self._lock:
            queue = self._queues.get(connection_id)
            if queue is None:
                raise ConnectionError("Local connector is not paired or available.")
            call_id = secrets.token_urlsafe(18)
            pending = PendingCall()
            self._calls[call_id] = pending
            queue.put({"call_id": call_id, **operation})
        if not pending.event.wait(timeout):
            with self._lock:
                self._calls.pop(call_id, None)
            raise TimeoutError("Local connector did not respond in time. Check that its agent is running.")
        with self._lock:
            self._calls.pop(call_id, None)
        if pending.result is None:
            raise ConnectionError("Local connector returned no result.")
        if not pending.result.get("success"):
            raise RuntimeError(pending.result.get("error", "Local database operation failed."))
        return pending.result.get("data", {})

    def next_operation(self, connection_id: str, timeout: float = 20) -> Optional[Dict[str, Any]]:
        with self._lock:
            if connection_id in self._queues:
                self._online_at[connection_id] = time.time()
        queue = self._queues.get(connection_id)
        if queue is None:
            return None
        try:
            return queue.get(timeout=timeout)
        except Empty:
            return None

    def resolve(self, connection_id: str, call_id: str, result: Dict[str, Any]) -> bool:
        with self._lock:
            pending = self._calls.get(call_id)
            if pending is None:
                return False
            pending.result = result
            pending.event.set()
            self._online_at[connection_id] = time.time()
            return True

    def is_online(self, connection_id: str, max_age: int = 45) -> bool:
        with self._lock:
            return time.time() - self._online_at.get(connection_id, 0) <= max_age

    def remove(self, connection_id: str) -> None:
        with self._lock:
            self._tokens.pop(connection_id, None)
            self._queues.pop(connection_id, None)
            self._online_at.pop(connection_id, None)
            for code, item in list(self._pair_codes.items()):
                if item[0] == connection_id:
                    self._pair_codes.pop(code, None)


local_agent_relay = LocalAgentRelay()
