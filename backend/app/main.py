from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import connections, schema, query, eval

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production Text-to-SQL API with LangGraph Clarification Engine, SQLGlot Validation, and Evaluation Harness",
    version="1.0.0"
)

# CORS Middleware (supports React frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Sub-Routers
app.include_router(connections.router, prefix=settings.API_V1_STR)
app.include_router(schema.router, prefix=settings.API_V1_STR)
app.include_router(query.router, prefix=settings.API_V1_STR)
app.include_router(eval.router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "docs_url": "/docs"
    }


@app.get("/health")
def healthcheck():
    return {"status": "healthy"}
