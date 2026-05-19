from typing import List, Dict, Any
from models.schemas import ResumeChunk
from utils.logger import logger

class ResumeChunker:
    @staticmethod
    def chunk_resume(candidate_id: str, resume_data: Dict[str, Any]) -> List[ResumeChunk]:
        chunks = []
        
        if "summary" in resume_data:
            chunks.append(ResumeChunk(
                chunk_id=f"{candidate_id}_summary_0",
                section="summary",
                content=resume_data["summary"],
                metadata={"candidate_id": candidate_id}
            ))

        if "skills" in resume_data:
            skills = resume_data["skills"]
            for skill_type, skill_list in skills.items():
                if skill_list:
                    prefix = ""
                    if skill_type == "languages": prefix = "Programming languages"
                    elif skill_type == "frontend": prefix = "Frontend technologies"
                    elif skill_type == "backend": prefix = "Backend technologies"
                    elif skill_type == "ai_ml": prefix = "AI/ML stack"
                    elif skill_type == "databases": prefix = "Databases"
                    elif skill_type == "devops": prefix = "DevOps/Cloud"
                    else: prefix = skill_type.capitalize()
                    
                    chunks.append(ResumeChunk(
                        chunk_id=f"{candidate_id}_skills_{skill_type}",
                        section=f"skills_{skill_type}",
                        content=f"{prefix}: {', '.join(skill_list)}",
                        metadata={"candidate_id": candidate_id}
                    ))

        if "experience" in resume_data:
            for idx, exp in enumerate(resume_data["experience"]):
                exp_id = exp.get("id", str(idx))
                content = f"{exp.get('role')} at {exp.get('company')} ({exp.get('duration')}): {exp.get('description')}"
                chunks.append(ResumeChunk(
                    chunk_id=f"{candidate_id}_experience_{exp_id}",
                    section="experience",
                    content=content,
                    metadata={"candidate_id": candidate_id, "id": exp_id}
                ))

        if "projects" in resume_data:
            for idx, proj in enumerate(resume_data["projects"]):
                proj_id = proj.get("id", str(idx))
                content = f"Project: {proj.get('name')}. {proj.get('description')} Tech stack: {', '.join(proj.get('tech_stack', []))}. Impact: {proj.get('impact', '')}"
                chunks.append(ResumeChunk(
                    chunk_id=f"{candidate_id}_project_{proj_id}",
                    section="project",
                    content=content,
                    metadata={"candidate_id": candidate_id, "id": proj_id}
                ))

        if "education" in resume_data:
            for idx, edu in enumerate(resume_data["education"]):
                edu_id = edu.get("id", str(idx))
                content = f"{edu.get('degree')} from {edu.get('institution')} ({edu.get('duration')}). CGPA: {edu.get('cgpa')}. Courses: {', '.join(edu.get('relevant_courses', []))}"
                chunks.append(ResumeChunk(
                    chunk_id=f"{candidate_id}_education_{edu_id}",
                    section="education",
                    content=content,
                    metadata={"candidate_id": candidate_id, "id": edu_id}
                ))

        if "certifications" in resume_data:
            for idx, cert in enumerate(resume_data["certifications"]):
                content = f"Certification: {cert.get('name')} by {cert.get('issuer')}, {cert.get('year')}"
                chunks.append(ResumeChunk(
                    chunk_id=f"{candidate_id}_certification_{idx}",
                    section="certification",
                    content=content,
                    metadata={"candidate_id": candidate_id}
                ))

        if "achievements" in resume_data and resume_data["achievements"]:
            content = "\n".join(resume_data["achievements"])
            chunks.append(ResumeChunk(
                chunk_id=f"{candidate_id}_achievements_0",
                section="achievements",
                content=content,
                metadata={"candidate_id": candidate_id}
            ))

        logger.info(f"Created {len(chunks)} chunks for candidate {candidate_id}")
        return chunks
