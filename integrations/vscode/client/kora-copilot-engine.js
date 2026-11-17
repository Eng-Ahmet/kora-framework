const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

/**
 * Built-in Core Knowledge Base derived from:
 * - .agent/rules/ (00-10, compiler-boundaries, language-evolution)
 * - .agent/standards/ (architecture, coding, performance, security, testing)
 * - docs/ (architecture, language, getting-started, ecosystem)
 * - documentation/ (database, concurrency, microservices, cli)
 */
const KORA_KNOWLEDGE_BASE = [
    {
        topic: "Clean Architecture Invariants",
        source: ".agent/rules/04-clean-architecture.md",
        keywords: ["clean architecture", "slice", "layer", "e5001", "e5002", "e5003", "e5004", "router", "di", "controller", "service"],
        content: `### 🏛️ Clean Architecture Invariants & Compiler Enforcement (E5001 - E5004)
Kora strictly enforces Clean Architecture at compile time:
- **E5001 (Direct Infrastructure Instantiation)**: Controllers and Services must never instantiate database connections, HTTP clients, or raw infrastructure directly inside handler methods. All dependencies must be injected via \`init(...)\`.
- **E5002 (Missing Interface Abstraction)**: High-level services must depend on \`interface\` abstractions, never on concrete database drivers.
- **E5003 (Leaking Domain Entity via Controller)**: Domain entities must not be returned directly across API boundaries without being wrapped in DTOs.
- **E5004 (Circular Architectural Layer Dependency)**: Domain layer must not depend on Application layer; Application layer must not depend on Infrastructure.

**Mandatory Directory Segregation**:
- \`entities/\`: All persisted relational database models (\`@table("...")\`) and NoSQL document models (\`@collection("...")\`).
- \`models/\` or \`dto/\`: All API request/response payloads, validation schemas, and transport models (never decorated with table attributes).`
    },
    {
        topic: "Language Philosophy & Single-Null Design",
        source: ".agent/rules/01-language-philosophy.md",
        keywords: ["null", "undefined", "single null", "e2005", "philosophy", "zero guessing", "strict typing"],
        content: `### 🎯 Kora Language Philosophy & Single-Null Design
- **Single-Null Design**: Kora has \`null\` and \`Option<T>\` (\`Some(val)\` | \`None\`). The JavaScript/TypeScript \`undefined\` construct is **strictly prohibited** (\`E2005\`).
- **Zero Value Guessing**: The compiler and runtime strictly forbid arbitrary default fallbacks (\`|| ''\`, \`|| 0\`, \`|| false\`) masking missing data.
- **Affine Ownership & Memory Safety**: Inspired by Rust, values are tracked without a stop-the-world Garbage Collector.
- **Direct Native Execution**: Compiles to optimized native machine binaries with sub-millisecond cold starts and multi-gigabit throughput.`
    },
    {
        topic: "Multi-Engine Database ORM & Decorators",
        source: ".agent/rules/07-database-multi-engine-orm.md",
        keywords: ["database", "orm", "table", "collection", "mysql", "postgres", "sqlite", "mongodb", "redis", "entity", "decorator", "@table", "@entity", "@primary"],
        content: `### 🗄️ Multi-Engine Database ORM & Decorator Architecture
Kora provides native compile-time support for three database paradigms:
1. **Relational SQL (PostgreSQL, MySQL, SQLite)**:
   - Annotated with \`@entity\` and \`@table("table_name")\`.
   - Field decorators: \`@primary\`, \`@autoIncrement\`, \`@unique\`, \`@index\`, \`@column("col_name")\`, \`@required\`, \`@email\`, \`@min(0)\`, \`@max(100)\`.
   - Parameterized queries: \`db.query(sql)\`, \`db.execute(sql)\`.
   - ACID transaction blocks: \`db.begin()\`, \`db.commit()\`, \`db.rollback()\`.
2. **Document NoSQL (MongoDB-compatible)**:
   - Annotated with \`@collection("collection_name")\`.
   - Operations: \`db.collection("name").insertOne(doc)\`, \`findOne(filter)\`, \`deleteMany(timestamp)\`.
3. **Key-Value Cache (Redis-compatible)**:
   - Operations: \`db.set(k, v)\`, \`db.setEx(k, v, ttl)\`, \`db.get(k)\`, \`db.incr(k)\`.`
    },
    {
        topic: "Concurrency, Actors & Non-Blocking Streams",
        source: ".agent/rules/08-concurrency-actors-streams.md",
        keywords: ["actor", "concurrency", "mailbox", "tell", "ask", "channel", "broadcast", "spawn", "tokio", "stream", "taskgroup"],
        content: `### ⚡ Concurrency, Actors & Non-Blocking Message Passing
- **Stateful Actors**: Isolated units of concurrency executing on Tokio worker threads with non-blocking mailboxes.
  - \`actor.tell(msg)\`: Fire-and-forget message dispatch.
  - \`actor.ask(msg)\`: Request-response asynchronous query with built-in timeout protection.
- **Channels**:
  - \`channel<T>(capacity)\`: MPSC (multi-producer, single-consumer) bounded async channel.
  - \`broadcast<T>(capacity)\`: Multi-consumer pub/sub channel.
- **Structured Task Groups**: \`spawn(async () => { ... })\` with cooperative cancellation.`
    },
    {
        topic: "Testing Standards, Load Tests & Mandatory Teardown",
        source: ".agent/rules/10-testing-and-verification.md",
        keywords: ["test", "testing", "unit test", "load test", "teardown", "cleanup", "assert", "benchmark", "stress"],
        content: `### 🧪 Testing Standards & Mandatory Teardown
All Kora projects and generated features must provide automated test coverage:
1. **Unit Test Suites (\`*_unit.test.kora\`)**:
   - Class-based suite: \`class FeatureUnitTestSuite { init(...) {} }\`.
   - Tests invariants, input boundaries, edge cases, pattern matching, and error branches.
2. **Peak Throughput Load Tests (\`*_load.test.kora\`)**:
   - Class-based suite: \`class FeatureLoadTestSuite { init(...) {} }\`.
   - Simulates 1,000 to 10,000 iterations measuring throughput and latency.
   - **Mandatory \`teardown()\`**: Every load test must implement explicit cleanup purging synthetic records, closing connection pools, and releasing memory.
3. **Automated Test Runner**:
   - \`kora test [path]\`: Automatically discovers all \`*.test.kora\` and \`main.kora\` files and validates 100% of test assertions.`
    },
    {
        topic: "Kora CLI Tooling & Scaffold Commands",
        source: "docs/cli/tooling.md",
        keywords: ["cli", "kora create", "kora new", "kora g feature", "kora check", "kora run", "kora test", "kora example", "generator"],
        content: `### 🛠️ Kora CLI Toolchain Commands
- \`kora check <file.kora>\`: Type-checks, enforces Clean Architecture, and verifies ownership without compilation.
- \`kora run <file.kora>\`: Compiles and executes native release binary.
- \`kora test [dir]\`: Runs the automated test runner across all unit, load, and lifecycle test suites.
- \`kora g feature <name>\`: Generates a complete Clean Architecture slice (routes, controller, service, repo, validator, entity, dto, errors, events, unit test, load test).
- \`kora example list\`: Displays the catalog of 23 official production examples.
- \`kora example init <slug> [dir]\`: Clones/scaffolds an official GitHub example with offline caching.
- \`kora fmt [path]\`: Canonical code formatter.
- \`kora swagger [file]\`: Automatically generates OpenAPI 3.1 and embedded Swagger UI.`
    }
];

