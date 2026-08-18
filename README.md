# DeepSeek Harness Plugin Explorer

A fast, interactive single-page web app built to discover, search, and explore community plugins and extensions for **DeepSeek Harness (DSH)**.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Explore%20Plugins-1f6feb?style=for-the-badge&logo=githubpages&logoColor=white)](https://minchansike.github.io/dsh-plugin-explorer/)

---

## 🚀 Live Demo

Explore 6,700+ plugins directly in your browser:
**[https://minchansike.github.io/dsh-plugin-explorer/](https://minchansike.github.io/dsh-plugin-explorer/)**

![DeepSeek Harness Plugin Explorer Screenshot](./screenshot.png)

---

## Key Features

- **Virtualization & Performance**: Effortlessly browse 6,700+ plugins with virtualized Grid and List layouts powered by `@tanstack/react-virtual`.
- **Instant Search & Multi-Filter**: Search across plugin names, descriptions, authors, programming languages, and topics in real time.
- **Categories & Tags**: Filter by curated categories with live counters or click any tag (`#topic`) to drill down.
- **My Bookmarks**: Bookmark favorite plugins with one click and filter them via the **My Bookmarks** category (persisted in `localStorage`).
- **In-App Webpage Drawer**: Preview plugin documentation and project homepages right inside a sliding side drawer without losing your browsing context.
- **Smart Sorting**: Sort instantly by most stars, recently updated, or alphabetical order.
- **Daily Automated Sync**: Catalog is kept fresh with an automated GitHub Actions cron workflow that indexes newly published `dsh-plugin` repositories.

---

## Tech Stack

- **Runtime & Scripts**: [Bun](https://bun.sh)
- **Framework**: React 19 + TypeScript
- **Build Tool**: [Vite](https://vite.dev) + `vite-plugin-singlefile`
- **Virtualization**: `@tanstack/react-virtual`
- **Styling & Icons**: Tailwind CSS v4, GitHub Dark theme palette & `lucide-react`

---

## Getting Started

### Development

```bash
bun install
bun run dev
```

### Production Build

```bash
bun run build
```

Generates single-file standalone distribution in `dist/`.

---

## GitHub Actions CI/CD

- **GitHub Pages Deployment (`deploy.yml`)**: Builds and deploys the latest application to GitHub Pages on every push to `main`.
- **Automated Catalog Sync (`update-catalog.yml`)**: Runs daily at 20:00 UTC (04:00 AM UTC+8) to fetch latest repositories tagged with `dsh-plugin`, auto-categorize them, and propose updates via a Pull Request.
