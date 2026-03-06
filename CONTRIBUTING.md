# 🤝 Contributing to LearnOS

Thank you for your interest in building the future of education.

LearnOS is an open-source project building the world's first **agentic AI university**. Every contribution — code, ideas, courses, docs — brings us closer to making education free and adaptive for everyone.

## 🚀 Quick Start for Contributors

1. **Fork** the repo and clone locally
2. **Set up** the dev environment (see [README.md](README.md#-quick-start))
3. **Pick an issue** or propose a feature
4. **Submit a PR** with clear description of what and why

## 📋 What We Need Help With

### 🔥 High Priority
- **Authentication system** — OAuth2, user accounts, session management
- **Multi-user support** — move from single-user demo to real multi-tenancy
- **Course marketplace** — community course creation, starring, forking
- **Deployment** — Dockerize, CI/CD, one-click deploy guides
- **Testing** — unit tests, integration tests, E2E tests

### 🧠 Agent Development
- Improve existing agents (tutor, assessment, curriculum, etc.)
- Build new agents (community, certification, research)
- Agent memory and context management
- Multi-agent collaboration patterns

### 🎨 Frontend
- UI/UX improvements
- Accessibility (WCAG compliance)
- Mobile responsiveness
- Dark mode
- Data visualization for learning analytics

### 📖 Documentation
- Architecture docs
- API documentation
- User guides
- Tutorial videos / GIFs
- Translate docs to other languages

### 🔬 Research
- Learning science integration
- Agent evaluation metrics
- Comparison studies vs. traditional platforms

## 🏗️ Project Structure

```
backend/     → FastAPI + SQLite + AI agents (Python)
frontend/    → Next.js 14 + Tailwind CSS (TypeScript)
```

## 💻 Development Guidelines

### Code Style
- **Python:** Follow PEP 8, use type hints, docstrings on public functions
- **TypeScript:** Use strict mode, prefer named exports, document props
- **Commits:** Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)

### PR Guidelines
- One feature/fix per PR
- Include description of what changed and why
- Add tests if adding new functionality
- Update docs if changing behavior
- Screenshots for UI changes

### Branch Naming
- `feat/description` — new features
- `fix/description` — bug fixes
- `docs/description` — documentation
- `refactor/description` — code refactoring

## 🗺️ Roadmap

Check the [README roadmap](README.md#️-roadmap) for current priorities. Issues labeled `good first issue` are great starting points.

## 💬 Community

- **GitHub Issues** — bug reports, feature requests, discussions
- **GitHub Discussions** — architecture decisions, RFC proposals
- **Pull Requests** — code contributions

## 📄 License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

**Every contribution to LearnOS is a contribution to making education accessible worldwide. Let's build this together. 🎓**
