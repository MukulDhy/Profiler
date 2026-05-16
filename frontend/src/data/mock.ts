export const candidate = {
  name: "Jordan Doe",
  title: "Senior Full Stack Engineer",
  initials: "JD",
  uuid: "8k2-p91",
  location: "San Francisco, CA",
  email: "jordan@profilegpt.ai",
  experienceYears: 8,
  atsScore: 98.4,
  summary:
    "Distributed systems specialist with a track record of scaling Node.js platforms to millions of users. Bridges low-level performance work with clean, product-focused API design.",
  strengths: [
    "Distributed systems architecture",
    "Performance optimization at scale",
    "Cross-functional technical leadership",
    "API design and developer experience",
  ],
  weaknesses: ["Limited public speaking experience", "Newer to mobile-native stack"],
  recruiterImpression:
    "High-signal senior engineer. Strong evidence of ownership and pragmatic decision-making across 4 production-grade projects.",
};

export const skills = [
  { name: "TypeScript", level: 95, group: "Frontend" },
  { name: "React", level: 92, group: "Frontend" },
  { name: "Node.js", level: 94, group: "Backend" },
  { name: "Go", level: 78, group: "Backend" },
  { name: "PostgreSQL", level: 88, group: "Backend" },
  { name: "AWS", level: 85, group: "Cloud" },
  { name: "Kubernetes", level: 72, group: "Cloud" },
  { name: "Python", level: 80, group: "AI/ML" },
  { name: "PyTorch", level: 65, group: "AI/ML" },
];

export const radarSkills = [
  { axis: "Frontend", value: 92 },
  { axis: "Backend", value: 94 },
  { axis: "Cloud", value: 80 },
  { axis: "AI/ML", value: 70 },
  { axis: "Systems", value: 88 },
  { axis: "Leadership", value: 82 },
];

export const codingActivity = [
  { month: "Jan", commits: 142 },
  { month: "Feb", commits: 188 },
  { month: "Mar", commits: 210 },
  { month: "Apr", commits: 175 },
  { month: "May", commits: 234 },
  { month: "Jun", commits: 198 },
  { month: "Jul", commits: 265 },
  { month: "Aug", commits: 240 },
];

export const timeline = [
  {
    year: "2024",
    role: "Senior Engineer",
    org: "OmniCorp",
    blurb: "Architected event-driven Kafka bus reducing data latency by 42%.",
  },
  {
    year: "2022",
    role: "Tech Lead",
    org: "FintechCorp",
    blurb: "Migrated monolithic PHP service to Go microservices, -40% latency.",
  },
  {
    year: "2020",
    role: "Full Stack Engineer",
    org: "Vortex Systems",
    blurb: "Scaled Node.js platform to 1.2M concurrent connections.",
  },
  {
    year: "2018",
    role: "Software Engineer Intern",
    org: "StartupX",
    blurb: "Built first version of internal analytics platform.",
  },
];

export const projects = [
  {
    id: "p1",
    name: "Vortex Realtime Engine",
    tagline: "Sub-100ms multiplayer state sync at 1.2M concurrent connections.",
    tech: ["Node.js", "Redis", "WebSockets", "AWS", "Terraform"],
    metrics: { users: "1.2M", uptime: "99.98%", latency: "84ms p95" },
    summary:
      "Designed a sharded WebSocket fleet with edge termination and a custom CRDT-based state layer. Replaced a Pusher-based system at 30% the cost.",
  },
  {
    id: "p2",
    name: "Kafka Event Mesh",
    tagline: "Cross-service event backbone powering 14 production teams.",
    tech: ["Kafka", "Go", "Schema Registry", "Kubernetes"],
    metrics: { topics: "320", events: "8B/mo", teams: "14" },
    summary:
      "Built a typed event mesh with schema enforcement, replay, and dead-letter routing. Eliminated 4 internal RPC services.",
  },
  {
    id: "p3",
    name: "Ledger ATS",
    tagline: "Open-source applicant tracking with embeddable widgets.",
    tech: ["TypeScript", "Next.js", "Postgres", "pgvector"],
    metrics: { stars: "4.2k", forks: "510", deploys: "1.1k" },
    summary:
      "OSS recruiting platform with semantic search over candidate notes. Adopted by 1,100+ teams.",
  },
  {
    id: "p4",
    name: "Compass AI Reviewer",
    tagline: "LLM agent that critiques PRs against architecture guidelines.",
    tech: ["Python", "FastAPI", "OpenAI", "GitHub Actions"],
    metrics: { repos: "62", PRs: "9,400", precision: "91%" },
    summary:
      "Static analysis + LLM hybrid that flags architectural drift. Deployed across 62 internal repos.",
  },
];

