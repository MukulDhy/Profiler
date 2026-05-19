from fastapi import APIRouter
from fastapi.responses import JSONResponse
from models.schemas import IngestRequest, IngestResponse, QueryRequest, QueryResponse
from controllers.resume_controller import resume_controller

router = APIRouter(prefix="/api/v1/resume", tags=["resume"])

@router.post("/ingest", response_model=IngestResponse)
async def ingest_resume(request: IngestRequest):
    try:
        return await resume_controller.ingest(request)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": True, "message": str(e), "code": "INGEST_FAILED"}
        )

@router.post("/query", response_model=QueryResponse)
async def query_resume(request: QueryRequest):
    try:
        return await resume_controller.query(request)
    except ValueError as ve:
        return JSONResponse(
            status_code=404,
            content={"error": True, "message": str(ve), "code": "INDEX_NOT_FOUND"}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": True, "message": str(e), "code": "QUERY_FAILED"}
        )

@router.get("/dashboard/{candidate_id}")
async def get_dashboard(candidate_id: str):
    dashboard = resume_controller.get_dashboard(candidate_id)
    if not dashboard:
        return JSONResponse(
            status_code=404,
            content={
                "error": True,
                "message": "No profile found for this candidate. Please ingest first.",
                "code": "PROFILE_NOT_FOUND"
            }
        )
    return dashboard

@router.get("/chunks/{candidate_id}")
async def get_chunks(candidate_id: str):
    chunks = resume_controller.get_chunks(candidate_id)
    if not chunks:
        return JSONResponse(
            status_code=404,
            content={
                "error": True,
                "message": "No chunks found for this candidate.",
                "code": "CHUNKS_NOT_FOUND"
            }
        )
    return chunks
