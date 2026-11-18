const vscode = require('vscode');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { KoraCopilotEngine } = require('./kora-copilot-engine');

let diagnosticCollection;
let validationTimeouts = new Map();
let statusBarItem;
let assistantViewProvider;
let copilotEngine;
let lastActiveKoraDocument = null;

/**
 * Safely escape characters for RegExp dynamic interpolation (prevents ReDoS and syntax errors)
 */
function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Official 23 Examples Metadata Catalog
 */
const EXAMPLES_CATALOG = [
    { slug: "01_hello_world", name: "Hello World & Baseline", category: "Core", difficulty: "Beginner", desc: "Pure models, enums, pattern matching, OrderProcessor and Clean Architecture baseline" },
    { slug: "02_clean_architecture_users", name: "Clean Architecture Users", category: "Architecture", difficulty: "Beginner", desc: "Class-based DI, User controller, service, repository interface, and validation" },
    { slug: "03_crud_products_api", name: "CRUD Products API", category: "Web & API", difficulty: "Intermediate", desc: "RESTful HTTP endpoints, paginated lists, in-memory repository, and CRUD mutations" },
    { slug: "04_mysql_database_orm", name: "MySQL Database ORM", category: "Database", difficulty: "Intermediate", desc: "Type-safe SQL queries, ACID transactions, connection pool, and NoSQL audit trail" },
    { slug: "05_jwt_auth_argon2", name: "JWT Auth & Argon2", category: "Security", difficulty: "Intermediate", desc: "Argon2 password hashing, cryptographically signed JWT tokens, and RBAC guards" },
    { slug: "06_realtime_websockets", name: "Realtime WebSockets", category: "Realtime", difficulty: "Intermediate", desc: "WebSocket connection hub, room presence, broadcast channels, and event subscriptions" },
    { slug: "07_async_actors_concurrency", name: "Async Actors Concurrency", category: "Concurrency", difficulty: "Advanced", desc: "Tokio-backed stateful actors, mailboxes, fire-and-forget `tell`, and query `ask`" },
    { slug: "08_openapi_swagger", name: "OpenAPI & Swagger UI", category: "Documentation", difficulty: "Beginner", desc: "Declarative OpenAPI 3.1 schema extraction and embedded dark-themed Swagger UI" },
    { slug: "09_enterprise_clean_architecture", name: "Enterprise Clean Architecture", category: "Enterprise", difficulty: "Advanced", desc: "Enterprise layered architecture with events, repositories, domain errors, and DI" },
    { slug: "10_dto_validation_and_types", name: "DTO Validation & Types", category: "Validation", difficulty: "Intermediate", desc: "Custom decorators (@email, @min, @max, @required), nested DTOs, and RFC errors" },
    { slug: "11_operators_control_flow_and_resilience", name: "Operators & Resilience", category: "Core", difficulty: "Intermediate", desc: "Pipeline operators, loops, break/continue, and try/catch/finally resilience" },
    { slug: "12_microservice_event_driven", name: "Microservice Event-Driven", category: "Enterprise", difficulty: "Advanced", desc: "Asynchronous event bus, domain event storage, message serialization, and consumers" },
    { slug: "13_modular_monolith_ecommerce", name: "Modular Monolith E-Commerce", category: "Architecture", difficulty: "Advanced", desc: "Multi-bounded context (Catalog, Billing, Orders) within a single compile unit" },
    { slug: "14_realtime_iot_telemetry", name: "Realtime IoT Telemetry", category: "IoT", difficulty: "Advanced", desc: "High-throughput sensor ingestion, ring buffer windows, and anomaly alerting" },
    { slug: "15_data_structures_sequential", name: "Sequential Data Structures", category: "Data Structures", difficulty: "Intermediate", desc: "Native Vector, LinkedList, Stack (LIFO), Queue (FIFO), and CircularBuffer" },
    { slug: "16_data_structures_associative", name: "Associative Data Structures", category: "Data Structures", difficulty: "Intermediate", desc: "HashMap, Map literals, BTreeMap sorted indexing, and fast key-value lookups" },
    { slug: "17_data_structures_sets", name: "Set Data Structures", category: "Data Structures", difficulty: "Intermediate", desc: "HashSet, TreeSet, BitSet flag manipulation, and set algebra operations" },
    { slug: "18_data_structures_specialized", name: "Specialized Data Structures", category: "Data Structures", difficulty: "Advanced", desc: "MinHeap/MaxHeap, LRU Cache with eviction, Prefix Trie, and Graph algorithms" },
    { slug: "19_type_inference_and_types", name: "Type Inference & ADTs", category: "Language", difficulty: "Intermediate", desc: "Hindley-Milner type inference, Algebraic Data Types, and exhaustive matching" },
    { slug: "20_concurrency_and_streams", name: "Concurrency & Streams", category: "Concurrency", difficulty: "Advanced", desc: "Async stream pipelines, batch buffering, backpressure, and concurrent workers" },
    { slug: "21_caching_and_kv_store", name: "Caching & Key-Value Store", category: "Database", difficulty: "Intermediate", desc: "In-memory Key-Value store with TTL expiration, atomic counters, and rate limiting" },
    { slug: "22_nosql_document_store", name: "NoSQL Document Store", category: "Database", difficulty: "Intermediate", desc: "Document collection storage, JSON querying, indexing, and projection filters" },
    { slug: "23_enterprise_reporting_media_email", name: "Enterprise Reporting & Media", category: "Enterprise", difficulty: "Advanced", desc: "Streaming PDF generation, CSV tabular export, and TLS SMTP email dispatch" }
];

/**
 * Analyzes a Kora document to determine structure, runnable status, and symbols.
 */
