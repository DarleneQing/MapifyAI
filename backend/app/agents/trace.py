import time
from app.models.schemas import TraceStep, AgentTrace


def make_trace(request_id: str) -> dict:
    return AgentTrace(request_id=request_id, steps=[]).model_dump()


def add_step(trace: dict, agent: str, input_data: dict, output_data: dict, start_ms: float) -> dict:
    duration = int((time.time() * 1000) - start_ms)
    step = TraceStep(
        agent=agent,
        input=input_data,
        output=output_data,
        duration_ms=duration,
    )
    trace["steps"].append(step.model_dump())
    return trace