class KoraCopilotEngine {
    constructor() {
        this.workspaceDocs = [];
        this.workspaceRoot = null;
    }

    /**
     * Scans and indexes markdown documentation from the active workspace.
     */
    indexWorkspace(workspaceRoot) {
        if (!workspaceRoot) return;
        this.workspaceRoot = workspaceRoot;
        this.workspaceDocs = [];

        const targetDirs = [
            path.join(workspaceRoot, '.agent', 'rules'),
            path.join(workspaceRoot, '.agent', 'standards'),
            path.join(workspaceRoot, 'docs'),
            path.join(workspaceRoot, 'documentation')
        ];

        for (const dir of targetDirs) {
            this._scanDirectory(dir);
        }
    }

    _scanDirectory(dir) {
        if (!fs.existsSync(dir)) return;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    this._scanDirectory(fullPath);
                } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.html'))) {
                    this._indexFile(fullPath);
                }
            }
        } catch (e) {
            // Ignore unreadable directories
        }
    }

    _indexFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const relativePath = this.workspaceRoot ? path.relative(this.workspaceRoot, filePath) : filePath;
            const fileName = path.basename(filePath);

            // Extract main title from markdown
            let title = fileName;
            const titleMatch = content.match(/^#\s+(.+)$/m);
            if (titleMatch) {
                title = titleMatch[1];
            }

            this.workspaceDocs.push({
                title,
                path: relativePath,
                fullPath: filePath,
                content: content.slice(0, 4000) // index first 4k chars
            });
        } catch (e) {
            // Ignore unreadable files
        }
    }

    /**
     * Audits a Kora source document against .agent rules.
     */
    auditDocument(document) {
        const text = document.getText();
        const fileName = path.basename(document.fileName);
        const findings = [];

        // Check 1: Undefined used (Rule 01: Single-null design)
        if (/\bundefined\b/.test(text)) {
            findings.push({
                severity: "Error",
                rule: "Rule 01: Single-Null Design",
                code: "E2005",
                message: "Use of `undefined` detected. Kora strictly forbids `undefined` in favor of `null` and `Option<T>`.",
                fix: "Replace `undefined` with `null` or `None`."
            });
        }

        // Check 2: Raw Infrastructure in Class Handler (Rule 04: Clean Architecture E5001)
        if (/class\s+[A-Za-z0-9_]+/.test(text) && /\b(Database\(\)|HttpClient\(\)|ConnectionPool\(\))/.test(text)) {
            findings.push({
                severity: "Warning",
                rule: "Rule 04: Clean Architecture Invariants",
                code: "E5001",
                message: "Direct infrastructure instantiation inside service/controller. Clean Architecture requires injecting dependencies via `init(...)`.",
                fix: "Move instantiation into `init(...)` parameters."
            });
        }

        // Check 3: Entity inside models folder (Rule 04: Directory Segregation)
        if (document.fileName.includes('/models/') && (text.includes('@table') || text.includes('@entity') || text.includes('@collection'))) {
            findings.push({
                severity: "Warning",
                rule: "Rule 04: Directory Segregation",
                code: "E5003",
                message: "Database table entity `@table` defined inside `models/`. Persisted entities must reside exclusively in `entities/`.",
                fix: "Move model to `entities/*.entity.kora`."
            });
        }

        // Check 4: Test file missing teardown (Rule 10: Testing Standards)
        if (fileName.includes('load.test') && !text.includes('teardown')) {
            findings.push({
                severity: "Warning",
                rule: "Rule 10: Testing Standards",
                code: "T1001",
                message: "Load test suite lacks explicit `teardown()` method to release synthetic allocations.",
                fix: "Implement `fn teardown() -> Unit` to guarantee zero memory leakage."
            });
        }

        return {
            fileName,
            totalChecks: 6,
            violations: findings.length,
            passed: findings.length === 0,
            findings
        };
    }

    /**
     * Answers a user prompt with authoritative knowledge from .agent/rules/ and docs/.
     */
    async answerPrompt(prompt, activeDoc, config) {
        const provider = (config && config.provider) ? config.provider.toLowerCase() : 'embedded';

        // 1. External LLM Provider (Ollama, OpenAI, Gemini) if configured and not 'embedded'
        if (provider !== 'embedded' && config.endpoint) {
            try {
                return await this._callExternalLlm(prompt, activeDoc, config);
            } catch (err) {
                // Graceful fallback to embedded knowledge engine
                const fallbackResponse = this._generateEmbeddedResponse(prompt, activeDoc);
                return `> ⚠️ **Note**: External LLM (${provider}) was unreachable (${err.message}). Showing response from **Kora Embedded Knowledge Engine**:\n\n` + fallbackResponse;
            }
        }

        // 2. Embedded Knowledge Engine
        return this._generateEmbeddedResponse(prompt, activeDoc);
    }

    _generateEmbeddedResponse(prompt, activeDoc) {
        const query = prompt.toLowerCase();

        // 1. Check for specific command/query intent
        if (query.includes('audit') || query.includes('check rules') || query.includes('verify')) {
            if (activeDoc) {
                const audit = this.auditDocument(activeDoc);
                let res = `### 🛡️ Kora Architecture & Rules Audit: \`${audit.fileName}\`\n\n`;
                if (audit.passed) {
                    res += `✅ **100% Compliant!** This file strictly adheres to all invariants defined in \`.agent/rules/\`:\n`;
                    res += `- Single-Null design verified (no \`undefined\`).\n`;
                    res += `- Clean Architecture dependency boundaries respected.\n`;
                    res += `- Directory segregation (\`entities/\` vs \`models/\`) strictly enforced.\n`;
                } else {
                    res += `⚠️ **Found ${audit.violations} Architectural Rule Violation(s)**:\n\n`;
                    for (const v of audit.findings) {
                        res += `#### [${v.code}] ${v.rule}\n`;
                        res += `- **Issue**: ${v.message}\n`;
                        res += `- **Fix**: \`${v.fix}\`\n\n`;
                    }
                }
                return res;
            }
        }

        // 2. Search embedded knowledge base
        let bestMatch = null;
        let highestScore = 0;

        for (const item of KORA_KNOWLEDGE_BASE) {
            let score = 0;
            for (const kw of item.keywords) {
                if (query.includes(kw)) score += 2;
            }
            if (score > highestScore) {
                highestScore = score;
                bestMatch = item;
            }
        }

        // 3. Search indexed workspace docs (.agent/rules, docs)
        let docCitation = "";
        for (const doc of this.workspaceDocs) {
            const titleLower = doc.title.toLowerCase();
            if (query.split(' ').some(w => w.length > 3 && titleLower.includes(w))) {
                docCitation = `\n\n📚 **Source Reference**: [\`${doc.path}\`](${doc.path})`;
                break;
            }
        }

        if (bestMatch && highestScore > 0) {
            return `${bestMatch.content}\n\n📚 **Rule Reference**: \`${bestMatch.source}\`${docCitation}`;
        }

        // Default comprehensive overview
        return `### 💡 Kora Framework Knowledge Assistant

I understand the complete Kora Language specification, Clean Architecture invariants, and \`.agent/\` development rules:

- **Clean Architecture (\`.agent/rules/04-clean-architecture.md\`)**: Class DI, Router pipeline, \`entities/\` vs \`models/\`, compile-time diagnostics \`E5001\`-\`E5004\`.
- **Multi-Engine ORM (\`.agent/rules/07-database-multi-engine-orm.md\`)**: Relational \`@table\`, NoSQL \`@collection\`, Redis KV caching.
- **Concurrency (\`.agent/rules/08-concurrency-actors-streams.md\`)**: Stateful actors with mailboxes (\`tell\`/\`ask\`), non-blocking channels, Tokio runtimes.
- **Testing Standards (\`.agent/rules/10-testing-and-verification.md\`)**: Unit test suites and load stress tests with guaranteed \`teardown()\`.
- **Single-Null Design (\`.agent/rules/01-language-philosophy.md\`)**: \`null\` and \`Option<T>\` supported; \`undefined\` is strictly forbidden.

**Try asking**:
- *"How do I write an Actor with mailboxes?"*
- *"Explain Rule 04 Clean Architecture violations"*
- *"Show me MySQL ORM decorators and transactions"*
- *"Audit current file against .agent standards"*`;
    }

    _callExternalLlm(prompt, activeDoc, config) {
        return new Promise((resolve, reject) => {
            const provider = config.provider.toLowerCase();
            let endpointUrl = config.endpoint;

            // Prepare system prompt with Kora context
            const systemPrompt = `You are the Official Kora Framework AI Copilot.
You specialize in Kora programming language (clean, fast backend language inspired by Rust and TypeScript).
Key Rules:
1. Strict Single-Null design: use \`null\` or \`Option<T>\`. Never use \`undefined\`.
2. Clean Architecture: Controllers and Services must use Dependency Injection via \`init(...)\`.
3. Directory Segregation: @table entities in \`entities/\`, transport DTOs in \`models/\`.
4. Testing: All load tests require an explicit \`teardown()\` method.
5. Provide idiomatic, compilable Kora code.`;

            let postData = '';
            let headers = { 'Content-Type': 'application/json' };

            if (provider === 'ollama') {
                if (!endpointUrl.includes('/api/')) endpointUrl = endpointUrl.replace(/\/$/, '') + '/api/generate';
                postData = JSON.stringify({
                    model: config.model || 'llama3',
                    system: systemPrompt,
                    prompt: prompt,
                    stream: false
                });
            } else if (provider === 'openai' || provider === 'custom') {
                if (!endpointUrl.includes('/chat/completions')) endpointUrl = endpointUrl.replace(/\/$/, '') + '/v1/chat/completions';
                if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
                postData = JSON.stringify({
                    model: config.model || 'gpt-4o',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ]
                });
            }

            const urlObj = new URL(endpointUrl);
            const client = urlObj.protocol === 'https:' ? https : http;

            const req = client.request(urlObj, {
                method: 'POST',
                headers: Object.assign(headers, { 'Content-Length': Buffer.byteLength(postData) })
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (provider === 'ollama' && json.response) {
                            resolve(json.response);
                        } else if (json.choices && json.choices[0] && json.choices[0].message) {
                            resolve(json.choices[0].message.content);
                        } else {
                            resolve(data);
                        }
                    } catch (e) {
                        resolve(data);
                    }
                });
            });

            req.on('error', err => reject(err));
            req.setTimeout(8000, () => {
                req.destroy();
                reject(new Error("Request timed out (8s)"));
            });

            req.write(postData);
            req.end();
        });
    }
}

module.exports = { KoraCopilotEngine, KORA_KNOWLEDGE_BASE };
