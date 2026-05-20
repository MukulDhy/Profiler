import pytest
import asyncio
from unittest.mock import patch, MagicMock
from services.chunker import ResumeChunker
from services.embedder import embedder
from services.vector_store import vector_store
from services.intelligence import intelligence_engine
from services.rag import rag_pipeline
from models.schemas import ResumeChunk

DUMMY_RESUME = {
    "candidate_id": "user_001",
    "personal": {"name": "Aryan Sharma"},
    "summary": "Experienced dev",
    "experience": [{"role": "Intern", "company": "Tech", "duration": "3 mos", "description": "Dev"}],
    "projects": [{"name": "P1", "description": "D1", "tech_stack": ["Python"]}],
    "skills": {"backend": ["Python"]}
}

def test_chunker():
    chunks = ResumeChunker.chunk_resume("user_001", DUMMY_RESUME)
    assert len(chunks) > 0
    assert chunks[0].section == "summary"
    assert chunks[0].content == "Experienced dev"
    for c in chunks:
        assert c.chunk_id.startswith("user_001")
        assert len(c.content) > 0

@pytest.mark.asyncio
async def test_embedder():
    chunks = [ResumeChunk(chunk_id="1", section="summary", content="test", metadata={})]
    emb_chunks = await embedder.embed_chunks(chunks)
    assert len(emb_chunks) == 1
    assert len(emb_chunks[0].embedding) == 384
    import numpy as np
    norm = np.linalg.norm(emb_chunks[0].embedding)
    assert abs(norm - 1.0) < 1e-5

@pytest.mark.asyncio
async def test_vector_store():
    chunks = [ResumeChunk(chunk_id="1", section="summary", content="test", metadata={})]
    emb_chunks = await embedder.embed_chunks(chunks)
    await vector_store.build_index("user_test", emb_chunks)
    
    q_emb = await embedder.embed_query("test")
    res = await vector_store.search("user_test", q_emb, top_k=1)
    assert len(res) == 1
    assert res[0].chunk_id == "1"

@pytest.mark.asyncio
@patch("services.intelligence.IntelligenceEngine._call_llm")
async def test_intelligence(mock_call_llm):
    mock_call_llm.side_effect = [
        {"summary_text": "Good", "strengths": [], "growth_areas": [], "recruiter_impression": "Yes"},
        {"recruiter_fit": 95, "label": "Backend"}
    ]
    dash = await intelligence_engine.generate_dashboard(DUMMY_RESUME)
    assert dash.quick_stats.recruiter_fit.value == 95
    assert dash.neural_summary.summary_text == "Good"
    assert dash.ats_analysis.score >= 0

@pytest.mark.asyncio
@patch("openai.resources.chat.completions.AsyncCompletions.create")
async def test_rag(mock_create):
    async def mock_create_async(*args, **kwargs):
        class MockChoice:
            message = MagicMock(content='{"answer": "A", "key_points": ["1"], "recommendation": "R"}')
        class MockResponse:
            choices = [MockChoice()]
        return MockResponse()
        
    mock_create.side_effect = mock_create_async
    
    with patch("services.vector_store.FAISSVectorStore.search") as mock_search:
        from models.schemas import SearchResult
        mock_search.return_value = [SearchResult(chunk_id="1", section="summary", content="A", metadata={}, score=0.9)]
        
        res = await rag_pipeline.query("user_test", "question")
        assert res["rag_response"].answer == "A"
        assert res["rag_response"].confidence_hint == "high"
