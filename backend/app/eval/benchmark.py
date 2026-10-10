import time
from typing import List, Optional
from app.eval.models import TestCase, TestExecutionResult, BenchmarkSummary
from app.eval.dataset import GOLDEN_EVALUATION_DATASET
from app.agent.graph import text_to_sql_agent
from app.validator.sql_validator import SQLValidator
from app.db.manager import db_manager


class EvaluationHarness:
    """
    Automated evaluation harness for Text-to-SQL accuracy, ambiguity detection,
    security defense, and latency benchmarking.
    """

    def __init__(self, connection_id: str = "demo-ecommerce"):
        self.connection_id = connection_id
        self.schema = db_manager.get_schema(connection_id)
        self.dialect = db_manager.get_adapter(connection_id).dialect

    def run_single_test(self, test: TestCase) -> TestExecutionResult:
        start_time = time.perf_counter()

        # For security attack and grounding tests, test SQL validation directly
        if test.category in ("security_attack", "grounding") or test.should_be_blocked:
            val_res = SQLValidator.validate_and_sanitize(
                sql=test.query,
                dialect=self.dialect,
                schema=self.schema
            )
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            
            # The test passes if the query was blocked as expected
            passed = not val_res.is_valid
            return TestExecutionResult(
                test_id=test.id,
                query=test.query,
                category=test.category,
                passed=passed,
                is_ambiguous_detected=False,
                sql_executed=None,
                error="; ".join(val_res.errors) if not val_res.is_valid else None,
                latency_ms=round(duration_ms, 2),
                details={"blocked_as_expected": passed, "errors": val_res.errors}
            )

        # For natural language questions (simple, aggregation, join, ambiguous)
        schema_context = self.schema.to_prompt_context(include_samples=True)
        initial_state = {
            "natural_query": test.query,
            "connection_id": self.connection_id,
            "schema_context": schema_context,
            "dialect": self.dialect,
            "retry_count": 0,
            "max_retries": 2
        }

        try:
            final_state = text_to_sql_agent.invoke(initial_state)
            duration_ms = (time.perf_counter() - start_time) * 1000.0

            is_ambiguous_detected = final_state.get("is_ambiguous", False)
            status = final_state.get("status")

            if test.is_ambiguous:
                # Ambiguous test case: passed if system detected ambiguity and generated clarification options
                has_options = bool(final_state.get("clarification_options"))
                passed = is_ambiguous_detected and has_options
                return TestExecutionResult(
                    test_id=test.id,
                    query=test.query,
                    category=test.category,
                    passed=passed,
                    is_ambiguous_detected=is_ambiguous_detected,
                    latency_ms=round(duration_ms, 2),
                    details={
                        "clarification_question": final_state.get("clarification_question"),
                        "options_count": len(final_state.get("clarification_options", []))
                    }
                )
            else:
                # Unambiguous query: passed if generated valid SQL, executed without error, and returned rows
                exec_result = final_state.get("execution_result") or {}
                rows = exec_result.get("rows", [])
                sql = final_state.get("sanitized_sql") or final_state.get("generated_sql")

                has_no_error = not bool(final_state.get("execution_error"))
                min_rows_met = len(rows) >= (test.expected_min_rows or 0)
                passed = (status == "success") and has_no_error and min_rows_met

                return TestExecutionResult(
                    test_id=test.id,
                    query=test.query,
                    category=test.category,
                    passed=passed,
                    is_ambiguous_detected=is_ambiguous_detected,
                    sql_executed=sql,
                    error=final_state.get("execution_error"),
                    latency_ms=round(duration_ms, 2),
                    details={
                        "returned_rows": len(rows),
                        "summary": final_state.get("summary"),
                        "vis_type": final_state.get("visualization_type")
                    }
                )
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            return TestExecutionResult(
                test_id=test.id,
                query=test.query,
                category=test.category,
                passed=False,
                is_ambiguous_detected=False,
                error=str(e),
                latency_ms=round(duration_ms, 2)
            )

    def run_benchmark(self, dataset: Optional[List[TestCase]] = None) -> BenchmarkSummary:
        tests_to_run = dataset or GOLDEN_EVALUATION_DATASET
        results: List[TestExecutionResult] = []

        total = len(tests_to_run)
        passed_count = 0
        total_latency = 0.0

        ambiguity_tests = [t for t in tests_to_run if t.category == "ambiguous"]
        ambiguity_passed = 0

        security_tests = [t for t in tests_to_run if t.category in ("security_attack", "grounding")]
        security_passed = 0

        category_stats = {}

        for test in tests_to_run:
            res = self.run_single_test(test)
            results.append(res)
            total_latency += res.latency_ms

            if res.passed:
                passed_count += 1

            if test.category == "ambiguous" and res.passed:
                ambiguity_passed += 1

            if test.category in ("security_attack", "grounding") and res.passed:
                security_passed += 1

            cat = test.category
            if cat not in category_stats:
                category_stats[cat] = {"total": 0, "passed": 0}
            category_stats[cat]["total"] += 1
            if res.passed:
                category_stats[cat]["passed"] += 1

        for cat, stats in category_stats.items():
            stats["accuracy_pct"] = round((stats["passed"] / stats["total"]) * 100.0, 1) if stats["total"] > 0 else 0.0

        return BenchmarkSummary(
            total_tests=total,
            passed_tests=passed_count,
            accuracy_percentage=round((passed_count / total) * 100.0, 1) if total > 0 else 0.0,
            ambiguity_detection_accuracy=round((ambiguity_passed / len(ambiguity_tests)) * 100.0, 1) if ambiguity_tests else 100.0,
            security_block_accuracy=round((security_passed / len(security_tests)) * 100.0, 1) if security_tests else 100.0,
            avg_latency_ms=round(total_latency / total, 1) if total > 0 else 0.0,
            category_breakdown=category_stats,
            results=results
        )


eval_harness = EvaluationHarness()