export const platforms = [
  { name: "GitHub", handle: "@jordandoe", stat: "412 repos · 4.2k stars" },
  { name: "LinkedIn", handle: "in/jordandoe", stat: "8.7k followers" },
  { name: "LeetCode", handle: "jordandoe", stat: "Knight · 1,892 rating" },
  { name: "HackerRank", handle: "jordandoe", stat: "6★ Problem Solving" },
];

export const suggestedPrompts = [
  "Explain the Vortex Realtime project",
  "What are Jordan's strongest skills?",
  "Summarize internship experience",
  "Is Jordan suitable for a backend role?",
  "Which project is most impressive?",
];

export const chatHistory = [
  { id: "1", title: "Backend engineering fit", date: "Today" },
  { id: "2", title: "Distributed systems deep dive", date: "Yesterday" },
  { id: "3", title: "Interview question generator", date: "2d ago" },
];

export const mockAIReply = (q: string): string => {
  const lower = q.toLowerCase();
  if (lower.includes("vortex"))
    return "**Vortex Realtime Engine** was Jordan's most technically ambitious project. They designed a sharded WebSocket fleet handling **1.2M concurrent connections** with **84ms p95 latency**, replacing a Pusher-based system at 30% the cost. The standout decision was using a custom CRDT layer for state sync rather than leaning on Redis pub/sub — a clear signal of distributed-systems maturity.";
  if (lower.includes("strong"))
    return "Jordan's strongest signals are in **distributed systems**, **performance engineering**, and **API design**. Across 4 production projects, they consistently make pragmatic infra choices (Go for hot paths, CRDTs over locks, Kafka for cross-team events). They rank in the **94th percentile** for backend depth among peers we've analyzed.";
  if (lower.includes("backend"))
    return "Yes — Jordan is an **excellent fit for senior backend roles**. Evidence: Kafka event mesh serving 14 teams, Go migration with 40% latency reduction, and proven scale at 1.2M concurrent connections. Recommended loop: system design (event-driven), one Go coding round, one architecture deep-dive on Vortex.";
  if (lower.includes("intern"))
    return "Jordan interned at **StartupX in 2018**, building the first version of an internal analytics platform. Limited public detail, but it appears to be where they first worked with time-series data — a pattern that recurs in later projects.";
  if (lower.includes("impressive"))
    return "**Vortex Realtime Engine** edges out the others for raw technical complexity, but the **Kafka Event Mesh** has higher organizational impact — it eliminated 4 internal RPC services and is used by 14 teams. Depending on the role: pick Vortex for IC depth, Mesh for staff-track signal.";
  return "Based on Jordan's resume, that's a strong area. They've shipped production systems touching this domain and consistently demonstrate ownership and pragmatic trade-off thinking. Want me to surface specific projects or metrics?";
};

export const recruiterInsights = {
  roleFits: [
    { role: "Senior Backend Engineer", score: 96, verdict: "Strong Hire" },
    { role: "Staff Distributed Systems", score: 88, verdict: "Hire" },
    { role: "Senior Full Stack", score: 91, verdict: "Strong Hire" },
    { role: "AI Engineer", score: 72, verdict: "Lean Hire" },
  ],
  interviewQuestions: [
    "Walk through the sharding strategy for the Vortex WebSocket fleet.",
    "Why CRDTs instead of a centralized lock service?",
    "How did you handle schema evolution in the Kafka mesh?",
    "Describe a time the Go migration plan needed adjustment.",
  ],
};