function analyzeKoraDocument(document) {
    if (!document) return null;
    const text = document.getText();
    const fileName = path.basename(document.fileName);

    const hasMain = /fn\s+main\s*\(/.test(text);
    const hasListen = /app\.listen\s*\(/.test(text) || /\.listen\s*\(/.test(text);
    const isTestFile = fileName.includes('test') || /class\s+[A-Za-z0-9_]*Test/.test(text);
    const hasRoutes = /class\s+[A-Za-z0-9_]*Routes/.test(text) || /\b(get|post|put|delete)\s*\(/.test(text);
    const hasController = /class\s+[A-Za-z0-9_]*Controller/.test(text);
    const hasService = /class\s+[A-Za-z0-9_]*Service/.test(text);
    const hasRepository = /class\s+[A-Za-z0-9_]*Repository/.test(text) || /interface\s+[A-Za-z0-9_]*Repository/.test(text);
    const hasEntity = /@table\s*\(/.test(text) || /@entity\b/.test(text);
    const hasModel = /\bmodel\s+[A-Za-z0-9_]+/.test(text);
    const hasActor = /class\s+[A-Za-z0-9_]*Actor/.test(text);

    let classification = "Library Module";
    let icon = "";
    let isRunnable = false;
    let runCommand = null;

    if (isTestFile) {
        classification = "Automated Test Suite";
        icon = "";
        isRunnable = true;
        runCommand = "kora.runTests";
    } else if (hasMain || hasListen) {
        classification = "Runnable Entrypoint";
        icon = "";
        isRunnable = true;
        runCommand = "kora.runFile";
    } else if (hasController) {
        classification = "Clean Architecture Controller";
        icon = "";
    } else if (hasService) {
        classification = "Clean Architecture Service";
        icon = "";
    } else if (hasRepository) {
        classification = "Data Access Repository";
        icon = "";
    } else if (hasEntity) {
        classification = "Database Entity (@table)";
        icon = "";
    } else if (hasModel) {
        classification = "Pure DTO Model";
        icon = "";
    } else if (hasRoutes) {
        classification = "HTTP Routing Module";
        icon = "";
    } else if (hasActor) {
        classification = "Concurrency Actor";
        icon = "";
    }

    // Extract symbols
    const symbols = [];
    const symRegex = /\b(pub\s+)?(model|class|interface|enum|fn)\s+([A-Za-z0-9_]+)/g;
    let m;
    while ((m = symRegex.exec(text)) !== null) {
        symbols.push({ kind: m[2], name: m[3] });
    }

    // Extract imports
    const imports = [];
    const impRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s*["']([^"']+)["']/g;
    let im;
    while ((im = impRegex.exec(text)) !== null) {
        imports.push({ symbols: im[1].split(',').map(s => s.trim()), path: im[2] });
    }

    return {
        fileName,
        filePath: document.fileName,
        classification,
        icon,
        isRunnable,
        runCommand,
        symbols,
        imports,
        lineCount: document.lineCount,
        hasMain,
        isTestFile
    };
}

/**
 * Activates the Kora Language Extension.
 */
function activate(context) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('kora');
    context.subscriptions.push(diagnosticCollection);

    // 0. Initialize Kora Copilot Engine & Index Workspace Knowledge
    copilotEngine = new KoraCopilotEngine(context.extensionUri, vscode);
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
        copilotEngine.indexWorkspace(root);
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(e => {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                copilotEngine.indexWorkspace(vscode.workspace.workspaceFolders[0].uri.fsPath);
            }
        })
    );

    // 1. Status Bar Item for Smart Executable Detection
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'kora.smartRun';
    context.subscriptions.push(statusBarItem);

    // 1b. Persistent Status Bar Item for Kora AI Copilot (Right Side)
    const aiStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    aiStatusBarItem.command = 'kora.focusChat';
    aiStatusBarItem.text = 'Kora AI';
    aiStatusBarItem.tooltip = 'Open Kora AI Copilot (Right Sidebar)';
    aiStatusBarItem.show();
    context.subscriptions.push(aiStatusBarItem);

    function updateStatusBar() {
        const editor = vscode.window.activeTextEditor;
        if (editor && isKoraFile(editor.document)) {
            lastActiveKoraDocument = editor.document;
            const analysis = analyzeKoraDocument(editor.document);
            if (analysis.isRunnable) {
                statusBarItem.text = `${analysis.icon} Kora: ${analysis.classification} (Click to Run)`;
                statusBarItem.tooltip = `Click to execute ${analysis.fileName} with Kora`;
                statusBarItem.backgroundColor = undefined;
            } else {
                statusBarItem.text = `Kora: ${analysis.classification}`;
                statusBarItem.tooltip = `${analysis.fileName} is a Clean Architecture component. Click to check syntax & rules.`;
            }
            statusBarItem.show();

            if (assistantViewProvider) {
                assistantViewProvider.updateActiveFile(analysis);
            }
        } else if (lastActiveKoraDocument) {
            const analysis = analyzeKoraDocument(lastActiveKoraDocument);
            statusBarItem.text = `Kora: ${analysis.classification}`;
            statusBarItem.tooltip = `Last active: ${analysis.fileName} (Click to Run)`;
            statusBarItem.show();
        } else {
            statusBarItem.text = `Kora: Workspace Active`;
            statusBarItem.tooltip = `Kora Framework extension active. Click to run entrypoint or test suite.`;
            statusBarItem.show();
        }
    }

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updateStatusBar),
        vscode.workspace.onDidChangeTextDocument(e => {
            if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
                updateStatusBar();
            }
        })
    );
    updateStatusBar();

    // 2. Real-time Syntax & Type Checking (with Debounce)
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => scheduleValidation(doc, 0)),
        vscode.workspace.onDidChangeTextDocument(e => scheduleValidation(e.document, 350)),
        vscode.workspace.onDidSaveTextDocument(doc => scheduleValidation(doc, 0)),
        vscode.workspace.onDidCloseTextDocument(doc => {
            diagnosticCollection.delete(doc.uri);
            validationTimeouts.delete(doc.uri.toString());
        })
    );

    if (vscode.window.activeTextEditor) {
        scheduleValidation(vscode.window.activeTextEditor.document, 0);
    }

    // 3. Register Kora AI Assistant & Copilot Webview View Provider
    assistantViewProvider = new KoraAssistantViewProvider(context.extensionUri, copilotEngine);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('kora.assistantView', assistantViewProvider)
    );

    // 4. Intelligent Autocompletion Provider
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        'kora',
        {
            provideCompletionItems(document, position, token, completionContext) {
                const completions = [];

                // Keywords
                const keywords = [
                    { label: 'model', detail: 'Pure immutable Data Transfer Object / Domain Model', kind: vscode.CompletionItemKind.Class, snippet: 'model ${1:Name} {\n\t${2:field}: ${3:String}\n}' },
                    { label: 'class', detail: 'Stateful service class with Dependency Injection', kind: vscode.CompletionItemKind.Class, snippet: 'class ${1:Name}Service implements ${2:Interface} {\n\tdb: Database\n\n\tinit(db: Database) {\n\t\tthis.db = db\n\t}\n\n\tfn ${3:execute}() -> ${4:Unit} {\n\t\t${0}\n\t}\n}' },
                    { label: 'interface', detail: 'Behavioral contract interface', kind: vscode.CompletionItemKind.Interface, snippet: 'interface ${1:Name} {\n\tfn ${2:method}(${3:param}: ${4:Type}) -> ${5:ReturnType}\n}' },
                    { label: 'enum', detail: 'Type-safe enumerated variants', kind: vscode.CompletionItemKind.Enum, snippet: 'enum ${1:Name} {\n\t${2:Active},\n\t${3:Inactive}\n}' },
                    { label: 'actor', detail: 'Isolated stateful actor concurrency construct', kind: vscode.CompletionItemKind.Class, snippet: 'class ${1:Name}Actor {\n\tvar state: ${2:Int}\n\n\tinit() {\n\t\tthis.state = 0\n\t}\n\n\tfn handle(msg: ${3:String}) -> ${4:Int} {\n\t\t${0}\n\t}\n}' },
                    { label: 'let', detail: 'Declare an immutable binding', kind: vscode.CompletionItemKind.Keyword, snippet: 'let ${1:name} = ${2:value}' },
                    { label: 'var', detail: 'Declare a mutable binding', kind: vscode.CompletionItemKind.Keyword, snippet: 'var ${1:name} = ${2:value}' },
                    { label: 'const', detail: 'Declare a compile-time constant', kind: vscode.CompletionItemKind.Keyword, snippet: 'const ${1:NAME} = ${2:value}' },
                    { label: 'for', detail: 'For-in loop over collections or ranges', kind: vscode.CompletionItemKind.Keyword, snippet: 'for ${1:item} in ${2:collection} {\n\t${0}\n}' },
                    { label: 'try', detail: 'Try-catch error resilience block', kind: vscode.CompletionItemKind.Keyword, snippet: 'try {\n\t${1}\n} catch (${2:err}) {\n\t${0}\n}' },
                    { label: 'fn', detail: 'Function declaration', kind: vscode.CompletionItemKind.Function, snippet: 'fn ${1:name}(${2:params}) -> ${3:Unit} {\n\t${0}\n}' },
                    { label: 'match', detail: 'Exhaustive pattern matching expression', kind: vscode.CompletionItemKind.Keyword, snippet: 'match ${1:expr} {\n\tSome(${2:val}) => ${3:val},\n\tNone => ${4:fallback},\n}' },
                    { label: 'channel', detail: 'Create a non-blocking MPSC channel', kind: vscode.CompletionItemKind.Function, snippet: 'channel<${1:Type}>(${2:100})' },
                    { label: 'broadcast', detail: 'Create a multi-consumer broadcast channel', kind: vscode.CompletionItemKind.Function, snippet: 'broadcast<${1:Type}>(${2:100})' },
                    { label: 'spawn', detail: 'Spawn a concurrent background task', kind: vscode.CompletionItemKind.Function, snippet: 'spawn(async () => {\n\t${0}\n})' }
                ];

                for (const kw of keywords) {
                    const item = new vscode.CompletionItem(kw.label, kw.kind);
                    item.detail = `Kora: ${kw.detail}`;
                    if (kw.snippet) item.insertText = new vscode.SnippetString(kw.snippet);
                    completions.push(item);
                }

                // Types
                const types = ['Int', 'Float', 'Bool', 'String', 'Unit', 'Option', 'Result', 'Database', 'Request', 'Response', 'App', 'Vector', 'HashMap', 'Stack', 'Queue', 'CircularBuffer', 'TaskGroup'];
                for (const ty of types) {
                    const item = new vscode.CompletionItem(ty, vscode.CompletionItemKind.TypeParameter);
                    item.detail = `Kora Type: ${ty}`;
                    completions.push(item);
                }

                // Decorators
                const decorators = ['@entity', '@table', '@primary', '@autoIncrement', '@unique', '@index', '@required', '@email', '@min', '@max', '@default', '@column', '@collection', '@id'];
                for (const dec of decorators) {
                    const item = new vscode.CompletionItem(dec, vscode.CompletionItemKind.Property);
                    item.detail = `Kora Decorator: ${dec}`;
                    completions.push(item);
                }

                // Context-aware member completions (e.g. user. -> fields of User)
                const linePrefix = document.lineAt(position).text.substr(0, position.character);
                if (linePrefix.endsWith('.')) {
                    const match = linePrefix.match(/([A-Za-z0-9_]+)\.$/);
                    if (match) {
                        const varName = match[1];
                        if (varName === 'app') {
                            return ['listen(port)', 'get(path, handler)', 'post(path, handler)', 'put(path, handler)', 'delete(path, handler)', 'use(middleware)'].map(m => {
                                const item = new vscode.CompletionItem(m.split('(')[0], vscode.CompletionItemKind.Method);
                                item.detail = `App.${m}`;
                                return item;
                            });
                        }
                        if (varName === 'db') {
                            return ['query(sql)', 'execute(sql)', 'begin()', 'commit()', 'rollback()', 'collection(name)', 'set(k, v)', 'get(k)'].map(m => {
                                const item = new vscode.CompletionItem(m.split('(')[0], vscode.CompletionItemKind.Method);
                                item.detail = `Database.${m}`;
                                return item;
                            });
                        }
                        if (varName === 'actor') {
                            return ['tell(message)', 'ask(message)', 'state'].map(m => {
                                const item = new vscode.CompletionItem(m.split('(')[0], vscode.CompletionItemKind.Method);
                                item.detail = `Actor.${m}`;
                                return item;
                            });
                        }
                        if (varName === 'channel') {
                            return ['send(item)', 'recv()', 'capacity'].map(m => {
                                const item = new vscode.CompletionItem(m.split('(')[0], vscode.CompletionItemKind.Method);
                                item.detail = `Channel.${m}`;
                                return item;
                            });
                        }

                        const text = document.getText();
                        const safeVar = escapeRegex(varName);
                        const typeRegex = new RegExp(`(?:let|var|param)\\s+${safeVar}\\s*(?::\\s*([A-Za-z0-9_]+)|=\\s*([A-Za-z0-9_]+)\\s*\\{)`);
                        const typeMatch = text.match(typeRegex);
                        const typeName = typeMatch ? (typeMatch[1] || typeMatch[2]) : varName;

                        const safeType = escapeRegex(typeName);
                        const modelRegex = new RegExp(`(?:model|class|interface)\\s+${safeType}\\s*(?:implements\\s+[^{]+)?\\{([^}]+)\\}`, 's');
                        const modelMatch = text.match(modelRegex);
                        if (modelMatch) {
                            const body = modelMatch[1];
                            const memberCompletions = [];
                            for (const fl of body.split('\n')) {
                                const fMatch = fl.trim().match(/^([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_?<>[\]]+)/);
                                if (fMatch) {
                                    const item = new vscode.CompletionItem(fMatch[1], vscode.CompletionItemKind.Field);
                                    item.detail = `${typeName}.${fMatch[1]}: ${fMatch[2]}`;
                                    memberCompletions.push(item);
                                }
                                const mMatch = fl.trim().match(/^fn\s+([A-Za-z0-9_]+)\s*\((.*?)\)(\s*->\s*([A-Za-z0-9_?<>[\]]+))?/);
                                if (mMatch) {
                                    const item = new vscode.CompletionItem(mMatch[1], vscode.CompletionItemKind.Method);
                                    item.detail = `fn ${typeName}.${mMatch[1]}(${mMatch[2]}) -> ${mMatch[4] || 'Unit'}`;
                                    memberCompletions.push(item);
                                }
                            }
                            if (memberCompletions.length > 0) return memberCompletions;
                        }
                    }
                }

                return completions;
            }
        },
        '.', '@'
    );
    context.subscriptions.push(completionProvider);

    // 4b. Rich Hover Documentation Provider
    const hoverProvider = vscode.languages.registerHoverProvider('kora', {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            if (!range) return null;
            const word = document.getText(range);

            const decoratorDocs = {
                'table': '### `@table("table_name")`\nMaps a class to a relational database table.\n- **Layer**: Core Entities (`src/entities/`)\n- **Rule**: Rule 04 & 07 (Clean Architecture & Database Invariants)',
                'collection': '### `@collection("name")`\nMaps a class to a NoSQL document collection.\n- **Layer**: Core Entities (`src/entities/`)',
                'primary': '### `@primary`\nDesignates the primary key identifier for database persistence.',
                'autoIncrement': '### `@autoIncrement`\nSpecifies that the integer identifier auto-increments upon insert.',
                'required': '### `@required`\nField-level validation constraint ensuring value is non-null and non-empty.',
                'email': '### `@email`\nField-level validation constraint enforcing valid RFC 5322 email formatting.',
                'min': '### `@min(val)`\nEnforces numerical minimum bound.',
                'max': '### `@max(val)`\nEnforces numerical maximum bound.'
            };
            if (decoratorDocs[word]) {
                return new vscode.Hover(new vscode.MarkdownString(decoratorDocs[word]));
            }

            const keywordDocs = {
                'model': '### `model <Name>`\n**Pure Immutable Data Transfer Object (DTO)**\n- Used for API request/response payloads and domain models.\n- Cannot contain mutable methods or direct database mappings (Rule 04).',
                'class': '### `class <Name>`\n**Service, Repository, or Actor Class**\n- Implements domain workflows or interfaces.\n- Must declare dependencies in `init(...)` for compile-time Dependency Injection (Rule 04).',
                'interface': '### `interface <Name>`\n**Contract Specification**\n- Defines abstract method signatures without concrete implementation.\n- High-level services must depend on interfaces rather than drivers (Rule 04).',
                'init': '### `init(...)`\n**Class Constructor**\n- Initializes instance state and receives injected dependency interfaces.',
                'fn': '### `fn <name>(params) -> ReturnType`\n**Function or Method Declaration**\n- Compiles to verified, zero-cost native machine code.',
                'actor': '### `actor` / `class <Name>Actor`\n**Stateful Concurrency Actor**\n- Isolated mutable state executing on Tokio worker threads with non-blocking mailboxes (Rule 08).',
                'tell': '### `actor.tell(msg)`\n**Fire-and-forget message dispatch** to actor mailbox.',
                'ask': '### `actor.ask(msg)`\n**Request-response async query** to actor with timeout resilience.',
                'channel': '### `channel<T>(capacity)`\n**MPSC Bounded Channel** for non-blocking stream pipelines.',
                'null': '### `null`\n**Single-Null Standard (Rule 01)**\n- Kora strictly forbids `undefined`. Null represents the intentional absence of a value.'
            };
            if (keywordDocs[word]) {
                return new vscode.Hover(new vscode.MarkdownString(keywordDocs[word]));
            }

            const text = document.getText();
            const safeWord = escapeRegex(word);
            const modelMatch = text.match(new RegExp(`model\\s+${safeWord}\\s*\\{([^}]+)\\}`));
            if (modelMatch) {
                return new vscode.Hover(new vscode.MarkdownString(`### Model \`${word}\` (Pure DTO)\n\`\`\`kora\nmodel ${word} {\n${modelMatch[1].trim()}\n}\n\`\`\`\n- **Layer**: Boundary DTO / Domain Model`));
            }

            const fnMatch = text.match(new RegExp(`(async\\s+)?fn\\s+${safeWord}\\s*\\((.*?)\\)(\\s*->\\s*([A-Za-z0-9_?<>\\[\\]]+))?`));
            if (fnMatch) {
                return new vscode.Hover(new vscode.MarkdownString(`### Function \`${word}\`\n\`\`\`kora\n${fnMatch[0]}\n\`\`\`\n- **Return**: \`${fnMatch[4] || 'Unit'}\`\n- **Async**: ${fnMatch[1] ? 'Yes (Tokio)' : 'No'}`));
            }

            return null;
        }
    });
    context.subscriptions.push(hoverProvider);

    // 4c. Go to Definition Provider (F12)
    const definitionProvider = vscode.languages.registerDefinitionProvider('kora', {
        provideDefinition(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            if (!range) return null;
            const word = document.getText(range);

            const text = document.getText();
            const lines = text.split('\n');
            const safeWord = escapeRegex(word);

            const defRegexes = [
                new RegExp(`\\bmodel\\s+${safeWord}\\b`),
                new RegExp(`\\bclass\\s+${safeWord}\\b`),
                new RegExp(`\\binterface\\s+${safeWord}\\b`),
                new RegExp(`\\benum\\s+${safeWord}\\b`),
                new RegExp(`\\bfn\\s+${safeWord}\\s*\\(`),
                new RegExp(`\\b(?:let|var)\\s+${safeWord}\\b`)
            ];

            for (let i = 0; i < lines.length; i++) {
                for (const rx of defRegexes) {
                    const m = lines[i].match(rx);
                    if (m) {
                        const col = lines[i].indexOf(word);
                        return new vscode.Location(document.uri, new vscode.Position(i, col >= 0 ? col : 0));
                    }
                }
            }
            return null;
        }
    });
    context.subscriptions.push(definitionProvider);

    // 4d. Document Symbol Provider (Outline View & Breadcrumbs)
    const documentSymbolProvider = vscode.languages.registerDocumentSymbolProvider('kora', {
        provideDocumentSymbols(document, token) {
            const symbols = [];
            const lines = document.getText().split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                const classMatch = line.match(/class\s+([A-Za-z0-9_]+)/);
                if (classMatch) {
                    const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length));
                    symbols.push(new vscode.DocumentSymbol(classMatch[1], 'Class / Service', vscode.SymbolKind.Class, range, range));
                    continue;
                }

                const modelMatch = line.match(/model\s+([A-Za-z0-9_]+)/);
                if (modelMatch) {
                    const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length));
                    symbols.push(new vscode.DocumentSymbol(modelMatch[1], 'DTO Model', vscode.SymbolKind.Struct, range, range));
                    continue;
                }

                const ifaceMatch = line.match(/interface\s+([A-Za-z0-9_]+)/);
                if (ifaceMatch) {
                    const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length));
                    symbols.push(new vscode.DocumentSymbol(ifaceMatch[1], 'Interface', vscode.SymbolKind.Interface, range, range));
                    continue;
                }

                const enumMatch = line.match(/enum\s+([A-Za-z0-9_]+)/);
                if (enumMatch) {
                    const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length));
                    symbols.push(new vscode.DocumentSymbol(enumMatch[1], 'Enum', vscode.SymbolKind.Enum, range, range));
                    continue;
                }

                const fnMatch = line.match(/fn\s+([A-Za-z0-9_]+)\s*\(/);
                if (fnMatch) {
                    const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length));
                    symbols.push(new vscode.DocumentSymbol(fnMatch[1], 'Function', vscode.SymbolKind.Function, range, range));
                    continue;
                }
            }
            return symbols;
        }
    });
    context.subscriptions.push(documentSymbolProvider);

    // 4e. Document Formatting Provider (Shift+Alt+F)
    const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider('kora', {
        provideDocumentFormattingEdits(document, options, token) {
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );

            const lines = document.getText().split('\n');
            let indentLevel = 0;
            const indentStr = '    ';
            const formattedLines = [];

            for (let rawLine of lines) {
                let line = rawLine.trim();
                if (!line) {
                    formattedLines.push('');
                    continue;
                }

                if (line.startsWith('}') || line.startsWith(']')) {
                    indentLevel = Math.max(0, indentLevel - 1);
                }

                formattedLines.push(indentStr.repeat(indentLevel) + line);

                if (line.endsWith('{') || line.endsWith('[')) {
                    indentLevel++;
                }
            }

            return [vscode.TextEdit.replace(fullRange, formattedLines.join('\n') + '\n')];
        }
    });
    context.subscriptions.push(formattingProvider);

    // 4f. Folding Range Provider
    const foldingProvider = vscode.languages.registerFoldingRangeProvider('kora', {
        provideFoldingRanges(document, context, token) {
            const ranges = [];
            const lines = document.getText().split('\n');
            const stack = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('{')) {
                    stack.push(i);
                }
                if (line.includes('}') && stack.length > 0) {
                    const start = stack.pop();
                    if (i > start) {
                        ranges.push(new vscode.FoldingRange(start, i));
                    }
                }
            }
            return ranges;
        }
    });
    context.subscriptions.push(foldingProvider);

    // 5. Code Action Provider (Lightbulb Quick Fix)
    const codeActionProvider = vscode.languages.registerCodeActionsProvider('kora', {
        provideCodeActions(document, range, contextAction, token) {
            const actions = [];

            for (const diag of contextAction.diagnostics) {
                if (diag.message.includes('E5001') || diag.message.includes('missing constructor') || diag.message.includes('init')) {
                    const fix = new vscode.CodeAction('Add missing `init(...)` constructor', vscode.CodeActionKind.QuickFix);
                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.insert(document.uri, range.start, '\n    init() {\n        // Injected dependencies\n    }\n');
                    fix.diagnostics = [diag];
                    fix.isPreferred = true;
                    actions.push(fix);
                }

                if (diag.message.includes('undefined')) {
                    const fix = new vscode.CodeAction('Replace `undefined` with `null` / `Option` (Rule 01: Single-Null)', vscode.CodeActionKind.QuickFix);
                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.replace(document.uri, range, 'null');
                    fix.diagnostics = [diag];
                    fix.isPreferred = true;
                    actions.push(fix);
                }
            }

            const genTestFix = new vscode.CodeAction('Scaffold Unit & Load Test Suite for this file', vscode.CodeActionKind.Refactor);
            genTestFix.command = {
                command: 'kora.generateTests',
                title: 'Generate Unit & Load Tests',
                arguments: [document.fileName]
            };
            actions.push(genTestFix);

            const auditFix = new vscode.CodeAction('Audit File Against .agent Rules', vscode.CodeActionKind.QuickFix);
            auditFix.command = {
                command: 'kora.auditFile',
                title: 'Audit File Against .agent Rules',
                arguments: [document.fileName]
            };
            actions.push(auditFix);

            return actions;
        }
    });
    context.subscriptions.push(codeActionProvider);

    // 6. CodeLens Provider ("Run Entrypoint", "Run Test Suite", "Audit Rules")
    const codeLensProvider = vscode.languages.registerCodeLensProvider('kora', {
        provideCodeLenses(document, token) {
            const codeLenses = [];
            const docText = document.getText();
            const lines = docText.split('\n');

            for (let i = 0; i < lines.length; i++) {
                if (/fn\s+main\s*\(/.test(lines[i])) {
                    const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, 0));
                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: 'Run Entrypoint',
                            command: 'kora.runFile',
                            arguments: [document.fileName]
                        }),
                        new vscode.CodeLens(range, {
                            title: 'Check Architecture',
                            command: 'kora.checkFile',
                            arguments: [document.fileName]
                        })
                    );
                    break;
                }

                if (/class\s+[A-Za-z0-9_]*Test/.test(lines[i])) {
                    const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, 0));
                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: 'Run Test Suite',
                            command: 'kora.runTests',
                            arguments: [document.fileName]
                        })
                    );
                }
            }

            if (codeLenses.length === 0 && lines.length > 0) {
                const topRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));
                codeLenses.push(
                    new vscode.CodeLens(topRange, {
                        title: 'Check Architecture & Types',
                        command: 'kora.checkFile',
                        arguments: [document.fileName]
                    }),
                    new vscode.CodeLens(topRange, {
                        title: 'Audit Rules',
                        command: 'kora.auditFile',
                        arguments: [document.fileName]
                    }),
                    new vscode.CodeLens(topRange, {
                        title: 'Scaffold Tests',
                        command: 'kora.generateTests',
                        arguments: [document.fileName]
                    })
                );
            }

            return codeLenses;
        }
    });
    context.subscriptions.push(codeLensProvider);

    // Helper to resolve active Kora file with multiple resilient fallbacks (Editor, Sidebar, Indexed Workspace)
    function resolveActiveKoraFile(filePath) {
        if (filePath && typeof filePath === 'string') return filePath;
        if (filePath && filePath.fsPath) return filePath.fsPath;
        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
            return vscode.window.activeTextEditor.document.fileName;
        }
        if (assistantViewProvider && assistantViewProvider.currentAnalysis && assistantViewProvider.currentAnalysis.filePath) {
            return assistantViewProvider.currentAnalysis.filePath;
        }
        if (lastActiveKoraDocument && lastActiveKoraDocument.fileName) {
            return lastActiveKoraDocument.fileName;
        }
        if (copilotEngine && copilotEngine.workspaceEngine && copilotEngine.workspaceEngine.indexedFiles) {
            for (const [fPath, meta] of copilotEngine.workspaceEngine.indexedFiles) {
                if (meta.role === 'entrypoint' || fPath.endsWith('main.kora') || fPath.endsWith('main.kr')) {
                    return fPath;
                }
            }
            for (const [fPath] of copilotEngine.workspaceEngine.indexedFiles) {
                return fPath;
            }
        }
        return null;
    }

    // 7. Register VS Code Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kora.smartRun', (filePath) => {
            const targetFile = resolveActiveKoraFile(filePath);
            if (targetFile && fs.existsSync(targetFile)) {
                const doc = (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName === targetFile)
                    ? vscode.window.activeTextEditor.document
                    : null;
                const analysis = doc ? analyzeKoraDocument(doc) : (assistantViewProvider ? assistantViewProvider.currentAnalysis : null);
                if (analysis && analysis.isTestFile) {
                    vscode.commands.executeCommand('kora.runTests', targetFile);
                } else {
                    vscode.commands.executeCommand('kora.runFile', targetFile);
                }
            } else {
                let terminal = vscode.window.terminals.find(t => t.name === 'Kora Run') || vscode.window.createTerminal('Kora Run');
                terminal.show();
                terminal.sendText('kora run');
            }
        }),

        vscode.commands.registerCommand('kora.runFile', (filePath) => {
            const targetFile = resolveActiveKoraFile(filePath);
            let terminal = vscode.window.terminals.find(t => t.name === 'Kora Run') || vscode.window.createTerminal('Kora Run');
            terminal.show();
            if (targetFile && fs.existsSync(targetFile)) {
                terminal.sendText(`kora run "${targetFile}"`);
            } else {
                terminal.sendText('kora run');
            }
        }),

        vscode.commands.registerCommand('kora.checkFile', (filePath) => {
            const targetFile = resolveActiveKoraFile(filePath);
            let terminal = vscode.window.terminals.find(t => t.name === 'Kora Check') || vscode.window.createTerminal('Kora Check');
            terminal.show();
            if (targetFile && fs.existsSync(targetFile)) {
                terminal.sendText(`kora check "${targetFile}"`);
            } else {
                terminal.sendText('kora check');
            }
        }),

        vscode.commands.registerCommand('kora.runTests', (filePath) => {
            const targetFile = resolveActiveKoraFile(filePath);
            let terminal = vscode.window.terminals.find(t => t.name === 'Kora Test') || vscode.window.createTerminal('Kora Test');
            terminal.show();
            if (targetFile && targetFile.includes('test') && fs.existsSync(targetFile)) {
                terminal.sendText(`kora test "${targetFile}"`);
            } else {
                terminal.sendText('kora test');
            }
        }),

        vscode.commands.registerCommand('kora.formatFile', () => {
            if (vscode.window.activeTextEditor) {
                vscode.commands.executeCommand('editor.action.formatDocument');
            } else {
                let terminal = vscode.window.terminals.find(t => t.name === 'Kora Format') || vscode.window.createTerminal('Kora Format');
                terminal.show();
                terminal.sendText('kora fmt');
            }
        }),

        vscode.commands.registerCommand('kora.auditFile', async (filePath) => {
            const targetFile = resolveActiveKoraFile(filePath);
            let docToAudit = null;
            if (vscode.window.activeTextEditor && (!targetFile || vscode.window.activeTextEditor.document.fileName === targetFile)) {
                docToAudit = vscode.window.activeTextEditor.document;
            } else if (targetFile && fs.existsSync(targetFile)) {
                try {
                    docToAudit = await vscode.workspace.openTextDocument(targetFile);
                } catch (e) {}
            }

            if (docToAudit) {
                const audit = copilotEngine.auditDocument(docToAudit);
                if (assistantViewProvider) {
                    assistantViewProvider.displayAudit(audit);
                    try {
                        vscode.commands.executeCommand('kora.assistantView.focus');
                        vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
                    } catch (e) {}
                }
            } else {
                if (assistantViewProvider) {
                    try {
                        vscode.commands.executeCommand('kora.assistantView.focus');
                        vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
                    } catch (e) {}
                    await assistantViewProvider.auditWorkspaceRules();
                }
            }
        }),

        vscode.commands.registerCommand('kora.explainCode', async (filePath) => {
            const targetFile = resolveActiveKoraFile(filePath);
            let docToExplain = null;
            if (vscode.window.activeTextEditor && (!targetFile || vscode.window.activeTextEditor.document.fileName === targetFile)) {
                docToExplain = vscode.window.activeTextEditor.document;
            } else if (targetFile && fs.existsSync(targetFile)) {
                try {
                    docToExplain = await vscode.workspace.openTextDocument(targetFile);
                } catch (e) {}
            }

            if (assistantViewProvider) {
                assistantViewProvider.switchTab('ask');
                try {
                    vscode.commands.executeCommand('kora.assistantView.focus');
                    vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
                } catch (e) {}
                if (docToExplain) {
                    assistantViewProvider.triggerExplanation(docToExplain);
                } else {
                    const wsRoot = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
                        ? vscode.workspace.workspaceFolders[0].uri.fsPath
                        : process.cwd();
                    assistantViewProvider.analyzeWorkspaceArchitecture(wsRoot);
                }
            }
        }),

        vscode.commands.registerCommand('kora.generateTests', (filePath) => {
            const activeFile = resolveActiveKoraFile(filePath);
            if (!activeFile) {
                vscode.window.showInformationMessage('Please open or select a Kora file to scaffold tests.');
                return;
            }

            const dir = path.dirname(activeFile);
            const baseName = path.basename(activeFile).replace(/\.(kora|kr)$/, '');
            const testsDir = path.join(dir, 'tests');

            if (!fs.existsSync(testsDir)) {
                fs.mkdirSync(testsDir, { recursive: true });
            }

            const unitPath = path.join(testsDir, `${baseName}_unit.test.kora`);
            const loadPath = path.join(testsDir, `${baseName}_load.test.kora`);

            const pascalName = baseName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

            const unitContent = `// ============================================================================\n// Unit Test Suite: ${pascalName}UnitTestSuite\n// ============================================================================\n\nclass ${pascalName}UnitTestSuite {\n    init() {}\n\n    fn test_initial_state() -> Bool {\n        return true\n    }\n\n    fn run() -> Unit {\n        let p = this.test_initial_state()\n        if p {\n            print("  [Pass] ${pascalName} Unit Tests: passed")\n        } else {\n            print("  [Fail] ${pascalName} Unit Tests: failed")\n        }\n    }\n}\n\nlet suite = ${pascalName}UnitTestSuite()\nsuite.run()\n`;

            const loadContent = `// ============================================================================\n// Load Test Suite: ${pascalName}LoadTestSuite\n// ============================================================================\n\nclass ${pascalName}LoadTestSuite {\n    init() {}\n\n    fn run_load_stress(iterations: Int) -> Int {\n        var processed = 0\n        for i in 0..iterations {\n            processed += 1\n        }\n        return processed\n    }\n\n    fn teardown() -> Unit {\n        print("  [Teardown] ${pascalName}: synthetic allocations purged")\n    }\n}\n\nlet load_suite = ${pascalName}LoadTestSuite()\nlet total = load_suite.run_load_stress(1000)\nprint("  [Pass] ${pascalName} Load Test: 1,000 iterations processed")\nload_suite.teardown()\n`;

            if (!fs.existsSync(unitPath)) fs.writeFileSync(unitPath, unitContent, 'utf-8');
            if (!fs.existsSync(loadPath)) fs.writeFileSync(loadPath, loadContent, 'utf-8');

            vscode.window.showInformationMessage(`Generated tests: tests/${baseName}_unit.test.kora and tests/${baseName}_load.test.kora`);
            vscode.workspace.openTextDocument(unitPath).then(doc => vscode.window.showTextDocument(doc));
        }),

        vscode.commands.registerCommand('kora.openExamplesExplorer', () => {
            if (assistantViewProvider) {
                assistantViewProvider.switchTab('examples');
                vscode.commands.executeCommand('kora.assistantView.focus');
            }
        }),

        vscode.commands.registerCommand('kora.walkthroughSelection', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            const selection = editor.document.getText(editor.selection) || editor.document.getText();
            const walkthrough = copilotEngine.walkthroughCode(selection);
            if (assistantViewProvider) {
                assistantViewProvider.displayWalkthrough(walkthrough);
                vscode.commands.executeCommand('kora.assistantView.focus');
            }
        }),

        vscode.commands.registerCommand('kora.generateDocs', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            const line = editor.document.lineAt(editor.selection.active.line).text;
            const docs = copilotEngine.generateDocumentation(line);
            editor.edit(builder => {
                builder.insert(new vscode.Position(editor.selection.active.line, 0), docs);
            });
        }),

        vscode.commands.registerCommand('kora.analyzeWorkspace', () => {
            const wsRoot = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
                ? vscode.workspace.workspaceFolders[0].uri.fsPath
                : process.cwd();
            if (assistantViewProvider) {
                assistantViewProvider.analyzeWorkspaceArchitecture(wsRoot);
                try {
                    vscode.commands.executeCommand('kora.assistantView.focus');
                    vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
                } catch (e) {}
            }
        }),

        vscode.commands.registerCommand('kora.validateProject', () => {
            let terminal = vscode.window.terminals.find(t => t.name === 'Kora Validate') || vscode.window.createTerminal('Kora Validate');
            terminal.show();
            terminal.sendText('kora doctor && kora test');
        }),

        vscode.commands.registerCommand('kora.openLearningCenter', () => {
            if (assistantViewProvider) {
                assistantViewProvider.switchTab('learning');
                vscode.commands.executeCommand('kora.assistantView.focus');
            }
        }),

        vscode.commands.registerCommand('kora.openArchitectureExplorer', () => {
            if (assistantViewProvider) {
                assistantViewProvider.switchTab('architecture');
                vscode.commands.executeCommand('kora.assistantView.focus');
            }
        }),

        vscode.commands.registerCommand('kora.autoFixRefactor', async (uriOrPath) => {
            const targetFile = resolveActiveKoraFile(uriOrPath);
            if (assistantViewProvider) {
                assistantViewProvider.switchTab('ask');
                try {
                    vscode.commands.executeCommand('kora.assistantView.focus');
                    vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
                } catch (e) {}
                await assistantViewProvider.triggerWorkspaceRefactor(targetFile, 'Auto-Fix and refactor Kora invariants');
            }
        }),

        vscode.commands.registerCommand('kora.fixDiagnostic', async (filePath) => {
            const activeFile = resolveActiveKoraFile(filePath);
            if (assistantViewProvider) {
                assistantViewProvider.switchTab('ask');
                try {
                    vscode.commands.executeCommand('kora.assistantView.focus');
                    vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
                } catch (e) {}
                await assistantViewProvider.triggerWorkspaceRefactor(activeFile, 'Auto-Fix compiler diagnostics');
            }
        }),

        vscode.commands.registerCommand('kora.focusChat', () => {
            if (assistantViewProvider) {
                assistantViewProvider.switchTab('ask');
                try {
                    vscode.commands.executeCommand('kora.assistantView.focus');
                    vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
                } catch (e) {}
            }
        }),

        vscode.commands.registerCommand('kora.acceptProposedChanges', async () => {
            if (assistantViewProvider) {
                await assistantViewProvider.acceptActiveProposal();
            }
        }),

        vscode.commands.registerCommand('kora.rejectProposedChanges', async () => {
            if (assistantViewProvider) {
                await assistantViewProvider.rejectActiveProposal();
            }
        })
    );
}

