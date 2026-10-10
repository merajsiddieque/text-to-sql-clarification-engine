from typing import List, Dict, Any, Optional
from typing_extensions import TypedDict
from app.validator.sql_validator import SQLValidationResult
from app.db.adapters.base import QueryResult


class ClarificationOption(TypedDict):
    id: str
    label: str
    description: str


class TextToSQLState(TypedDict, total=False):
    # Inputs
    natural_query: str
    connection_id: str
    conversation_history: List[Dict[str, str]]
    schema_context: str
    dialect: str
    
    # Ambiguity & Clarification
    is_ambiguous: bool
    ambiguity_reason: Optional[str]
    clarification_question: Optional[str]
    clarification_options: List[Dict[str, Any]]
    selected_clarification: Optional[str]

    # Generation & Validation
    generated_sql: Optional[str]
    sanitized_sql: Optional[str]
    validation_result: Optional[Dict[str, Any]]
    validation_errors: List[str]
    retry_count: int
    max_retries: int

    # Execution & Results
    execution_result: Optional[Dict[str, Any]]
    execution_error: Optional[str]
    summary: Optional[str]
    visualization_type: Optional[str]  # 'table', 'bar', 'line', 'pie', 'metric'
    
    # Workflow status
    status: str  # 'needs_clarification', 'executing', 'success', 'failed'
    status_message: Optional[str]
