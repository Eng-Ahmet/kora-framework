/**
 * Kora Documentation Platform — In-Memory Client-Side Search
 */

const SEARCH_INDEX = [
  {
    title: "Language Tour & Fundamentals",
    category: "Language",
    url: "pages/language-tour.html",
    snippet: "Variables, primitive types, type inference, functions, closures, pattern matching, operators."
  },
  {
    title: "Object-Oriented Programming & Clean Architecture",
    category: "Architecture",
    url: "pages/oop-clean-arch.html",
    snippet: "Models, structs, interfaces, classes, dependency injection, and compiler diagnostics E5001-E5004."
  },
  {
    title: "Multi-Engine Database & ORM",
    category: "Database",
    url: "pages/database-orm.html",
    snippet: "MySQL, PostgreSQL, SQLite, NoSQL MongoDB document store, Redis caching, @table and @collection annotations."
  },
  {
    title: "Concurrency, Actors & Stream Pipelines",
    category: "Runtime",
    url: "pages/concurrency-streams.html",
    snippet: "Actor mailboxes, ask/tell patterns, MPSC channels, broadcast event distribution, stream processing."
  },
  {
    title: "CLI Tooling & Compiler Driver",
    category: "Tooling",
    url: "pages/cli-tooling.html",
    snippet: "kora create, check, run, build, fmt, swagger, and full 8-stage compilation pipeline."
  },
  {
    title: "23 Crates Ecosystem Reference",
    category: "Ecosystem",
    url: "pages/crates-reference.html",
    snippet: "Deep dive into all workspace crates: kora-ast, kora-ty, kora-orm, kora-runtime, kora-lsp, and more."
  },
  {
    title: "VS Code Extension & LSP Integration",
    category: "Tooling",
    url: "pages/vscode-extension.html",
    snippet: "Language Server Protocol, TextMate grammar syntax highlighting, snippets, and CI/CD publishing."
  },
  {
    title: "Language Gap Analysis & Evolution Roadmap",
    category: "Architecture",
    url: "pages/language-gap-analysis.html",
    snippet: "Technical evaluation of Type System, Memory Model, Async Runtime, Standard Library std::*, and 4-phase P0-P3 roadmap."
  },
  {
    title: "Middleware Ecosystem & Pipeline",
    category: "HTTP & Network",
    url: "pages/middleware-ecosystem.html",
    snippet: "Security headers (HSTS, CSP, X-Frame-Options), sliding-window rate limiting, circuit breaker, access logging, and request correlation."
  },
  {
    title: "Essential Backend Libraries & Integrations",
    category: "Libraries",
    url: "pages/libraries-integrations.html",
    snippet: "Email delivery, secure image processing & validation, PDF invoice builder, Excel spreadsheets, S3 cloud storage, and reporting engine."
  },
  {
    title: "Project & Feature Templates",
    category: "Architecture",
    url: "pages/project-feature-templates.html",
    snippet: "Clean Architecture feature template, strict entities vs models segregation, official project templates (REST, microservice, worker, websocket, graphql), and CLI generators."
  },
  {
    title: "Microservices & Event-Driven Architecture",
    category: "Distributed Systems",
    url: "pages/microservices-events.html",
    snippet: "API Gateway, Kafka/RabbitMQ domain event bus, distributed SAGA pattern with compensating transactions, and Kubernetes manifests."
  },
  {
    title: "Security-Hardened Architecture & Auditing",
    category: "Security",
    url: "pages/security-hardened-architecture.html",
    snippet: "Parser DoS defense (E1005), dialect SQL identifier escaping, constant-time JWT claims validation, decompression bomb & SVG XSS defense, CWE-22 path traversal sanitization, and SMTP CRLF injection defense."
  }
];

document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.getElementById('search-trigger');
  const modal = document.getElementById('search-modal');
  const input = document.getElementById('search-input');
  const resultsContainer = document.getElementById('search-results');

  if (!modal || !input) return;

  function openSearch() {
    modal.classList.add('active');
    input.value = '';
    renderResults('');
    input.focus();
  }

  function closeSearch() {
    modal.classList.remove('active');
  }

  if (trigger) {
    trigger.addEventListener('click', openSearch);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeSearch();
  });

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      modal.classList.contains('active') ? closeSearch() : openSearch();
    }
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeSearch();
    }
  });

  input.addEventListener('input', (e) => {
    renderResults(e.target.value.trim().toLowerCase());
  });

  function renderResults(query) {
    if (!resultsContainer) return;
    const filtered = query === '' 
      ? SEARCH_INDEX 
      : SEARCH_INDEX.filter(item => 
          item.title.toLowerCase().includes(query) || 
          item.snippet.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
        );

    if (filtered.length === 0) {
      resultsContainer.innerHTML = '<div style="padding: 1rem; color: var(--text-muted); text-align: center;">No matching documentation found</div>';
      return;
    }

    resultsContainer.innerHTML = filtered.map(item => {
      // Adjust URL if already inside pages/
      let targetUrl = item.url;
      if (window.location.pathname.includes('/pages/')) {
        targetUrl = targetUrl.replace('pages/', '');
      }
      return `
        <a href="${targetUrl}" class="search-result-item">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="search-result-title">${item.title}</span>
            <span class="badge badge-blue">${item.category}</span>
          </div>
          <div class="search-result-snippet">${item.snippet}</div>
        </a>
      `;
    }).join('');
  }
});
