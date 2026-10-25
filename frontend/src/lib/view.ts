import {
  candidate as mockCandidate,
  codingActivity as mockCodingActivity,
  platforms as mockPlatforms,
  projects as mockProjects,
  radarSkills as mockRadarSkills,
  recruiterInsights as mockRecruiterInsights,
  skills as mockSkills,
  timeline as mockTimeline,
} from "@/data/mock";
import type {
  AnalysisMeta,
  CodingActivityPoint,
  Platform,
  Project,
  RadarSkill,
  RecruiterInsights,
  ResumeProfile,
  Skill,
  TimelineItem,
} from "./types";

export interface DashboardCandidate {
  name: string;
  title: string;
  initials: string;
  uuid: string;
  location: string;
  email: string;
  experienceYears: number;
  atsScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recruiterImpression: string;
}

export interface DashboardAts {
  keywordMatch: { matched: number; total: number };
  formatting: string;
  missingKeywords: string[];
}

export interface DashboardView {
  candidate: DashboardCandidate;
  skills: Skill[];
  radarSkills: RadarSkill[];
  codingActivity: CodingActivityPoint[];
  timeline: TimelineItem[];
  platforms: Platform[];
  projects: Project[];
  recruiterInsights: RecruiterInsights;
  ats: DashboardAts;
  recruiterFit: number | null;
  projectCount: number;
  isLive: boolean;
  analysisMeta: AnalysisMeta | null;
}

const DEMO_ATS: DashboardAts = {
  keywordMatch: { matched: 42, total: 45 },
  formatting: "Pass",
  missingKeywords: ["Rust", "gRPC"],
};

export function buildDashboardView(
  profile: ResumeProfile | null,
  analysisMeta?: AnalysisMeta | null,
  sourceIsLive = false
): DashboardView {
  if (!profile) {
    return {
      candidate: {
        name: mockCandidate.name,
        title: mockCandidate.title,
        initials: mockCandidate.initials,
        uuid: mockCandidate.uuid,
        location: mockCandidate.location,
        email: mockCandidate.email,
        experienceYears: mockCandidate.experienceYears,
        atsScore: mockCandidate.atsScore,
        summary: mockCandidate.summary,
        strengths: mockCandidate.strengths,
        weaknesses: mockCandidate.weaknesses,
        recruiterImpression: mockCandidate.recruiterImpression,
      },
      skills: mockSkills,
      radarSkills: mockRadarSkills,
      codingActivity: mockCodingActivity,
      timeline: mockTimeline,
      platforms: mockPlatforms,
      projects: mockProjects as unknown as Project[],
      recruiterInsights: mockRecruiterInsights,
      ats: DEMO_ATS,
      recruiterFit: 94,
      projectCount: mockProjects.length,
      isLive: false,
      analysisMeta: null,
    };
  }

  const roleFits = profile.recruiterInsights?.roleFits ?? [];
  const recruiterFit =
    roleFits.length > 0
      ? roleFits.reduce((best, fit) => Math.max(best, fit.score ?? 0), 0)
      : null;

  return {
    candidate: {
      name: profile.candidate?.name || "Unknown Candidate",
      title: profile.candidate?.title || "Professional",
      initials: profile.candidate?.initials || "??",
      uuid: profile.candidate?.uuid || "—",
      location: profile.candidate?.location || "—",
      email: profile.candidate?.email || "—",
      experienceYears: profile.candidate?.experienceYears ?? 0,
      atsScore: profile.analysis?.atsScore ?? 0,
      summary: profile.candidate?.summary || "",
      strengths: profile.analysis?.strengths ?? [],
      weaknesses: profile.analysis?.weaknesses ?? [],
      recruiterImpression: profile.analysis?.recruiterImpression || "",
    },
    skills: profile.skills ?? [],
    radarSkills: profile.radarSkills ?? [],
    codingActivity: profile.codingActivity ?? [],
    timeline: profile.timeline ?? [],
    platforms: profile.platforms ?? [],
    projects: profile.projects ?? [],
    recruiterInsights: {
      roleFits,
      interviewQuestions: profile.recruiterInsights?.interviewQuestions ?? [],
    },
    ats: {
      keywordMatch: profile.analysis?.keywordMatch ?? { matched: 0, total: 0 },
      formatting: profile.analysis?.formatting || "Not evaluated",
      missingKeywords: profile.analysis?.missingKeywords ?? [],
    },
    recruiterFit,
    projectCount: profile.projects?.length ?? 0,
    isLive: sourceIsLive,
    analysisMeta: analysisMeta ?? null,
  };
}