/**
 * Debounced wrapper to trigger compilation and diagnostics.
 */
function scheduleValidation(document, delayMs) {
    if (!isKoraFile(document)) return;

    const key = document.uri.toString();
    if (validationTimeouts.has(key)) {
        clearTimeout(validationTimeouts.get(key));
    }

    if (delayMs === 0) {
        validateKoraDocument(document);
    } else {
        const timeout = setTimeout(() => {
            validateKoraDocument(document);
            validationTimeouts.delete(key);
        }, delayMs);
        validationTimeouts.set(key, timeout);
    }
}

function isKoraFile(document) {
    return document.languageId === 'kora' ||
           document.fileName.endsWith('.kora') ||
           document.fileName.endsWith('.kr');
}

function validateKoraDocument(document) {
    if (!isKoraFile(document)) return;

    const filePath = document.fileName;
    execFile('kora', ['check', filePath], (err, stdout, stderr) => {
        const diagnostics = [];
        const output = stderr || stdout || '';

        const errorRegex = /(error|warning)\[(E\d+)\]:\s*(.*?)\n\s*-->\s*(.*?):(\d+):(\d+)/g;
        let match;

        while ((match = errorRegex.exec(output)) !== null) {
            const isError = match[1] === 'error';
            const code = match[2];
            const message = match[3];
            const line = parseInt(match[5], 10) - 1;
            const col = parseInt(match[6], 10) - 1;

            const range = new vscode.Range(
                new vscode.Position(Math.max(0, line), Math.max(0, col)),
                new vscode.Position(Math.max(0, line), Math.max(0, col + 10))
            );

            const diag = new vscode.Diagnostic(
                range,
                `[${code}] ${message}`,
                isError ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
            );
            diag.source = 'kora';
            diagnostics.push(diag);
        }

        diagnosticCollection.set(document.uri, diagnostics);

        if (assistantViewProvider) {
            assistantViewProvider.updateDiagnostics(diagnostics);
        }
    });
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Webview View Provider for the Kora Copilot & AI Assistant sidebar panel.
 */
class KoraAssistantViewProvider {
    constructor(extensionUri, engine) {
        this.extensionUri = extensionUri;
        this.engine = engine;
        this.view = null;
        this.currentAnalysis = null;
        this.currentDiagnostics = [];
        this.activeProposal = null;
    }

    resolveWebviewView(webviewView, context, token) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'smartRun':
                    vscode.commands.executeCommand('kora.smartRun', this.currentAnalysis ? this.currentAnalysis.filePath : null);
                    break;
                case 'checkFile':
                    vscode.commands.executeCommand('kora.checkFile', this.currentAnalysis ? this.currentAnalysis.filePath : null);
                    break;
                case 'runTests':
                    vscode.commands.executeCommand('kora.runTests', this.currentAnalysis ? this.currentAnalysis.filePath : null);
                    break;
                case 'generateTests':
                    vscode.commands.executeCommand('kora.generateTests', this.currentAnalysis ? this.currentAnalysis.filePath : null);
                    break;
                case 'explainCode':
                    vscode.commands.executeCommand('kora.explainCode', this.currentAnalysis ? this.currentAnalysis.filePath : null);
                    break;
                case 'auditFile':
                    vscode.commands.executeCommand('kora.auditFile', this.currentAnalysis ? this.currentAnalysis.filePath : null);
                    break;
                case 'analyzeWorkspace':
                    vscode.commands.executeCommand('kora.analyzeWorkspace');
                    break;
                case 'cloneExample':
                    if (message.slug) {
                        let terminal = vscode.window.terminals.find(t => t.name === 'Kora Example') || vscode.window.createTerminal('Kora Example');
                        terminal.show();
                        terminal.sendText(`kora example init ${message.slug}`);
                    }
                    break;
                case 'insertCode':
                    if (message.code && vscode.window.activeTextEditor) {
                        const editor = vscode.window.activeTextEditor;
                        editor.edit(editBuilder => {
                            editBuilder.insert(editor.selection.active, message.code);
                        });
                    }
                    break;
                case 'askQuestion':
                    await this.answerKoraPrompt(message.prompt, message.scope || 'workspace');
                    break;
                case 'requestAiFix':
                case 'requestWorkspaceRefactor':
                    {
                        const activeFile = (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document)
                            ? vscode.window.activeTextEditor.document.fileName
                            : (this.currentAnalysis ? this.currentAnalysis.filePath : null);
                        await this.triggerWorkspaceRefactor(message.targetPath || activeFile, message.goal || 'Auto-Fix and refactor Kora invariants');
                    }
                    break;
                case 'acceptProposal':
                    await this.acceptActiveProposal(message.proposalId);
                    break;
                case 'rejectProposal':
                    await this.rejectActiveProposal(message.proposalId);
                    break;
                case 'setFileStatus':
                    this.setFileApprovalStatus(message.proposalId, message.filePath, message.status);
                    break;
                case 'previewDiff':
                    try {
                        await this.engine.reviewManager.openVisualDiff(message.filePath, message.proposalId);
                    } catch (e) {
                        vscode.window.showErrorMessage(`Failed to open visual diff: ${e.message}`);
                    }
                    break;
                case 'selectFilesToAttach':
                    try {
                        const uris = await vscode.window.showOpenDialog({
                            canSelectFiles: true,
                            canSelectFolders: true,
                            canSelectMany: true,
                            openLabel: 'Attach to Kora AI'
                        });
                        if (uris && uris.length > 0) {
                            const paths = uris.map(u => u.fsPath);
                            if (this.view) {
                                this.view.webview.postMessage({
                                    type: 'filesAttached',
                                    paths: paths
                                });
                            }
                        }
                    } catch (e) {}
                    break;
                case 'openFile':
                    if (message.filePath) {
                        try {
                            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(message.filePath));
                            await vscode.window.showTextDocument(doc);
                        } catch (e) {
                            vscode.window.showErrorMessage(`Could not open file: ${e.message}`);
                        }
                    }
                    break;
                case 'applyFix':
                    {
                        let editor = vscode.window.activeTextEditor;
                        if (message.filePath && (!editor || editor.document.fileName !== message.filePath)) {
                            try {
                                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(message.filePath));
                                editor = await vscode.window.showTextDocument(doc);
                            } catch (e) {}
                        }
                        if (editor && message.code) {
                            const doc = editor.document;
                            const fullRange = new vscode.Range(
                                doc.positionAt(0),
                                doc.positionAt(doc.getText().length)
                            );
                            await editor.edit(editBuilder => {
                                editBuilder.replace(fullRange, message.code);
                            });
                            await doc.save();
                            vscode.window.showInformationMessage(`AI fix successfully applied to ${path.basename(doc.fileName)}!`);
                            vscode.commands.executeCommand('kora.checkFile', doc.fileName);
                        }
                    }
                    break;
                case 'updateProvider':
                    if (message.provider) {
                        const cfg = vscode.workspace.getConfiguration('kora.copilot');
                        await cfg.update('provider', message.provider, vscode.ConfigurationTarget.Global);
                        this.syncProviderToWebview();
                    }
                    break;
                case 'requestGitHubAuth':
                    try {
                        const session = await vscode.authentication.getSession('github', ['read:user'], { createIfNone: true });
                        if (session && session.accessToken) {
                            const cfg = vscode.workspace.getConfiguration('kora.copilot');
                            await cfg.update('githubToken', session.accessToken, vscode.ConfigurationTarget.Global);
                            await cfg.update('provider', 'github', vscode.ConfigurationTarget.Global);
                            vscode.window.showInformationMessage(`GitHub Account linked for Kora Copilot (${session.account ? session.account.label : 'authenticated'})!`);
                            this.syncProviderToWebview();
                        }
                    } catch (err) {
                        vscode.window.showWarningMessage(`Could not link GitHub account: ${err.message}. You can manually paste a token.`);
                    }
                    break;
                case 'updateGitHubConfig':
                    {
                        const cfg = vscode.workspace.getConfiguration('kora.copilot');
                        if (message.token) await cfg.update('githubToken', message.token, vscode.ConfigurationTarget.Global);
                        if (message.model) await cfg.update('model', message.model, vscode.ConfigurationTarget.Global);
                        await cfg.update('provider', 'github', vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage(`GitHub Models configured (${message.model || 'gpt-4o-mini'})!`);
                        this.syncProviderToWebview();
                    }
                    break;
                case 'updateOllamaConfig':
                    {
                        const cfg = vscode.workspace.getConfiguration('kora.copilot');
                        const envModel = (typeof process !== 'undefined' && process.env && process.env.OLLAMA_MODEL) ? process.env.OLLAMA_MODEL : '';
                        const effectiveModel = message.model || envModel || 'gemma:2b';
                        if (message.endpoint) await cfg.update('endpoint', message.endpoint, vscode.ConfigurationTarget.Global);
                        await cfg.update('model', effectiveModel, vscode.ConfigurationTarget.Global);
                        await cfg.update('provider', 'ollama', vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage(`Local Ollama configured (${effectiveModel})!`);
                        this.syncProviderToWebview();
                    }
                    break;
                case 'fetchOllamaModels':
                    {
                        const cfg = vscode.workspace.getConfiguration('kora.copilot');
                        const endpoint = message.endpoint || cfg.get('endpoint', 'http://localhost:11434');
                        try {
                            const resolution = await this.engine.ollamaService.resolveBestModel('chat', cfg.get('model'), endpoint);
                            const ranked = await this.engine.ollamaService.getRankedModels('chat', endpoint);
                            if (this.view) {
                                this.view.webview.postMessage({
                                    type: 'ollamaModelsLoaded',
                                    models: ranked.map(m => m.name),
                                    detailedModels: ranked,
                                    activeModel: resolution.model,
                                    resolution: resolution,
                                    status: resolution.status
                                });
                            }
                        } catch (e) {
                            if (this.view) {
                                this.view.webview.postMessage({
                                    type: 'ollamaModelsLoaded',
                                    models: [],
                                    detailedModels: [],
                                    activeModel: 'qwen2.5-coder:7b',
                                    resolution: {
                                        model: null,
                                        status: 'no_models',
                                        message: e.message,
                                        recommendation: 'ollama pull qwen2.5-coder:7b'
                                    },
                                    status: 'no_models'
                                });
                            }
                        }
                    }
                    break;
                case 'getAvailableContextOptions':
                    {
                        this.syncProviderToWebview();
                        if (this.currentAnalysis && this.view) {
                            this.view.webview.postMessage({
                                type: 'activeFileUpdated',
                                analysis: this.currentAnalysis
                            });
                        }
                        const wsRoot = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
                            ? vscode.workspace.workspaceFolders[0].uri.fsPath
                            : process.cwd();
                        await this.engine.workspaceEngine.discoverContext(wsRoot, '');
                        const files = [];
                        for (const [fPath, meta] of this.engine.workspaceEngine.indexedFiles) {
                            files.push({
                                label: meta.relPath,
                                path: fPath,
                                role: meta.role
                            });
                        }
                        if (this.view) {
                            this.view.webview.postMessage({
                                type: 'availableContextOptions',
                                files: files
                            });
                        }
                    }
                    break;
                case 'stopGeneration':
                    this.isGenerationStopped = true;
                    if (this.view) {
                        this.view.webview.postMessage({
                            type: 'generationStopped'
                        });
                    }
                    break;
                case 'saveAllSettings':
                    {
                        const cfg = vscode.workspace.getConfiguration('kora.copilot');
                        const s = message.settings || {};
                        if (s.provider) await cfg.update('provider', s.provider, vscode.ConfigurationTarget.Global);
                        if (s.githubToken !== undefined) await cfg.update('githubToken', s.githubToken, vscode.ConfigurationTarget.Global);
                        if (s.openaiKey !== undefined) await cfg.update('openaiKey', s.openaiKey, vscode.ConfigurationTarget.Global);
                        if (s.geminiKey !== undefined) await cfg.update('geminiKey', s.geminiKey, vscode.ConfigurationTarget.Global);
                        if (s.anthropicKey !== undefined) await cfg.update('anthropicKey', s.anthropicKey, vscode.ConfigurationTarget.Global);
                        if (s.model !== undefined) await cfg.update('model', s.model, vscode.ConfigurationTarget.Global);
                        if (s.endpoint !== undefined) await cfg.update('endpoint', s.endpoint, vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage(`Kora Copilot settings saved! Active Provider: ${s.provider || cfg.get('provider')}`);
                        this.syncProviderToWebview();
                    }
                    break;
                case 'testConnection':
                    {
                        const cfg = vscode.workspace.getConfiguration('kora.copilot');
                        const s = message.settings || {};
                        const testConfig = {
                            provider: s.provider || cfg.get('provider', 'embedded'),
                            model: s.model || cfg.get('model', 'gpt-4o-mini'),
                            endpoint: s.endpoint || cfg.get('endpoint', ''),
                            githubToken: s.githubToken || cfg.get('githubToken', ''),
                            openaiKey: s.openaiKey || cfg.get('openaiKey', ''),
                            geminiKey: s.geminiKey || cfg.get('geminiKey', ''),
                            anthropicKey: s.anthropicKey || cfg.get('anthropicKey', ''),
                            apiKey: cfg.get('apiKey', '')
                        };
                        const result = await this.engine.testConnection(testConfig);
                        if (this.view) {
                            this.view.webview.postMessage({
                                type: 'testConnectionResult',
                                result: result
                            });
                        }
                    }
                    break;
            }
        });

        if (vscode.window.activeTextEditor) {
            const analysis = analyzeKoraDocument(vscode.window.activeTextEditor.document);
            this.updateActiveFile(analysis);
        }
    }

    async triggerWorkspaceRefactor(targetPath = null, goal = 'Auto-Fix and refactor Kora invariants') {
        const cfg = vscode.workspace.getConfiguration('kora.copilot');
        const runtimeConfig = {
            provider: cfg.get('provider', 'embedded'),
            model: cfg.get('model', 'gemma:2b'),
            endpoint: cfg.get('endpoint', ''),
            githubToken: cfg.get('githubToken', '')
        };

        const onProgress = (step, allSteps) => {
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'agentProgress',
                    step: step,
                    allSteps: allSteps
                });
            }
        };

        const targetFiles = targetPath ? [targetPath] : [];

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Kora AI: Analyzing workspace and planning refactor...`,
                cancellable: false
            }, async () => {
                const result = await this.engine.generateWorkspaceRefactor(goal, {
                    targetFiles: targetFiles.length > 0 ? targetFiles : null,
                    activeFilePath: targetPath,
                    config: runtimeConfig
                }, onProgress);

                this.activeProposal = result.rawProposal;

                if (this.view) {
                    this.view.webview.postMessage({
                        type: 'proposalCreated',
                        proposal: result.proposal,
                        filesCount: result.filesCount
                    });
                }

                if (result.filesCount > 0) {
                    vscode.window.showInformationMessage(`Kora AI: Prepared changes for ${result.filesCount} file(s). Review diffs in Kora AI panel.`);
                } else {
                    vscode.window.showInformationMessage(`Kora AI: No rule violations found. All workspace invariants satisfied!`);
                    if (this.view) {
                        this.view.webview.postMessage({
                            type: 'assistantAnswer',
                            answer: `**Workspace Invariants Satisfied**\n\nNo violations or necessary refactors found for: *${goal}*. All scanned components strictly comply with Clean Architecture rules.`,
                            provider: 'embedded',
                            model: 'RefactorAgent'
                        });
                    }
                }
            });
        } catch (err) {
            vscode.window.showErrorMessage(`Kora AI Refactor Error: ${err.message}`);
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'assistantError',
                    error: err.message,
                    originalPrompt: goal
                });
            }
        }
    }

    async auditWorkspaceRules() {
        const auditText = this.engine.auditWorkspace();
        if (this.view) {
            this.view.webview.postMessage({
                type: 'auditResult',
                audit: {
                    passed: !auditText.includes('Rule Violation'),
                    violations: (auditText.match(/Violation/g) || []).length,
                    findings: [],
                    rawText: auditText
                }
            });
            this.view.webview.postMessage({
                type: 'assistantAnswer',
                answer: auditText,
                provider: 'embedded',
                model: 'RuleEngine'
            });
        }
    }

    async acceptActiveProposal(proposalId = null) {
        try {
            const result = await this.engine.reviewManager.applyApprovedChanges(proposalId);
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'proposalApplied',
                    proposalId: proposalId || (this.activeProposal ? this.activeProposal.id : null),
                    appliedCount: result.appliedCount
                });
            }
            vscode.window.showInformationMessage(`Successfully applied changes to ${result.appliedCount} file(s)!`);
            if (vscode.window.activeTextEditor) {
                vscode.commands.executeCommand('kora.checkFile', vscode.window.activeTextEditor.document.fileName);
            }
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to apply changes: ${err.message}`);
        }
    }

    async rejectActiveProposal(proposalId = null) {
        this.engine.reviewManager.rejectAll(proposalId);
        if (this.view) {
            this.view.webview.postMessage({
                type: 'proposalRejected',
                proposalId: proposalId || (this.activeProposal ? this.activeProposal.id : null)
            });
        }
        vscode.window.showInformationMessage('AI proposed changes were rejected.');
    }

    setFileApprovalStatus(proposalId, filePath, status) {
        const updated = this.engine.reviewManager.setFileStatus(proposalId, filePath, status);
        if (this.view && updated) {
            this.view.webview.postMessage({
                type: 'proposalUpdated',
                proposal: this.engine.reviewManager.serializeProposal(proposalId)
            });
        }
    }

    updateActiveFile(analysis) {
        this.currentAnalysis = analysis;
        if (this.view) {
            this.view.webview.postMessage({
                type: 'fileUpdated',
                analysis: analysis
            });
        }
    }

    updateDiagnostics(diagnostics) {
        this.currentDiagnostics = diagnostics;
        if (this.view) {
            this.view.webview.postMessage({
                type: 'diagnosticsUpdated',
                diagnostics: diagnostics.map(d => ({
                    message: d.message,
                    severity: d.severity,
                    line: d.range.start.line + 1
                }))
            });
        }
    }

    displayAudit(audit) {
        if (this.view) {
            this.view.webview.postMessage({
                type: 'auditResult',
                audit: audit
            });
        }
    }

    triggerExplanation(document) {
        const text = document.getText();
        const analysis = analyzeKoraDocument(document);

        let explanation = `### Kora Code & Architecture Analysis: \`${analysis.fileName}\`\n\n`;
        explanation += `- **Classification**: **${analysis.classification}**\n`;
        explanation += `- **Runnable**: ${analysis.isRunnable ? 'Yes (Ready to run directly)' : 'No (Library / Service component)'}\n`;
        explanation += `- **Total Lines**: ${analysis.lineCount}\n`;
        explanation += `- **Declared Symbols**: ${analysis.symbols.length > 0 ? analysis.symbols.map(s => `\`${s.name} (${s.kind})\``).join(', ') : 'None'}\n`;
        explanation += `- **Imported Modules**: ${analysis.imports.length > 0 ? analysis.imports.map(i => `\`${i.path}\``).join(', ') : 'None'}\n\n`;

        if (analysis.isRunnable) {
            explanation += `> **Execution Advice**: This file contains an entrypoint or test runner. Click **Run Entrypoint** or use \`kora run "${analysis.fileName}"\`.\n\n`;
        } else {
            explanation += `> **Clean Architecture Advice**: In Kora Clean Architecture (\`.agent/rules/04-clean-architecture.md\`), domain logic is organized into bounded contexts. Inject this service into a controller or mount via \`Router\` in \`src/main.kora\`.\n\n`;
        }

        explanation += `#### Layer Breakdown:\n`;
        if (text.includes('@table') || text.includes('@entity')) {
            explanation += `- **Data Layer (@table)**: Persisted database entity (\`.agent/rules/07-database-multi-engine-orm.md\`).\n`;
        }
        if (text.includes('class') && text.includes('init(')) {
            explanation += `- **Service / DI Layer**: State and logic with acyclic dependency injection (\`init\`).\n`;
        }
        if (text.includes('channel') || text.includes('actor') || text.includes('spawn')) {
            explanation += `- **Concurrency Layer**: Executes over Tokio worker threads with mailboxes (\`.agent/rules/08-concurrency-actors-streams.md\`).\n`;
        }

        if (this.view) {
            this.view.webview.postMessage({
                type: 'explanationResult',
                explanation: explanation
            });
        }
    }

    async resolveContextMentions(prompt) {
        const mentions = [];
        const attachments = [];

        // 1. @selection
        if (/@selection\b/i.test(prompt)) {
            mentions.push('@selection');
            const editor = vscode.window.activeTextEditor;
            if (editor && !editor.selection.isEmpty) {
                const selectedText = editor.document.getText(editor.selection);
                const relFile = vscode.workspace.asRelativePath ? vscode.workspace.asRelativePath(editor.document.uri) : path.basename(editor.document.fileName);
                attachments.push({
                    type: 'selection',
                    title: `@selection in ${relFile} (Lines ${editor.selection.start.line + 1}-${editor.selection.end.line + 1})`,
                    content: selectedText
                });
            } else if (editor) {
                attachments.push({
                    type: 'selection',
                    title: `@selection in ${path.basename(editor.document.fileName)} (Full File)`,
                    content: editor.document.getText().slice(0, 5000)
                });
            }
        }

        // 2. @problems
        if (/@problems\b/i.test(prompt)) {
            mentions.push('@problems');
            const allDiags = vscode.languages.getDiagnostics();
            const problemsList = [];
            for (const [uri, diags] of allDiags) {
                const relPath = vscode.workspace.asRelativePath ? vscode.workspace.asRelativePath(uri) : (uri.fsPath || '');
                for (const d of diags) {
                    const sev = d.severity === 0 ? 'Error' : 'Warning';
                    problemsList.push(`- [${sev}] ${relPath}:${d.range.start.line + 1}: ${d.message}`);
                }
            }
            attachments.push({
                type: 'problems',
                title: `@problems (${problemsList.length} issue(s) found)`,
                content: problemsList.slice(0, 30).join('\n') || 'No compiler errors or warnings found in workspace.'
            });
        }

        // 3. @terminal
        if (/@terminal\b/i.test(prompt)) {
            mentions.push('@terminal');
            const terms = vscode.window.terminals;
            const termInfo = terms.map(t => `- Terminal: "${t.name}" (Active: ${t === vscode.window.activeTerminal})`).join('\n');
            attachments.push({
                type: 'terminal',
                title: `@terminal (Active terminals)`,
                content: termInfo || 'No active terminal sessions.'
            });
        }

        // 4. @workspace
        if (/@workspace\b/i.test(prompt)) {
            mentions.push('@workspace');
            const wsRoot = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
                ? vscode.workspace.workspaceFolders[0].uri.fsPath
                : process.cwd();
            const context = await this.engine.workspaceEngine.discoverContext(wsRoot, prompt);
            attachments.push({
                type: 'workspace',
                title: `@workspace (${this.engine.workspaceEngine.indexedFiles.size} indexed files)`,
                content: this.engine.workspaceEngine.formatContextForPrompt(context)
            });
        }

        // 5. @file[: ]([^\s]+)
        const fileRegex = /@file(?::|\s+)([^\s]+)/gi;
        let fm;
        while ((fm = fileRegex.exec(prompt)) !== null) {
            const rawTarget = fm[1].replace(/['"]/g, '');
            mentions.push(`@file:${rawTarget}`);
            const wsRoot = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
                ? vscode.workspace.workspaceFolders[0].uri.fsPath
                : process.cwd();
            const fullPath = path.isAbsolute(rawTarget) ? rawTarget : path.resolve(wsRoot, rawTarget);
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    attachments.push({
                        type: 'file',
                        title: `@file ${rawTarget}`,
                        path: fullPath,
                        content: content.slice(0, 8000)
                    });
                } catch (e) {}
            }
        }

        // 6. @folder[: ]([^\s]+)
        const folderRegex = /@folder(?::|\s+)([^\s]+)/gi;
        let fdm;
        while ((fdm = folderRegex.exec(prompt)) !== null) {
            const rawFolder = fdm[1].replace(/['"]/g, '');
            mentions.push(`@folder:${rawFolder}`);
            const wsRoot = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
                ? vscode.workspace.workspaceFolders[0].uri.fsPath
                : process.cwd();
            const fullFolder = path.isAbsolute(rawFolder) ? rawFolder : path.resolve(wsRoot, rawFolder);
            if (fs.existsSync(fullFolder) && fs.statSync(fullFolder).isDirectory()) {
                try {
                    const files = fs.readdirSync(fullFolder);
                    attachments.push({
                        type: 'folder',
                        title: `@folder ${rawFolder}`,
                        content: `Files in directory ${rawFolder}:\n` + files.slice(0, 40).map(f => `- ${f}`).join('\n')
                    });
                } catch (e) {}
            }
        }

        return { mentions, attachments };
    }

    async answerKoraPrompt(prompt, scope = 'workspace') {
        const doc = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document : null;
        const config = vscode.workspace.getConfiguration('kora.copilot');

        let provider = config.get('provider', 'embedded');
        let githubToken = config.get('githubToken', '');
        let openaiKey = config.get('openaiKey', '');
        let geminiKey = config.get('geminiKey', '');
        let anthropicKey = config.get('anthropicKey', '');
        let model = config.get('model', 'gpt-4o-mini');
        let endpoint = config.get('endpoint', '');
        let apiKey = config.get('apiKey', '');

        if (provider === 'github' && !githubToken && !apiKey && !process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
            try {
                const session = await vscode.authentication.getSession('github', ['read:user'], { createIfNone: false });
                if (session && session.accessToken) {
                    githubToken = session.accessToken;
                }
            } catch (e) {}
        }

        const runtimeConfig = {
            provider,
            githubToken,
            openaiKey,
            geminiKey,
            anthropicKey,
            model,
            endpoint,
            apiKey
        };

        this.isGenerationStopped = false;

        const onProgress = (step, allSteps) => {
            if (this.isGenerationStopped) return;
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'agentProgress',
                    step: step,
                    allSteps: allSteps
                });
            }
        };

        const lower = (prompt || '').toLowerCase();
        if (scope === 'refactor' || lower.startsWith('/fix') || lower.startsWith('/refactor') || lower.includes('refactor file') || lower.includes('auto-fix')) {
            await this.triggerWorkspaceRefactor(doc ? doc.fileName : null, prompt);
            return;
        }

        try {
            const contextData = await this.resolveContextMentions(prompt);
            let enrichedPrompt = prompt;
            if (contextData.attachments.length > 0) {
                const blocks = contextData.attachments.map(att => `[Context Reference: ${att.title}]\n\`\`\`\n${att.content}\n\`\`\``).join('\n\n');
                enrichedPrompt = `${prompt}\n\n${blocks}`;
            }

            const answer = await this.engine.answerPrompt(enrichedPrompt, doc, runtimeConfig, {
                scope,
                onProgress
            });

            if (this.isGenerationStopped) return;

            if (this.view) {
                this.view.webview.postMessage({
                    type: 'assistantAnswer',
                    answer: answer,
                    provider: provider,
                    model: model,
                    mentions: contextData.mentions
                });
            }
        } catch (err) {
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'assistantError',
                    error: err.message,
                    originalPrompt: prompt
                });
            }
            vscode.window.showErrorMessage(`Kora AI Error: ${err.message}`);
        }
    }

    syncProviderToWebview() {
        if (this.view) {
            const config = vscode.workspace.getConfiguration('kora.copilot');
            const envModel = (typeof process !== 'undefined' && process.env && process.env.OLLAMA_MODEL) ? process.env.OLLAMA_MODEL : '';
            this.view.webview.postMessage({
                type: 'syncConfig',
                provider: config.get('provider', 'embedded'),
                model: config.get('model', envModel || 'gemma:2b'),
                hasGitHubToken: Boolean(config.get('githubToken') || process.env.GITHUB_TOKEN),
                endpoint: config.get('endpoint', ''),
                envModel: envModel,
                settings: {
                    provider: config.get('provider', 'embedded'),
                    githubToken: config.get('githubToken', ''),
                    openaiKey: config.get('openaiKey', ''),
                    geminiKey: config.get('geminiKey', ''),
                    anthropicKey: config.get('anthropicKey', ''),
                    model: config.get('model', envModel || 'gemma:2b'),
                    endpoint: config.get('endpoint', '')
                }
            });
        }
    }

    switchTab(tabName) {
        if (this.view) {
            this.view.webview.postMessage({
                type: 'switchTab',
                tab: tabName
            });
        }
    }

    displayWalkthrough(walkthrough) {
        if (this.view) {
            this.view.webview.postMessage({
                type: 'walkthroughResult',
                walkthrough: walkthrough
            });
        }
    }

    analyzeWorkspaceArchitecture(workspaceRoot) {
        if (!workspaceRoot || !fs.existsSync(workspaceRoot)) return;
        const counts = { controllers: 0, services: 0, repositories: 0, entities: 0, models: 0, tests: 0 };
        const filesFound = [];

        function scan(dir) {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const e of entries) {
                    const full = path.join(dir, e.name);
                    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'target' && e.name !== 'node_modules' && e.name !== 'dist') {
                        scan(full);
                    } else if (e.isFile() && (e.name.endsWith('.kora') || e.name.endsWith('.kr'))) {
                        const rel = path.relative(workspaceRoot, full);
                        filesFound.push(rel);
                        if (rel.includes('controller') || e.name.includes('controller')) counts.controllers++;
                        else if (rel.includes('service') || e.name.includes('service')) counts.services++;
                        else if (rel.includes('repository') || e.name.includes('repository')) counts.repositories++;
                        else if (rel.includes('entity') || e.name.includes('entity')) counts.entities++;
                        else if (rel.includes('model') || e.name.includes('model')) counts.models++;
                        else if (rel.includes('test') || e.name.includes('test')) counts.tests++;
                    }
                }
            } catch (err) {}
        }
        scan(workspaceRoot);

        if (this.view) {
            this.view.webview.postMessage({
                type: 'architectureResult',
                architecture: { counts, filesCount: filesFound.length, files: filesFound.slice(0, 30) }
            });
        }
    }

    getHtmlForWebview(webview) {
        const nonce = getNonce();
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'icon.png'));
        const catalogHtml = EXAMPLES_CATALOG.map(ex => `
            <div class="example-card" onclick="cloneExample('${ex.slug}')">
                <div class="example-header">
                    <span class="example-name">${ex.name}</span>
                    <span class="badge ${ex.difficulty.toLowerCase()}">${ex.difficulty}</span>
                </div>
                <div class="example-desc">${ex.desc}</div>
                <div class="example-footer">
                    <span class="category-tag">${ex.category}</span>
                    <button class="btn-clone" title="Scaffold into current project">Scaffold Example</button>
                </div>
            </div>
        `).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval' ${webview.cspSource}; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kora AI Agent</title>
    <style>
        * {
            box-sizing: border-box;
        }
        html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
        }
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            display: flex;
            flex-direction: column;
            padding: 6px 8px;
            font-size: 11.5px;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
        }
        .header {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
            padding-bottom: 4px;
            border-bottom: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.1));
            width: 100%;
        }
        .logo {
            font-size: 13px;
            font-weight: 700;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            gap: 8px;
            letter-spacing: 0.2px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .logo-img {
            display: block;
            flex-shrink: 0;
            border-radius: 4px;
        }
        .engine-badge {
            font-size: 9.5px;
            background: rgba(16, 185, 129, 0.15);
            color: #34D399;
            border: 1px solid rgba(16, 185, 129, 0.3);
            padding: 2px 6px;
            border-radius: 12px;
            font-weight: 600;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .tabs {
            flex-shrink: 0;
            display: flex;
            gap: 2px;
            margin-bottom: 6px;
            background: var(--vscode-editorWidget-background, rgba(255, 255, 255, 0.03));
            padding: 2px;
            border-radius: 6px;
            border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.08));
            overflow-x: auto;
            scrollbar-width: none;
            width: 100%;
        }
        .tabs::-webkit-scrollbar {
            display: none;
        }
        .tab-btn {
            flex: 1 0 auto;
            background: transparent;
            color: var(--vscode-foreground);
            opacity: 0.75;
            border: none;
            padding: 5px 6px;
            font-size: 10.5px;
            font-weight: 500;
            border-radius: 4px;
            cursor: pointer;
            text-align: center;
            white-space: nowrap;
            transition: all 0.15s ease;
        }
        .tab-btn:hover {
            opacity: 1;
            background: rgba(255, 255, 255, 0.06);
        }
        .tab-btn.active {
            opacity: 1;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            font-weight: 600;
        }
        .section {
            display: none;
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            width: 100%;
            box-sizing: border-box;
        }
        .section.active {
            display: block;
        }
        #tab-ask.section.active {
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
            min-height: 0;
            height: 100%;
            overflow: hidden;
            box-sizing: border-box;
            position: relative;
        }
        .drop-overlay {
            position: absolute;
            inset: 0;
            background: rgba(14, 165, 233, 0.28);
            border: 2px dashed #0284c7;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-weight: 600;
            font-size: 13px;
            color: #38bdf8;
            z-index: 999;
            pointer-events: none;
            backdrop-filter: blur(2px);
        }
        .attached-files-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            padding: 4px 6px;
            margin-bottom: 4px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px dashed rgba(56, 189, 248, 0.3);
            border-radius: 4px;
        }
        .attached-file-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: rgba(56, 189, 248, 0.15);
            border: 1px solid rgba(56, 189, 248, 0.3);
            color: #38bdf8;
            border-radius: 10px;
            padding: 1px 6px;
            font-size: 10px;
            font-weight: 500;
        }
        .attached-file-remove {
            cursor: pointer;
            opacity: 0.7;
            font-weight: 700;
            margin-left: 2px;
            padding: 0 2px;
        }
        .attached-file-remove:hover {
            opacity: 1;
            color: #ef4444;
        }
        .btn-attach {
            background: transparent;
            border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.15));
            color: var(--vscode-foreground);
            padding: 5px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
        }
        .btn-attach:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: #38bdf8;
            color: #38bdf8;
        }
            box-sizing: border-box;
            position: relative;
        }
        .provider-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.1));
            border-radius: 4px;
            padding: 4px 6px;
            margin-bottom: 6px;
            gap: 4px;
            flex-shrink: 0;
        }
        .provider-select-group {
            display: flex;
            align-items: center;
            gap: 6px;
            flex: 1;
            min-width: 0;
        }
        .provider-select {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border, rgba(255, 255, 255, 0.1));
            border-radius: 3px;
            font-size: 10.5px;
            padding: 2px 4px;
            flex: 1;
            cursor: pointer;
            min-width: 0;
        }
        .btn-config-toggle {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 12px;
            padding: 2px 4px;
            opacity: 0.8;
            flex-shrink: 0;
        }
        .btn-config-toggle:hover {
            opacity: 1.0;
        }
        .provider-config-box {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 8px;
            font-size: 11px;
            flex-shrink: 0;
        }
        .agent-tracker {
            background: var(--vscode-editorWidget-background, rgba(255, 255, 255, 0.04));
            border: 1px solid var(--vscode-focusBorder, #38bdf8);
            border-radius: 6px;
            padding: 6px 8px;
            margin-bottom: 6px;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            gap: 3px;
        }
        .tracker-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 10.5px;
            font-weight: 600;
        }
        .tracker-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: rgba(56, 189, 248, 0.15);
            color: #38bdf8;
            padding: 1px 6px;
            border-radius: 10px;
            font-size: 9.5px;
        }
        .tracker-detail {
            font-size: 10.5px;
            opacity: 0.85;
            line-height: 1.3;
        }
        .tracker-steps {
            display: flex;
            flex-direction: column;
            gap: 2px;
            margin-top: 3px;
            padding-top: 3px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            max-height: 80px;
            overflow-y: auto;
            font-size: 9px;
            opacity: 0.8;
        }
        .chat-scroll-area {
            flex: 1 1 auto;
            overflow-y: auto;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding-right: 2px;
            margin-bottom: 6px;
            min-height: 80px;
        }
        .suggestion-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin-bottom: 4px;
            flex-shrink: 0;
        }
        .chip {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 3px 6px;
            border-radius: 12px;
            font-size: 9.5px;
            cursor: pointer;
            transition: opacity 0.15s ease;
        }
        .chip:hover {
            opacity: 0.8;
        }
        .chat-history {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
        }
        .msg-user {
            background: var(--vscode-button-secondaryBackground, rgba(255, 255, 255, 0.08));
            padding: 6px 8px;
            border-radius: 6px;
            align-self: flex-end;
            font-size: 11px;
            max-width: 90%;
            word-break: break-word;
        }
        .msg-assistant {
            background: var(--vscode-editor-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 8px 10px;
            border-radius: 4px;
            align-self: flex-start;
            font-size: 11px;
            line-height: 1.45;
            max-width: 100%;
            width: 100%;
            word-break: break-word;
        }
        .file-ref-pill {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 1px 6px;
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 10px;
            font-size: 10px;
            cursor: pointer;
            text-decoration: none;
            margin: 1px 2px;
            font-family: monospace;
        }
        .file-ref-pill:hover {
            background: rgba(59, 130, 246, 0.3);
        }
        .proposal-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-focusBorder, #38bdf8);
            border-radius: 6px;
            padding: 8px;
            margin: 6px 0;
            width: 100%;
            box-sizing: border-box;
        }
        .proposal-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
            padding-bottom: 4px;
            border-bottom: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.1));
        }
        .proposal-title {
            font-size: 11.5px;
            font-weight: 700;
            color: #38bdf8;
        }
        .proposal-file-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 4px;
            background: var(--vscode-editorWidget-background, rgba(255, 255, 255, 0.03));
            border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.08));
            border-radius: 4px;
            padding: 4px 6px;
            margin-bottom: 4px;
            font-size: 10.5px;
        }
        .proposal-file-name {
            cursor: pointer;
            color: var(--vscode-textLink-foreground);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1;
        }
        .diff-stat-add { color: #10b981; font-weight: 600; font-size: 9.5px; }
        .diff-stat-del { color: #ef4444; font-weight: 600; font-size: 9.5px; }
        .btn-prop-sm {
            background: var(--vscode-button-secondaryBackground, rgba(255, 255, 255, 0.08));
            color: var(--vscode-foreground);
            border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.1));
            border-radius: 3px;
            padding: 2px 5px;
            font-size: 9.5px;
            cursor: pointer;
            white-space: nowrap;
        }
        .btn-prop-sm:hover {
            background: rgba(255, 255, 255, 0.15);
        }
        .proposal-global-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin-top: 6px;
        }
        .btn-accept-all {
            background: #10b981;
            color: #fff;
            border: none;
            padding: 5px 8px;
            border-radius: 4px;
            font-weight: 600;
            cursor: pointer;
            font-size: 10.5px;
            text-align: center;
        }
        .btn-accept-all:hover {
            background: #059669;
        }
        .btn-reject-all {
            background: #ef4444;
            color: #fff;
            border: none;
            padding: 5px 8px;
            border-radius: 4px;
            font-weight: 600;
            cursor: pointer;
            font-size: 10.5px;
            text-align: center;
        }
        .btn-reject-all:hover {
            background: #dc2626;
        }
        .chat-input-box {
            flex-shrink: 0;
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.15));
            border-radius: 8px;
            padding: 6px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
            margin-top: auto;
            width: 100%;
            z-index: 20;
        }
        .chat-scope-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            font-size: 10px;
        }
        .scope-select {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border, rgba(255, 255, 255, 0.1));
            border-radius: 4px;
            font-size: 10px;
            padding: 2px 6px;
            cursor: pointer;
        }
        .chat-textarea {
            width: 100%;
            min-height: 40px;
            max-height: 120px;
            resize: none;
            overflow-y: auto;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, rgba(255, 255, 255, 0.1));
            border-radius: 5px;
            padding: 6px 8px;
            font-family: inherit;
            font-size: 11.5px;
            line-height: 1.4;
            box-sizing: border-box;
            outline: none;
        }
        .chat-textarea:focus {
            border-color: var(--vscode-focusBorder);
        }
        .chat-actions-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
        }
        .btn-refactor-quick {
            background: linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(37, 99, 235, 0.2));
            color: #38bdf8;
            border: 1px solid rgba(56, 189, 248, 0.35);
            border-radius: 4px;
            padding: 3px 8px;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .btn-refactor-quick:hover {
            background: linear-gradient(135deg, rgba(14, 165, 233, 0.35), rgba(37, 99, 235, 0.35));
        }
        .btn-send-main {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            padding: 4px 12px;
            font-size: 10.5px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .btn-send-main:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .typing-cursor {
            display: inline-block;
            width: 6px;
            height: 12px;
            background: var(--vscode-textLink-foreground);
            margin-left: 2px;
            vertical-align: middle;
            animation: blink 0.8s infinite;
        }
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }
        .typing-indicator {
            display: flex;
            gap: 6px;
            align-items: center;
            padding: 6px 10px;
            font-size: 11px;
            opacity: 0.85;
            color: var(--vscode-textLink-foreground);
            background: var(--vscode-editor-background);
            border-radius: 4px;
            border-left: 3px solid var(--vscode-textLink-foreground);
            font-style: italic;
        }
        /* Inspector & other tabs */
        .file-status-box {
            background: var(--vscode-editorWidget-background, rgba(255, 255, 255, 0.03));
            border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.08));
            border-radius: 6px;
            padding: 10px;
            margin-bottom: 10px;
            width: 100%;
        }
        .file-title {
            font-weight: 600;
            font-size: 12px;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
        }
        .pill {
            display: inline-flex;
            align-items: center;
            padding: 2px 7px;
            border-radius: 12px;
            font-size: 9.5px;
            font-weight: 600;
            letter-spacing: 0.3px;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .pill.runnable { background: rgba(16, 185, 129, 0.2); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.35); }
        .pill.library { background: rgba(59, 130, 246, 0.2); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.35); }
        .pill.test { background: rgba(139, 92, 246, 0.2); color: #A78BFA; border: 1px solid rgba(139, 92, 246, 0.35); }
        .action-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 5px;
            margin-top: 8px;
            width: 100%;
        }
        button.action-btn {
            width: 100%;
            min-width: 0;
            background: var(--vscode-button-secondaryBackground, rgba(255, 255, 255, 0.08));
            color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
            border: 1px solid var(--vscode-button-border, rgba(255, 255, 255, 0.1));
            padding: 6px 4px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 10.5px;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            transition: all 0.15s ease;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        button.action-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground, rgba(255, 255, 255, 0.14));
            border-color: rgba(255, 255, 255, 0.2);
        }
        button.action-btn.primary {
            grid-column: span 2;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            font-weight: 600;
            border: none;
            padding: 7px 10px;
            font-size: 11px;
        }
        button.action-btn.primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .explanation-box {
            background: var(--vscode-editor-background);
            padding: 8px 10px;
            border-radius: 4px;
            margin-top: 10px;
            font-size: 11px;
            line-height: 1.4;
            max-height: 280px;
            overflow-y: auto;
            border-left: 3px solid var(--vscode-textLink-foreground);
            white-space: pre-wrap;
            width: 100%;
        }
        .audit-box {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 10px;
            margin-top: 10px;
            font-size: 11px;
            width: 100%;
        }
        .diag-item {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid #ef4444;
            padding: 6px;
            border-radius: 4px;
            margin-bottom: 6px;
            font-size: 11px;
            width: 100%;
        }
        .example-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 8px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: transform 0.1s;
            width: 100%;
        }
        .example-card:hover {
            border-color: var(--vscode-focusBorder);
        }
        .example-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            font-size: 11px;
            margin-bottom: 4px;
        }
        .badge {
            font-size: 9px;
            padding: 1px 4px;
            border-radius: 3px;
        }
        .badge.beginner { background: #10b981; color: white; }
        .badge.intermediate { background: #f59e0b; color: white; }
        .badge.advanced { background: #ef4444; color: white; }
        .example-desc {
            font-size: 10px;
            opacity: 0.8;
            margin-bottom: 6px;
        }
        .example-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .category-tag {
            font-size: 9px;
            opacity: 0.7;
            text-transform: uppercase;
        }
        .btn-clone {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 3px 6px;
            font-size: 9px;
            border-radius: 3px;
            cursor: pointer;
        }
        .settings-group {
            margin-bottom: 10px;
        }
        .active-model-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 10px;
            background: rgba(56, 189, 248, 0.12);
            color: #38bdf8;
            border: 1px solid rgba(56, 189, 248, 0.3);
            padding: 2px 7px;
            border-radius: 12px;
            font-weight: 500;
            cursor: pointer;
            white-space: nowrap;
            max-width: 140px;
            overflow: hidden;
            text-overflow: ellipsis;
            transition: all 0.15s ease;
        }
        .active-model-pill:hover {
            background: rgba(56, 189, 248, 0.22);
            border-color: #38bdf8;
        }
        .btn-mention-pill {
            background: rgba(59, 130, 246, 0.12);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.25);
            border-radius: 10px;
            padding: 1px 6px;
            font-size: 9.5px;
            cursor: pointer;
            font-family: monospace;
            transition: all 0.15s;
        }
        .btn-mention-pill:hover {
            background: rgba(59, 130, 246, 0.25);
        }
        .mention-menu {
            position: absolute;
            bottom: 100%;
            left: 0;
            right: 0;
            margin-bottom: 6px;
            background: var(--vscode-editorWidget-background, #252526);
            border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.15));
            border-radius: 6px;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
        }
        .mention-menu-header {
            font-size: 9.5px;
            font-weight: 600;
            opacity: 0.7;
            padding: 4px 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            text-transform: uppercase;
        }
        .mention-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            padding: 5px 8px;
            cursor: pointer;
            font-size: 11px;
            transition: background 0.1s;
        }
        .mention-item:hover, .mention-item.selected {
            background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.08));
        }
        .mention-token {
            font-weight: 600;
            color: #38bdf8;
            font-family: monospace;
        }
        .mention-desc {
            font-size: 10px;
            opacity: 0.75;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .btn-stop-gen {
            background: rgba(239, 68, 68, 0.15);
            color: #ef4444;
            border: 1px solid rgba(239, 68, 68, 0.4);
            border-radius: 4px;
            padding: 4px 10px;
            font-size: 10.5px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .btn-stop-gen:hover {
            background: rgba(239, 68, 68, 0.28);
        }
        .settings-label {
            display: block;
            font-size: 10.5px;
            font-weight: 600;
            opacity: 0.85;
            margin-bottom: 3px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <img src="${logoUri}" width="20" height="20" class="logo-img" alt="Kora Logo" />
            <span>Kora AI Agent</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
            <span class="active-model-pill" id="active-model-pill" onclick="switchTab('settings')" title="Active AI model. Click to configure settings.">Embedded</span>
            <span class="engine-badge" id="engine-indicator">Active</span>
        </div>
    </div>

    <div class="tabs">
        <button class="tab-btn active" data-tab="ask" onclick="switchTab('ask')">AI Agent</button>
        <button class="tab-btn" data-tab="copilot" onclick="switchTab('copilot')">Inspector</button>
        <button class="tab-btn" data-tab="arch" onclick="switchTab('arch')">Architecture</button>
        <button class="tab-btn" data-tab="learn" onclick="switchTab('learn')">Learning</button>
        <button class="tab-btn" data-tab="examples" onclick="switchTab('examples')">Examples (23)</button>
        <button class="tab-btn" data-tab="settings" onclick="switchTab('settings')">Settings</button>
    </div>

    <!-- 1. AI Agent Chat Tab (Primary) -->
    <div id="tab-ask" class="section active">
        <!-- Drag & Drop Overlay Indicator -->
        <div id="drop-overlay" class="drop-overlay" style="display: none;">
            
            <span>Drop File or Folder to Attach</span>
            <span style="font-size: 10px; opacity: 0.85;">Will be indexed and attached to AI context</span>
        </div>

        <div class="provider-bar">
            <div class="provider-select-group">
                <span style="font-size: 10px; opacity: 0.8; font-weight: 600;">Engine:</span>
                <select id="copilot-provider-select" class="provider-select" onchange="onProviderSelectChanged(this.value)">
                    <option value="embedded">Embedded Core (Offline Rules)</option>
                    <option value="copilot">GitHub Copilot (Native IDE)</option>
                    <option value="ollama">Local Ollama (Intelligent Discovery)</option>
                    <option value="github">GitHub Models API (PAT)</option>
                </select>
            </div>
            <button class="btn-config-toggle" onclick="toggleConfigPanel()" title="Configure Engine Settings">Configure</button>
        </div>

        <div id="ollama-alert-banner" style="display: none; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 4px; padding: 6px 8px; margin-bottom: 6px; font-size: 10px; line-height: 1.4;">
            <div id="ollama-alert-text"></div>
        </div>

        <div id="provider-config-box" class="provider-config-box" style="display: none;">
            <div id="cfg-copilot" style="display: none;">
                <div style="font-weight: 600; margin-bottom: 4px; color: #60A5FA;">Native GitHub Copilot</div>
                <div style="font-size: 10.5px; opacity: 0.85; margin-bottom: 6px;">Zero token setup: Queries the Language Model API provided by your authenticated GitHub Copilot IDE session.</div>
                <div style="font-size: 10px; color: #10B981; font-weight: 600;">Ready to chat without manual API keys or endpoints.</div>
            </div>
            <div id="cfg-github" style="display: none;">
                <div style="font-weight: 600; margin-bottom: 4px;">GitHub Models Setup</div>
                <button class="action-btn primary" style="width: 100%; margin-bottom: 6px; padding: 4px;" onclick="requestGitHubLogin()">Auto-Link GitHub Account</button>
                <div style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Or paste Personal Access Token (PAT):</div>
                <input type="password" id="cfg-gh-token" class="chat-textarea" style="min-height: 28px; max-height: 28px;" placeholder="ghp_... or github_pat_..." />
                <div style="font-size: 10px; opacity: 0.7; margin: 4px 0 2px 0;">Model:</div>
                <div style="display: flex; gap: 4px;">
                    <select id="cfg-gh-model" class="provider-select" style="flex: 1;">
                        <option value="gpt-4o-mini">gpt-4o-mini (Fast & Recommended)</option>
                        <option value="Phi-3.5-mini-instruct">Phi-3.5-mini-instruct (Small)</option>
                        <option value="Meta-Llama-3.1-8B-Instruct">Meta-Llama-3.1-8B-Instruct</option>
                    </select>
                    <button class="btn-send-main" onclick="saveGitHubConfig()">Save</button>
                </div>
            </div>
            <div id="cfg-ollama" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-weight: 600; color: #34D399;">Local Ollama Models</span>
                    <button class="btn-prop-sm" onclick="refreshOllamaModels()" title="Refresh models from local Ollama">Scan</button>
                </div>
                <div style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Endpoint URL:</div>
                <input type="text" id="cfg-ollama-endpoint" class="chat-textarea" style="min-height: 28px; max-height: 28px;" value="http://localhost:11434" onchange="refreshOllamaModels()" />
                <div style="font-size: 10px; opacity: 0.7; margin: 4px 0 2px 0;">Discovered / Selected Model:</div>
                <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                    <select id="cfg-ollama-model" class="provider-select" style="flex: 1;" onchange="onOllamaSelectChange(this.value)">
                        <option value="auto">Auto-detect best model</option>
                        <option value="custom">Enter custom model name...</option>
                    </select>
                    <button class="btn-send-main" onclick="saveOllamaConfig()">Save</button>
                </div>
                <input type="text" id="cfg-ollama-custom" class="chat-textarea" style="min-height: 28px; max-height: 28px; display: none;" placeholder="Type custom model (e.g. qwen2.5-coder:7b)..." />
            </div>
            <div id="cfg-embedded" style="display: none;">
                <div style="font-weight: 600; margin-bottom: 2px;">Embedded Knowledge Engine</div>
                <div style="font-size: 10px; opacity: 0.8;">Instant offline inference powered by Kora AST analyzer, .agent/rules/ invariants, and the official language documentation.</div>
            </div>
        </div>

        <!-- Compact Antigravity-Style Agent Status & Step Timeline -->
        <div id="agent-tracker" class="agent-tracker" style="display: none;">
            <div class="tracker-header" onclick="toggleTrackerSteps()" style="cursor: pointer;" title="Click to expand/collapse agent activity steps">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="tracker-badge" id="tracker-badge">Working</span>
                    <span id="tracker-state-title" style="color: #38bdf8;">Exploring Workspace</span>
                </div>
                <span id="tracker-chevron" style="font-size: 9px; opacity: 0.8;">v</span>
            </div>
            <div id="tracker-detail" class="tracker-detail">Scanning project files and module relationships...</div>
            <div id="tracker-steps" class="tracker-steps" style="display: none;"></div>
        </div>

        <div class="chat-scroll-area" id="chat-scroll-area">
            <div class="suggestion-chips">
                <span class="chip" data-chip="Auto-fix all rule violations across workspace" onclick="askChip('Auto-fix all rule violations across workspace')">Auto-Fix Workspace</span>
                <span class="chip" data-chip="Analyze workspace Clean Architecture layers" onclick="askChip('Analyze workspace Clean Architecture layers')">Analyze Architecture</span>
                <span class="chip" data-chip="Audit active file against .agent rules" onclick="askChip('Audit active file against .agent rules')">Audit Rules</span>
                <span class="chip" data-chip="Show Rule 08: Actors & Mailboxes" onclick="askChip('Show Rule 08: Actors & Mailboxes')">Rule 08 Concurrency</span>
                <span class="chip" data-chip="Explain Single-Null Design vs undefined" onclick="askChip('Explain Single-Null Design vs undefined')">Single-Null vs Undefined</span>
            </div>

            <div class="chat-history" id="chat-history"></div>
        </div>

        <!-- Persistent Fixed Bottom Chat Input Container -->
        <div class="chat-input-box" style="position: relative;">
            <div id="mention-menu" class="mention-menu" style="display: none;">
                <div class="mention-menu-header">Context References (click or Enter to insert):</div>
                <div class="mention-items-list" id="mention-items-list"></div>
            </div>

            <!-- Attached Files/Folders Bar -->
            <div id="attached-files-bar" class="attached-files-bar" style="display: none;"></div>

            <div class="chat-scope-bar">
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="opacity: 0.8;">Scope:</span>
                    <select id="chat-scope" class="scope-select">
                        <option value="workspace">Entire Workspace</option>
                        <option value="active">Active File Only</option>
                        <option value="refactor">Refactor Mode</option>
                    </select>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; overflow-x: auto;">
                    <button class="btn-mention-pill" onclick="insertMentionToken('@workspace')" title="Reference entire project architecture">@workspace</button>
                    <button class="btn-mention-pill" onclick="insertMentionToken('@selection')" title="Reference active editor code selection">@selection</button>
                    <button class="btn-mention-pill" onclick="insertMentionToken('@problems')" title="Reference current compiler diagnostics">@problems</button>
                </div>
            </div>
            <textarea id="chat-input" class="chat-textarea" placeholder="Ask Kora AI Agent, drag & drop files/folders here, type @ for context references, or /fix... (Enter to send, Shift+Enter for new line)"></textarea>
            <div class="chat-actions-row">
                <button class="btn-refactor-quick" onclick="requestWorkspaceRefactor()" title="Workspace-wide AI Auto-Fix & Refactor">
                    <span>Auto-Fix & Refactor</span>
                </button>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <button class="btn-attach" id="btn-attach" onclick="triggerFilePicker()" title="Attach File or Folder (Drag & Drop also supported)">Attach</button>
                    <button class="btn-stop-gen" id="btn-stop" style="display: none;" onclick="stopGeneration()" title="Stop Generation">
                        <span>Stop</span>
                    </button>
                    <button class="btn-send-main" id="btn-send" onclick="sendPrompt()">
                        <span>Send</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- 2. Active File Inspector Tab -->
    <div id="tab-copilot" class="section">
        <div class="file-status-box">
            <div class="file-title">
                <span id="active-filename">No active file</span>
                <span id="active-pill" class="pill library">Library</span>
            </div>
            <div id="active-meta" style="font-size: 11px; opacity: 0.8; margin-bottom: 6px;">Open a .kora or .kr file to analyze</div>
            
            <div class="action-grid">
                <button class="action-btn primary" id="btn-run" onclick="smartRun()">Smart Run / Test</button>
                <button class="action-btn" onclick="auditFile()" title="Audit file against .agent rules">Audit Rules</button>
                <button class="action-btn" onclick="checkFile()" title="Run type checks and linter">Check Types</button>
                <button class="action-btn" onclick="runTests()" title="Execute test suites">Test Suite</button>
                <button class="action-btn" onclick="explainCode()" title="Explain code architecture">Explain Code</button>
                <button class="action-btn" onclick="generateTests()" title="Scaffold tests for active symbols">Scaffold Tests</button>
                <button class="action-btn" onclick="switchTab('arch')" title="Inspect clean architecture layers">Architecture</button>
                <button class="action-btn" onclick="requestWorkspaceRefactor()" style="grid-column: span 2; background: linear-gradient(135deg, #0284c7, #2563eb); color: #fff; font-weight: 600;" title="AI analyzes workspace/file and proposes coordinated code fixes with Diff Review">AI Auto-Fix & Refactor (Workspace)</button>
            </div>
        </div>

        <div id="audit-container" style="display: none;">
            <div style="font-weight: 600; margin-bottom: 4px;">Rule Compliance Audit:</div>
            <div id="audit-text" class="audit-box"></div>
        </div>

        <div id="diagnostics-panel" style="display: none;">
            <div style="font-weight: 600; margin-bottom: 4px; color: #ef4444;">Compiler Diagnostics:</div>
            <div id="diagnostics-list"></div>
        </div>

        <div id="explanation-container" style="display: none;">
            <div style="font-weight: 600; margin-bottom: 4px;">Architecture Explanation:</div>
            <div id="explanation-text" class="explanation-box"></div>
        </div>
    </div>

    <!-- 3. Architecture Explorer Tab -->
    <div id="tab-arch" class="section">
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px;">Workspace Architecture Explorer</div>
        <div style="font-size: 11px; opacity: 0.8; margin-bottom: 10px;">Visual representation of Clean Architecture layers across your workspace:</div>
        
        <div id="arch-stats" class="action-grid" style="grid-template-columns: 1fr 1fr 1fr; margin-bottom: 12px;">
            <div style="background: var(--vscode-editor-background); padding: 6px; border-radius: 4px; text-align: center;">
                <div style="font-size: 16px; font-weight: 700; color: #3B82F6;" id="count-ctrl">0</div>
                <div style="font-size: 9px; opacity: 0.7;">Controllers</div>
            </div>
            <div style="background: var(--vscode-editor-background); padding: 6px; border-radius: 4px; text-align: center;">
                <div style="font-size: 16px; font-weight: 700; color: #10B981;" id="count-svc">0</div>
                <div style="font-size: 9px; opacity: 0.7;">Services</div>
            </div>
            <div style="background: var(--vscode-editor-background); padding: 6px; border-radius: 4px; text-align: center;">
                <div style="font-size: 16px; font-weight: 700; color: #F59E0B;" id="count-repo">0</div>
                <div style="font-size: 9px; opacity: 0.7;">Repositories</div>
            </div>
            <div style="background: var(--vscode-editor-background); padding: 6px; border-radius: 4px; text-align: center;">
                <div style="font-size: 16px; font-weight: 700; color: #EC4899;" id="count-entity">0</div>
                <div style="font-size: 9px; opacity: 0.7;">Entities</div>
            </div>
            <div style="background: var(--vscode-editor-background); padding: 6px; border-radius: 4px; text-align: center;">
                <div style="font-size: 16px; font-weight: 700; color: #8B5CF6;" id="count-model">0</div>
                <div style="font-size: 9px; opacity: 0.7;">DTO Models</div>
            </div>
            <div style="background: var(--vscode-editor-background); padding: 6px; border-radius: 4px; text-align: center;">
                <div style="font-size: 16px; font-weight: 700; color: #06B6D4;" id="count-test">0</div>
                <div style="font-size: 9px; opacity: 0.7;">Tests</div>
            </div>
        </div>

        <button class="action-btn primary" style="width: 100%; margin-bottom: 12px;" onclick="analyzeWorkspace()">Refresh Workspace Map</button>

        <div style="font-weight: 600; margin-bottom: 6px;">Layer Data Flow (Clean Architecture):</div>
        <div style="background: var(--vscode-editor-background); padding: 8px; border-radius: 4px; font-size: 11px; line-height: 1.5; border-left: 3px solid #10B981;">
            <b>1. HTTP Request</b> -> <code>Controllers (Presentation)</code><br>
            <b>2. Validation</b> -> <code>DTO Models (Boundary)</code><br>
            <b>3. Injected DI</b> -> <code>Services (Application Logic)</code><br>
            <b>4. Interface Contract</b> -> <code>Repositories (Data Access)</code><br>
            <b>5. Storage Mapping</b> -> <code>Entities (@table SQL / NoSQL)</code>
        </div>
    </div>

    <!-- 4. Learning Center Tab -->
    <div id="tab-learn" class="section">
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px;">Kora Interactive Learning Center</div>
        <div style="font-size: 11px; opacity: 0.8; margin-bottom: 10px;">Master Kora through hands-on lessons with runnable code:</div>

        <div class="lesson-card" style="background: var(--vscode-editor-background); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: var(--vscode-textLink-foreground);">Lesson 1: Pure Models & DTOs</div>
            <div style="font-size: 11px; margin: 4px 0;">Models define immutable payloads without runtime overhead:</div>
            <pre style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; font-size: 10px;">model User {\n    name: String\n    age: Int\n}</pre>
            <button class="action-btn" onclick="insertSnippet('model User {\n    name: String\n    age: Int\n}\n')">Insert into Editor</button>
        </div>

        <div class="lesson-card" style="background: var(--vscode-editor-background); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: var(--vscode-textLink-foreground);">Lesson 2: Clean Architecture & DI</div>
            <div style="font-size: 11px; margin: 4px 0;">Services receive dependencies via <code>init(...)</code> constructor injection:</div>
            <pre style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; font-size: 10px;">class UserService {\n    repo: UserRepository\n    init(repo: UserRepository) {\n        this.repo = repo\n    }\n}</pre>
            <button class="action-btn" onclick="insertSnippet('class UserService {\n    repo: UserRepository\n    init(repo: UserRepository) {\n        this.repo = repo\n    }\n}\n')">Insert into Editor</button>
        </div>

        <div class="lesson-card" style="background: var(--vscode-editor-background); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: var(--vscode-textLink-foreground);">Lesson 3: Concurrency Actors & Mailboxes</div>
            <div style="font-size: 11px; margin: 4px 0;">Stateful actors run on Tokio threads with <code>tell</code> and <code>ask</code>:</div>
            <pre style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; font-size: 10px;">class WorkerActor {\n    var count: Int\n    init() { this.count = 0 }\n    fn handle(msg: String) -> Int {\n        this.count += 1\n        return this.count\n    }\n}</pre>
            <button class="action-btn" onclick="insertSnippet('class WorkerActor {\n    var count: Int\n    init() { this.count = 0 }\n    fn handle(msg: String) -> Int {\n        this.count += 1\n        return this.count\n    }\n}\n')">Insert into Editor</button>
        </div>

        <div class="lesson-card" style="background: var(--vscode-editor-background); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: var(--vscode-textLink-foreground);">Lesson 4: Load Test with Teardown</div>
            <div style="font-size: 11px; margin: 4px 0;">High throughput stress testing with guaranteed resource teardown (Rule 10):</div>
            <pre style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; font-size: 10px;">class LoadTestSuite {\n    fn run(n: Int) -> Int {\n        var total = 0\n        for i in 0..n { total += 1 }\n        return total\n    }\n    fn teardown() -> Unit {\n        print(\"Teardown complete\")\n    }\n}</pre>
            <button class="action-btn" onclick="insertSnippet('class LoadTestSuite {\n    init() {}\n    fn run(n: Int) -> Int {\n        var total = 0\n        for i in 0..n { total += 1 }\n        return total\n    }\n    fn teardown() -> Unit {\n        print(\"  [Teardown] synthetic allocations purged\")\n    }\n}\n')">Insert into Editor</button>
        </div>
    </div>

    <!-- 5. Examples Catalog -->
    <div id="tab-examples" class="section">
        <div style="margin-bottom: 8px; font-size: 11px; opacity: 0.8;">Click any official reference architecture to scaffold directly into your project:</div>
        <div id="catalog-list">
            ${catalogHtml}
        </div>
    </div>

    <!-- 6. Settings Section -->
    <div id="tab-settings" class="section">
        <div style="font-weight: 600; font-size: 12.5px; margin-bottom: 4px;">AI Models & API Keys Settings</div>
        <div style="font-size: 10.5px; opacity: 0.8; margin-bottom: 10px;">Configure AI engine providers, API keys, custom endpoints, and models:</div>

        <div class="settings-group">
            <label class="settings-label">Active Engine Provider:</label>
            <select id="cfg-active-provider" class="provider-select" onchange="onSettingsProviderChange(this.value)">
                <option value="embedded">Embedded Core (Offline Rules & Docs)</option>
                <option value="copilot">GitHub Copilot (Native IDE - Zero Config)</option>
                <option value="ollama">Local Ollama (gemma:2b / local models)</option>
                <option value="github">GitHub Models API (PAT / Azure)</option>
                <option value="openai">OpenAI (gpt-4o / gpt-4o-mini)</option>
                <option value="gemini">Google Gemini (gemini-1.5-flash)</option>
                <option value="anthropic">Anthropic Claude (claude-3-5-sonnet)</option>
                <option value="custom">Custom OpenAI-compatible Endpoint</option>
            </select>
        </div>

        <div class="settings-group" id="cfg-field-copilot" style="display: none; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 8px; border-radius: 4px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: #60A5FA; margin-bottom: 4px;">Native GitHub Copilot Mode</div>
            <div style="font-size: 10.5px; opacity: 0.85; line-height: 1.4;">Zero tokens required: Directly connects to GitHub Copilot's Language Model in your IDE. No external PAT or setup needed!</div>
        </div>

        <div class="settings-group" id="cfg-field-ollama" style="display: none; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); padding: 8px; border-radius: 4px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-weight: 600; color: #34D399;">Local Ollama Integration</span>
                <button class="btn-prop-sm" onclick="refreshOllamaModels()">Scan Models</button>
            </div>
            <div style="font-size: 10.5px; opacity: 0.85; line-height: 1.4;">Private offline execution on your machine. Auto-detects local models (<b>gemma:2b</b>, etc.).</div>
        </div>

        <div class="settings-group" id="cfg-field-github">
            <label class="settings-label">GitHub Token / PAT:</label>
            <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                <input type="password" id="cfg-input-github" class="chat-textarea" style="min-height: 28px; max-height: 28px;" placeholder="ghp_... or github_pat_..." />
                <button class="btn-prop-sm" onclick="togglePasswordVisibility('cfg-input-github')">Show</button>
            </div>
            <button class="action-btn" style="width: 100%;" onclick="requestGitHubLogin()">Auto-Link GitHub Account</button>
        </div>

        <div class="settings-group" id="cfg-field-openai">
            <label class="settings-label">OpenAI API Key:</label>
            <div style="display: flex; gap: 4px;">
                <input type="password" id="cfg-input-openai" class="chat-textarea" style="min-height: 28px; max-height: 28px;" placeholder="sk-..." />
                <button class="btn-prop-sm" onclick="togglePasswordVisibility('cfg-input-openai')">Show</button>
            </div>
        </div>

        <div class="settings-group" id="cfg-field-gemini">
            <label class="settings-label">Google Gemini API Key:</label>
            <div style="display: flex; gap: 4px;">
                <input type="password" id="cfg-input-gemini" class="chat-textarea" style="min-height: 28px; max-height: 28px;" placeholder="AIzaSy..." />
                <button class="btn-prop-sm" onclick="togglePasswordVisibility('cfg-input-gemini')">Show</button>
            </div>
        </div>

        <div class="settings-group" id="cfg-field-anthropic">
            <label class="settings-label">Anthropic Claude API Key:</label>
            <div style="display: flex; gap: 4px;">
                <input type="password" id="cfg-input-anthropic" class="chat-textarea" style="min-height: 28px; max-height: 28px;" placeholder="sk-ant-..." />
                <button class="btn-prop-sm" onclick="togglePasswordVisibility('cfg-input-anthropic')">Show</button>
            </div>
        </div>

        <div class="settings-group">
            <label class="settings-label">Model Name:</label>
            <input type="text" id="cfg-input-model" class="chat-textarea" style="min-height: 28px; max-height: 28px;" placeholder="e.g. gpt-4o-mini, phi3:mini, claude-3-5-sonnet" />
        </div>

        <div class="settings-group">
            <label class="settings-label">Endpoint URL (Optional):</label>
            <input type="text" id="cfg-input-endpoint" class="chat-textarea" style="min-height: 28px; max-height: 28px;" placeholder="e.g. http://localhost:11434 or https://api.openai.com/v1" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 12px;">
            <button class="action-btn primary" onclick="saveAllSettings()">Save Settings</button>
            <button class="action-btn" onclick="testConnection()">Test Connection</button>
        </div>

        <div id="test-connection-status" style="margin-top: 10px; display: none; padding: 8px; border-radius: 5px; font-size: 11px; line-height: 1.4;"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function switchTab(name) {
            if (!name) return;
            const tabButtons = document.querySelectorAll('.tab-btn');
            tabButtons.forEach(b => {
                const target = b.getAttribute('data-tab');
                if (target === name) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });

            const sections = document.querySelectorAll('.section');
            sections.forEach(s => {
                if (s.id === 'tab-' + name) {
                    s.classList.add('active');
                    s.style.display = (name === 'ask' ? 'flex' : 'block');
                } else {
                    s.classList.remove('active');
                    s.style.display = 'none';
                }
            });

            try {
                const s = vscode.getState() || { history: [] };
                s.activeTab = name;
                vscode.setState(s);
            } catch (e) {}
        }
        window.switchTab = switchTab;

        // Global Event Delegation for all tabs and chips
        document.addEventListener('click', function(e) {
            const tabBtn = e.target.closest('.tab-btn');
            if (tabBtn) {
                const tab = tabBtn.getAttribute('data-tab');
                if (tab) {
                    e.preventDefault();
                    switchTab(tab);
                    return;
                }
            }

            const chip = e.target.closest('.chip');
            if (chip) {
                const txt = chip.getAttribute('data-chip') || chip.innerText;
                if (txt && typeof askChip === 'function') {
                    e.preventDefault();
                    askChip(txt);
                    return;
                }
            }
        });

        let isGenerating = false;
        let lastSentPrompt = '';
        let availableContextFiles = [];
        let mentionSelectedIndex = 0;
        let activeMentionFilter = '';

        // Drag & Drop File and Folder Attachment Handler
        const dropOverlay = document.getElementById('drop-overlay');
        const attachedBar = document.getElementById('attached-files-bar');
        let attachedPaths = [];

        function renderAttachedPills() {
            if (!attachedBar) return;
            if (attachedPaths.length === 0) {
                attachedBar.style.display = 'none';
                attachedBar.innerHTML = '';
                return;
            }
            attachedBar.style.display = 'flex';
            attachedBar.innerHTML = '';
            attachedPaths.forEach((itemPath, index) => {
                const pill = document.createElement('span');
                pill.className = 'attached-file-pill';
                const isFolder = itemPath.endsWith('/') || !itemPath.includes('.');
                const icon = isFolder ? '[Folder]' : '[File]';
                const shortName = itemPath.split(/[/\\]/).filter(Boolean).pop() || itemPath;
                pill.innerHTML = '<span>' + icon + ' ' + shortName + '</span><span class="attached-file-remove" data-idx="' + index + '" title="Remove attachment">x</span>';
                pill.querySelector('.attached-file-remove').onclick = (e) => {
                    e.stopPropagation();
                    attachedPaths.splice(index, 1);
                    renderAttachedPills();
                };
                attachedBar.appendChild(pill);
            });
        }

        function attachFileOrFolder(rawPath) {
            if (!rawPath) return;
            const clean = rawPath.trim().replace(/^file:\/\//, '');
            if (!attachedPaths.includes(clean)) {
                attachedPaths.push(clean);
                renderAttachedPills();
            }
        }

        function triggerFilePicker() {
            vscode.postMessage({ type: 'selectFilesToAttach' });
        }

        let dragCounter = 0;
        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            if (dropOverlay) dropOverlay.style.display = 'flex';
        });

        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0 && dropOverlay) {
                dropOverlay.style.display = 'none';
                dragCounter = 0;
            }
        });

        window.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            if (dropOverlay && dropOverlay.style.display === 'none') {
                dropOverlay.style.display = 'flex';
            }
        });

        window.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            if (dropOverlay) dropOverlay.style.display = 'none';

            if (e.dataTransfer) {
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    for (let i = 0; i < e.dataTransfer.files.length; i++) {
                        const file = e.dataTransfer.files[i];
                        const pathStr = file.path || file.name;
                        attachFileOrFolder(pathStr);
                    }
                }
                const uriList = e.dataTransfer.getData('text/uri-list');
                if (uriList) {
                    const lines = uriList.split(/\r?\n/).filter(Boolean);
                    lines.forEach(l => attachFileOrFolder(l));
                }
                const textPath = e.dataTransfer.getData('text/plain');
                if (textPath && !uriList) {
                    textPath.split(/\r?\n/).filter(Boolean).forEach(p => attachFileOrFolder(p));
                }
            }
        });

        // Request available files for context mention autocomplete
        vscode.postMessage({ type: 'getAvailableContextOptions' });

        // Restore persisted state safely
        try {
            const state = vscode.getState() || { history: [], activeTab: 'ask', proposals: [] };
            if (state.history && Array.isArray(state.history)) {
                state.history.forEach(item => {
                    try {
                        if (item.type === 'message') appendMessage(item.role, item.text, false);
                        else if (item.type === 'proposal') renderProposalCard(item.proposal, false);
                    } catch (e) {}
                });
            }
            if (state.activeTab && state.activeTab !== 'ask') {
                switchTab(state.activeTab);
            }
        } catch (e) {}

        // Auto-expand textarea & mention menu listeners
        const chatInput = document.getElementById('chat-input');
        const mentionMenu = document.getElementById('mention-menu');
        const mentionList = document.getElementById('mention-items-list');

        if (chatInput) {
            chatInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
                handleMentionInput();
            });

            chatInput.addEventListener('keydown', function(e) {
                if (mentionMenu && mentionMenu.style.display !== 'none') {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        navigateMention(1);
                        return;
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        navigateMention(-1);
                        return;
                    } else if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault();
                        selectCurrentMention();
                        return;
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        hideMentionMenu();
                        return;
                    }
                }

                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendPrompt();
                }
            });
        }

        function handleMentionInput() {
            if (!chatInput) return;
            const cursorPos = chatInput.selectionStart;
            const textBefore = chatInput.value.slice(0, cursorPos);
            const atMatch = textBefore.match(/@([a-zA-Z0-9_.:\/-]*)$/);

            if (atMatch) {
                activeMentionFilter = atMatch[1].toLowerCase();
                showMentionMenu(activeMentionFilter);
            } else {
                hideMentionMenu();
            }
        }

        function showMentionMenu(filter = '') {
            if (!mentionMenu || !mentionList) return;

            const baseOptions = [
                { token: '@workspace', label: '@workspace', desc: 'Full workspace analysis & Clean Architecture layers' },
                { token: '@selection', label: '@selection', desc: 'Reference current code selection in editor' },
                { token: '@problems', label: '@problems', desc: 'Reference active compiler diagnostics & errors' },
                { token: '@terminal', label: '@terminal', desc: 'Reference active terminal sessions' },
                { token: '@file:', label: '@file:<path>', desc: 'Include specific project file content' },
                { token: '@folder:', label: '@folder:<path>', desc: 'Inspect directory file hierarchy' }
            ];

            const fileOptions = availableContextFiles.map(f => ({
                token: '@file:' + f.label,
                label: '@file:' + f.label,
                desc: (f.role || 'file') + ' - ' + f.path
            }));

            const all = baseOptions.concat(fileOptions);
            const filtered = filter ? all.filter(o => o.token.toLowerCase().includes(filter) || o.label.toLowerCase().includes(filter)) : all;

            if (filtered.length === 0) {
                hideMentionMenu();
                return;
            }

            mentionSelectedIndex = 0;
            mentionList.innerHTML = '';
            filtered.slice(0, 10).forEach((item, idx) => {
                const div = document.createElement('div');
                div.className = 'mention-item' + (idx === 0 ? ' selected' : '');
                div.innerHTML = '<span class="mention-token">' + item.token + '</span><span class="mention-desc">' + item.desc + '</span>';
                div.onclick = () => {
                    applyMentionSelection(item.token);
                };
                mentionList.appendChild(div);
            });

            mentionMenu.style.display = 'block';
        }

        function hideMentionMenu() {
            if (mentionMenu) mentionMenu.style.display = 'none';
        }

        function navigateMention(delta) {
            if (!mentionList) return;
            const items = mentionList.querySelectorAll('.mention-item');
            if (items.length === 0) return;
            if (items[mentionSelectedIndex]) items[mentionSelectedIndex].classList.remove('selected');
            mentionSelectedIndex = (mentionSelectedIndex + delta + items.length) % items.length;
            if (items[mentionSelectedIndex]) {
                items[mentionSelectedIndex].classList.add('selected');
                items[mentionSelectedIndex].scrollIntoView({ block: 'nearest' });
            }
        }

        function selectCurrentMention() {
            if (!mentionList) return;
            const items = mentionList.querySelectorAll('.mention-item');
            if (items.length > 0 && items[mentionSelectedIndex]) {
                const tokenEl = items[mentionSelectedIndex].querySelector('.mention-token');
                if (tokenEl) applyMentionSelection(tokenEl.innerText);
            }
        }

        function applyMentionSelection(token) {
            if (!chatInput) return;
            const cursorPos = chatInput.selectionStart;
            const text = chatInput.value;
            const textBefore = text.slice(0, cursorPos);
            const textAfter = text.slice(cursorPos);
            const atIndex = textBefore.lastIndexOf('@');
            if (atIndex >= 0) {
                chatInput.value = textBefore.slice(0, atIndex) + token + ' ' + textAfter;
                const newPos = atIndex + token.length + 1;
                chatInput.selectionStart = chatInput.selectionEnd = newPos;
            } else {
                insertMentionToken(token);
            }
            chatInput.focus();
            hideMentionMenu();
        }

        function insertMentionToken(token) {
            if (!chatInput) return;
            const pos = chatInput.selectionStart || chatInput.value.length;
            const before = chatInput.value.slice(0, pos);
            const after = chatInput.value.slice(pos);
            const sep = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
            chatInput.value = before + sep + token + ' ' + after;
            chatInput.focus();
            chatInput.selectionStart = chatInput.selectionEnd = pos + sep.length + token.length + 1;
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
            hideMentionMenu();
        }

        function toggleTrackerSteps() {
            const steps = document.getElementById('tracker-steps');
            const chev = document.getElementById('tracker-chevron');
            if (!steps) return;
            if (steps.style.display === 'none') {
                steps.style.display = 'flex';
                if (chev) chev.innerText = '^';
            } else {
                steps.style.display = 'none';
                if (chev) chev.innerText = 'v';
            }
        }

        function copyText(str) {
            navigator.clipboard.writeText(str);
        }

        function stopGeneration() {
            vscode.postMessage({ type: 'stopGeneration' });
            isGenerating = false;
            const btnSend = document.getElementById('btn-send');
            const btnStop = document.getElementById('btn-stop');
            if (btnSend) btnSend.disabled = false;
            if (btnStop) btnStop.style.display = 'none';
            removeTypingIndicator();
            hideAgentTracker();
            appendMessage('assistant', '*Generation cancelled by user.*', false);
        }

        function requestWorkspaceRefactor() {
            const scope = document.getElementById('chat-scope').value;
            const input = document.getElementById('chat-input');
            const customGoal = input ? input.value.trim() : '';
            if (input) input.value = '';

            showAgentTracker('PlanningRefactor', 'Analyzing workspace invariants and planning changes...');
            vscode.postMessage({
                type: 'requestWorkspaceRefactor',
                scope: scope,
                goal: customGoal || 'Auto-Fix and refactor Kora invariants'
            });
        }

        function previewDiff(filePath, proposalId) {
            vscode.postMessage({
                type: 'previewDiff',
                filePath: filePath,
                proposalId: proposalId
            });
        }

        function openFile(filePath) {
            vscode.postMessage({
                type: 'openFile',
                filePath: filePath
            });
        }

        function acceptProposal(proposalId) {
            vscode.postMessage({
                type: 'acceptProposal',
                proposalId: proposalId
            });
        }

        function rejectProposal(proposalId) {
            vscode.postMessage({
                type: 'rejectProposal',
                proposalId: proposalId
            });
        }

        function setFileStatus(proposalId, filePath, status) {
            vscode.postMessage({
                type: 'setFileStatus',
                proposalId: proposalId,
                filePath: filePath,
                status: status
            });
        }

        function smartRun() { vscode.postMessage({ type: 'smartRun' }); }
        function checkFile() { vscode.postMessage({ type: 'checkFile' }); }
        function runTests() { vscode.postMessage({ type: 'runTests' }); }
        function explainCode() { vscode.postMessage({ type: 'explainCode' }); }
        function auditFile() { vscode.postMessage({ type: 'auditFile' }); }
        function generateTests() { vscode.postMessage({ type: 'generateTests' }); }
        function cloneExample(slug) { vscode.postMessage({ type: 'cloneExample', slug: slug }); }
        function insertSnippet(code) { vscode.postMessage({ type: 'insertCode', code: code }); }
        function analyzeWorkspace() { vscode.postMessage({ type: 'analyzeWorkspace' }); }

        function askChip(text) {
            const input = document.getElementById('chat-input');
            if (input) {
                input.value = text;
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            }
            sendPrompt();
        }

        function onProviderSelectChanged(provider) {
            vscode.postMessage({ type: 'updateProvider', provider: provider });
            updateConfigBoxVisibility(provider);
        }

        function toggleConfigPanel() {
            const box = document.getElementById('provider-config-box');
            box.style.display = box.style.display === 'none' ? 'block' : 'none';
            const current = document.getElementById('copilot-provider-select').value;
            updateConfigBoxVisibility(current);
        }

        function updateConfigBoxVisibility(provider) {
            const cp = document.getElementById('cfg-copilot');
            const gh = document.getElementById('cfg-github');
            const ol = document.getElementById('cfg-ollama');
            const em = document.getElementById('cfg-embedded');
            if (cp) cp.style.display = provider === 'copilot' ? 'block' : 'none';
            if (gh) gh.style.display = provider === 'github' ? 'block' : 'none';
            if (ol) {
                ol.style.display = provider === 'ollama' ? 'block' : 'none';
                if (provider === 'ollama') refreshOllamaModels();
            }
            if (em) em.style.display = provider === 'embedded' ? 'block' : 'none';
        }

        function refreshOllamaModels() {
            const endInput = document.getElementById('cfg-ollama-endpoint') || document.getElementById('cfg-input-endpoint');
            const endpoint = (endInput && endInput.value.trim()) ? endInput.value.trim() : 'http://localhost:11434';
            vscode.postMessage({ type: 'fetchOllamaModels', endpoint: endpoint });
        }

        function onOllamaSelectChange(val) {
            const customInput = document.getElementById('cfg-ollama-custom');
            if (val === 'custom') {
                if (customInput) customInput.style.display = 'block';
            } else {
                if (customInput) customInput.style.display = 'none';
                const modelInput = document.getElementById('cfg-input-model');
                if (modelInput) modelInput.value = val;
            }
        }

        function requestGitHubLogin() {
            vscode.postMessage({ type: 'requestGitHubAuth' });
        }

        function saveGitHubConfig() {
            const token = document.getElementById('cfg-gh-token').value.trim();
            const model = document.getElementById('cfg-gh-model').value;
            vscode.postMessage({
                type: 'updateGitHubConfig',
                token: token,
                model: model
            });
            document.getElementById('provider-config-box').style.display = 'none';
        }

        function saveOllamaConfig() {
            const endpoint = document.getElementById('cfg-ollama-endpoint').value.trim();
            const selectVal = document.getElementById('cfg-ollama-model').value;
            const customInput = document.getElementById('cfg-ollama-custom');
            const customVal = customInput ? customInput.value.trim() : '';
            const model = (selectVal === 'custom' && customVal) ? customVal : (selectVal !== 'custom' ? selectVal : 'gemma:2b');
            vscode.postMessage({
                type: 'updateOllamaConfig',
                endpoint: endpoint,
                model: model
            });
            document.getElementById('provider-config-box').style.display = 'none';
        }

        function togglePasswordVisibility(id) {
            const input = document.getElementById(id);
            if (input) input.type = input.type === 'password' ? 'text' : 'password';
        }

        function onSettingsProviderChange(val) {
            const modelInput = document.getElementById('cfg-input-model');
            const endInput = document.getElementById('cfg-input-endpoint');
            const cpGroup = document.getElementById('cfg-field-copilot');
            const olGroup = document.getElementById('cfg-field-ollama');
            const ghGroup = document.getElementById('cfg-field-github');
            const oaGroup = document.getElementById('cfg-field-openai');
            const geGroup = document.getElementById('cfg-field-gemini');
            const anGroup = document.getElementById('cfg-field-anthropic');

            if (cpGroup) cpGroup.style.display = val === 'copilot' ? 'block' : 'none';
            if (olGroup) olGroup.style.display = val === 'ollama' ? 'block' : 'none';
            if (ghGroup) ghGroup.style.display = val === 'github' ? 'block' : 'none';
            if (oaGroup) oaGroup.style.display = (val === 'openai' || val === 'custom') ? 'block' : 'none';
            if (geGroup) geGroup.style.display = val === 'gemini' ? 'block' : 'none';
            if (anGroup) anGroup.style.display = val === 'anthropic' ? 'block' : 'none';

            if (val === 'copilot') {
                if (modelInput) modelInput.value = 'default';
                if (endInput) endInput.value = '';
            } else if (val === 'github') {
                if (modelInput && (!modelInput.value || modelInput.value === 'default' || modelInput.value.includes('gemma'))) modelInput.value = 'gpt-4o-mini';
            } else if (val === 'ollama') {
                if (modelInput && (!modelInput.value || modelInput.value === 'default' || modelInput.value.includes('gpt'))) {
                    modelInput.value = window.koraEnvModel || 'gemma:2b';
                }
                if (endInput && !endInput.value) endInput.value = 'http://localhost:11434';
                refreshOllamaModels();
            } else if (val === 'gemini') {
                if (modelInput && (!modelInput.value || modelInput.value === 'default')) modelInput.value = 'gemini-1.5-flash';
            } else if (val === 'anthropic') {
                if (modelInput && (!modelInput.value || modelInput.value === 'default')) modelInput.value = 'claude-3-5-sonnet-20241022';
            }
        }

        function saveAllSettings() {
            const settings = {
                provider: document.getElementById('cfg-active-provider').value,
                githubToken: document.getElementById('cfg-input-github').value.trim(),
                openaiKey: document.getElementById('cfg-input-openai').value.trim(),
                geminiKey: document.getElementById('cfg-input-gemini').value.trim(),
                anthropicKey: document.getElementById('cfg-input-anthropic').value.trim(),
                model: document.getElementById('cfg-input-model').value.trim(),
                endpoint: document.getElementById('cfg-input-endpoint').value.trim()
            };
            vscode.postMessage({
                type: 'saveAllSettings',
                settings: settings
            });
        }

        function testConnection() {
            const statusDiv = document.getElementById('test-connection-status');
            statusDiv.style.display = 'block';
            statusDiv.style.background = 'var(--vscode-editorWidget-background)';
            statusDiv.style.border = '1px solid var(--vscode-widget-border)';
            statusDiv.style.color = 'var(--vscode-foreground)';
            statusDiv.innerText = 'Testing connection...';

            const settings = {
                provider: document.getElementById('cfg-active-provider').value,
                githubToken: document.getElementById('cfg-input-github').value.trim(),
                openaiKey: document.getElementById('cfg-input-openai').value.trim(),
                geminiKey: document.getElementById('cfg-input-gemini').value.trim(),
                anthropicKey: document.getElementById('cfg-input-anthropic').value.trim(),
                model: document.getElementById('cfg-input-model').value.trim(),
                endpoint: document.getElementById('cfg-input-endpoint').value.trim()
            };
            vscode.postMessage({
                type: 'testConnection',
                settings: settings
            });
        }

        function sendPrompt() {
            const input = document.getElementById('chat-input');
            let prompt = input.value.trim();
            if ((!prompt && attachedPaths.length === 0) || isGenerating) return;

            if (attachedPaths.length > 0) {
                const attachmentTokens = attachedPaths.map(p => {
                    const isFolder = p.endsWith('/') || !p.includes('.');
                    return isFolder ? ('@folder:' + p) : ('@file:' + p);
                }).join(' ');
                prompt = (prompt ? (prompt + ' ') : '') + attachmentTokens;
                attachedPaths = [];
                renderAttachedPills();
            }

            lastSentPrompt = prompt;
            isGenerating = true;

            const btnSend = document.getElementById('btn-send');
            const btnStop = document.getElementById('btn-stop');
            if (btnSend) btnSend.disabled = true;
            if (btnStop) btnStop.style.display = 'inline-flex';

            const scope = document.getElementById('chat-scope').value;
            appendMessage('user', prompt);
            showTypingIndicator();
            showAgentTracker('Understanding', 'Analyzing user request with workspace context...');

            vscode.postMessage({
                type: 'askQuestion',
                prompt: prompt,
                scope: scope
            });

            input.value = '';
            input.style.height = '40px';
        }

        function appendMessage(role, text, persist = true) {
            const history = document.getElementById('chat-history');
            const scrollArea = document.getElementById('chat-scroll-area');
            const msg = document.createElement('div');
            msg.className = role === 'user' ? 'msg-user' : 'msg-assistant';

            if (role === 'assistant') {
                renderMarkdownWithCodeActions(text, msg);
            } else {
                msg.innerText = text;
            }

            history.appendChild(msg);
            if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;

            if (persist) {
                const s = vscode.getState() || { history: [] };
                s.history = s.history || [];
                s.history.push({ type: 'message', role, text });
                vscode.setState(s);
            }
        }

        function showTypingIndicator() {
            removeTypingIndicator();
            const history = document.getElementById('chat-history');
            const scrollArea = document.getElementById('chat-scroll-area');
            const ind = document.createElement('div');
            ind.id = 'active-typing-indicator';
            ind.className = 'typing-indicator';
            ind.innerHTML = '<span>Kora AI is reasoning...</span><span class="typing-cursor"></span>';
            history.appendChild(ind);
            if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
        }

        function removeTypingIndicator() {
            const ind = document.getElementById('active-typing-indicator');
            if (ind) ind.remove();
        }

        function showAgentTracker(state, detail) {
            const tracker = document.getElementById('agent-tracker');
            if (!tracker) return;
            tracker.style.display = 'flex';
            document.getElementById('tracker-state-title').innerText = state;
            document.getElementById('tracker-detail').innerText = detail;
        }

        function hideAgentTracker() {
            const tracker = document.getElementById('agent-tracker');
            if (tracker) tracker.style.display = 'none';
        }

        function renderProposalCard(proposal, persist = true) {
            removeTypingIndicator();
            hideAgentTracker();

            const history = document.getElementById('chat-history');
            const scrollArea = document.getElementById('chat-scroll-area');

            const card = document.createElement('div');
            card.className = 'proposal-card';
            card.id = 'card-' + proposal.id;

            let fileRows = '';
            for (const f of proposal.files) {
                const statusColor = f.status === 'accepted' ? '#10b981' : (f.status === 'rejected' ? '#ef4444' : '#38bdf8');
                fileRows += '<div class="proposal-file-row">' +
                    '<span class="proposal-file-name" onclick="openFile(\'' + f.filePath + '\')" title="Click to open ' + f.fileName + '">' + f.fileName + '</span>' +
                    '<span class="diff-stat-add">+' + f.additions + '</span>' +
                    '<span class="diff-stat-del">-' + f.deletions + '</span>' +
                    '<span style="font-size: 9.5px; color:' + statusColor + ';">' + f.status + '</span>' +
                    '<button class="btn-prop-sm" onclick="previewDiff(\'' + f.filePath + '\', \'' + proposal.id + '\')">Diff</button>' +
                    '<button class="btn-prop-sm" style="color: #10b981;" onclick="setFileStatus(\'' + proposal.id + '\', \'' + f.filePath + '\', \'accepted\')" title="Accept this file">Accept</button>' +
                    '<button class="btn-prop-sm" style="color: #ef4444;" onclick="setFileStatus(\'' + proposal.id + '\', \'' + f.filePath + '\', \'rejected\')" title="Reject this file">Reject</button>' +
                '</div>';
            }

            card.innerHTML = '<div class="proposal-card-header">' +
                '<span class="proposal-title">' + proposal.title + '</span>' +
                '<span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8;">' + proposal.totalFiles + ' files</span>' +
            '</div>' +
            '<div style="font-size: 10.5px; opacity: 0.85; margin-bottom: 6px;">Coordinated changes proposed across multiple project files. Click <b>Diff</b> to inspect native side-by-side comparison.</div>' +
            '<div class="proposal-files-list">' + fileRows + '</div>' +
            '<div class="proposal-global-actions">' +
                '<button class="btn-accept-all" onclick="acceptProposal(\'' + proposal.id + '\')">Accept All Changes</button>' +
                '<button class="btn-reject-all" onclick="rejectProposal(\'' + proposal.id + '\')">Reject All</button>' +
            '</div>';

            history.appendChild(card);
            if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;

            if (persist) {
                const s = vscode.getState() || { history: [] };
                s.history = s.history || [];
                s.history.push({ type: 'proposal', proposal });
                vscode.setState(s);
            }
        }

        function renderMarkdownWithCodeActions(text, container) {
            container.innerHTML = '';
            const codeBlockRegex = new RegExp('\\x60{3}([a-zA-Z0-9_-]*)\\n([\\s\\S]*?)\\x60{3}', 'g');
            let lastIndex = 0;
            let match;

            while ((match = codeBlockRegex.exec(text)) !== null) {
                const preText = text.substring(lastIndex, match.index);
                if (preText.trim()) {
                    appendMarkdownText(preText, container);
                }

                const lang = match[1] || 'kora';
                const code = match[2];

                const card = document.createElement('div');
                card.style.margin = '8px 0';
                card.style.background = 'var(--vscode-terminal-background, #181818)';
                card.style.border = '1px solid rgba(255,255,255,0.12)';
                card.style.borderRadius = '6px';
                card.style.overflow = 'hidden';

                const header = document.createElement('div');
                header.style.display = 'flex';
                header.style.justifyContent = 'space-between';
                header.style.alignItems = 'center';
                header.style.padding = '4px 8px';
                header.style.background = 'rgba(255,255,255,0.05)';
                header.style.fontSize = '10px';
                header.style.opacity = '0.85';
                header.innerHTML = '<span>' + lang.toUpperCase() + '</span>';

                const pre = document.createElement('pre');
                pre.style.margin = '0';
                pre.style.padding = '8px';
                pre.style.fontSize = '11px';
                pre.style.fontFamily = 'monospace';
                pre.style.overflowX = 'auto';
                pre.style.whiteSpace = 'pre';
                pre.innerText = code;

                const bar = document.createElement('div');
                bar.style.display = 'flex';
                bar.style.gap = '6px';
                bar.style.padding = '6px 8px';
                bar.style.background = 'rgba(0,0,0,0.2)';
                bar.style.borderTop = '1px solid rgba(255,255,255,0.08)';

                const btnApply = document.createElement('button');
                btnApply.className = 'btn-prop-sm';
                btnApply.style.background = '#10B981';
                btnApply.style.color = '#fff';
                btnApply.innerText = 'Apply to File';
                btnApply.onclick = () => {
                    vscode.postMessage({ type: 'applyFix', code: code });
                };

                const btnDiff = document.createElement('button');
                btnDiff.className = 'btn-prop-sm';
                btnDiff.innerText = 'Diff';
                btnDiff.onclick = () => {
                    vscode.postMessage({ type: 'previewDiff', code: code });
                };

                const btnCopy = document.createElement('button');
                btnCopy.className = 'btn-prop-sm';
                btnCopy.innerText = 'Copy';
                btnCopy.onclick = () => {
                    navigator.clipboard.writeText(code);
                    btnCopy.innerText = 'Copied';
                    setTimeout(() => { btnCopy.innerText = 'Copy'; }, 1500);
                };

                bar.appendChild(btnApply);
                bar.appendChild(btnDiff);
                bar.appendChild(btnCopy);

                card.appendChild(header);
                card.appendChild(pre);
                card.appendChild(bar);
                container.appendChild(card);

                lastIndex = match.index + match[0].length;
            }

            const remainingText = text.substring(lastIndex);
            if (remainingText.trim()) {
                appendMarkdownText(remainingText, container);
            }
        }

        function appendMarkdownText(text, container) {
            const p = document.createElement('div');
            p.style.whiteSpace = 'pre-wrap';
            p.style.lineHeight = '1.45';

            // Find file links: [label](file://path)
            const linkRegex = /\[([^\]]+)\]\(file:\/\/([^)]+)\)/g;
            let lastIdx = 0;
            let m;

            while ((m = linkRegex.exec(text)) !== null) {
                if (m.index > lastIdx) {
                    p.appendChild(document.createTextNode(text.substring(lastIdx, m.index)));
                }
                const pill = document.createElement('span');
                pill.className = 'file-ref-pill';
                pill.innerText = m[1];
                const targetFilePath = m[2];
                pill.onclick = () => openFile(targetFilePath);
                p.appendChild(pill);
                lastIdx = m.index + m[0].length;
            }

            if (lastIdx < text.length) {
                p.appendChild(document.createTextNode(text.substring(lastIdx)));
            }

            container.appendChild(p);
        }

        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.type === 'agentProgress') {
                const s = msg.step;
                showAgentTracker(s.state, s.detail);
                const stepsBox = document.getElementById('tracker-steps');
                if (stepsBox && msg.allSteps) {
                    stepsBox.innerHTML = '';
                    for (const st of msg.allSteps) {
                        const line = document.createElement('div');
                        line.innerText = '[' + st.state + '] ' + st.detail;
                        stepsBox.appendChild(line);
                    }
                }
            } else if (msg.type === 'filesAttached') {
                if (msg.paths && Array.isArray(msg.paths)) {
                    msg.paths.forEach(p => attachFileOrFolder(p));
                }
            } else if (msg.type === 'availableContextOptions') {
                availableContextFiles = msg.files || [];
            } else if (msg.type === 'proposalCreated') {
                isGenerating = false;
                const btnSend = document.getElementById('btn-send');
                const btnStop = document.getElementById('btn-stop');
                if (btnSend) btnSend.disabled = false;
                if (btnStop) btnStop.style.display = 'none';
                renderProposalCard(msg.proposal, true);
            } else if (msg.type === 'proposalUpdated') {
                const oldCard = document.getElementById('card-' + msg.proposal.id);
                if (oldCard) oldCard.remove();
                renderProposalCard(msg.proposal, true);
            } else if (msg.type === 'proposalApplied') {
                const card = document.getElementById('card-' + msg.proposalId);
                if (card) {
                    card.style.borderColor = '#10B981';
                    const actBox = card.querySelector('.proposal-global-actions');
                    if (actBox) actBox.innerHTML = '<div style="color: #10b981; font-weight: 600; text-align: center; grid-column: span 2;">Changes Successfully Applied!</div>';
                }
            } else if (msg.type === 'proposalRejected') {
                const card = document.getElementById('card-' + msg.proposalId);
                if (card) {
                    card.style.borderColor = '#ef4444';
                    const actBox = card.querySelector('.proposal-global-actions');
                    if (actBox) actBox.innerHTML = '<div style="color: #ef4444; font-weight: 600; text-align: center; grid-column: span 2;">Proposal Rejected.</div>';
                }
            } else if (msg.type === 'assistantAnswer') {
                isGenerating = false;
                const btnSend = document.getElementById('btn-send');
                const btnStop = document.getElementById('btn-stop');
                if (btnSend) btnSend.disabled = false;
                if (btnStop) btnStop.style.display = 'none';
                removeTypingIndicator();
                hideAgentTracker();
                appendMessage('assistant', msg.answer, true);
                if (msg.provider && msg.provider !== 'embedded') {
                    document.getElementById('engine-indicator').innerText = 'Connected: ' + msg.provider;
                }
            } else if (msg.type === 'assistantError') {
                isGenerating = false;
                const btnSend = document.getElementById('btn-send');
                const btnStop = document.getElementById('btn-stop');
                if (btnSend) btnSend.disabled = false;
                if (btnStop) btnStop.style.display = 'none';
                removeTypingIndicator();
                hideAgentTracker();

                // Preserve user prompt so it is not lost
                if (msg.originalPrompt && chatInput) {
                    chatInput.value = msg.originalPrompt;
                    chatInput.style.height = 'auto';
                    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
                }

                appendMessage('assistant', '**AI Request Failed**: ' + msg.error + '\n\n*Your input was preserved below.*', false);
            } else if (msg.type === 'generationStopped') {
                isGenerating = false;
                const btnSend = document.getElementById('btn-send');
                const btnStop = document.getElementById('btn-stop');
                if (btnSend) btnSend.disabled = false;
                if (btnStop) btnStop.style.display = 'none';
                removeTypingIndicator();
                hideAgentTracker();
            } else if (msg.type === 'fileUpdated') {
                const a = msg.analysis;
                if (!a) return;
                document.getElementById('active-filename').innerText = a.fileName;
                const pill = document.getElementById('active-pill');
                pill.innerText = a.classification;
                pill.className = 'pill ' + (a.isTestFile ? 'test' : (a.isRunnable ? 'runnable' : 'library'));

                document.getElementById('active-meta').innerText = a.lineCount + ' lines - ' + a.symbols.length + ' symbols - ' + a.imports.length + ' imports';
                
                const btnRun = document.getElementById('btn-run');
                if (a.isTestFile) {
                    btnRun.innerText = 'Run Test Suite (kora test)';
                } else if (a.isRunnable) {
                    btnRun.innerText = 'Run Entrypoint (kora run)';
                } else {
                    btnRun.innerText = 'Check Module (kora check)';
                }
            } else if (msg.type === 'diagnosticsUpdated') {
                const panel = document.getElementById('diagnostics-panel');
                const list = document.getElementById('diagnostics-list');
                list.innerHTML = '';
                if (msg.diagnostics && msg.diagnostics.length > 0) {
                    panel.style.display = 'block';
                    msg.diagnostics.forEach(d => {
                        const div = document.createElement('div');
                        div.className = 'diag-item';
                        div.innerText = 'Line ' + d.line + ': ' + d.message;
                        list.appendChild(div);
                    });
                } else {
                    panel.style.display = 'none';
                }
            } else if (msg.type === 'auditResult') {
                const container = document.getElementById('audit-container');
                const text = document.getElementById('audit-text');
                container.style.display = 'block';
                const audit = msg.audit;
                if (audit.passed) {
                    text.innerHTML = '<span style="color: #10B981; font-weight: 600;">100% Rule Compliance:</span> No violations of .agent/rules found.';
                } else {
                    let out = '<span style="color: #ef4444; font-weight: 600;">' + audit.violations + ' Rule Violation(s):</span><br>';
                    audit.findings.forEach(f => {
                        out += '<div style="margin-top: 4px;">- <b>[' + f.code + '] ' + f.rule + '</b>: ' + f.message + '<br><i>Fix: ' + f.fix + '</i></div>';
                    });
                    text.innerHTML = out;
                }
            } else if (msg.type === 'explanationResult') {
                const container = document.getElementById('explanation-container');
                const text = document.getElementById('explanation-text');
                container.style.display = 'block';
                text.innerText = msg.explanation;
            } else if (msg.type === 'switchTab') {
                switchTab(msg.tab);
            } else if (msg.type === 'architectureResult') {
                const arch = msg.architecture;
                if (arch && arch.counts) {
                    document.getElementById('count-ctrl').innerText = arch.counts.controllers;
                    document.getElementById('count-svc').innerText = arch.counts.services;
                    document.getElementById('count-repo').innerText = arch.counts.repositories;
                    document.getElementById('count-entity').innerText = arch.counts.entities;
                    document.getElementById('count-model').innerText = arch.counts.models;
                    document.getElementById('count-test').innerText = arch.counts.tests;
                }
            } else if (msg.type === 'walkthroughResult') {
                switchTab('copilot');
                const container = document.getElementById('explanation-container');
                const text = document.getElementById('explanation-text');
                container.style.display = 'block';
                text.innerText = msg.walkthrough;
            } else if (msg.type === 'testConnectionResult') {
                const statusDiv = document.getElementById('test-connection-status');
                if (!statusDiv) return;
                statusDiv.style.display = 'block';
                if (msg.result.success) {
                    statusDiv.style.background = 'rgba(16, 185, 129, 0.15)';
                    statusDiv.style.border = '1px solid #10B981';
                    statusDiv.style.color = '#34D399';
                    statusDiv.innerText = 'Connected (' + msg.result.latencyMs + 'ms): ' + msg.result.message;
                } else {
                    statusDiv.style.background = 'rgba(239, 68, 68, 0.15)';
                    statusDiv.style.border = '1px solid #EF4444';
                    statusDiv.style.color = '#F87171';
                    let extra = '';
                    if (msg.result.recommendation) {
                        extra = '\nTip: Run ' + msg.result.recommendation;
                    }
                    statusDiv.innerText = 'Connection Error (' + msg.result.provider + '): ' + msg.result.error + extra;
                }
            } else if (msg.type === 'syncConfig') {
                const select = document.getElementById('copilot-provider-select');
                if (select) select.value = msg.provider || 'embedded';
                const pill = document.getElementById('active-model-pill');
                if (pill) {
                    if (msg.provider === 'embedded') pill.innerText = 'Embedded';
                    else if (msg.provider === 'copilot') pill.innerText = 'Copilot';
                    else if (msg.provider === 'ollama') pill.innerText = (msg.model || 'Ollama');
                    else pill.innerText = (msg.model || msg.provider);
                }
                if (msg.provider && msg.provider !== 'embedded') {
                    document.getElementById('engine-indicator').innerText = 'Connected: ' + msg.provider;
                } else {
                    document.getElementById('engine-indicator').innerText = 'Active (Embedded)';
                }
                if (msg.model) {
                    const ghModel = document.getElementById('cfg-gh-model');
                    if (ghModel && msg.provider === 'github') ghModel.value = msg.model;
                    const olModel = document.getElementById('cfg-ollama-model');
                    if (olModel && msg.provider === 'ollama') olModel.value = msg.model;
                }
                if (msg.endpoint) {
                    const olEnd = document.getElementById('cfg-ollama-endpoint');
                    if (olEnd) olEnd.value = msg.endpoint;
                }
                if (msg.settings) {
                    const s = msg.settings;
                    const actProv = document.getElementById('cfg-active-provider');
                    if (actProv && s.provider) actProv.value = s.provider;
                    onSettingsProviderChange(s.provider || msg.provider || 'embedded');
                    const inpGh = document.getElementById('cfg-input-github');
                    if (inpGh && s.githubToken) inpGh.value = s.githubToken;
                    const inpOa = document.getElementById('cfg-input-openai');
                    if (inpOa && s.openaiKey) inpOa.value = s.openaiKey;
                    const inpGe = document.getElementById('cfg-input-gemini');
                    if (inpGe && s.geminiKey) inpGe.value = s.geminiKey;
                    const inpAn = document.getElementById('cfg-input-anthropic');
                    if (inpAn && s.anthropicKey) inpAn.value = s.anthropicKey;
                    const inpMo = document.getElementById('cfg-input-model');
                    if (inpMo && s.model) inpMo.value = s.model;
                    const inpEnd = document.getElementById('cfg-input-endpoint');
                    if (inpEnd && s.endpoint) inpEnd.value = s.endpoint;
                }
                if (msg.provider === 'ollama') {
                    refreshOllamaModels();
                }
            } else if (msg.type === 'ollamaModelsLoaded') {
                const banner = document.getElementById('ollama-alert-banner');
                const bannerText = document.getElementById('ollama-alert-text');
                const pill = document.getElementById('active-model-pill');
                const select = document.getElementById('cfg-ollama-model');

                if (msg.status === 'no_models') {
                    if (banner && bannerText) {
                        banner.style.display = 'block';
                        banner.style.background = 'rgba(239, 68, 68, 0.15)';
                        banner.style.borderColor = '#ef4444';
                        bannerText.innerHTML = '<b>0 Ollama models found!</b> Run: <code style="background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 3px;">ollama pull qwen2.5-coder:7b</code> <button class="btn-prop-sm" onclick="copyText(\'ollama pull qwen2.5-coder:7b\')">Copy</button>';
                    }
                    if (pill) pill.innerText = '0 Models (Ollama)';
                } else if (msg.status === 'fallback') {
                    if (banner && bannerText) {
                        banner.style.display = 'block';
                        banner.style.background = 'rgba(245, 158, 11, 0.15)';
                        banner.style.borderColor = '#f59e0b';
                        bannerText.innerHTML = 'Requested model not found. Using best local coding model: <b>' + msg.activeModel + '</b>';
                    }
                    if (pill) pill.innerText = msg.activeModel;
                } else {
                    if (banner) banner.style.display = 'none';
                    if (pill && msg.activeModel) pill.innerText = msg.activeModel;
                }

                if (select) {
                    select.innerHTML = '';
                    const models = msg.detailedModels || (msg.models ? msg.models.map(m => ({ name: m })) : []);
                    if (models.length === 0) {
                        const opt = document.createElement('option');
                        opt.value = 'auto';
                        opt.innerText = 'No models found (Run: ollama pull qwen2.5-coder:7b)';
                        select.appendChild(opt);
                    } else {
                        const autoOpt = document.createElement('option');
                        autoOpt.value = 'auto';
                        autoOpt.innerText = 'Auto-select best model (' + (msg.activeModel || models[0].name) + ')';
                        select.appendChild(autoOpt);

                        models.forEach(m => {
                            const opt = document.createElement('option');
                            opt.value = m.name;
                            const sizeStr = m.parameterSize ? (' [' + m.parameterSize + ']') : '';
                            const catStr = m.category === 'coding' ? ' [Coding]' : (m.category === 'agentic' ? ' [Agentic]' : '');
                            opt.innerText = m.name + sizeStr + catStr;
                            if (m.name === msg.activeModel) {
                                opt.selected = true;
                            }
                            select.appendChild(opt);
                        });
                    }
                    const optCustom = document.createElement('option');
                    optCustom.value = 'custom';
                    optCustom.innerText = 'Enter custom model name...';
                    select.appendChild(optCustom);
                }
            }
        });
    
        // Expose all action functions globally so inline onclick handlers always work
        window.switchTab = switchTab;
        window.sendPrompt = sendPrompt;
        window.smartRun = smartRun;
        window.checkFile = checkFile;
        window.runTests = runTests;
        window.explainCode = explainCode;
        window.auditFile = auditFile;
        window.generateTests = generateTests;
        window.openArch = function() { switchTab('arch'); };
        window.analyzeWorkspace = analyzeWorkspace;
        window.requestWorkspaceRefactor = requestWorkspaceRefactor;
        window.toggleConfigPanel = toggleConfigPanel;
        window.saveAllSettings = saveAllSettings;
        window.testConnection = testConnection;
        window.triggerFilePicker = triggerFilePicker;
        window.stopGeneration = stopGeneration;
        window.refreshOllamaModels = refreshOllamaModels;
        window.requestGitHubLogin = requestGitHubLogin;
        window.togglePasswordVisibility = togglePasswordVisibility;
        window.cloneExample = cloneExample;
        window.insertSnippet = insertSnippet;
        window.askChip = askChip;
        window.handleChipClick = askChip;

    </script>
</body>
</html>`;
    }
}

function deactivate() {
    if (diagnosticCollection) {
        diagnosticCollection.clear();
    }
    validationTimeouts.clear();
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}

module.exports = { activate, deactivate };
