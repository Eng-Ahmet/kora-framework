const vscode = require('vscode');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { KoraCopilotEngine } = require('./kora-copilot-engine');
const { KoraAssistantViewProvider } = require('./kora-webview-provider');
const { EXAMPLES_CATALOG, getNonce, getWebviewHtml } = require('./kora-webview-html');

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
// Official 23 Examples Catalog imported from ./kora-webview-html


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
        vscode.window.registerWebviewViewProvider('kora.assistantView', assistantViewProvider, { webviewOptions: { retainContextWhenHidden: true } })
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
                assistantViewProvider.switchTab('learn');
                vscode.commands.executeCommand('kora.assistantView.focus');
            }
        }),

        vscode.commands.registerCommand('kora.openArchitectureExplorer', () => {
            if (assistantViewProvider) {
                assistantViewProvider.switchTab('arch');
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

// getNonce, EXAMPLES_CATALOG, and getWebviewHtml imported from ./kora-webview-html

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
