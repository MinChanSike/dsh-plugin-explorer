import fs from "fs";
import path from "path";

interface GitHubRepoItem {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  owner: {
    login: string;
    avatar_url: string;
  };
  topics: string[];
  language: string | null;
  license: { spdx_id?: string; name?: string } | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  size: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  archived: boolean;
  fork: boolean;
  default_branch: string;
}

const CATEGORY_RULES: Record<string, string[]> = {
  ui: [
    "ui",
    "theme",
    "themes",
    "frontend",
    "interface",
    "design",
    "dashboard",
    "component",
    "components",
    "css",
    "tailwindcss",
    "styling",
    "canvas",
    "gui",
    "web-ui",
  ],
  "agent-session": [
    "agent",
    "agents",
    "session",
    "chat",
    "conversation",
    "memory",
    "workflow",
    "agentic",
    "multi-agent",
    "autonomous",
    "prompt",
    "dialogue",
  ],
  development: [
    "development",
    "devtool",
    "devtools",
    "debug",
    "debugger",
    "compiler",
    "linter",
    "formatter",
    "testing",
    "test",
    "sdk",
    "cli",
    "builder",
    "terminal",
    "code-generator",
    "ide",
    "editor",
  ],
  communication: [
    "communication",
    "messaging",
    "bot",
    "discord",
    "slack",
    "telegram",
    "wechat",
    "email",
    "sms",
    "notification",
    "webhook",
    "chatops",
  ],
  data: [
    "data",
    "database",
    "sql",
    "nosql",
    "files",
    "storage",
    "vector",
    "embeddings",
    "rag",
    "knowledge",
    "document",
    "indexer",
    "parsing",
  ],
  "model-mcp": [
    "model",
    "mcp",
    "llm",
    "deepseek",
    "openai",
    "claude",
    "ollama",
    "vllm",
    "transformers",
    "inference",
    "api",
    "anthropic",
  ],
  security: [
    "security",
    "governance",
    "auth",
    "authentication",
    "authorization",
    "encryption",
    "audit",
    "compliance",
    "privacy",
    "firewall",
    "guardrail",
  ],
  operations: [
    "operations",
    "devops",
    "deployment",
    "docker",
    "kubernetes",
    "k8s",
    "ci-cd",
    "cloud",
    "serverless",
    "monitoring",
    "infra",
    "infrastructure",
  ],
  lifestyle: [
    "lifestyle",
    "entertainment",
    "game",
    "music",
    "video",
    "audio",
    "personal",
    "productivity",
    "fun",
    "social",
    "hobby",
  ],
  research: [
    "research",
    "learning",
    "education",
    "study",
    "paper",
    "dataset",
    "academic",
    "benchmark",
    "science",
    "nlp",
  ],
};

function categorize(
  topics: string[],
  description: string,
  name: string,
): { categories: string[]; category: string; matchedTopics: string[] } {
  const text = `${name} ${description || ""} ${topics.join(" ")}`.toLowerCase();
  const matchedCategories = new Set<string>();
  const matchedTopics: string[] = [];

  for (const [catId, keywords] of Object.entries(CATEGORY_RULES)) {
    for (const kw of keywords) {
      if (topics.includes(kw) || text.includes(kw)) {
        matchedCategories.add(catId);
        if (topics.includes(kw) && !matchedTopics.includes(kw)) {
          matchedTopics.push(kw);
        }
      }
    }
  }

  const catList = Array.from(matchedCategories);
  if (catList.length === 0) {
    catList.push("other");
  }

  return {
    categories: catList,
    category: catList[0] || "other",
    matchedTopics,
  };
}

async function fetchTopicRepos(): Promise<GitHubRepoItem[]> {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "deepseek-harness-plugin-updater",
  };
  if (GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  }

  const allRepos: GitHubRepoItem[] = [];
  const seenIds = new Set<number>();
  let page = 1;
  const perPage = 100;
  const maxPages = 10; // GitHub Search API limits to 1000 results per query

  while (page <= maxPages) {
    const url = `https://api.github.com/search/repositories?q=topic:dsh-plugin&sort=stars&order=desc&per_page=${perPage}&page=${page}`;
    console.log(`Fetching page ${page}...`);

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.warn(
          `Search API responded with status ${res.status}: ${res.statusText}`,
        );
        break;
      }
      const data: any = await res.json();
      const items: GitHubRepoItem[] = data.items || [];
      if (items.length === 0) break;

      for (const item of items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allRepos.push(item);
        }
      }

      if (items.length < perPage) break;
      page++;
    } catch (err) {
      console.error(`Error on page ${page}:`, err);
      break;
    }
  }

  return allRepos;
}

