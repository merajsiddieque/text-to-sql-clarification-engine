const API_BASE = '/api/v1';

export async function fetchConnections() {
  const res = await fetch(`${API_BASE}/connections`);
  if (!res.ok) throw new Error('Failed to fetch connections');
  return res.json();
}

export async function testConnection(payload) {
  const res = await fetch(`${API_BASE}/connections/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to test connection');
  return res.json();
}

export async function createConnection(payload) {
  const res = await fetch(`${API_BASE}/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create connection');
  }
  return res.json();
}

export async function deleteConnection(connectionId) {
  const res = await fetch(`${API_BASE}/connections/${connectionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete connection');
  return res.json();
}

export async function fetchSchema(connectionId) {
  const res = await fetch(`${API_BASE}/schema/${connectionId}`);
  if (!res.ok) throw new Error('Failed to fetch schema');
  return res.json();
}

export async function refreshSchema(connectionId) {
  const res = await fetch(`${API_BASE}/schema/${connectionId}/refresh`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to refresh schema');
  return res.json();
}

export async function runNaturalQuery({ naturalQuery, connectionId, selectedClarification, conversationHistory = [] }) {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      natural_query: naturalQuery,
      connection_id: connectionId,
      selected_clarification: selectedClarification,
      conversation_history: conversationHistory,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Query execution failed');
  }
  return res.json();
}

export async function validateSQL({ sql, connectionId, dialect }) {
  const res = await fetch(`${API_BASE}/query/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, connection_id: connectionId, dialect }),
  });
  if (!res.ok) throw new Error('SQL validation failed');
  return res.json();
}

export async function runBenchmarkSuite() {
  const res = await fetch(`${API_BASE}/eval/benchmark`);
  if (!res.ok) throw new Error('Failed to run benchmark');
  return res.json();
}
