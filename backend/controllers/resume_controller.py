import os
import json
from typing import Any, Dict, List
from models.schemas import IngestRequest, IngestResponse, QueryRequest, QueryResponse
from services.chunker import ResumeChunker
from services.embedder import embedder
from services.vector_store import vector_store
from services.intelligence import intelligence_engine
from services.rag import rag_pipeline
from config.settings import settings

class ResumeController:
    async def ingest(self, request: IngestRequest) -> IngestResponse:
        candidate_id = request.candidate_id
        resume_data = request.resume_data
        
        chunks = ResumeChunker.chunk_resume(candidate_id, resume_data)
        embedded_chunks = await embedder.embed_chunks(chunks)
        
        await vector_store.build_index(candidate_id, embedded_chunks)
        
        dashboard = await intelligence_engine.generate_dashboard(resume_data)
        
        candidate_dir = os.path.join(settings.FAISS_STORE_PATH, candidate_id)
        os.makedirs(candidate_dir, exist_ok=True)
        dashboard_path = os.path.join(candidate_dir, "dashboard.json")
        with open(dashboard_path, "w") as f:
            f.write(dashboard.model_dump_json())
            
        return IngestResponse(
            candidate_id=candidate_id,
            status="success",
            chunks_created=len(chunks),
            message="Resume indexed and intelligence generated successfully.",
            dashboard=dashboard
        )

    async def query(self, request: QueryRequest) -> QueryResponse:
        result = await rag_pipeline.query(request.candidate_id, request.question, request.top_k)
        if not result.get("rag_response"):
            raise ValueError(f"No index found for {request.candidate_id}")
            
        return QueryResponse(
            candidate_id=request.candidate_id,
            question=request.question,
            rag_response=result["rag_response"],
            latency_ms=result["latency_ms"]
        )

    def get_dashboard(self, candidate_id: str) -> Dict[str, Any]:
        dashboard_path = os.path.join(settings.FAISS_STORE_PATH, candidate_id, "dashboard.json")
        if not os.path.exists(dashboard_path):
            return None
        with open(dashboard_path, "r") as f:
            return json.load(f)
            
    def get_chunks(self, candidate_id: str) -> List[Dict[str, Any]]:
        metadata_path = os.path.join(settings.FAISS_STORE_PATH, candidate_id, "metadata.pkl")
        if not os.path.exists(metadata_path):
            return None
        import pickle
        with open(metadata_path, "rb") as f:
            return pickle.load(f)

resume_controller = ResumeController()
