import os
import re
import csv
import gzip
import uuid
import sqlite3
import io
import shutil
import tempfile
from pathlib import Path
from itertools import chain
from typing import Dict, Any, List, Optional, BinaryIO, Union
from app.db.manager import db_manager

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(50 * 1024 * 1024)))
MAX_IN_MEMORY_TABLE_UPLOAD_BYTES = int(os.getenv("MAX_IN_MEMORY_TABLE_UPLOAD_BYTES", str(25 * 1024 * 1024)))
MAX_DECOMPRESSED_SQL_BYTES = int(os.getenv("MAX_DECOMPRESSED_SQL_BYTES", str(200 * 1024 * 1024)))


class UploadLimitError(ValueError):
    """Raised when an upload exceeds a configured processing limit."""


def clean_name(name: str) -> str:
    """Sanitizes table or column names to be safe SQL identifiers."""
    cleaned = re.sub(r"[^\w]+", "_", name.strip())
    if not cleaned or cleaned[0].isdigit():
        cleaned = f"t_{cleaned}"
    return cleaned


def infer_column_type(values: List[str]) -> str:
    """Infers SQLite column data type from sample string values."""
    non_empty = [v.strip() for v in values if v is not None and str(v).strip() != ""]
    if not non_empty:
        return "TEXT"

    is_int = True
    for v in non_empty:
        try:
            int(v)
        except ValueError:
            is_int = False
            break
    if is_int:
        return "INTEGER"

    is_float = True
    for v in non_empty:
        try:
            float(v)
        except ValueError:
            is_float = False
            break
    if is_float:
        return "REAL"

    return "TEXT"


def import_csv_tsv_to_sqlite(file_content: bytes, filename: str, conn: sqlite3.Connection, is_tsv: bool = False) -> str:
    """Parses a bounded CSV/TSV upload into an in-memory SQLite table."""
    text_content = ""
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            text_content = file_content.decode(enc)
            break
        except UnicodeDecodeError:
            continue

    if not text_content:
        raise ValueError("Could not decode CSV/TSV file with standard encodings.")

    delimiter = "\t" if is_tsv else ","
    # Fallback auto-detection if delimiter isn't clear
    if not is_tsv and "\t" in text_content.splitlines()[0] and "," not in text_content.splitlines()[0]:
        delimiter = "\t"

    reader = csv.reader(io.StringIO(text_content, newline=""), delimiter=delimiter)
    raw_headers = next(reader, None)
    if not raw_headers:
        raise ValueError("Uploaded CSV/TSV file is empty.")

    sample_rows = []
    for _ in range(100):
        try:
            sample_rows.append(next(reader))
        except StopIteration:
            break

    # Deduplicate and clean headers
    headers = []
    seen = set()
    for i, h in enumerate(raw_headers):
        col_name = clean_name(h) if h.strip() else f"col_{i+1}"
        base = col_name
        idx = 1
        while col_name.casefold() in seen:
            col_name = f"{base}_{idx}"
            idx += 1
        seen.add(col_name.casefold())
        headers.append(col_name)

    # Infer column types using up to 100 sample rows
    col_types = []
    for col_idx in range(len(headers)):
        col_samples = [row[col_idx] for row in sample_rows if col_idx < len(row)]
        col_types.append(infer_column_type(col_samples))

    table_name = clean_name(os.path.splitext(os.path.basename(filename))[0])
    if not table_name:
        table_name = "data_table"

    cur = conn.cursor()
    col_defs = ", ".join([f'"{h}" {t}' for h, t in zip(headers, col_types)])
    cur.execute(f'DROP TABLE IF EXISTS "{table_name}";')
    cur.execute(f'CREATE TABLE "{table_name}" ({col_defs});')

    placeholders = ", ".join(["?"] * len(headers))
    insert_sql = f'INSERT INTO "{table_name}" VALUES ({placeholders});'
    batch = []
    for row in chain(sample_rows, reader):
        padded = list(row) + [""] * max(0, len(headers) - len(row))
        batch.append(padded[:len(headers)])
        if len(batch) >= 500:
            cur.executemany(insert_sql, batch)
            batch.clear()
    if batch:
        cur.executemany(insert_sql, batch)
    conn.commit()

    return table_name


