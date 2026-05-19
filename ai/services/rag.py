import json
import time
from typing import Dict, Any
from openai import AsyncOpenAI
from config.settings import settings
from utils.logger import logger
from models.schemas import RAGResponse
from services.vector_store import vector_store
from services.embedder import embedder

class RAGPipeline:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.LLM_MODEL
        self.system_prompt = """You are the AI profile system for a professional candidate. You act as an intelligent recruiter assistant that has deeply studied this candidate's resume, projects, and experience.

When a recruiter asks you a question:
- Answer using ONLY the provided resume context chunks
- Be specific and cite evidence (project names, companies, metrics)
- Write as if you are presenting the candidate to a hiring manager
- Never invent, hallucinate, or assume skills not present in context
- Keep answers professional, concise, and recruiter-friendly

You MUST respond with ONLY valid JSON in this exact format:
{
  "answer": "Full conversational answer here",
  "key_points": ["point 1", "point 2", "point 3"],
  "recommendation": "One sentence recruiter verdict"
}

Do not include any text outside the JSON object. No preamble. No markdown fences."""

    def _strip_json(self, content: str) -> str:
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        return content.strip()

    async def query(self, candidate_id: str, question: str, top_k: int = 5) -> Dict[str, Any]:
        start_time = time.time()
        
        query_embedding = await embedder.embed_query(question)
        search_results = await vector_store.search(candidate_id, query_embedding, top_k)
        
        if not search_results:
            return {"rag_response": None, "latency_ms": int((time.time() - start_time) * 1000)}

        context_parts = []
        sources = []
        section_hits = set()
        highest_score = 0.0

        for res in search_results:
            context_parts.append(f"Section: {res.section}\nContent: {res.content}")
            sources.append(res.chunk_id)
            section_hit = res.section.split('_')[0]
            section_hits.add(section_hit)
            if res.score > highest_score:
                highest_score = res.score
                
        context_str = "\n\n".join(context_parts)
        user_prompt = f"Context:\n{context_str}\n\nQuestion: {question}"

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            )
            content = response.choices[0].message.content
            cleaned = self._strip_json(content)
            result_json = json.loads(cleaned)
        except Exception as e:
            logger.error(f"RAG LLM Call failed: {str(e)}")
            result_json = {
                "answer": "I am currently unable to answer that question based on the provided context.",
                "key_points": [],
                "recommendation": "Unable to provide a recommendation."
            }

        confidence_hint = "low"
        if highest_score > 0.75:
            confidence_hint = "high"
        elif highest_score >= 0.5:
            confidence_hint = "medium"

        rag_response = RAGResponse(
            answer=result_json.get("answer", ""),
            key_points=result_json.get("key_points", []),
            recommendation=result_json.get("recommendation", ""),
            sources=sources,
            section_hits=list(section_hits),
            confidence_hint=confidence_hint
        )
        
        latency_ms = int((time.time() - start_time) * 1000)
        return {"rag_response": rag_response, "latency_ms": latency_ms}

rag_pipeline = RAGPipeline()
