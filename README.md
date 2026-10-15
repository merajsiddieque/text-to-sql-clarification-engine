# Text-to-SQL with Clarification Engine 🚀

A production-grade GenAI application enabling users to connect their SQL databases, ask questions in natural English, automatically clarify ambiguities, validate and safely execute queries, and visualize results as interactive tables, charts, and plain-English explanations.

---

## 🌟 Key Capabilities

1. **Multi-Database Connection Manager**
   - Cloud & Local connections: PostgreSQL, MySQL, SQLite (plus demo e-commerce store).
   - Dynamic schema discovery: tables, columns, data types, primary & foreign keys, table statistics.

2. **Clarification Engine (LangGraph Orchestrated)**
   - Distinguishes between unambiguous questions and ambiguous business requests (e.g., *"Show top performing products"* -> asks whether performance means revenue, profit, or units sold).
   - Multi-turn conversation memory with clarifying follow-ups.

3. **SQL Generation & Validation Pipeline**
   - Engine-aware dialect generation (PostgreSQL, MySQL, SQLite).
   - AST validation via **SQLGlot** (enforce strictly `SELECT` read-only statements, block DDL/DML injection, restrict functions, inject row limits and statement timeouts).

4. **Safe Query Execution & Guardrails**
   - Read-only transaction enforcement.
   - Guarded timeouts & execution limits.
   - Comprehensive error recovery and self-healing SQL regeneration.

5. **Rich Results & Visualizations**
   - Interactive, sortable, and searchable data tables.
   - Automatic chart recommendations (Bar, Line, Pie, Area) based on query result shape.
   - Plain-English executive summaries and full generated SQL inspector.

6. **Evaluation Harness & Benchmarking**
   - Automated benchmark suite measuring:
     - Execution Accuracy
     - Result Correctness against golden datasets
     - Clarification Quality (Ambiguity detection F1)
     - Schema Grounding
     - Latency & Token Usage

### Uploaded file processing

- CSV and TSV uploads are parsed directly into an in-memory SQLite database. They are limited to 25 MB by default.
- `.db` and `.sqlite` files, plus SQL text files (`.sql`, `.dump`, `.bak`, and `.sql.gz`), are staged in a temporary directory while they are validated/imported. Temporary files are automatically removed after processing; queryable data remains in memory for the active backend process.
- Uploaded connections disappear when removed or when the backend restarts. They are not persisted or reloaded from disk.
- Defaults can be adjusted in the backend environment: `MAX_UPLOAD_BYTES` (50 MB), `MAX_IN_MEMORY_TABLE_UPLOAD_BYTES` (25 MB), and `MAX_DECOMPRESSED_SQL_BYTES` (200 MB).

### Planned: RAG for uploaded databases

Uploaded databases are currently queried through their extracted schema and the existing SQL-generation workflow. A planned retrieval-augmented generation (RAG) feature will add semantic retrieval for uploaded data:

- Build embeddings for relevant schema metadata and textual representations of uploaded table data, then store them in a vector index associated with the uploaded database.
- Embed each natural-language question and retrieve the most relevant schema and data context from that index.
- Supply the retrieved context to SQL generation so the model can ground its query in the uploaded database's tables, columns, and content.
- Continue to execute generated SQL against the uploaded database with the existing read-only SQL validation and query limits; vector retrieval provides context and does not replace SQL execution.
- Keep each index scoped to its owner and uploaded database, and remove it when that upload is deleted or expires.

This is a planned capability and is not implemented yet. The embedding model and vector-store technology have not been selected.
