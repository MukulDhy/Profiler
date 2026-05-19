import json
import asyncio
from typing import Dict, Any, List
from openai import AsyncOpenAI
from config.settings import settings
from utils.logger import logger
from models.schemas import (
    DashboardIntelligence, QuickStats, NeuralSummary, ATSAnalysis,
    ProfileContext, ProfileContextQuickStats, ATSScore, ExperienceStat,
    ProjectsStat, RecruiterFitStat, KeywordMatch
)

class IntelligenceEngine:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.LLM_MODEL
        
        self.keyword_list = [
            "REST API", "GraphQL", "Docker", "Kubernetes", "CI/CD", "AWS", "GCP", "Azure", 
            "PostgreSQL", "MongoDB", "Redis", "React", "Node.js", "Python", "TypeScript", 
            "Git", "Agile", "Microservices", "System Design", "Distributed Systems", 
            "Machine Learning", "Deep Learning", "LLM", "RAG", "Vector Database", "FastAPI", 
            "Express", "Next.js", "TailwindCSS", "Linux", "Nginx", "Load Balancing", "OAuth", 
            "JWT", "WebSockets", "gRPC", "Rust", "Go", "Java", "Spring Boot", "Terraform", 
            "Prometheus", "Grafana", "Kafka", "ElasticSearch"
        ]

    def _strip_json(self, content: str) -> str:
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        return content.strip()

    async def _call_llm(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            )
            content = response.choices[0].message.content
            cleaned = self._strip_json(content)
            return json.loads(cleaned)
        except Exception as e:
            logger.error(f"LLM Call failed: {str(e)}")
            return {}

    def _compute_ats_analysis(self, resume_data: Dict[str, Any]) -> ATSAnalysis:
        resume_str = json.dumps(resume_data).lower()
        matched = sum(1 for kw in self.keyword_list if kw.lower() in resume_str)
        total = len(self.keyword_list)
        
        score = (matched / total) * 100 if total > 0 else 0
        missing = [kw for kw in self.keyword_list if kw.lower() not in resume_str][:5]
        
        return ATSAnalysis(
            score=round(score, 1),
            keyword_match=KeywordMatch(matched=matched, total=total),
            formatting="Pass",
            missing_keywords=missing
        )

    async def _generate_neural_summary(self, resume_str: str) -> NeuralSummary:
        sys_prompt = "You are an expert tech recruiter. Analyze the candidate's resume. You MUST reply with valid JSON only, using exactly this schema: {\"summary_text\": \"1-2 sentence professional summary\", \"strengths\": [\"str 1\", \"str 2\", \"str 3\"], \"growth_areas\": [\"str 1\", \"str 2\"], \"recruiter_impression\": \"1-2 sentence verdict\"}. No markdown fences."
        result = await self._call_llm(sys_prompt, f"Resume: {resume_str}")
        return NeuralSummary(
            summary_text=result.get("summary_text", "Strong candidate."),
            strengths=result.get("strengths", ["Software Engineering"]),
            growth_areas=result.get("growth_areas", ["More experience needed"]),
            recruiter_impression=result.get("recruiter_impression", "Solid hire.")
        )

    async def _generate_quick_stats(self, resume_data: Dict[str, Any], ats_score_val: float) -> QuickStats:
        sys_prompt = "You are an expert tech recruiter. Given the resume, compute the overall recruiter fit score (0-100) and top matching role category. MUST return valid JSON: {\"recruiter_fit\": 90, \"label\": \"Backend roles\"}. No markdown fences."
        resume_str = json.dumps(resume_data)
        result = await self._call_llm(sys_prompt, f"Resume: {resume_str}")
        
        fit_val = float(result.get("recruiter_fit", 80))
        fit_label = result.get("label", "Software Engineer")
        
        ats_label = "Optimized" if ats_score_val >= 85 else "Good" if ats_score_val >= 70 else "Needs Work"
        
        exp_list = resume_data.get("experience", [])
        total_years = len(exp_list) * 1.5 
        if total_years >= 7:
            years_val = f"{int(total_years)}+"
            years_label = "Senior tier"
        elif total_years >= 3:
            years_val = f"{int(total_years)}+"
            years_label = "Mid tier"
        else:
            years_val = "1+" if total_years > 0 else "0"
            years_label = "Junior tier"
            
        proj_list = resume_data.get("projects", [])
        proj_count = len(proj_list)
        has_impact = any("impact" in p for p in proj_list)
        proj_label = "Production-grade" if has_impact else "Academic"

        return QuickStats(
            ats_score=ATSScore(value=round(ats_score_val, 1), label=ats_label, unit="%"),
            experience=ExperienceStat(value=years_val, label=years_label, unit="yrs"),
            projects=ProjectsStat(value=proj_count, label=proj_label, unit=None),
            recruiter_fit=RecruiterFitStat(value=round(fit_val, 1), label=fit_label, unit="%")
        )

    async def _generate_suggested_questions(self, resume_data: Dict[str, Any], top_role: str) -> List[str]:
        questions = []
        
        proj_list = resume_data.get("projects", [])
        for p in proj_list:
            if "name" in p:
                questions.append(f"Explain the {p['name']} project")
                break
                
        name = resume_data.get("personal", {}).get("name", "the candidate").split()[0]
        questions.append(f"What are {name}'s strongest backend skills?")
        
        if resume_data.get("experience"):
            questions.append("Summarize internship experience")
            
        questions.append(f"Is {name} suitable for a {top_role} role?")
        questions.append("Which project is most impressive?")
        
        final_qs = []
        for q in questions:
            if q not in final_qs:
                final_qs.append(q)
        return final_qs[:6]

    async def generate_dashboard(self, resume_data: Dict[str, Any]) -> DashboardIntelligence:
        resume_str = json.dumps(resume_data)
        
        ats_analysis = self._compute_ats_analysis(resume_data)
        
        neural_summary_task = self._generate_neural_summary(resume_str)
        quick_stats_task = self._generate_quick_stats(resume_data, ats_analysis.score)
        
        neural_summary, quick_stats = await asyncio.gather(neural_summary_task, quick_stats_task)
        
        suggested_questions = await self._generate_suggested_questions(resume_data, quick_stats.recruiter_fit.label)
        
        profile_context = ProfileContext(
            name=resume_data.get("personal", {}).get("name", "Unknown"),
            role=resume_data.get("experience", [{}])[0].get("role", "Candidate") if resume_data.get("experience") else "Candidate",
            location=resume_data.get("personal", {}).get("location", "Unknown"),
            quick_stats=ProfileContextQuickStats(
                ats=quick_stats.ats_score.value,
                years=quick_stats.experience.value,
                projects=quick_stats.projects.value,
                fit=quick_stats.recruiter_fit.value
            )
        )
        
        return DashboardIntelligence(
            quick_stats=quick_stats,
            neural_summary=neural_summary,
            ats_analysis=ats_analysis,
            profile_context=profile_context,
            suggested_questions=suggested_questions
        )

intelligence_engine = IntelligenceEngine()
