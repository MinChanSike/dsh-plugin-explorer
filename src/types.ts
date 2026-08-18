export interface CategoryDef {
  id: string;
  label: string;
  labelEn: string;
  color?: string;
}

export interface ProjectTypeDef {
  id: string;
  label: string;
  labelEn: string;
}

export interface PluginOwner {
  login: string;
  avatarUrl: string;
}

export interface PluginRepo {
  id: string;
  repositoryId: number;
  slug: string;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  homepage?: string;
  owner: PluginOwner;
  topics?: string[];
  language?: string;
  license?: string;
  stars: number;
  forks: number;
  openIssues: number;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  pushedAt?: string;
  archived?: boolean;
  fork?: boolean;
  projectType?: string;
  category?: string;
  categories?: string[];
  matchedTopics?: string[];
  classificationConfidence?: string;
  defaultBranch?: string;
}

export interface CatalogData {
  schemaVersion: number;
  generatedAt: string;
  source: {
    label: string;
    topic: string;
    url: string;
  };
  definitions: {
    categories: CategoryDef[];
    projectTypes: ProjectTypeDef[];
  };
  stats: {
    fetched: number;
    reportedByGitHub: number;
    categories: Record<string, number>;
    projectTypes: Record<string, number>;
  };
  repositories: PluginRepo[];
}
