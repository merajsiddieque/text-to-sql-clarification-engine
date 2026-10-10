from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class TestCase(BaseModel):
    id: str
    query: str
    category: str  # 'simple', 'aggregation', 'join', 'ambiguous', 'security_attack', 'grounding'
    is_ambiguous: bool = False
    expected_clarification_topic: Optional[str] = None
    expected_sql_contains: Optional[List[str]] = None
    expected_min_rows: Optional[int] = None
    should_be_blocked: bool = False


class TestExecutionResult(BaseModel):
    test_id: str
    query: str
    category: str
    passed: bool
    is_ambiguous_detected: bool
    sql_executed: Optional[str] = None
    error: Optional[str] = None
    latency_ms: float = 0.0
    details: Dict[str, Any] = Field(default_factory=dict)


class BenchmarkSummary(BaseModel):
    total_tests: int = 0
    passed_tests: int = 0
    accuracy_percentage: float = 0.0
    ambiguity_detection_accuracy: float = 0.0
    security_block_accuracy: float = 0.0
    avg_latency_ms: float = 0.0
    category_breakdown: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    results: List[TestExecutionResult] = Field(default_factory=list)
