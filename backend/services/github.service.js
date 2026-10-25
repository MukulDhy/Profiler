import axios from "axios";
import logger from "../utils/logger.js";

const GITHUB_API = "https://api.github.com";
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

const headers = () => {
  const token = (process.env.GITHUB_TOKEN || "").trim();
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "ProfileGPT",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const monthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const lastMonths = (count = 8) => {
  const now = new Date();
  const months = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    months.push({
      key: monthKey(date),
      label: date.toLocaleString("en-US", { month: "short" }),
      commits: 0,
    });
  }
  return months;
};

const normaliseUsername = (username) => String(username || "").trim();

export const isValidGithubUsername = (username) =>
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(
    normaliseUsername(username)
  );

const request = async (path) => {
  const { data } = await axios.get(`${GITHUB_API}${path}`, {
    timeout: 15_000,
    headers: headers(),
  });
  return data;
};

export const getGithubActivity = async (username) => {
  const login = normaliseUsername(username);
  if (!isValidGithubUsername(login)) {
    const error = new Error("Please provide a valid GitHub username.");
    error.statusCode = 400;
    throw error;
  }

  const cached = cache.get(login.toLowerCase());
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let user;
  try {
    user = await request(`/users/${encodeURIComponent(login)}`);
  } catch (error) {
    const status = error?.response?.status;
    const wrapped = new Error(
      status === 404
        ? `GitHub user "${login}" was not found.`
        : status === 403
          ? "GitHub's public API rate limit was reached. Try again later."
          : "Could not reach GitHub right now."
    );
    wrapped.statusCode = status === 404 ? 404 : status === 403 ? 429 : 502;
    throw wrapped;
  }

  let events = [];
  let repos = [];
  try {
    [events, repos] = await Promise.all([
      request(`/users/${encodeURIComponent(login)}/events/public?per_page=100`),
      request(
        `/users/${encodeURIComponent(login)}/repos?sort=updated&per_page=100&type=owner`
      ),
    ]);
  } catch (error) {
    // Profile data is still useful even if the secondary calls fail.
    logger.warn(`GitHub secondary fetch failed for ${login}: ${error.message}`);
  }

  const months = lastMonths(8);
  const byMonth = new Map(months.map((month) => [month.key, month]));

  let commitsLast90Days = 0;
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type !== "PushEvent") continue;
    const commits = Array.isArray(event.payload?.commits)
      ? event.payload.commits.length
      : 0;
    commitsLast90Days += commits;

    const created = new Date(event.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const bucket = byMonth.get(monthKey(created));
    if (bucket) bucket.commits += commits;
  }

  const repoList = Array.isArray(repos) ? repos : [];
  const totalStars = repoList.reduce(
    (total, repo) => total + (repo.stargazers_count || 0),
    0
  );

  const languageCounts = new Map();
  for (const repo of repoList) {
    if (!repo.language) continue;
    languageCounts.set(
      repo.language,
      (languageCounts.get(repo.language) || 0) + 1
    );
  }

  const languages = [...languageCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topRepos = repoList
    .slice()
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 6)
    .map((repo) => ({
      name: repo.name,
      description: repo.description || "",
      url: repo.html_url,
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      language: repo.language || "",
      updatedAt: repo.updated_at,
    }));

  const value = {
    username: user.login,
    user: {
      name: user.name || user.login,
      avatar: user.avatar_url,
      bio: user.bio || "",
      url: user.html_url,
      company: user.company || "",
      location: user.location || "",
      createdAt: user.created_at,
    },
    stats: {
      publicRepos: user.public_repos || 0,
      followers: user.followers || 0,
      following: user.following || 0,
      totalStars,
      commitsLast90Days,
    },
    languages,
    activity: months.map((month) => ({
      month: month.label,
      commits: month.commits,
    })),
    repos: topRepos,
    fetchedAt: new Date().toISOString(),
  };

  cache.set(login.toLowerCase(), {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return value;
};
