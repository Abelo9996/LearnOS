# 🤝 Contributing to LearnOS

Thank you for your interest in building the future of education.

LearnOS is an open-source project building the world's first **agentic AI university**. Every contribution — code, ideas, courses, docs — brings us closer to making education free and adaptive for everyone.

## 🚀 Quick Start for Contributors

1. **Fork** the repo and clone locally
2. **Set up** the dev environment (see [README.md](README.md#️-quick-start))
3. **Pick an issue** or propose a feature
4. **Submit a PR** with a clear description of what and why

```bash
git clone https://github.com/<you>/LearnOS.git
cd LearnOS
npm install
npm start        # API on :3001
npm run dev      # frontend on :3000
npm test         # run the Vitest suite before opening a PR
```

## 📋 What We Need Help With

### 🔥 High Priority
- **Additional LLM providers** — extend `ai/llm.js` beyond Claude (OpenAI, Gemini) behind the existing interface
- **Cohort & social learning** — study groups, shared progress, leaderboards
- **Course marketplace depth** — richer authoring, forking, and discovery
- **Testing** — expand unit/integration coverage under `tests/`
- **Deployment recipes** — one-click deploy guides for common hosts

### 🧠 Agent Development
- Improve existing agents (`ai/agents/`: curriculum, assessment, research, analytics, profiling)
- Build new agents (certification, community)
- Agent memory and context management
- Multi-agent collaboration patterns

### 🎨 Frontend
- UI/UX improvements and accessibility (WCAG)
- Mobile responsiveness
- Data visualization for learning analytics

### 📖 Documentation
- Architecture docs, API reference, user guides
- Tutorials / GIFs
- Translations

## 🏗️ Project Structure

```
server.js     → Express 5 entry point (API + serves the built SPA)
routes/       → REST endpoints
middleware/   → local-user resolver, logging, url-safety (SSRF guard)
ai/           → LLM layer + agents (Claude)
db/           → better-sqlite3 (schema.sql). No seed data: every install starts empty.
src/          → React 18 frontend (Vite)
tests/        → Vitest
```

## 💻 Development Guidelines

### Code Style
- **JavaScript (ESM):** the project uses `"type": "module"` — use `import`/`export`. Match the surrounding style; prefer small, focused modules.
- **Frontend:** React function components and hooks; keep components readable and colocated with their screen.
- **Commits:** use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).

### PR Guidelines
- One feature/fix per PR
- Include a description of what changed and why
- Add or update tests (`npm test`) when changing behavior
- Update docs if behavior changes
- Screenshots for UI changes

### Branch Naming
- `feat/description` — new features
- `fix/description` — bug fixes
- `docs/description` — documentation
- `refactor/description` — code refactoring

## 💬 Community

- **GitHub Issues** — bug reports, feature requests, discussions
- **Pull Requests** — code contributions

## 📄 License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

**Every contribution to LearnOS is a contribution to making education accessible worldwide. Let's build this together. 🎓**
