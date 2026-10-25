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

export interface Sharing {
  isPublic: boolean;
  shareToken: string | null;
  sharedAt: string | null;
  url: string | null;
}

export interface UploadSummary {
  id: string;
  fileName: string;
  fileType: "pdf" | "doc" | "docx";
  fileSize: number;
  url: string;
  createdAt: string;
  updatedAt?: string;
  processingStatus?: ProcessingStatus;
  analysisMeta?: AnalysisMeta | null;
  isPublic?: boolean;
  shareToken?: string | null;
  sharedAt?: string | null;
  sharing?: Sharing;
}

export interface ResumeProfileResponse {
  upload: UploadSummary | null;
  processingStatus: ProcessingStatus | null;
  profile: ResumeProfile | null;
  analysisMeta: AnalysisMeta | null;
  sharing?: Sharing;
}

export interface ResumeListResponse {
  uploads: UploadSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  username?: string | null;
  bio?: string | null;
  location?: string | null;
  phone?: string | null;
  profilePicture?: string | null;
  githubUsername?: string | null;
  role?: "user" | "admin";
  provider?: "local" | "google";
  isEmailVerified?: boolean;
  createdAt?: string;
  lastLogin?: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken?: string;
}

export interface AuthConfig {
  googleEnabled: boolean;
  demoEnabled: boolean;
  requireEmailVerification: boolean;
}

export interface MeResponse {
  user: AuthUser;
  isDemo: boolean;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  title: string;
  resumeId: string;
  messageCount: number;
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id?: string;
  role: "user" | "assistant";
  content: string;
  provider?: string | null;
  model?: string | null;
  createdAt?: string;
}

export interface Conversation {
  id: string;
  title: string;
  resumeId: string;
  messages: ChatMessageRecord[];
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageResponse {
  conversationId: string;
  message: ChatMessageRecord;
  suggestions: string[];
  title: string;
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export interface Note {
  id: string;
  resumeId: string;
  conversationId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Job match ───────────────────────────────────────────────────────────────

export interface JobMatch {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  gaps: string[];
  suggestions: string[];
  verdict: string;
  provider?: string | null;
  model?: string | null;
}

// ─── GitHub ──────────────────────────────────────────────────────────────────

export interface GithubActivity {
  username: string;
  user: {
    name: string;
    avatar: string;
    bio: string;
    url: string;
    company: string;
    location: string;
    createdAt: string;
  };
  stats: {
    publicRepos: number;
    followers: number;
    following: number;
    totalStars: number;
    commitsLast90Days: number;
  };
  languages: Array<{ name: string; count: number }>;
  activity: CodingActivityPoint[];
  repos: Array<{
    name: string;
    description: string;
    url: string;
    stars: number;
    forks: number;
    language: string;
    updatedAt: string;
  }>;
  fetchedAt: string;
}

// ─── Public sharing ──────────────────────────────────────────────────────────

export interface PublicProfile {
  profile: ResumeProfile;
  owner: {
    name: string;
    username: string | null;
    bio: string;
    avatar: string;
    location: string;
    githubUsername: string | null;
  };
  resume: {
    fileName: string;
    fileType: string;
    analysedAt: string;
  };
  sharedAt: string;
}

export interface PublicChatResponse {
  answer: string;
  suggestions: string[];
  provider?: string | null;
  model?: string | null;
}
