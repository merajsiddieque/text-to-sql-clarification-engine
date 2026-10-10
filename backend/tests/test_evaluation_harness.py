from app.eval.benchmark import eval_harness


def test_full_evaluation_benchmark_suite():
    summary = eval_harness.run_benchmark()
    assert summary.total_tests >= 10
    assert summary.accuracy_percentage >= 80.0
    assert summary.ambiguity_detection_accuracy == 100.0
    assert summary.security_block_accuracy == 100.0
    assert summary.avg_latency_ms > 0.0
    print(f"\nBenchmark Summary: Passed {summary.passed_tests}/{summary.total_tests} ({summary.accuracy_percentage}%)")