async function updateCatalog() {
  const existingCatalogPath = path.resolve(process.cwd(), "catalog.json");
  let existingCatalog: any = null;

  if (fs.existsSync(existingCatalogPath)) {
    try {
      existingCatalog = JSON.parse(
        fs.readFileSync(existingCatalogPath, "utf-8"),
      );
    } catch (e) {
      console.warn("Could not parse existing catalog.json");
    }
  }

  const fetchedRepos = await fetchTopicRepos();
  console.log(`Fetched ${fetchedRepos.length} repositories from GitHub.`);

  // If no repos fetched (e.g. rate limit without token), do not overwrite with empty list
  if (fetchedRepos.length === 0 && existingCatalog?.repositories?.length) {
    console.log("No new repositories retrieved. Keeping existing catalog.");
    return;
  }

  // Merge with existing repositories if needed
  const repoMap = new Map<number, any>();
  if (existingCatalog?.repositories) {
    for (const r of existingCatalog.repositories) {
      repoMap.set(
        r.repositoryId || parseInt(r.id.replace("github:", ""), 10),
        r,
      );
    }
  }

  for (const item of fetchedRepos) {
    const { categories, category, matchedTopics } = categorize(
      item.topics || [],
      item.description || "",
      item.name || "",
    );

    repoMap.set(item.id, {
      id: `github:${item.id}`,
      repositoryId: item.id,
      slug: String(item.id),
      name: item.name,
      fullName: item.full_name,
      description: item.description || "",
      url: item.html_url,
      homepage: item.homepage || "",
      owner: {
        login: item.owner?.login || "",
        avatarUrl: item.owner?.avatar_url || "",
      },
      topics: item.topics || [],
      language: item.language || undefined,
      license: item.license?.spdx_id || item.license?.name || undefined,
      stars: item.stargazers_count || 0,
      forks: item.forks_count || 0,
      openIssues: item.open_issues_count || 0,
      size: item.size || 0,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      pushedAt: item.pushed_at,
      archived: item.archived || false,
      fork: item.fork || false,
      projectType: "plugin",
      category,
      categories,
      matchedTopics,
      classificationConfidence: "high",
      defaultBranch: item.default_branch || "main",
    });
  }

  const allRepos = Array.from(repoMap.values()).sort(
    (a, b) => (b.stars || 0) - (a.stars || 0),
  );

  const categoryCounts: Record<string, number> = {};
  for (const r of allRepos) {
    const cats = r.categories || [r.category || "other"];
    for (const c of cats) {
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    }
  }

  const newCatalog = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      label: "GitHub Topic",
      topic: "dsh-plugin",
      url: "https://github.com/topics/dsh-plugin",
    },
    definitions: existingCatalog?.definitions || {
      categories: [
        {
          id: "ui",
          label: "界面增强",
          labelEn: "UI enhancement",
          color: "#a0c3ec",
        },
        {
          id: "agent-session",
          label: "Agent 与会话",
          labelEn: "Agent & session",
          color: "#c4b5fd",
        },
        {
          id: "development",
          label: "开发工具",
          labelEn: "Developer tools",
          color: "#ffffff",
        },
        {
          id: "communication",
          label: "消息通讯",
          labelEn: "Messaging",
          color: "#ffc285",
        },
        {
          id: "data",
          label: "文件与数据",
          labelEn: "Files & data",
          color: "#8ed6c4",
        },
        {
          id: "model-mcp",
          label: "模型与 MCP",
          labelEn: "Model & MCP",
          color: "#9bb7ff",
        },
        {
          id: "security",
          label: "安全与治理",
          labelEn: "Security & governance",
          color: "#ff9c8c",
        },
        {
          id: "operations",
          label: "部署运维",
          labelEn: "Deployment & ops",
          color: "#d0d3d8",
        },
        {
          id: "lifestyle",
          label: "生活娱乐",
          labelEn: "Lifestyle",
          color: "#ffb3d1",
        },
        {
          id: "research",
          label: "学习研究",
          labelEn: "Learning & research",
          color: "#b7d987",
        },
        { id: "other", label: "其他", labelEn: "Other", color: "#7d8187" },
      ],
      projectTypes: [
        { id: "plugin", label: "插件", labelEn: "Plugin" },
        { id: "skill", label: "技能", labelEn: "Skill" },
        { id: "collection", label: "插件合集", labelEn: "Collection" },
        { id: "channel", label: "渠道适配", labelEn: "Channel adapter" },
        { id: "application", label: "完整应用", labelEn: "Application" },
        { id: "infrastructure", label: "基础设施", labelEn: "Infrastructure" },
        { id: "directory", label: "索引目录", labelEn: "Directory" },
        { id: "unknown", label: "待识别", labelEn: "Unrecognized" },
      ],
    },
    stats: {
      fetched: allRepos.length,
      reportedByGitHub: allRepos.length,
      categories: categoryCounts,
      projectTypes: existingCatalog?.stats?.projectTypes || {
        plugin: allRepos.length,
      },
    },
    repositories: allRepos,
  };

  // Only compare repository content ignoring generatedAt timestamp to determine real changes
  if (existingCatalog) {
    const oldComparison = JSON.stringify(existingCatalog.repositories);
    const newComparison = JSON.stringify(newCatalog.repositories);
    if (oldComparison === newComparison) {
      console.log("No changes detected in repository list.");
      return;
    }
  }

  const jsonStr = JSON.stringify(newCatalog, null, 2);
  fs.writeFileSync(existingCatalogPath, jsonStr, "utf-8");

  const publicCatalogPath = path.resolve(
    process.cwd(),
    "public",
    "catalog.json",
  );
  if (fs.existsSync(path.dirname(publicCatalogPath))) {
    fs.writeFileSync(publicCatalogPath, jsonStr, "utf-8");
  }

  console.log(
    `Updated catalog.json successfully with ${allRepos.length} plugins.`,
  );
}

updateCatalog();