def clean_sql_for_sqlite(sql_text: str) -> str:
    """
    Cleans SQL script (including MSSQL/MySQL dumps or backups)
    to be executable in SQLite.
    """
    # Remove GO statement separators commonly found in MSSQL .bak or .sql scripts
    lines = []
    for line in sql_text.splitlines():
        trimmed = line.strip()
        if re.match(r"^GO\s*$", trimmed, re.IGNORECASE):
            continue
        if re.match(r"^USE\s+\[?[\w]+\]?\s*;?$", trimmed, re.IGNORECASE):
            continue
        if re.match(r"^SET\s+(ANSI_NULLS|QUOTED_IDENTIFIER|NOCOUNT)\s+(ON|OFF)\s*;?$", trimmed, re.IGNORECASE):
            continue
        lines.append(line)
    
    cleaned = "\n".join(lines)

    # Convert MSSQL bracket identifiers [table] -> "table"
    cleaned = re.sub(r"\[([a-zA-Z0-9_]+)\]", r'"\1"', cleaned)
    # Convert N'...' unicode string literals to '...'
    cleaned = re.sub(r"N'([^']*)'", r"'\1'", cleaned)
    # Convert IDENTITY(x,y) to AUTOINCREMENT
    cleaned = re.sub(r"IDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)", "PRIMARY KEY AUTOINCREMENT", cleaned, flags=re.IGNORECASE)
    # Remove dbo. prefix
    cleaned = re.sub(r'"?dbo"?\.', '', cleaned, flags=re.IGNORECASE)

    return cleaned


def import_sql_script_to_sqlite(sql_content: str, conn: sqlite3.Connection) -> None:
    """Executes a SQL script into an in-memory SQLite connection."""
    cleaned = clean_sql_for_sqlite(sql_content)
    if re.search(r"\bVACUUM\s+INTO\b", cleaned, flags=re.IGNORECASE):
        raise ValueError("VACUUM INTO is not allowed in uploaded SQL because it can create files outside temporary storage.")

    def restrict_external_files(action: int, arg1: str, arg2: str, database: str, trigger: str) -> int:
        if action in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH):
            return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_FUNCTION and (arg2 or arg1 or "").lower() == "load_extension":
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK

    conn.set_authorizer(restrict_external_files)
    try:
        conn.executescript(cleaned)
        conn.commit()
    except Exception as e:
        # If executescript fails due to multiple statements or engine quirks, try line by line
        conn.rollback()
        # Fallback: split on semicolons
        statements = [s.strip() for s in cleaned.split(";") if s.strip()]
        for stmt in statements:
            try:
                conn.execute(stmt)
            except Exception:
                # ignore non-fatal dialect statements
                pass
        conn.commit()
    finally:
        conn.set_authorizer(None)


def _decode_sql_file(path: str, filename: str) -> str:
    with open(path, "rb") as source:
        raw = source.read(MAX_DECOMPRESSED_SQL_BYTES + 1)
    if len(raw) > MAX_DECOMPRESSED_SQL_BYTES:
        raise UploadLimitError(f"Expanded SQL exceeds the {MAX_DECOMPRESSED_SQL_BYTES // (1024 * 1024)} MB processing limit.")
    for encoding in ("utf-8-sig", "utf-8", "utf-16", "cp1252", "latin-1"):
        try:
            text = raw.decode(encoding)
            if "\x00" in text:
                raise ValueError(f"'{filename}' appears to be a binary backup. Only SQL text dumps are supported.")
            return text
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Could not decode {filename} text content.")


def _copy_upload_to_path(upload: BinaryIO, path: str) -> int:
    upload.seek(0)
    total = 0
    with open(path, "wb") as destination:
        while chunk := upload.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_UPLOAD_BYTES:
                raise UploadLimitError(f"Upload exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.")
            destination.write(chunk)
    return total


def _decompress_gzip_to_path(source_path: str, destination_path: str) -> None:
    total = 0
    try:
        with gzip.open(source_path, "rb") as source, open(destination_path, "wb") as destination:
            while chunk := source.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_DECOMPRESSED_SQL_BYTES:
                    raise UploadLimitError(
                        f"Expanded SQL exceeds the {MAX_DECOMPRESSED_SQL_BYTES // (1024 * 1024)} MB processing limit."
                    )
                destination.write(chunk)
    except (OSError, EOFError) as error:
        raise ValueError(f"Failed to decompress .sql.gz file: {error}") from error


