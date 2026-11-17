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

                return completions;
            }
        },
        '.', '@'
    );
    context.subscriptions.push(completionProvider);

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

        const answer = await this.engine.answerPrompt(prompt, doc, config);

        if (this.view) {
            this.view.webview.postMessage({
                type: 'assistantAnswer',
                answer: answer,
                provider: config.get('provider', 'embedded')
            });
        }
    }

    getHtmlForWebview(webview) {
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
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            padding: 10px;
            margin: 0;
            font-size: 12px;
        }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
        }
        .logo {
            font-size: 15px;
            font-weight: 700;
            color: var(--vscode-textLink-foreground);
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .engine-badge {
            font-size: 9px;
            background: rgba(16, 185, 129, 0.15);
            color: #10B981;
            border: 1px solid #10B981;
            padding: 1px 5px;
            border-radius: 10px;
            font-weight: 600;
        }
        .tabs {
            display: flex;
            gap: 4px;
            margin-bottom: 12px;
            background: var(--vscode-editor-background);
            padding: 3px;
            border-radius: 4px;
        }
        .tab-btn {
            flex: 1;
            background: transparent;
            color: var(--vscode-foreground);
            border: none;
            padding: 6px 4px;
            font-size: 11px;
            border-radius: 3px;
            cursor: pointer;
            text-align: center;
        }
        .tab-btn.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            font-weight: 600;
        }
        .section {
            display: none;
        }
        .section.active {
            display: block;
        }
        .file-status-box {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 10px;
            margin-bottom: 12px;
        }
        .file-title {
            font-weight: 600;
            font-size: 13px;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .pill {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
        }
        .pill.runnable { background: #10B981; color: #fff; }
        .pill.library { background: #3B82F6; color: #fff; }
        .pill.test { background: #8B5CF6; color: #fff; }
        .action-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin-top: 10px;
        }
        button.action-btn {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border, transparent);
            padding: 6px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        }
        button.action-btn.primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            grid-column: span 2;
        }
        button.action-btn:hover {
            opacity: 0.9;
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
        }
        .audit-box {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 10px;
            margin-top: 10px;
            font-size: 11px;
        }
        .diag-item {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid #ef4444;
            padding: 6px;
            border-radius: 4px;
            margin-bottom: 6px;
            font-size: 11px;
        }
        .example-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 8px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: transform 0.1s;
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
        <span class="logo">⚡ Kora Copilot</span>
        <span class="engine-badge" id="engine-indicator">Knowledge Core (.agent & docs)</span>
    </div>

    <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('copilot')">Inspector</button>
        <button class="tab-btn" onclick="switchTab('ask')">Copilot Chat</button>
        <button class="tab-btn" onclick="switchTab('examples')">Examples (23)</button>
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
                <button class="action-btn" onclick="auditFile()">🛡️ Audit .agent Rules</button>
                <button class="action-btn" onclick="checkFile()">⚡ Check Types</button>
                <button class="action-btn" onclick="runTests()">🧪 Test Suite</button>
                <button class="action-btn" onclick="explainCode()">💡 Explain Code</button>
                <button class="action-btn" onclick="generateTests()">✨ Scaffold Tests</button>
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

    <!-- 2. Copilot Chat -->
    <div id="tab-ask" class="section">
        <div class="suggestion-chips">
            <span class="chip" onclick="askChip('Audit active file against .agent rules')">🛡️ Audit Rules</span>
            <span class="chip" onclick="askChip('Explain Rule 04: Clean Architecture')">🏛️ Rule 04 Architecture</span>
            <span class="chip" onclick="askChip('Show Rule 07: Multi-Engine Database ORM')">🗄️ Rule 07 Database</span>
            <span class="chip" onclick="askChip('Show Rule 08: Actors & Mailboxes')">⚡ Rule 08 Concurrency</span>
            <span class="chip" onclick="askChip('Explain Single-Null Design vs undefined')">🎯 Single-Null vs Undefined</span>
        </div>

        <div class="chat-history" id="chat-history"></div>

        <div class="chat-input-row">
            <input type="text" id="chat-input" class="chat-input" placeholder="Ask Kora Copilot (.agent & docs indexed)..." onkeydown="if(event.key==='Enter') sendPrompt()" />
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

    <script>
        const vscode = acquireVsCodeApi();

        function switchTab(name) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById('tab-' + name).classList.add('active');
        }

        function smartRun() { vscode.postMessage({ type: 'smartRun' }); }
        function checkFile() { vscode.postMessage({ type: 'checkFile' }); }
        function runTests() { vscode.postMessage({ type: 'runTests' }); }
        function explainCode() { vscode.postMessage({ type: 'explainCode' }); }
        function auditFile() { vscode.postMessage({ type: 'auditFile' }); }
        function generateTests() { vscode.postMessage({ type: 'generateTests' }); }
        function cloneExample(slug) { vscode.postMessage({ type: 'cloneExample', slug: slug }); }

        function askChip(text) {
            document.getElementById('chat-input').value = text;
            sendPrompt();
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
            } else if (msg.type === 'assistantAnswer') {
                appendMessage('assistant', msg.answer);
                if (msg.provider && msg.provider !== 'embedded') {
                    document.getElementById('engine-indicator').innerText = 'Connected: ' + msg.provider;
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
