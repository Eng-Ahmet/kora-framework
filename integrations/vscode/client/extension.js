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
    let icon = "$(library)";
    let isRunnable = false;
    let runCommand = null;

    if (isTestFile) {
        classification = "Automated Test Suite";
        icon = "$(beaker)";
        isRunnable = true;
        runCommand = "kora.runTests";
    } else if (hasMain || hasListen) {
        classification = "Runnable Entrypoint";
        icon = "$(play)";
        isRunnable = true;
        runCommand = "kora.runFile";
    } else if (hasController) {
        classification = "Clean Architecture Controller";
        icon = "$(symbol-interface)";
    } else if (hasService) {
        classification = "Clean Architecture Service";
        icon = "$(gear)";
    } else if (hasRepository) {
        classification = "Data Access Repository";
        icon = "$(database)";
    } else if (hasEntity) {
        classification = "Database Entity (@table)";
        icon = "$(table)";
    } else if (hasModel) {
        classification = "Pure DTO Model";
        icon = "$(symbol-struct)";
    } else if (hasRoutes) {
        classification = "HTTP Routing Module";
        icon = "$(link)";
    } else if (hasActor) {
        classification = "Concurrency Actor";
        icon = "$(zap)";
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
    copilotEngine = new KoraCopilotEngine();
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

    function updateStatusBar() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !isKoraFile(editor.document)) {
            statusBarItem.hide();
            return;
        }

        const analysis = analyzeKoraDocument(editor.document);
        if (analysis.isRunnable) {
            statusBarItem.text = `${analysis.icon} Kora: ${analysis.classification} (Click to Run)`;
            statusBarItem.tooltip = `Click to execute ${analysis.fileName} with Kora`;
            statusBarItem.backgroundColor = undefined;
        } else {
            statusBarItem.text = `${analysis.icon} Kora: ${analysis.classification}`;
            statusBarItem.tooltip = `${analysis.fileName} is a Clean Architecture component. Click to check syntax & rules.`;
        }
        statusBarItem.show();

        if (assistantViewProvider) {
            assistantViewProvider.updateActiveFile(analysis);
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
                    const fix = new vscode.CodeAction('💡 Add missing `init(...)` constructor', vscode.CodeActionKind.QuickFix);
                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.insert(document.uri, range.start, '\n    init() {\n        // Injected dependencies\n    }\n');
                    fix.diagnostics = [diag];
                    fix.isPreferred = true;
                    actions.push(fix);
                }

                if (diag.message.includes('undefined')) {
                    const fix = new vscode.CodeAction('💡 Replace `undefined` with `null` / `Option` (Rule 01: Single-Null)', vscode.CodeActionKind.QuickFix);
                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.replace(document.uri, range, 'null');
                    fix.diagnostics = [diag];
                    fix.isPreferred = true;
                    actions.push(fix);
                }
            }

            const genTestFix = new vscode.CodeAction('✨ Scaffold Unit & Load Test Suite for this file', vscode.CodeActionKind.Refactor);
            genTestFix.command = {
                command: 'kora.generateTests',
                title: 'Generate Unit & Load Tests',
                arguments: [document.fileName]
            };
            actions.push(genTestFix);

            const auditFix = new vscode.CodeAction('🛡️ Audit File Against .agent Rules', vscode.CodeActionKind.QuickFix);
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

    // 6. CodeLens Provider ("▶ Run Entrypoint", "🧪 Run Test Suite", "🛡️ Audit Rules")
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
                            title: '▶ Run Entrypoint',
                            command: 'kora.runFile',
                            arguments: [document.fileName]
                        }),
                        new vscode.CodeLens(range, {
                            title: '⚡ Check Architecture',
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
                            title: '🧪 Run Test Suite',
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
                        title: '⚡ Check Architecture & Types',
                        command: 'kora.checkFile',
                        arguments: [document.fileName]
                    }),
                    new vscode.CodeLens(topRange, {
                        title: '🛡️ Audit Rules',
                        command: 'kora.auditFile',
                        arguments: [document.fileName]
                    }),
                    new vscode.CodeLens(topRange, {
                        title: '✨ Scaffold Tests',
                        command: 'kora.generateTests',
                        arguments: [document.fileName]
                    })
                );
            }

            return codeLenses;
        }
    });
    context.subscriptions.push(codeLensProvider);

    // 7. Register VS Code Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kora.smartRun', (filePath) => {
            const activeFile = filePath || (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName);
            if (!activeFile) return;

            const doc = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document : null;
            const analysis = doc ? analyzeKoraDocument(doc) : null;

            if (analysis && analysis.isTestFile) {
                vscode.commands.executeCommand('kora.runTests', activeFile);
            } else {
                vscode.commands.executeCommand('kora.runFile', activeFile);
            }
        }),

        vscode.commands.registerCommand('kora.runFile', (filePath) => {
            const activeFile = filePath || (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName);
            if (!activeFile) return;

            let terminal = vscode.window.terminals.find(t => t.name === 'Kora Run') || vscode.window.createTerminal('Kora Run');
            terminal.show();
            terminal.sendText(`kora run "${activeFile}"`);
        }),

        vscode.commands.registerCommand('kora.checkFile', (filePath) => {
            const activeFile = filePath || (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName);
            if (!activeFile) return;

            let terminal = vscode.window.terminals.find(t => t.name === 'Kora Check') || vscode.window.createTerminal('Kora Check');
            terminal.show();
            terminal.sendText(`kora check "${activeFile}"`);
        }),

        vscode.commands.registerCommand('kora.runTests', (filePath) => {
            const activeFile = filePath || (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName);
            let terminal = vscode.window.terminals.find(t => t.name === 'Kora Test') || vscode.window.createTerminal('Kora Test');
            terminal.show();
            if (activeFile) {
                terminal.sendText(`kora test "${activeFile}"`);
            } else {
                terminal.sendText(`kora test`);
            }
        }),

        vscode.commands.registerCommand('kora.formatFile', () => {
            vscode.commands.executeCommand('editor.action.formatDocument');
        }),

        vscode.commands.registerCommand('kora.auditFile', (filePath) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('Please open a Kora file to audit.');
                return;
            }
            const audit = copilotEngine.auditDocument(editor.document);
            if (assistantViewProvider) {
                assistantViewProvider.displayAudit(audit);
                vscode.commands.executeCommand('kora.assistantView.focus');
            }
        }),

        vscode.commands.registerCommand('kora.explainCode', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('Please open a Kora file to explain.');
                return;
            }
            if (assistantViewProvider) {
                assistantViewProvider.triggerExplanation(editor.document);
                vscode.commands.executeCommand('kora.assistantView.focus');
            }
        }),

        vscode.commands.registerCommand('kora.generateTests', (filePath) => {
            const activeFile = filePath || (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName);
            if (!activeFile) return;

            const dir = path.dirname(activeFile);
            const baseName = path.basename(activeFile).replace(/\.(kora|kr)$/, '');
            const testsDir = path.join(dir, 'tests');

            if (!fs.existsSync(testsDir)) {
                fs.mkdirSync(testsDir, { recursive: true });
            }

            const unitPath = path.join(testsDir, `${baseName}_unit.test.kora`);
            const loadPath = path.join(testsDir, `${baseName}_load.test.kora`);

            const pascalName = baseName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

            const unitContent = `// ============================================================================\n// Unit Test Suite: ${pascalName}UnitTestSuite\n// ============================================================================\n\nclass ${pascalName}UnitTestSuite {\n    init() {}\n\n    fn test_initial_state() -> Bool {\n        return true\n    }\n\n    fn run() -> Unit {\n        let p = this.test_initial_state()\n        if p {\n            print("  ✓ ${pascalName} Unit Tests: passed")\n        } else {\n            print("  ✗ ${pascalName} Unit Tests: failed")\n        }\n    }\n}\n\nlet suite = ${pascalName}UnitTestSuite()\nsuite.run()\n`;

            const loadContent = `// ============================================================================\n// Load Test Suite: ${pascalName}LoadTestSuite\n// ============================================================================\n\nclass ${pascalName}LoadTestSuite {\n    init() {}\n\n    fn run_load_stress(iterations: Int) -> Int {\n        var processed = 0\n        for i in 0..iterations {\n            processed += 1\n        }\n        return processed\n    }\n\n    fn teardown() -> Unit {\n        print("  ✓ ${pascalName} Teardown: synthetic allocations purged")\n    }\n}\n\nlet load_suite = ${pascalName}LoadTestSuite()\nlet total = load_suite.run_load_stress(1000)\nprint("  ✓ ${pascalName} Load Test: 1,000 iterations processed")\nload_suite.teardown()\n`;

            if (!fs.existsSync(unitPath)) fs.writeFileSync(unitPath, unitContent, 'utf-8');
            if (!fs.existsSync(loadPath)) fs.writeFileSync(loadPath, loadContent, 'utf-8');

            vscode.window.showInformationMessage(`✓ Generated tests: tests/${baseName}_unit.test.kora and tests/${baseName}_load.test.kora`);
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
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                vscode.window.showInformationMessage('No active workspace folder to analyze.');
                return;
            }
            const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
            if (assistantViewProvider) {
                assistantViewProvider.analyzeWorkspaceArchitecture(root);
                vscode.commands.executeCommand('kora.assistantView.focus');
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
                    vscode.commands.executeCommand('kora.smartRun');
                    break;
                case 'checkFile':
                    vscode.commands.executeCommand('kora.checkFile');
                    break;
                case 'runTests':
                    vscode.commands.executeCommand('kora.runTests');
                    break;
                case 'generateTests':
                    vscode.commands.executeCommand('kora.generateTests');
                    break;
                case 'explainCode':
                    vscode.commands.executeCommand('kora.explainCode');
                    break;
                case 'auditFile':
                    vscode.commands.executeCommand('kora.auditFile');
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
                    await this.answerKoraPrompt(message.prompt);
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
                            vscode.window.showInformationMessage(`✅ GitHub Account linked for Kora Copilot (${session.account ? session.account.label : 'authenticated'})!`);
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
                        vscode.window.showInformationMessage(`✅ GitHub Models configured (${message.model || 'gpt-4o-mini'})!`);
                        this.syncProviderToWebview();
                    }
                    break;
                case 'updateOllamaConfig':
                    {
                        const cfg = vscode.workspace.getConfiguration('kora.copilot');
                        if (message.endpoint) await cfg.update('endpoint', message.endpoint, vscode.ConfigurationTarget.Global);
                        if (message.model) await cfg.update('model', message.model, vscode.ConfigurationTarget.Global);
                        await cfg.update('provider', 'ollama', vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage(`✅ Local Ollama configured (${message.model || 'phi3:mini'})!`);
                        this.syncProviderToWebview();
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
                        vscode.window.showInformationMessage(`✅ Kora Copilot settings saved! Active Provider: ${s.provider || cfg.get('provider')}`);
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

        let explanation = `### 🏛️ Kora Code & Architecture Analysis: \`${analysis.fileName}\`\n\n`;
        explanation += `- **Classification**: **${analysis.classification}**\n`;
        explanation += `- **Runnable**: ${analysis.isRunnable ? '✅ Yes (Ready to run directly)' : 'ℹ️ No (Library / Service component)'}\n`;
        explanation += `- **Total Lines**: ${analysis.lineCount}\n`;
        explanation += `- **Declared Symbols**: ${analysis.symbols.length > 0 ? analysis.symbols.map(s => `\`${s.name} (${s.kind})\``).join(', ') : 'None'}\n`;
        explanation += `- **Imported Modules**: ${analysis.imports.length > 0 ? analysis.imports.map(i => `\`${i.path}\``).join(', ') : 'None'}\n\n`;

        if (analysis.isRunnable) {
            explanation += `> 💡 **Execution Advice**: This file contains an entrypoint or test runner. Click **▶ Run Entrypoint** or use \`kora run "${analysis.fileName}"\`.\n\n`;
        } else {
            explanation += `> 💡 **Clean Architecture Advice**: In Kora Clean Architecture (\`.agent/rules/04-clean-architecture.md\`), domain logic is organized into bounded contexts. Inject this service into a controller or mount via \`Router\` in \`src/main.kora\`.\n\n`;
        }

        explanation += `#### 🔍 Layer Breakdown:\n`;
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

    async answerKoraPrompt(prompt) {
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

        // If provider is GitHub and token isn't in settings or env, try silent session lookup
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

        const answer = await this.engine.answerPrompt(prompt, doc, runtimeConfig);

        if (this.view) {
            this.view.webview.postMessage({
                type: 'assistantAnswer',
                answer: answer,
                provider: provider,
                model: model
            });
        }
    }

    syncProviderToWebview() {
        if (this.view) {
            const config = vscode.workspace.getConfiguration('kora.copilot');
            this.view.webview.postMessage({
                type: 'syncConfig',
                provider: config.get('provider', 'embedded'),
                model: config.get('model', 'gpt-4o-mini'),
                hasGitHubToken: Boolean(config.get('githubToken') || process.env.GITHUB_TOKEN),
                endpoint: config.get('endpoint', ''),
                settings: {
                    provider: config.get('provider', 'embedded'),
                    githubToken: config.get('githubToken', ''),
                    openaiKey: config.get('openaiKey', ''),
                    geminiKey: config.get('geminiKey', ''),
                    anthropicKey: config.get('anthropicKey', ''),
                    model: config.get('model', 'gpt-4o-mini'),
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
                    <button class="btn-clone" title="Scaffold into current project">Scaffold Example ⚡</button>
                </div>
            </div>
        `).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kora AI Assistant</title>
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            padding: 8px;
            margin: 0;
            font-size: 11.5px;
            width: 100%;
            max-width: 100%;
            overflow-x: hidden;
        }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
            padding-bottom: 8px;
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
            display: flex;
            gap: 2px;
            margin-bottom: 10px;
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
            width: 100%;
        }
        .section.active {
            display: block;
        }
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
        .settings-label {
            display: block;
            font-size: 10.5px;
            font-weight: 600;
            opacity: 0.85;
            margin-bottom: 3px;
        }
        .provider-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            padding: 4px 8px;
            margin-bottom: 8px;
        }
        .provider-select-group {
            display: flex;
            align-items: center;
            gap: 6px;
            flex: 1;
        }
        .provider-select {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 3px;
            font-size: 11px;
            padding: 3px 6px;
            flex: 1;
            cursor: pointer;
        }
        .btn-config-toggle {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 13px;
            padding: 2px 4px;
            opacity: 0.8;
        }
        .btn-config-toggle:hover {
            opacity: 1.0;
        }
        .provider-config-box {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 10px;
            font-size: 11px;
        }
        .chat-input-row {
            display: flex;
            gap: 4px;
            margin-bottom: 10px;
        }
        .chat-input {
            flex: 1;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 8px;
            border-radius: 4px;
            font-size: 11px;
        }
        .chat-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
        }
        .suggestion-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin-bottom: 10px;
        }
        .chip {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 3px 6px;
            border-radius: 12px;
            font-size: 10px;
            cursor: pointer;
        }
        .chip:hover {
            opacity: 0.8;
        }
        .chat-history {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 380px;
            overflow-y: auto;
            margin-bottom: 10px;
        }
        .msg-user {
            background: var(--vscode-button-secondaryBackground);
            padding: 6px 8px;
            border-radius: 4px;
            align-self: flex-end;
            font-size: 11px;
            max-width: 90%;
        }
        .msg-assistant {
            background: var(--vscode-editor-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 8px 10px;
            border-radius: 4px;
            align-self: flex-start;
            font-size: 11px;
            line-height: 1.4;
            max-width: 98%;
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <img src="${logoUri}" width="20" height="20" class="logo-img" alt="Kora Logo" />
            <span>Kora Copilot</span>
        </div>
        <span class="engine-badge" id="engine-indicator">● Active</span>
    </div>

    <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('copilot')">Inspector</button>
        <button class="tab-btn" onclick="switchTab('arch')">Architecture</button>
        <button class="tab-btn" onclick="switchTab('learn')">Learning</button>
        <button class="tab-btn" onclick="switchTab('ask')">AI Chat</button>
        <button class="tab-btn" onclick="switchTab('examples')">Examples (23)</button>
        <button class="tab-btn" onclick="switchTab('settings')">⚙️ Settings</button>
    </div>

    <!-- 1. Inspector / Active File Copilot -->
    <div id="tab-copilot" class="section active">
        <div class="file-status-box">
            <div class="file-title">
                <span id="active-filename">No active file</span>
                <span id="active-pill" class="pill library">Library</span>
            </div>
            <div id="active-meta" style="font-size: 11px; opacity: 0.8; margin-bottom: 6px;">Open a .kora or .kr file to analyze</div>
            
            <div class="action-grid">
                <button class="action-btn primary" id="btn-run" onclick="smartRun()">▶ Smart Run / Test</button>
                <button class="action-btn" onclick="auditFile()" title="Audit file against .agent rules">🛡️ Audit Rules</button>
                <button class="action-btn" onclick="checkFile()" title="Run type checks and linter">⚡ Check Types</button>
                <button class="action-btn" onclick="runTests()" title="Execute test suites">🧪 Test Suite</button>
                <button class="action-btn" onclick="explainCode()" title="Explain code architecture">💡 Explain Code</button>
                <button class="action-btn" onclick="generateTests()" title="Scaffold tests for active symbols">✨ Scaffold Tests</button>
                <button class="action-btn" onclick="switchTab('arch')" title="Inspect clean architecture layers">🏛️ Architecture</button>
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

    <!-- 1b. Architecture Explorer Tab -->
    <div id="tab-arch" class="section">
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px;">🏛️ Workspace Architecture Explorer</div>
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

        <button class="action-btn primary" style="width: 100%; margin-bottom: 12px;" onclick="analyzeWorkspace()">🔄 Refresh Workspace Map</button>

        <div style="font-weight: 600; margin-bottom: 6px;">Layer Data Flow (Clean Architecture):</div>
        <div style="background: var(--vscode-editor-background); padding: 8px; border-radius: 4px; font-size: 11px; line-height: 1.5; border-left: 3px solid #10B981;">
            <b>1. HTTP Request</b> ➔ <code>Controllers (Presentation)</code><br>
            <b>2. Validation</b> ➔ <code>DTO Models (Boundary)</code><br>
            <b>3. Injected DI</b> ➔ <code>Services (Application Logic)</code><br>
            <b>4. Interface Contract</b> ➔ <code>Repositories (Data Access)</code><br>
            <b>5. Storage Mapping</b> ➔ <code>Entities (@table SQL / NoSQL)</code>
        </div>
    </div>

    <!-- 1c. Learning Center Tab -->
    <div id="tab-learn" class="section">
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px;">🎓 Kora Interactive Learning Center</div>
        <div style="font-size: 11px; opacity: 0.8; margin-bottom: 10px;">Master Kora through hands-on lessons with runnable code:</div>

        <div class="lesson-card" style="background: var(--vscode-editor-background); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: var(--vscode-textLink-foreground);">Lesson 1: Pure Models & DTOs</div>
            <div style="font-size: 11px; margin: 4px 0;">Models define immutable payloads without runtime overhead:</div>
            <pre style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; font-size: 10px;">model User {\n    name: String\n    age: Int\n}</pre>
            <button class="action-btn" onclick="insertSnippet('model User {\n    name: String\n    age: Int\n}\n')">Insert into Editor 📝</button>
        </div>

        <div class="lesson-card" style="background: var(--vscode-editor-background); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: var(--vscode-textLink-foreground);">Lesson 2: Clean Architecture & DI</div>
            <div style="font-size: 11px; margin: 4px 0;">Services receive dependencies via <code>init(...)</code> constructor injection:</div>
            <pre style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; font-size: 10px;">class UserService {\n    repo: UserRepository\n    init(repo: UserRepository) {\n        this.repo = repo\n    }\n}</pre>
            <button class="action-btn" onclick="insertSnippet('class UserService {\n    repo: UserRepository\n    init(repo: UserRepository) {\n        this.repo = repo\n    }\n}\n')">Insert into Editor 📝</button>
        </div>

        <div class="lesson-card" style="background: var(--vscode-editor-background); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: var(--vscode-textLink-foreground);">Lesson 3: Concurrency Actors & Mailboxes</div>
            <div style="font-size: 11px; margin: 4px 0;">Stateful actors run on Tokio threads with <code>tell</code> and <code>ask</code>:</div>
            <pre style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; font-size: 10px;">class WorkerActor {\n    var count: Int\n    init() { this.count = 0 }\n    fn handle(msg: String) -> Int {\n        this.count += 1\n        return this.count\n    }\n}</pre>
            <button class="action-btn" onclick="insertSnippet('class WorkerActor {\n    var count: Int\n    init() { this.count = 0 }\n    fn handle(msg: String) -> Int {\n        this.count += 1\n        return this.count\n    }\n}\n')">Insert into Editor 📝</button>
        </div>

        <div class="lesson-card" style="background: var(--vscode-editor-background); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: var(--vscode-textLink-foreground);">Lesson 4: Load Test with Teardown</div>
            <div style="font-size: 11px; margin: 4px 0;">High throughput stress testing with guaranteed resource teardown (Rule 10):</div>
            <pre style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; font-size: 10px;">class LoadTestSuite {\n    fn run(n: Int) -> Int {\n        var total = 0\n        for i in 0..n { total += 1 }\n        return total\n    }\n    fn teardown() -> Unit {\n        print(\"Teardown complete\")\n    }\n}</pre>
            <button class="action-btn" onclick="insertSnippet('class LoadTestSuite {\n    init() {}\n    fn run(n: Int) -> Int {\n        var total = 0\n        for i in 0..n { total += 1 }\n        return total\n    }\n    fn teardown() -> Unit {\n        print(\"  ✓ Teardown: synthetic allocations purged\")\n    }\n}\n')">Insert into Editor 📝</button>
        </div>
    </div>

    <!-- 2. Copilot Chat -->
    <div id="tab-ask" class="section">
        <div class="provider-bar">
            <div class="provider-select-group">
                <span style="font-size: 10px; opacity: 0.8; font-weight: 600;">Engine:</span>
                <select id="copilot-provider-select" class="provider-select" onchange="onProviderSelectChanged(this.value)">
                    <option value="embedded">⚡ Embedded Core (Offline Rules)</option>
                    <option value="github">🐙 GitHub Models (gpt-4o-mini)</option>
                    <option value="ollama">🦙 Local Ollama (phi3 / llama3.2)</option>
                </select>
            </div>
            <button class="btn-config-toggle" onclick="toggleConfigPanel()" title="Configure Engine Settings">⚙️</button>
        </div>

        <div id="provider-config-box" class="provider-config-box" style="display: none;">
            <div id="cfg-github">
                <div style="font-weight: 600; margin-bottom: 4px;">🐙 GitHub Models Setup</div>
                <button class="action-btn primary" style="width: 100%; margin-bottom: 6px; padding: 4px;" onclick="requestGitHubLogin()">🔗 Auto-Link GitHub Account</button>
                <div style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Or paste Personal Access Token (PAT):</div>
                <input type="password" id="cfg-gh-token" class="chat-input" placeholder="ghp_... or github_pat_..." style="width: 100%; margin-bottom: 6px; box-sizing: border-box;" />
                <div style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Model:</div>
                <div style="display: flex; gap: 4px;">
                    <select id="cfg-gh-model" class="provider-select" style="flex: 1;">
                        <option value="gpt-4o-mini">gpt-4o-mini (Fast & Recommended)</option>
                        <option value="Phi-3.5-mini-instruct">Phi-3.5-mini-instruct (Small)</option>
                        <option value="Meta-Llama-3.1-8B-Instruct">Meta-Llama-3.1-8B-Instruct</option>
                    </select>
                    <button class="chat-btn" onclick="saveGitHubConfig()">Save</button>
                </div>
            </div>
            <div id="cfg-ollama" style="display: none;">
                <div style="font-weight: 600; margin-bottom: 4px;">🦙 Local Ollama Setup</div>
                <div style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Endpoint URL:</div>
                <input type="text" id="cfg-ollama-endpoint" class="chat-input" value="http://localhost:11434" style="width: 100%; margin-bottom: 6px; box-sizing: border-box;" />
                <div style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Small Model Name:</div>
                <div style="display: flex; gap: 4px;">
                    <select id="cfg-ollama-model" class="provider-select" style="flex: 1;">
                        <option value="phi3:mini">phi3:mini (Fast Microsoft Small Model)</option>
                        <option value="llama3.2:1b">llama3.2:1b (Meta Ultralight 1B)</option>
                        <option value="llama3.2:3b">llama3.2:3b (Meta Light 3B)</option>
                        <option value="qwen2.5-coder:1.5b">qwen2.5-coder:1.5b (Coding Specialist)</option>
                        <option value="llama3">llama3 (Standard 8B)</option>
                    </select>
                    <button class="chat-btn" onclick="saveOllamaConfig()">Save</button>
                </div>
            </div>
            <div id="cfg-embedded" style="display: none;">
                <div style="font-weight: 600; margin-bottom: 2px;">⚡ Embedded Knowledge Engine</div>
                <div style="font-size: 10px; opacity: 0.8;">Instant offline inference powered by Kora AST analyzer, .agent/rules/ invariants, and the official language documentation.</div>
            </div>
        </div>

        <div class="suggestion-chips">
            <span class="chip" onclick="askChip('Audit active file against .agent rules')">🛡️ Audit Rules</span>
            <span class="chip" onclick="askChip('Explain Rule 04: Clean Architecture')">🏛️ Rule 04 Architecture</span>
            <span class="chip" onclick="askChip('Show Rule 07: Multi-Engine Database ORM')">🗄️ Rule 07 Database</span>
            <span class="chip" onclick="askChip('Show Rule 08: Actors & Mailboxes')">⚡ Rule 08 Concurrency</span>
            <span class="chip" onclick="askChip('Explain Single-Null Design vs undefined')">🎯 Single-Null vs Undefined</span>
        </div>

        <div class="chat-history" id="chat-history"></div>

        <div class="chat-input-row">
            <input type="text" id="chat-input" class="chat-input" placeholder="Ask Kora Copilot (or discuss active code)..." onkeydown="if(event.key==='Enter') sendPrompt()" />
            <button class="chat-btn" onclick="sendPrompt()">Send</button>
        </div>
    </div>

    <!-- 3. Examples Catalog -->
    <div id="tab-examples" class="section">
        <div style="margin-bottom: 8px; font-size: 11px; opacity: 0.8;">Click any official reference architecture to scaffold directly into your project:</div>
        <div id="catalog-list">
            ${catalogHtml}
        </div>
    </div>

    <!-- 4. Settings Section -->
    <div id="tab-settings" class="section">
        <div style="font-weight: 600; font-size: 12.5px; margin-bottom: 4px;">⚙️ AI Models & API Keys Settings</div>
        <div style="font-size: 10.5px; opacity: 0.8; margin-bottom: 10px;">Configure AI engine providers, API keys, custom endpoints, and models:</div>

        <div class="settings-group">
            <label class="settings-label">Active Engine Provider:</label>
            <select id="cfg-active-provider" class="provider-select" onchange="onSettingsProviderChange(this.value)">
                <option value="embedded">⚡ Embedded Core (Offline Rules & Docs)</option>
                <option value="github">🐙 GitHub Models (gpt-4o-mini / Phi-3.5)</option>
                <option value="ollama">🦙 Local Ollama (phi3:mini / llama3.2:1b)</option>
                <option value="openai">🤖 OpenAI (gpt-4o / gpt-4o-mini)</option>
                <option value="gemini">✨ Google Gemini (gemini-1.5-flash)</option>
                <option value="anthropic">🧠 Anthropic Claude (claude-3-5-sonnet)</option>
                <option value="custom">🌐 Custom OpenAI-compatible Endpoint</option>
            </select>
        </div>

        <div class="settings-group" id="cfg-field-github">
            <label class="settings-label">GitHub Token / PAT:</label>
            <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                <input type="password" id="cfg-input-github" class="chat-input" placeholder="ghp_... or github_pat_..." style="flex: 1;" />
                <button class="chat-btn" onclick="togglePasswordVisibility('cfg-input-github')">👁️</button>
            </div>
            <button class="action-btn" style="width: 100%;" onclick="requestGitHubLogin()">🔗 Auto-Link GitHub Account</button>
        </div>

        <div class="settings-group" id="cfg-field-openai">
            <label class="settings-label">OpenAI API Key:</label>
            <div style="display: flex; gap: 4px;">
                <input type="password" id="cfg-input-openai" class="chat-input" placeholder="sk-..." style="flex: 1;" />
                <button class="chat-btn" onclick="togglePasswordVisibility('cfg-input-openai')">👁️</button>
            </div>
        </div>

        <div class="settings-group" id="cfg-field-gemini">
            <label class="settings-label">Google Gemini API Key:</label>
            <div style="display: flex; gap: 4px;">
                <input type="password" id="cfg-input-gemini" class="chat-input" placeholder="AIzaSy..." style="flex: 1;" />
                <button class="chat-btn" onclick="togglePasswordVisibility('cfg-input-gemini')">👁️</button>
            </div>
        </div>

        <div class="settings-group" id="cfg-field-anthropic">
            <label class="settings-label">Anthropic Claude API Key:</label>
            <div style="display: flex; gap: 4px;">
                <input type="password" id="cfg-input-anthropic" class="chat-input" placeholder="sk-ant-..." style="flex: 1;" />
                <button class="chat-btn" onclick="togglePasswordVisibility('cfg-input-anthropic')">👁️</button>
            </div>
        </div>

        <div class="settings-group">
            <label class="settings-label">Model Name:</label>
            <input type="text" id="cfg-input-model" class="chat-input" placeholder="e.g. gpt-4o-mini, phi3:mini, claude-3-5-sonnet" style="width: 100%;" />
        </div>

        <div class="settings-group">
            <label class="settings-label">Endpoint URL (Optional):</label>
            <input type="text" id="cfg-input-endpoint" class="chat-input" placeholder="e.g. http://localhost:11434 or https://api.openai.com/v1" style="width: 100%;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 12px;">
            <button class="action-btn primary" onclick="saveAllSettings()">💾 Save Settings</button>
            <button class="action-btn" onclick="testConnection()">⚡ Test Connection</button>
        </div>

        <div id="test-connection-status" style="margin-top: 10px; display: none; padding: 8px; border-radius: 5px; font-size: 11px; line-height: 1.4;"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function switchTab(name) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            const targetBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(name));
            if (targetBtn) targetBtn.classList.add('active');
            const targetSec = document.getElementById('tab-' + name);
            if (targetSec) targetSec.classList.add('active');
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
            document.getElementById('chat-input').value = text;
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
            const gh = document.getElementById('cfg-github');
            const ol = document.getElementById('cfg-ollama');
            const em = document.getElementById('cfg-embedded');
            if (gh) gh.style.display = provider === 'github' ? 'block' : 'none';
            if (ol) ol.style.display = provider === 'ollama' ? 'block' : 'none';
            if (em) em.style.display = provider === 'embedded' ? 'block' : 'none';
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
            const model = document.getElementById('cfg-ollama-model').value;
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
            if (val === 'github') {
                if (modelInput && !modelInput.value) modelInput.value = 'gpt-4o-mini';
            } else if (val === 'ollama') {
                if (modelInput && (!modelInput.value || modelInput.value.includes('gpt'))) modelInput.value = 'phi3:mini';
                if (endInput && !endInput.value) endInput.value = 'http://localhost:11434';
            } else if (val === 'gemini') {
                if (modelInput && (!modelInput.value || modelInput.value.includes('phi'))) modelInput.value = 'gemini-1.5-flash';
            } else if (val === 'anthropic') {
                if (modelInput && (!modelInput.value || modelInput.value.includes('phi'))) modelInput.value = 'claude-3-5-sonnet-20241022';
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
            statusDiv.innerText = '⚡ Testing connection...';

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
            const prompt = input.value.trim();
            if (!prompt) return;

            appendMessage('user', prompt);
            vscode.postMessage({ type: 'askQuestion', prompt: prompt });
            input.value = '';
        }

        function appendMessage(role, text) {
            const history = document.getElementById('chat-history');
            const msg = document.createElement('div');
            msg.className = role === 'user' ? 'msg-user' : 'msg-assistant';
            msg.innerText = text;
            history.appendChild(msg);
            history.scrollTop = history.scrollHeight;
        }

        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.type === 'fileUpdated') {
                const a = msg.analysis;
                if (!a) return;
                document.getElementById('active-filename').innerText = a.fileName;
                const pill = document.getElementById('active-pill');
                pill.innerText = a.classification;
                pill.className = 'pill ' + (a.isTestFile ? 'test' : (a.isRunnable ? 'runnable' : 'library'));

                document.getElementById('active-meta').innerText = a.lineCount + ' lines • ' + a.symbols.length + ' symbols • ' + a.imports.length + ' imports';
                
                const btnRun = document.getElementById('btn-run');
                if (a.isTestFile) {
                    btnRun.innerText = '🧪 Run Test Suite (kora test)';
                } else if (a.isRunnable) {
                    btnRun.innerText = '▶ Run Entrypoint (kora run)';
                } else {
                    btnRun.innerText = '⚡ Check Module (kora check)';
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
                    text.innerHTML = '<span style="color: #10B981; font-weight: 600;">✓ 100% Rule Compliance:</span> No violations of .agent/rules found.';
                } else {
                    let out = '<span style="color: #ef4444; font-weight: 600;">' + audit.violations + ' Rule Violation(s):</span><br>';
                    audit.findings.forEach(f => {
                        out += '<div style="margin-top: 4px;">• <b>[' + f.code + '] ' + f.rule + '</b>: ' + f.message + '<br><i>Fix: ' + f.fix + '</i></div>';
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
            } else if (msg.type === 'assistantAnswer') {
                appendMessage('assistant', msg.answer);
                if (msg.provider && msg.provider !== 'embedded') {
                    document.getElementById('engine-indicator').innerText = 'Connected: ' + msg.provider;
                }
            } else if (msg.type === 'testConnectionResult') {
                const statusDiv = document.getElementById('test-connection-status');
                if (!statusDiv) return;
                statusDiv.style.display = 'block';
                if (msg.result.success) {
                    statusDiv.style.background = 'rgba(16, 185, 129, 0.15)';
                    statusDiv.style.border = '1px solid #10B981';
                    statusDiv.style.color = '#34D399';
                    statusDiv.innerText = '✅ Connected (' + msg.result.latencyMs + 'ms): ' + msg.result.message;
                } else {
                    statusDiv.style.background = 'rgba(239, 68, 68, 0.15)';
                    statusDiv.style.border = '1px solid #EF4444';
                    statusDiv.style.color = '#F87171';
                    statusDiv.innerText = '❌ Connection Error (' + msg.result.provider + '): ' + msg.result.error;
                }
            } else if (msg.type === 'syncConfig') {
                const select = document.getElementById('copilot-provider-select');
                if (select) select.value = msg.provider || 'embedded';
                if (msg.provider && msg.provider !== 'embedded') {
                    document.getElementById('engine-indicator').innerText = 'Connected: ' + msg.provider;
                } else {
                    document.getElementById('engine-indicator').innerText = '● Active (Embedded)';
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
            }
        });
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