def process_uploaded_database(
    file_bytes: Union[bytes, BinaryIO],
    filename: str,
    custom_name: Optional[str] = None
) -> Dict[str, Any]:
    """Import supported uploads into session-only SQLite memory; stage non-tabular files temporarily."""
    lower_name = (filename or "").lower()
    allowed = [".sql", ".sqlite", ".db", ".dump", ".csv", ".tsv", ".bak", ".sql.gz"]
    if not any(lower_name.endswith(ext) for ext in allowed):
        raise ValueError(f"Unsupported file format '{filename}'. Allowed formats: {', '.join(allowed)}")

    upload = io.BytesIO(file_bytes) if isinstance(file_bytes, bytes) else file_bytes
    upload.seek(0)
    start_position = upload.tell()
    upload.seek(0, os.SEEK_END)
    upload_size = upload.tell()
    upload.seek(start_position)
    if upload_size > MAX_UPLOAD_BYTES:
        raise UploadLimitError(f"Upload exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.")

    is_csv = lower_name.endswith(".csv")
    is_tsv = lower_name.endswith(".tsv")
    if (is_csv or is_tsv) and upload_size > MAX_IN_MEMORY_TABLE_UPLOAD_BYTES:
        raise UploadLimitError(
            f"CSV/TSV uploads are limited to {MAX_IN_MEMORY_TABLE_UPLOAD_BYTES // (1024 * 1024)} MB for in-memory processing."
        )

    conn_id = f"upload_{uuid.uuid4().hex[:8]}"
    display_name = custom_name.strip() if custom_name and custom_name.strip() else filename
    memory_conn = sqlite3.connect(":memory:")
    adapter_registered = False

    try:
        if is_csv or is_tsv:
            file_content = upload.read(MAX_IN_MEMORY_TABLE_UPLOAD_BYTES + 1)
            if len(file_content) > MAX_IN_MEMORY_TABLE_UPLOAD_BYTES:
                raise UploadLimitError(
                    f"CSV/TSV uploads are limited to {MAX_IN_MEMORY_TABLE_UPLOAD_BYTES // (1024 * 1024)} MB for in-memory processing."
                )
            import_csv_tsv_to_sqlite(file_content, filename, memory_conn, is_tsv=is_tsv)
        else:
            with tempfile.TemporaryDirectory(prefix="ai_sql_upload_") as temp_dir:
                staged_path = os.path.join(temp_dir, os.path.basename(filename))
                _copy_upload_to_path(upload, staged_path)

                if lower_name.endswith(".sqlite") or lower_name.endswith(".db"):
                    try:
                        source_uri = f"{Path(staged_path).resolve().as_uri()}?mode=ro"
                        source_conn = sqlite3.connect(source_uri, uri=True)
                        try:
                            source_conn.execute("SELECT count(*) FROM sqlite_master;")
                            source_conn.backup(memory_conn)
                        finally:
                            source_conn.close()
                    except sqlite3.Error as error:
                        raise ValueError(f"Uploaded file '{filename}' is not a valid SQLite database: {error}") from error
                else:
                    sql_path = staged_path
                    if lower_name.endswith(".sql.gz"):
                        sql_path = os.path.join(temp_dir, "expanded_upload.sql")
                        _decompress_gzip_to_path(staged_path, sql_path)
                    sql_text = _decode_sql_file(sql_path, filename)
                    import_sql_script_to_sqlite(sql_text, memory_conn)

        adapter = db_manager.register_sqlite_from_connection(conn_id, display_name, memory_conn)
        adapter_registered = True
        schema = db_manager.get_schema(conn_id, force_refresh=True)
        table_names = list(schema.tables.keys())
        return {
            "connection_id": conn_id,
            "name": display_name,
            "dialect": "sqlite",
            "is_demo": False,
            "storage": "in-memory",
            "tables": table_names,
            "table_count": len(table_names),
            "total_rows": sum(table.row_count for table in schema.tables.values())
        }
    except Exception:
        if adapter_registered:
            db_manager.remove_connection(conn_id)
        raise
    finally:
        memory_conn.close()
