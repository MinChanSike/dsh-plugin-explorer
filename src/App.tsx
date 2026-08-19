import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Search,
  LayoutGrid,
  List,
  Star,
  GitFork,
  ExternalLink,
  X,
  Globe,
  FolderGit2,
  Code2,
  Box,
  Layers,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Bookmark,
} from "lucide-react";
import { CatalogData, PluginRepo, CategoryDef } from "./types";
import { SpotlightCard } from "./SpotlightCard";

const PAGE_SIZE = 40;

export const App: React.FC = () => {
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const fetchCatalog = useCallback(() => {
    setIsLoadingCatalog(true);
    setCatalogError(null);

    // Resolve catalog.json relative to the document or base URL
    const baseUrl =
      import.meta.env.BASE_URL && import.meta.env.BASE_URL !== "./"
        ? new URL(import.meta.env.BASE_URL, window.location.href).href
        : window.location.href;
    const catalogUrl = new URL("catalog.json", baseUrl).href;

    fetch(catalogUrl, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            `Failed to load catalog.json (Status: ${res.status} ${res.statusText})`,
          );
        }
        return res.json();
      })
      .then((data: CatalogData) => {
        setCatalog(data);
        setIsLoadingCatalog(false);
      })
      .catch((err: any) => {
        console.error("Error fetching catalog.json:", err);
        setCatalogError(err.message || "Failed to load catalog");
        setIsLoadingCatalog(false);
      });
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const allRepositories: PluginRepo[] = useMemo(
    () => catalog?.repositories || [],
    [catalog],
  );
  const categories: CategoryDef[] = useMemo(
    () => catalog?.definitions?.categories || [],
    [catalog],
  );

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"stars" | "updated" | "name">("stars");
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("dsh_plugin_favorites");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem("dsh_plugin_favorites", JSON.stringify([...next]));
      } catch (e) {
        console.error("Failed to save favorites to localStorage", e);
      }
      return next;
    });
  }, []);

  // Drawer state for previewing repository/homepage in right-side drawer
  const [activeDrawerRepo, setActiveDrawerRepo] = useState<PluginRepo | null>(
    null,
  );
  const [isDrawerLoading, setIsDrawerLoading] = useState<boolean>(true);
  const [iframeError, setIframeError] = useState<boolean>(false);
  const [iframeErrorMessage, setIframeErrorMessage] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check if a URL is likely or definitely blocked from iframes (e.g. GitHub.com)
  const isKnownUnembeddableUrl = (url?: string) => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      // GitHub repos, GitLab, and certain domains send X-Frame-Options: DENY / SAMEORIGIN
      const host = parsed.hostname.toLowerCase();
      return (
        host === "github.com" ||
        (host.endsWith(".github.com") && !host.endsWith(".github.io")) ||
        host === "gitlab.com" ||
        host === "bitbucket.org"
      );
    } catch {
      return false;
    }
  };

  // When activeDrawerRepo changes, set loading state to true and reset error
  const handleOpenDrawer = (repo: PluginRepo) => {
    const targetUrl = repo.homepage || repo.url;
    setActiveDrawerRepo(repo);

    if (isKnownUnembeddableUrl(targetUrl)) {
      setIsDrawerLoading(false);
      setIframeError(true);
      setIframeErrorMessage(
        "GitHub repository pages block embedding via X-Frame-Options security policies.",
      );
    } else {
      setIsDrawerLoading(true);
      setIframeError(false);
      setIframeErrorMessage("");
    }
  };

  // Timeout fallback for iframes blocked silently by CSP / browser error page
  useEffect(() => {
    if (!activeDrawerRepo || !isDrawerLoading) return;
    const timer = setTimeout(() => {
      if (isDrawerLoading) {
        setIsDrawerLoading(false);
        setIframeError(true);
        setIframeErrorMessage(
          "The webpage took too long to load or was blocked from embedding by the remote server's security headers.",
        );
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [activeDrawerRepo, isDrawerLoading]);

  // Inspect iframe contentWindow on load to detect blank/blocked error pages
  const handleIframeLoad = () => {
    setIsDrawerLoading(false);
    try {
      const iframe = iframeRef.current;
      if (iframe) {
        // If contentDocument is accessible and URL is about:blank or empty body, it may have been blocked
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          if (
            doc.location.href === "about:blank" ||
            (!doc.body?.children.length && !doc.body?.innerText?.trim())
          ) {
            // Some browsers load an empty about:blank on CSP block
            setIframeError(true);
            setIframeErrorMessage(
              "The remote webpage prevented preview inside this frame.",
            );
          }
        }
      }
    } catch {
      // Cross-origin restriction is normal when loaded successfully
    }
  };

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveDrawerRepo(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Grid responsiveness
  const [columnsCount, setColumnsCount] = useState<number>(3);
  const parentRef = useRef<HTMLDivElement>(null);

  // Measure container width to determine grid columns accurately
  useEffect(() => {
    const updateColumns = () => {
      if (!parentRef.current) return;
      const width = parentRef.current.clientWidth - 40; // minus 20px padding on each side
      if (width < 620) setColumnsCount(1);
      else if (width < 960) setColumnsCount(2);
      else if (width < 1360) setColumnsCount(3);
      else setColumnsCount(4);
    };

    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  // Filter & Search logic
  const filteredRepositories = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();

    return allRepositories
      .filter((repo) => {
        // Bookmarks / Category filter
        if (selectedCategory === "bookmarks") {
          if (!favorites.has(repo.id)) {
            return false;
          }
        } else if (selectedCategory !== "all") {
          const repoCategories =
            repo.categories || (repo.category ? [repo.category] : []);
          if (!repoCategories.includes(selectedCategory)) {
            return false;
          }
        }

        // Tag filter
        if (selectedTag) {
          const topics = repo.topics || [];
          const matched = repo.matchedTopics || [];
          if (!topics.includes(selectedTag) && !matched.includes(selectedTag)) {
            return false;
          }
        }

        // Search filter (name, fullName, description, owner, language, topics)
        if (lowerSearch) {
          const inName = repo.name?.toLowerCase().includes(lowerSearch);
          const inFullName = repo.fullName?.toLowerCase().includes(lowerSearch);
          const inDesc = repo.description?.toLowerCase().includes(lowerSearch);
          const inOwner = repo.owner?.login
            ?.toLowerCase()
            .includes(lowerSearch);
          const inLang = repo.language?.toLowerCase().includes(lowerSearch);
          const inTopics = repo.topics?.some((t) =>
            t.toLowerCase().includes(lowerSearch),
          );

          if (
            !inName &&
            !inFullName &&
            !inDesc &&
            !inOwner &&
            !inLang &&
            !inTopics
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "stars") return (b.stars || 0) - (a.stars || 0);
        if (sortBy === "updated") {
          const dateA = new Date(a.updatedAt || a.pushedAt || 0).getTime();
          const dateB = new Date(b.updatedAt || b.pushedAt || 0).getTime();
          return dateB - dateA;
        }
        if (sortBy === "name")
          return (a.name || "").localeCompare(b.name || "");
        return 0;
      });
  }, [
    allRepositories,
    searchTerm,
    selectedCategory,
    selectedTag,
    sortBy,
    favorites,
  ]);

  // Infinite scrolling state
  const [displayedCount, setDisplayedCount] = useState<number>(PAGE_SIZE);

  // Reset pagination on filter changes
  useEffect(() => {
    setDisplayedCount(PAGE_SIZE);
  }, [searchTerm, selectedCategory, selectedTag, sortBy]);

  // Subset of items displayed
  const visibleRepositories = useMemo(() => {
    return filteredRepositories.slice(0, displayedCount);
  }, [filteredRepositories, displayedCount]);

  // Load more trigger
  const handleLoadMore = useCallback(() => {
    if (displayedCount < filteredRepositories.length) {
      setDisplayedCount((prev) =>
        Math.min(prev + PAGE_SIZE, filteredRepositories.length),
      );
    }
  }, [displayedCount, filteredRepositories.length]);

  // Grid rows calculation
  const gridRows = useMemo(() => {
    if (viewMode === "list") return [];
    const rows: PluginRepo[][] = [];
    for (let i = 0; i < visibleRepositories.length; i += columnsCount) {
      rows.push(visibleRepositories.slice(i, i + columnsCount));
    }
    return rows;
  }, [visibleRepositories, columnsCount, viewMode]);

  // Virtualizer for List mode
  const listVirtualizer = useVirtualizer({
    count: viewMode === "list" ? visibleRepositories.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 74,
    gap: 12,
    overscan: 6,
  });

  // Virtualizer for Grid mode
  const gridVirtualizer = useVirtualizer({
    count: viewMode === "grid" ? gridRows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    gap: 16,
    overscan: 4,
  });

  // Infinite scroll trigger on bottom reached
  useEffect(() => {
    const virtualizer = viewMode === "list" ? listVirtualizer : gridVirtualizer;
    const virtualItems = virtualizer.getVirtualItems();
    if (!virtualItems.length) return;

    const lastItem = virtualItems[virtualItems.length - 1];
    const totalVirtual =
      viewMode === "list" ? visibleRepositories.length : gridRows.length;

    if (
      lastItem &&
      lastItem.index >= totalVirtual - 1 &&
      displayedCount < filteredRepositories.length
    ) {
      handleLoadMore();
    }
  }, [
    listVirtualizer.getVirtualItems(),
    gridVirtualizer.getVirtualItems(),
    viewMode,
    visibleRepositories.length,
    gridRows.length,
    displayedCount,
    filteredRepositories.length,
    handleLoadMore,
  ]);

  // Category map for label resolution
  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryDef>();
    categories.forEach((cat) => map.set(cat.id, cat));
    return map;
  }, []);

  const formatNumber = (num: number) => {
    if (!num) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return num.toLocaleString();
  };

  const appBuildDate = useMemo(() => {
    try {
      const rawDate =
        typeof __APP_BUILD_DATE__ !== "undefined"
          ? __APP_BUILD_DATE__
          : catalog?.generatedAt;
      if (!rawDate) return null;
      const date = new Date(rawDate);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  }, [catalog?.generatedAt]);

  const hasActiveFilters =
    selectedCategory !== "all" || selectedTag || searchTerm;

  const targetDrawerUrl = activeDrawerRepo?.homepage || activeDrawerRepo?.url;

  return (
    <div className="app-container">
      {/* Compact Left-Side Navigation Panel */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-icon">
            <Sparkles size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-title-row">
              <span className="sidebar-title">DeepSeek Harness</span>
              <a
                href="https://github.com/MinChanSike/dsh-plugin-explorer"
                target="_blank"
                rel="noreferrer"
                className="sidebar-github-link"
                title="View on GitHub"
                aria-label="GitHub repository"
              >
                <svg
                  height="16"
                  width="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                </svg>
              </a>
            </div>
            <div className="sidebar-count-badge">
              {filteredRepositories.length.toLocaleString()} plugins available
            </div>
          </div>
        </div>

        {/* Scrollable Middle Content */}
        <div className="sidebar-content">
          {/* View Mode Switcher */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">View Mode</div>
            <div className="view-mode-group">
              <button
                className={`sidebar-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid View"
              >
                <LayoutGrid size={14} /> Grid
              </button>
              <button
                className={`sidebar-toggle-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="List View"
              >
                <List size={14} /> List
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">Search</div>
            <div className="search-wrapper">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search plugins..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="search-clear"
                  onClick={() => setSearchTerm("")}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Sort */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">Sort By</div>
            <select
              className="select-input"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "stars" | "updated" | "name")
              }
            >
              <option value="stars">Most Stars ★</option>
              <option value="updated">Recently Updated 🕒</option>
              <option value="name">Name (A-Z) 🔤</option>
            </select>
          </div>

          {/* Active Filters if any */}
          {hasActiveFilters && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">Active Filters</div>
              <div className="sidebar-active-filters">
                {selectedCategory !== "all" && (
                  <div className="filter-badge">
                    <span>
                      Category:{" "}
                      {selectedCategory === "bookmarks"
                        ? "My Bookmarks"
                        : categoryMap.get(selectedCategory)?.labelEn ||
                          selectedCategory}
                    </span>
                    <button
                      className="filter-badge-remove"
                      onClick={() => setSelectedCategory("all")}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {selectedTag && (
                  <div className="filter-badge">
                    <span>Tag: #{selectedTag}</span>
                    <button
                      className="filter-badge-remove"
                      onClick={() => setSelectedTag(null)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {searchTerm && (
                  <div className="filter-badge">
                    <span>Query: "{searchTerm}"</span>
                    <button
                      className="filter-badge-remove"
                      onClick={() => setSearchTerm("")}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                <button
                  className="clear-btn"
                  onClick={() => {
                    setSelectedCategory("all");
                    setSelectedTag(null);
                    setSearchTerm("");
                  }}
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}

          {/* Categories Navigation */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <span>Categories</span>
              <span style={{ fontSize: "0.7rem", fontWeight: 400 }}>
                {categories.length + 1}
              </span>
            </div>
            <ul className="nav-list">
              <li>
                <button
                  className={`nav-item-btn ${selectedCategory === "all" ? "active" : ""}`}
                  onClick={() => setSelectedCategory("all")}
                >
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Layers size={14} /> All Categories
                  </span>
                  <span className="nav-item-count">
                    {allRepositories.length}
                  </span>
                </button>
              </li>
              {categories.map((cat) => {
                const count = catalog?.stats?.categories?.[cat.id] || 0;
                return (
                  <li key={cat.id}>
                    <button
                      className={`nav-item-btn ${selectedCategory === cat.id ? "active" : ""}`}
                      onClick={() =>
                        setSelectedCategory(
                          selectedCategory === cat.id ? "all" : cat.id,
                        )
                      }
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Box size={14} /> {cat.labelEn || cat.label}
                      </span>
                      <span className="nav-item-count">{count}</span>
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  className={`nav-item-btn ${selectedCategory === "bookmarks" ? "active" : ""}`}
                  onClick={() =>
                    setSelectedCategory(
                      selectedCategory === "bookmarks" ? "all" : "bookmarks",
                    )
                  }
                >
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Bookmark
                      size={14}
                      fill={
                        selectedCategory === "bookmarks"
                          ? "currentColor"
                          : "none"
                      }
                    />{" "}
                    My Bookmarks
                  </span>
                  <span className="nav-item-count">{favorites.size}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Sidebar Footer with Build Date */}
        {appBuildDate && (
          <div className="sidebar-footer">
            <span>Updated: {appBuildDate}</span>
          </div>
        )}
      </aside>

      {/* Main Content Area - Full screen plugin list/grid with no header */}
      <main className="main-content">
        <div className="scroll-viewport" ref={parentRef}>
          {isLoadingCatalog ? (
            <div className="empty-view">
              <div className="drawer-loading-spinner" />
              <h3>Loading plugins catalog...</h3>
              <p style={{ fontSize: "0.85rem" }}>
                Fetching the latest plugin repository data.
              </p>
            </div>
          ) : catalogError ? (
            <div className="empty-view">
              <AlertCircle size={40} color="var(--color-attention-fg)" />
              <h3>Failed to load catalog</h3>
              <p style={{ fontSize: "0.85rem" }}>{catalogError}</p>
              <button
                className="action-btn primary"
                onClick={fetchCatalog}
                style={{ marginTop: 10 }}
              >
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          ) : filteredRepositories.length === 0 ? (
            <div className="empty-view">
              <FolderGit2 size={40} />
              <h3>No plugins match your filter</h3>
              <p style={{ fontSize: "0.85rem" }}>
                Try adjusting your search query, category, or tag selections.
              </p>
            </div>
          ) : viewMode === "list" ? (
            /* Virtualized List View */
            <div
              style={{
                height: `${listVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {listVirtualizer.getVirtualItems().map((virtualRow) => {
                const repo = visibleRepositories[virtualRow.index];
                if (!repo) return null;
                const isSelected = activeDrawerRepo?.id === repo.id;

                return (
                  <div
                    key={repo.id || virtualRow.index}
                    ref={listVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div
                      className={`plugin-list-row ${isSelected ? "selected" : ""}`}
                    >
                      <img
                        src={
                          repo.owner?.avatarUrl ||
                          "https://github.githubassets.com/favicons/favicon.png"
                        }
                        alt={repo.name}
                        className="card-avatar"
                        loading="lazy"
                      />

                      <div className="list-info">
                        <div className="list-top">
                          <button
                            type="button"
                            className="plugin-name-btn"
                            onClick={() => handleOpenDrawer(repo)}
                            title="Open webpage in drawer"
                          >
                            {repo.fullName || repo.name}
                          </button>
                          {repo.language && (
                            <span className="tag-badge">
                              <Code2
                                size={10}
                                style={{ display: "inline", marginRight: 3 }}
                              />
                              {repo.language}
                            </span>
                          )}
                        </div>
                        <p className="list-desc">
                          {repo.description || "No description provided."}
                        </p>
                      </div>

                      <div className="list-actions">
                        <button
                          type="button"
                          className={`action-btn fav-btn ${favorites.has(repo.id) ? "favorited" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(repo.id);
                          }}
                          title={
                            favorites.has(repo.id)
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                        >
                          <Bookmark
                            size={13}
                            fill={
                              favorites.has(repo.id) ? "currentColor" : "none"
                            }
                          />
                        </button>

                        <div className="meta-stats">
                          <span className="meta-stat stars">
                            <Star size={13} fill="currentColor" />{" "}
                            {formatNumber(repo.stars)}
                          </span>
                          <span className="meta-stat">
                            <GitFork size={13} /> {formatNumber(repo.forks)}
                          </span>
                        </div>

                        {repo.homepage && (
                          <a
                            href={repo.homepage}
                            target="_blank"
                            rel="noreferrer"
                            className="action-btn"
                            title="Open Homepage"
                          >
                            <Globe size={13} />
                          </a>
                        )}

                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="action-btn primary"
                        >
                          GitHub <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Virtualized Grid View with Consistent Item Spacing */
            <div
              style={{
                height: `${gridVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {gridVirtualizer.getVirtualItems().map((virtualRow) => {
                const rowRepos = gridRows[virtualRow.index];
                if (!rowRepos) return null;

                return (
                  <div
                    key={virtualRow.index}
                    ref={gridVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div
                      className="grid-row-container"
                      style={{
                        gridTemplateColumns: `repeat(${columnsCount}, 1fr)`,
                      }}
                    >
                      {rowRepos.map((repo) => {
                        const isSelected = activeDrawerRepo?.id === repo.id;

                        return (
                          <SpotlightCard
                            key={repo.id}
                            className={`plugin-card ${isSelected ? "selected" : ""}`}
                            spotlightColor="rgba(56, 139, 253, 0.15)"
                          >
                            <div>
                              <div className="card-header">
                                <img
                                  src={
                                    repo.owner?.avatarUrl ||
                                    "https://github.githubassets.com/favicons/favicon.png"
                                  }
                                  alt={repo.name}
                                  className="card-avatar"
                                  loading="lazy"
                                />
                                <div className="card-title-box">
                                  <button
                                    type="button"
                                    className="plugin-name-btn"
                                    onClick={() => handleOpenDrawer(repo)}
                                    title="Open webpage in drawer"
                                  >
                                    {repo.name}
                                  </button>
                                  <div className="plugin-owner">
                                    {repo.owner?.login}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={`card-fav-btn ${favorites.has(repo.id) ? "favorited" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(repo.id);
                                  }}
                                  title={
                                    favorites.has(repo.id)
                                      ? "Remove from favorites"
                                      : "Add to favorites"
                                  }
                                >
                                  <Bookmark
                                    size={14}
                                    fill={
                                      favorites.has(repo.id)
                                        ? "currentColor"
                                        : "none"
                                    }
                                  />
                                </button>
                              </div>

                              <p
                                className="plugin-desc"
                                title={repo.description}
                              >
                                {repo.description || "No description provided."}
                              </p>
                            </div>

                            <div>
                              <div className="card-tags">
                                {repo.category && (
                                  <span
                                    className="tag-badge category-tag"
                                    onClick={() =>
                                      setSelectedCategory(repo.category!)
                                    }
                                  >
                                    {categoryMap.get(repo.category)?.labelEn ||
                                      repo.category}
                                  </span>
                                )}
                                {repo.topics?.slice(0, 3).map((topic) => (
                                  <span
                                    key={topic}
                                    className="tag-badge"
                                    onClick={() => setSelectedTag(topic)}
                                  >
                                    #{topic}
                                  </span>
                                ))}
                                {repo.language && (
                                  <span className="tag-badge">
                                    {repo.language}
                                  </span>
                                )}
                              </div>

                              <div className="card-footer">
                                <div className="meta-stats">
                                  <span className="meta-stat stars">
                                    <Star size={13} fill="currentColor" />{" "}
                                    {formatNumber(repo.stars)}
                                  </span>
                                  <span className="meta-stat">
                                    <GitFork size={13} />{" "}
                                    {formatNumber(repo.forks)}
                                  </span>
                                </div>

                                <div style={{ display: "flex", gap: "6px" }}>
                                  {repo.homepage && (
                                    <a
                                      href={repo.homepage}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="action-btn"
                                      title="Homepage"
                                    >
                                      <Globe size={13} />
                                    </a>
                                  )}
                                  <a
                                    href={repo.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="action-btn primary"
                                  >
                                    GitHub <ExternalLink size={12} />
                                  </a>
                                </div>
                              </div>
                            </div>
                          </SpotlightCard>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Infinite Scroll loader */}
          {displayedCount < filteredRepositories.length && (
            <div className="infinite-loader">
              <div className="spinner"></div>
              <span>
                Loading more plugins ({displayedCount} of{" "}
                {filteredRepositories.length})...
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Right-Side Drawer Panel with Loading Animation & Progress */}
      {activeDrawerRepo && targetDrawerUrl && (
        <>
          <div
            className="drawer-backdrop"
            onClick={() => setActiveDrawerRepo(null)}
          />
          <aside className="drawer-panel">
            <div className="drawer-header">
              <div className="drawer-title-group">
                <img
                  src={
                    activeDrawerRepo.owner?.avatarUrl ||
                    "https://github.githubassets.com/favicons/favicon.png"
                  }
                  alt={activeDrawerRepo.name}
                  className="drawer-avatar"
                />
                <div style={{ minWidth: 0 }}>
                  <div className="drawer-title">
                    {activeDrawerRepo.fullName || activeDrawerRepo.name}
                  </div>
                  <div className="drawer-url">{targetDrawerUrl}</div>
                </div>
              </div>

              <div className="drawer-actions">
                <a
                  href={targetDrawerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="action-btn"
                  title="Open in new tab"
                >
                  <ExternalLink size={13} /> Open in Tab
                </a>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setActiveDrawerRepo(null)}
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="drawer-iframe-container">
              {isDrawerLoading && !iframeError && (
                <>
                  <div className="drawer-progress-bar" />
                  <div className="drawer-loading-overlay">
                    <div className="drawer-loading-spinner" />
                    <span>Loading webpage...</span>
                  </div>
                </>
              )}
              {iframeError ? (
                <div className="drawer-fallback-overlay">
                  <div className="drawer-fallback-icon-wrap">
                    <AlertCircle size={36} color="var(--color-attention-fg)" />
                  </div>
                  <div className="drawer-fallback-title">Unable to Preview</div>
                  <p className="drawer-fallback-desc">
                    {iframeErrorMessage ||
                      "This website cannot be displayed inside the drawer due to security policies (Content-Security-Policy or X-Frame-Options set to DENY/SAMEORIGIN)."}
                  </p>
                  <div className="drawer-fallback-url-preview">
                    <code>{targetDrawerUrl}</code>
                  </div>
                  <div className="drawer-fallback-actions">
                    <a
                      href={targetDrawerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="action-btn primary"
                      style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                    >
                      Open in New Tab <ExternalLink size={14} />
                    </a>
                    {activeDrawerRepo.url &&
                      activeDrawerRepo.url !== targetDrawerUrl && (
                        <a
                          href={activeDrawerRepo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="action-btn"
                          style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                        >
                          View on GitHub <ExternalLink size={14} />
                        </a>
                      )}
                  </div>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  src={targetDrawerUrl}
                  title={activeDrawerRepo.name}
                  className="drawer-iframe"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  onLoad={handleIframeLoad}
                  onError={() => {
                    setIsDrawerLoading(false);
                    setIframeError(true);
                    setIframeErrorMessage(
                      "Failed to load the webpage due to a connection or iframe security restriction.",
                    );
                  }}
                />
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
};
