from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class ResumeChunk(BaseModel):
    chunk_id: str
    section: str
    content: str
    metadata: Dict[str, Any]

class EmbeddedChunk(ResumeChunk):
    embedding: List[float]

class SearchResult(ResumeChunk):
    score: float

class RAGResponse(BaseModel):
    answer: str
    key_points: List[str]
    recommendation: str
    sources: List[str]
    section_hits: List[str]
    confidence_hint: str

class ATSScore(BaseModel):
    value: float
    label: str
    unit: Optional[str] = None

class ExperienceStat(BaseModel):
    value: str
    label: str
    unit: Optional[str] = None

class ProjectsStat(BaseModel):
    value: int
    label: str
    unit: Optional[str] = None

class RecruiterFitStat(BaseModel):
    value: float
    label: str
    unit: Optional[str] = None

class QuickStats(BaseModel):
    ats_score: ATSScore
    experience: ExperienceStat
    projects: ProjectsStat
    recruiter_fit: RecruiterFitStat

class NeuralSummary(BaseModel):
    summary_text: str
    strengths: List[str]
    growth_areas: List[str]
    recruiter_impression: str

class KeywordMatch(BaseModel):
    matched: int
    total: int

class ATSAnalysis(BaseModel):
    score: float
    keyword_match: KeywordMatch
    formatting: str
    missing_keywords: List[str]

class ProfileContextQuickStats(BaseModel):
    ats: float
    years: str
    projects: int
    fit: float

class ProfileContext(BaseModel):
    name: str
    role: str
    location: str
    quick_stats: ProfileContextQuickStats

class DashboardIntelligence(BaseModel):
    quick_stats: QuickStats
    neural_summary: NeuralSummary
    ats_analysis: ATSAnalysis
    profile_context: ProfileContext
    suggested_questions: List[str]

class IngestRequest(BaseModel):
    candidate_id: str
    resume_data: Dict[str, Any]

class IngestResponse(BaseModel):
    candidate_id: str
    status: str
    chunks_created: int
    message: str
    dashboard: DashboardIntelligence

class QueryRequest(BaseModel):
    candidate_id: str
    question: str
    top_k: int = 5

class QueryResponse(BaseModel):
    candidate_id: str
    question: str
    rag_response: RAGResponse
    latency_ms: int
