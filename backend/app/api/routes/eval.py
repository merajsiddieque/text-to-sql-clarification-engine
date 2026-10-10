from fastapi import APIRouter
from app.eval.benchmark import eval_harness
from app.eval.models import BenchmarkSummary

router = APIRouter(prefix="/eval", tags=["evaluation"])


@router.get("/benchmark", response_model=BenchmarkSummary)
def run_benchmark():
    """Executes the full evaluation suite and returns metrics."""
    return eval_harness.run_benchmark()
