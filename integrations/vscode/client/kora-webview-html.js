const vscode = require('vscode');

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
 * Generate cryptographically secure nonce for CSP
 */
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Render the complete Webview HTML document
 */
function getWebviewHtml(webview, extensionUri, catalog, nonce) {
    const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'icon.png'));
    const catalogList = catalog || EXAMPLES_CATALOG;
    const catalogHtml = catalogList.map(ex => `
        <div class="example-card" data-slug="${ex.slug}" data-action="cloneExample" onclick="cloneExample('${ex.slug}')">
            <div class="example-header">
                <span class="example-name">${ex.name}</span>
                <span class="badge ${ex.difficulty.toLowerCase()}">${ex.difficulty}</span>
            </div>
            <div class="example-desc">${ex.desc}</div>
            <div class="example-footer">
                <span class="category-tag">${ex.category}</span>
                <button class="btn-clone" data-slug="${ex.slug}" data-action="cloneExample" title="Scaffold into current project">Scaffold Example</button>
            </div>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval' ${webview.cspSource}; font-src ${webview.cspSource}; connect-src https: http:;">
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
            <span class="active-model-pill" id="active-model-pill" data-tab="settings" data-action="switchTab" onclick="switchTab('settings')" title="Active AI model. Click to configure settings.">Embedded</span>
            <span class="engine-badge" id="engine-indicator">Active</span>
        </div>
    </div>

    <div class="tabs">
        <button type="button" class="tab-btn active" data-tab="ask" onclick="switchTab('ask')" id="tab-nav-ask">AI Agent</button>
        <button type="button" class="tab-btn" data-tab="copilot" onclick="switchTab('copilot')" id="tab-nav-copilot">Inspector</button>
        <button type="button" class="tab-btn" data-tab="arch" onclick="switchTab('arch')" id="tab-nav-arch">Architecture</button>
        <button type="button" class="tab-btn" data-tab="learn" onclick="switchTab('learn')" id="tab-nav-learn">Learning</button>
        <button type="button" class="tab-btn" data-tab="examples" onclick="switchTab('examples')" id="tab-nav-examples">Examples (23)</button>
        <button type="button" class="tab-btn" data-tab="settings" onclick="switchTab('settings')" id="tab-nav-settings">Settings</button>
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
            <button class="btn-config-toggle" data-action="toggleConfigPanel" onclick="toggleConfigPanel()" title="Configure Engine Settings">Configure</button>
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
                <button class="action-btn primary" style="width: 100%; margin-bottom: 6px; padding: 4px;" data-action="requestGitHubLogin" onclick="requestGitHubLogin()">Auto-Link GitHub Account</button>
                <div style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Or paste Personal Access Token (PAT):</div>
                <input type="password" id="cfg-gh-token" class="chat-textarea" style="min-height: 28px; max-height: 28px;" placeholder="ghp_... or github_pat_..." />
                <div style="font-size: 10px; opacity: 0.7; margin: 4px 0 2px 0;">Model:</div>
                <div style="display: flex; gap: 4px;">
                    <select id="cfg-gh-model" class="provider-select" style="flex: 1;">
                        <option value="gpt-4o-mini">gpt-4o-mini (Fast & Recommended)</option>
                        <option value="Phi-3.5-mini-instruct">Phi-3.5-mini-instruct (Small)</option>
                        <option value="Meta-Llama-3.1-8B-Instruct">Meta-Llama-3.1-8B-Instruct</option>
                    </select>
                    <button class="btn-send-main" data-action="saveGitHubConfig" onclick="saveGitHubConfig()">Save</button>
                </div>
            </div>
            <div id="cfg-ollama" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-weight: 600; color: #34D399;">Local Ollama Models</span>
                    <button class="btn-prop-sm" data-action="refreshOllamaModels" onclick="refreshOllamaModels()" title="Refresh models from local Ollama">Scan</button>
                </div>
                <div style="font-size: 10px; opacity: 0.7; margin-bottom: 2px;">Endpoint URL:</div>
                <input type="text" id="cfg-ollama-endpoint" class="chat-textarea" style="min-height: 28px; max-height: 28px;" value="http://localhost:11434" onchange="refreshOllamaModels()" />
                <div style="font-size: 10px; opacity: 0.7; margin: 4px 0 2px 0;">Discovered / Selected Model:</div>
                <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                    <select id="cfg-ollama-model" class="provider-select" style="flex: 1;" onchange="onOllamaSelectChange(this.value)">
                        <option value="auto">Auto-detect best model</option>
                        <option value="custom">Enter custom model name...</option>
                    </select>
                    <button class="btn-send-main" data-action="saveOllamaConfig" onclick="saveOllamaConfig()">Save</button>
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
                <button class="btn-refactor-quick" data-action="requestWorkspaceRefactor" onclick="requestWorkspaceRefactor()" title="Workspace-wide AI Auto-Fix & Refactor">
                    <span>Auto-Fix & Refactor</span>
                </button>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <button class="btn-attach" id="btn-attach" data-action="triggerFilePicker" onclick="triggerFilePicker()" title="Attach File or Folder (Drag & Drop also supported)">Attach</button>
                    <button class="btn-stop-gen" id="btn-stop" style="display: none;" data-action="stopGeneration" onclick="stopGeneration()" title="Stop Generation">
                        <span>Stop</span>
                    </button>
                    <button class="btn-send-main" id="btn-send" data-action="sendPrompt" onclick="sendPrompt()">
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
                <button class="action-btn primary" id="btn-run" data-action="smartRun" onclick="smartRun()">Smart Run / Test</button>
                <button class="action-btn" data-action="auditFile" onclick="auditFile()" title="Audit file against .agent rules">Audit Rules</button>
                <button class="action-btn" data-action="checkFile" onclick="checkFile()" title="Run type checks and linter">Check Types</button>
                <button class="action-btn" data-action="runTests" onclick="runTests()" title="Execute test suites">Test Suite</button>
                <button class="action-btn" data-action="explainCode" onclick="explainCode()" title="Explain code architecture">Explain Code</button>
                <button class="action-btn" data-action="generateTests" onclick="generateTests()" title="Scaffold tests for active symbols">Scaffold Tests</button>
                <button class="action-btn" data-tab="arch" data-action="switchTab" onclick="switchTab('arch')" title="Inspect clean architecture layers">Architecture</button>
                <button class="action-btn" data-action="requestWorkspaceRefactor" onclick="requestWorkspaceRefactor()" style="grid-column: span 2; background: linear-gradient(135deg, #0284c7, #2563eb); color: #fff; font-weight: 600;" title="AI analyzes workspace/file and proposes coordinated code fixes with Diff Review">AI Auto-Fix & Refactor (Workspace)</button>
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

        <button class="action-btn primary" style="width: 100%; margin-bottom: 12px;" data-action="analyzeWorkspace" onclick="analyzeWorkspace()">Refresh Workspace Map</button>

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
            <button class="action-btn" data-action="insertSnippet" data-snippet="lesson1" onclick="insertSnippet('lesson1')">Insert into Editor</button>
        </div>

        <div class="lesson-card" style="background: var(--vscode-editor-background); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: var(--vscode-textLink-foreground);">Lesson 2: Clean Architecture & DI</div>
            <div style="font-size: 11px; margin: 4px 0;">Services receive dependencies via <code>init(...)</code> constructor injection:</div>
            <pre style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; font-size: 10px;">class UserService {\n    repo: UserRepository\n    init(repo: UserRepository) {\n        this.repo = repo\n    }\n}</pre>
            <button class="action-btn" data-action="insertSnippet" data-snippet="lesson2" onclick="insertSnippet('lesson2')">Insert into Editor</button>
        </div>

        <div class="lesson-card" style="background: var(--vscode-editor-background); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: var(--vscode-textLink-foreground);">Lesson 3: Concurrency Actors & Mailboxes</div>
            <div style="font-size: 11px; margin: 4px 0;">Stateful actors run on Tokio threads with <code>tell</code> and <code>ask</code>:</div>
            <pre style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; font-size: 10px;">class WorkerActor {\n    var count: Int\n    init() { this.count = 0 }\n    fn handle(msg: String) -> Int {\n        this.count += 1\n        return this.count\n    }\n}</pre>
            <button class="action-btn" data-action="insertSnippet" data-snippet="lesson3" onclick="insertSnippet('lesson3')">Insert into Editor</button>
        </div>

        <div class="lesson-card" style="background: var(--vscode-editor-background); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-weight: 600; color: var(--vscode-textLink-foreground);">Lesson 4: Load Test with Teardown</div>
            <div style="font-size: 11px; margin: 4px 0;">High throughput stress testing with guaranteed resource teardown (Rule 10):</div>
            <pre style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; font-size: 10px;">class LoadTestSuite {\n    fn run(n: Int) -> Int {\n        var total = 0\n        for i in 0..n { total += 1 }\n        return total\n    }\n    fn teardown() -> Unit {\n        print(\"Teardown complete\")\n    }\n}</pre>
            <button class="action-btn" data-action="insertSnippet" data-snippet="lesson4" onclick="insertSnippet('lesson4')">Insert into Editor</button>
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
                <button class="btn-prop-sm" data-action="refreshOllamaModels" onclick="refreshOllamaModels()">Scan Models</button>
            </div>
            <div style="font-size: 10.5px; opacity: 0.85; line-height: 1.4;">Private offline execution on your machine. Auto-detects local models (<b>gemma:2b</b>, etc.).</div>
        </div>

        <div class="settings-group" id="cfg-field-github">
            <label class="settings-label">GitHub Token / PAT:</label>
            <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                <input type="password" id="cfg-input-github" class="chat-textarea" style="min-height: 28px; max-height: 28px;" placeholder="ghp_... or github_pat_..." />
                <button class="btn-prop-sm" data-action="togglePassword" data-target="cfg-input-github" onclick="togglePasswordVisibility('cfg-input-github')">Show</button>
            </div>
            <button class="action-btn" style="width: 100%;" data-action="requestGitHubLogin" onclick="requestGitHubLogin()">Auto-Link GitHub Account</button>
        </div>

        <div class="settings-group" id="cfg-field-openai">
            <label class="settings-label">OpenAI API Key:</label>
            <div style="display: flex; gap: 4px;">
                <input type="password" id="cfg-input-openai" class="chat-textarea" style="min-height: 28px; max-height: 28px;" placeholder="sk-..." />
                <button class="btn-prop-sm" data-action="togglePassword" data-target="cfg-input-openai" onclick="togglePasswordVisibility('cfg-input-openai')">Show</button>
            </div>
        </div>

        <div class="settings-group" id="cfg-field-gemini">
            <label class="settings-label">Google Gemini API Key:</label>
            <div style="display: flex; gap: 4px;">
                <input type="password" id="cfg-input-gemini" class="chat-textarea" style="min-height: 28px; max-height: 28px;" placeholder="AIzaSy..." />
                <button class="btn-prop-sm" data-action="togglePassword" data-target="cfg-input-gemini" onclick="togglePasswordVisibility('cfg-input-gemini')">Show</button>
            </div>
        </div>

        <div class="settings-group" id="cfg-field-anthropic">
            <label class="settings-label">Anthropic Claude API Key:</label>
            <div style="display: flex; gap: 4px;">
                <input type="password" id="cfg-input-anthropic" class="chat-textarea" style="min-height: 28px; max-height: 28px;" placeholder="sk-ant-..." />
                <button class="btn-prop-sm" data-action="togglePassword" data-target="cfg-input-anthropic" onclick="togglePasswordVisibility('cfg-input-anthropic')">Show</button>
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
            <button class="action-btn primary" data-action="saveAllSettings" onclick="saveAllSettings()">Save Settings</button>
            <button class="action-btn" data-action="testConnection" onclick="testConnection()">Test Connection</button>
        </div>

        <div id="test-connection-status" style="margin-top: 10px; display: none; padding: 8px; border-radius: 5px; font-size: 11px; line-height: 1.4;"></div>
    </div>

    
    <script>

        function dispatchAction(actionName, targetEl, event) {
            if (!actionName) return;
            switch (actionName) {
                case 'switchTab':
                    if (targetEl) {
                        const t = targetEl.getAttribute('data-tab') || 'ask';
                        switchTab(t);
                    }
                    break;
                case 'smartRun':
                    smartRun();
                    break;
                case 'checkFile':
                    checkFile();
                    break;
                case 'runTests':
                    runTests();
                    break;
                case 'explainCode':
                    explainCode();
                    break;
                case 'auditFile':
                    auditFile();
                    break;
                case 'generateTests':
                    generateTests();
                    break;
                case 'openArch':
                    switchTab('arch');
                    break;
                case 'analyzeWorkspace':
                    analyzeWorkspace();
                    break;
                case 'requestWorkspaceRefactor':
                    requestWorkspaceRefactor();
                    break;
                case 'toggleConfigPanel':
                    toggleConfigPanel();
                    break;
                case 'saveAllSettings':
                    saveAllSettings();
                    break;
                case 'testConnection':
                    testConnection();
                    break;
                case 'triggerFilePicker':
                    triggerFilePicker();
                    break;
                case 'stopGeneration':
                    stopGeneration();
                    break;
                case 'sendPrompt':
                    sendPrompt();
                    break;
                case 'refreshOllamaModels':
                    refreshOllamaModels();
                    break;
                case 'requestGitHubLogin':
                    requestGitHubLogin();
                    break;
                case 'saveGitHubConfig':
                    saveGitHubConfig();
                    break;
                case 'saveOllamaConfig':
                    saveOllamaConfig();
                    break;
                case 'togglePassword':
                    if (targetEl) {
                        const targetId = targetEl.getAttribute('data-target');
                        if (targetId) togglePasswordVisibility(targetId);
                    }
                    break;
                case 'insertSnippet':
                    if (targetEl) {
                        const snipId = targetEl.getAttribute('data-snippet');
                        if (snipId) insertSnippet(snipId);
                    }
                    break;
                case 'cloneExample':
                    if (targetEl) {
                        const slug = targetEl.getAttribute('data-slug') || targetEl.closest('.example-card')?.getAttribute('data-slug');
                        if (slug) cloneExample(slug);
                    }
                    break;
                default:
                    if (typeof window[actionName] === 'function') {
                        window[actionName]();
                    }
                    break;
            }
        }


        let vscode;
        try {
            vscode = acquireVsCodeApi();
        } catch (e) {
            vscode = {
                postMessage: () => {},
                getState: () => ({ history: [] }),
                setState: () => {}
            };
        }

        function normalizeTabName(name) {
            if (!name) return 'ask';
            let t = String(name).toLowerCase().trim();
            if (t.startsWith('tab-')) t = t.substring(4);
            if (t === 'learning') return 'learn';
            if (t === 'architecture') return 'arch';
            if (t === 'inspector') return 'copilot';
            if (t === 'chat' || t === 'agent') return 'ask';
            if (t === 'example') return 'examples';
            if (t === 'setting') return 'settings';
            return t;
        }

        function switchTab(rawName) {
            const name = normalizeTabName(rawName);
            const validTabs = ['ask', 'copilot', 'arch', 'learn', 'examples', 'settings'];
            const targetTab = validTabs.includes(name) ? name : 'ask';

            const tabButtons = document.querySelectorAll('.tab-btn');
            tabButtons.forEach(b => {
                const target = b.getAttribute('data-tab');
                if (target === targetTab) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });

            const sections = document.querySelectorAll('.section');
            sections.forEach(s => {
                if (s.id === 'tab-' + targetTab) {
                    s.classList.add('active');
                    s.style.display = (targetTab === 'ask' ? 'flex' : 'block');
                } else {
                    s.classList.remove('active');
                    s.style.display = 'none';
                }
            });

            try {
                if (typeof vscode !== 'undefined' && vscode.getState) {
                    const st = vscode.getState() || { history: [] };
                    st.activeTab = targetTab;
                    vscode.setState(st);
                }
            } catch (e) {}
        }
        window.switchTab = switchTab;
        window.normalizeTabName = normalizeTabName;
        window.openArch = function() { switchTab('arch'); };
        window.openLearning = function() { switchTab('learn'); };
        window.openExamples = function() { switchTab('examples'); };
        window.openInspector = function() { switchTab('copilot'); };
        window.openSettings = function() { switchTab('settings'); };

        // Directly bind all tab buttons immediately so tabs NEVER fail
        function bindAllTabButtons() {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.onclick = function(e) {
                    if (e) e.preventDefault();
                    const tab = this.getAttribute('data-tab');
                    if (tab) switchTab(tab);
                };
            });
        }
        bindAllTabButtons();

        // Comprehensive Universal Event Delegation (CSP compliant)
        document.addEventListener('click', function(e) {
            // 1. Tab buttons
            const tabBtn = e.target.closest('.tab-btn');
            if (tabBtn) {
                const tab = tabBtn.getAttribute('data-tab');
                if (tab) {
                    e.preventDefault();
                    switchTab(tab);
                    return;
                }
            }

            // 2. Active model pill in header
            if (e.target.closest('#active-model-pill')) {
                e.preventDefault();
                switchTab('settings');
                return;
            }

            // 3. Suggestion chips
            const chip = e.target.closest('.chip');
            if (chip) {
                const txt = chip.getAttribute('data-chip') || chip.innerText.trim();
                if (txt && typeof askChip === 'function') {
                    e.preventDefault();
                    askChip(txt);
                    return;
                }
            }

            // 4. Mention pills
            const mentionPill = e.target.closest('.btn-mention-pill');
            if (mentionPill) {
                const tok = mentionPill.getAttribute('data-token') || mentionPill.innerText.trim();
                if (tok) {
                    e.preventDefault();
                    insertMentionToken(tok);
                    return;
                }
            }

            // 5. Example clone / card
            const cloneBtn = e.target.closest('.btn-clone');
            if (cloneBtn) {
                const card = cloneBtn.closest('.example-card');
                const slug = card ? (card.getAttribute('data-slug') || card.getAttribute('data-action-slug')) : null;
                if (slug) {
                    e.preventDefault();
                    cloneExample(slug);
                    return;
                }
            }
            const exCard = e.target.closest('.example-card');
            if (exCard) {
                const slug = exCard.getAttribute('data-slug');
                if (slug) {
                    e.preventDefault();
                    cloneExample(slug);
                    return;
                }
            }

            // 6. Action buttons with data-action
            const actionEl = e.target.closest('[data-action]');
            if (actionEl) {
                const act = actionEl.getAttribute('data-action');
                e.preventDefault();
                dispatchAction(act, actionEl, e);
                return;
            }
        });

        // Universal change delegation
        document.addEventListener('change', function(e) {
            const el = e.target;
            if (el.id === 'copilot-provider-select') {
                onProviderSelectChanged(el.value);
            } else if (el.id === 'cfg-active-provider') {
                onSettingsProviderChange(el.value);
            } else if (el.id === 'cfg-ollama-model') {
                onOllamaSelectChange(el.value);
            } else if (el.id === 'cfg-ollama-endpoint') {
                refreshOllamaModels();
            }
        });

        // Automatic runtime binder for any remaining static onclick/onchange handlers
        function bindAllStaticHandlers() {
            document.querySelectorAll('[onclick]').forEach(el => {
                const raw = el.getAttribute('onclick');
                if (!raw || el.hasAttribute('data-action')) return;
                el.addEventListener('click', function(ev) {
                    try {
                        const m = raw.match(/^([a-zA-Z0-9_]+)\((.*)\)$/);
                        if (m) {
                            const fnName = m[1];
                            const rawArgs = m[2].trim();
                            if (rawArgs === '') {
                                if (typeof window[fnName] === 'function') {
                                    ev.preventDefault();
                                    window[fnName]();
                                }
                            } else {
                                const argM = rawArgs.match(/^['"]([^'"]+)['"]$/);
                                if (argM && typeof window[fnName] === 'function') {
                                    ev.preventDefault();
                                    window[fnName](argM[1]);
                                }
                            }
                        }
                    } catch (err) {}
                });
            });
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bindAllStaticHandlers);
        } else {
            bindAllStaticHandlers();
        }

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
        const LESSON_SNIPPETS = {
            lesson1: 'model User {\n    name: String\n    age: Int\n}\n',
            lesson2: 'class UserService {\n    repo: UserRepository\n    init(repo: UserRepository) {\n        this.repo = repo\n    }\n}\n',
            lesson3: 'class WorkerActor {\n    var count: Int\n    init() { this.count = 0 }\n    fn handle(msg: String) -> Int {\n        this.count += 1\n        return this.count\n    }\n}\n',
            lesson4: 'class LoadTestSuite {\n    init() {}\n    fn run(n: Int) -> Int {\n        var total = 0\n        for i in 0..n { total += 1 }\n        return total\n    }\n    fn teardown() -> Unit {\n        print("  [Teardown] synthetic allocations purged")\n    }\n}\n'
        };

        function insertSnippet(code) {
            const finalCode = LESSON_SNIPPETS[code] || code;
            vscode.postMessage({ type: 'insertCode', code: finalCode });
        }
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
        window.openLearning = function() { switchTab('learn'); };
        window.openExamples = function() { switchTab('examples'); };
        window.openInspector = function() { switchTab('copilot'); };
        window.openSettings = function() { switchTab('settings'); };
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

module.exports = {
    EXAMPLES_CATALOG,
    getNonce,
    getWebviewHtml
};
