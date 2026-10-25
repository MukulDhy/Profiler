export type ProcessingStatus = "uploaded" | "processing" | "completed" | "failed";

export interface CandidateLinks {
  github?: string | null;
  linkedin?: string | null;
  leetcode?: string | null;
  portfolio?: string | null;
}

export interface Candidate {
  name: string;
  title: string;
  initials: string;
  uuid?: string | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  links?: CandidateLinks;
  experienceYears: number;
  summary: string;
}

export interface KeywordMatch {
  matched: number;
  total: number;
}

export interface Analysis {
  score: number;
  atsScore: number;
  keywordMatch: KeywordMatch;
  formatting: string;
  missingKeywords: string[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  recruiterImpression: string;
}

export interface Skill {
  name: string;
  level: number;
  group: string;
}

export interface RadarSkill {
  axis: string;
  value: number;
}

export interface TimelineItem {
  year: string;
  role: string;
  org: string;
  blurb: string;
}

export interface Project {
  id: string;
  name: string;
  tagline: string;
  tech: string[];
  metrics: Record<string, string>;
  summary: string;
  links?: Record<string, string>;
}

export interface Platform {
  name: string;
  handle: string;
  stat: string;
}

export interface RoleFit {
  role: string;
  score: number;
  verdict: string;
}

export interface RecruiterInsights {
  roleFits: RoleFit[];
  interviewQuestions: string[];
}

export interface CodingActivityPoint {
  month: string;
  commits: number;
}

export interface ResumeProfile {
  candidate: Candidate;
  analysis: Analysis;
  skills: Skill[];
  radarSkills: RadarSkill[];
  timeline: TimelineItem[];
  projects: Project[];
  platforms: Platform[];
  recruiterInsights: RecruiterInsights;
  codingActivity: CodingActivityPoint[];
}

export interface AnalysisMeta {
  provider?: string | null;
  model?: string | null;
  durationMs?: number | null;
  attempts?: number;
  providerTrail?: Array<{
    provider?: string;
    model?: string;
    status?: string;
    error?: string;
  }>;
  warnings?: string[];
  analysedAt?: string | null;
  error?: string | null;
}

export interface UploadSummary {
  id: string;
  fileName: string;
  fileType: "pdf" | "doc" | "docx";
  fileSize: number;
  url: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ResumeProfileResponse {
  upload: UploadSummary | null;
  processingStatus: ProcessingStatus | null;
  profile: ResumeProfile | null;
  analysisMeta: AnalysisMeta | null;
}
