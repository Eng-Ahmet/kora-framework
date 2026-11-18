const fs = require('fs');
const path = require('path');

/**
 * Workspace Context Engine for Kora VS Code Extension.
 * Discovers, indexes, and analyzes workspace files, symbols, architectural layers,
 * and cross-file dependencies with path boundary safety and intelligent context retrieval.
 */
class WorkspaceContextEngine {
    constructor(vscodeInstance = null) {
        this.vscode = vscodeInstance;
        this.indexedFiles = new Map(); // filePath -> FileMeta
        this.dependencyGraph = new Map(); // filePath -> Set<importedPath>
        this.reverseGraph = new Map(); // filePath -> Set<importerPath>
        this.symbolIndex = new Map(); // symbolName -> [{ filePath, kind, line }]
        this.architectureSummary = {
            controllers: [],
            services: [],
            repositories: [],
            entities: [],
            models: [],
            tests: [],
            configs: []
        };
        this.isIndexing = false;
        this.lastIndexTime = 0;

        this.ignoredDirs = new Set([
            'node_modules',
            '.git',
            'target',
            'dist',
            'build',
            '.kora-build',
            '.kora_tmp',
            'coverage',
            '.venv',
            '.idea',
            '.cache'
        ]);

        this.koraExtensions = new Set(['.kora', '.kr']);
        this.configFiles = new Set(['kora.toml', 'Cargo.toml', 'package.json']);
    }

    /**
     * Determines if a relative or absolute path should be ignored.
     */
    isIgnored(targetPath) {
        const parts = targetPath.split(/[/\\]/);
        for (const part of parts) {
            if (this.ignoredDirs.has(part)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Ensures targetPath stays within one of the workspace folders (Path Traversal Protection).
     */
    isWithinWorkspace(targetPath, workspaceRoots) {
        if (!workspaceRoots || workspaceRoots.length === 0) return true;
        const normalized = path.resolve(targetPath);
        return workspaceRoots.some(root => {
            const normalizedRoot = path.resolve(root);
            return normalized === normalizedRoot || normalized.startsWith(normalizedRoot + path.sep);
        });
    }

    /**
     * Scans and indexes the entire workspace.
     */
    async scanWorkspace(workspaceRoots) {
        if (!workspaceRoots || workspaceRoots.length === 0) {
            if (this.vscode && this.vscode.workspace && this.vscode.workspace.workspaceFolders) {
                workspaceRoots = this.vscode.workspace.workspaceFolders.map(f => f.uri.fsPath);
            } else {
                workspaceRoots = [process.cwd()];
            }
        }

        this.isIndexing = true;
        this.indexedFiles.clear();
        this.dependencyGraph.clear();
        this.reverseGraph.clear();
        this.symbolIndex.clear();
        this.architectureSummary = {
            controllers: [],
            services: [],
            repositories: [],
            entities: [],
            models: [],
            tests: [],
            configs: []
        };

        const discovered = [];

        for (const root of workspaceRoots) {
            if (!fs.existsSync(root)) continue;
            this._discoverFilesRecursive(root, root, discovered);
        }

        for (const fileMeta of discovered) {
            this._indexSingleFile(fileMeta, workspaceRoots);
        }

        this._buildDependencyGraphs();
        this.lastIndexTime = Date.now();
        this.isIndexing = false;

        return {
            totalFiles: this.indexedFiles.size,
            architecture: this.getArchitectureCounts(),
            symbols: this.symbolIndex.size
        };
    }

    _discoverFilesRecursive(currentDir, rootDir, results) {
        try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                const relPath = path.relative(rootDir, fullPath);

                if (this.isIgnored(relPath) || this.isIgnored(entry.name)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    this._discoverFilesRecursive(fullPath, rootDir, results);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (this.koraExtensions.has(ext) || this.configFiles.has(entry.name) || relPath.startsWith('.agent')) {
                        results.push({
                            fullPath,
                            relPath,
                            fileName: entry.name,
                            ext,
                            size: 0
                        });
                    }
                }
            }
        } catch (e) {
            // Ignore permission or read errors gracefully
        }
    }

    _indexSingleFile(fileMeta, workspaceRoots) {
        try {
            const stats = fs.statSync(fileMeta.fullPath);
            fileMeta.size = stats.size;
            fileMeta.mtime = stats.mtimeMs;

            // Protection against massive files (limit 500KB for text analysis)
            if (stats.size > 500 * 1024) {
                fileMeta.isTooLarge = true;
                this.indexedFiles.set(fileMeta.fullPath, fileMeta);
                return;
            }

            const content = fs.readFileSync(fileMeta.fullPath, 'utf8');
            fileMeta.content = content;
            fileMeta.lines = content.split('\n').length;

            const classification = this._classifyFile(fileMeta.relPath, content);
            fileMeta.role = classification.role;
            fileMeta.isTest = classification.isTest;
            fileMeta.isRunnable = classification.isRunnable;

            // Register in architectural breakdown
            if (this.architectureSummary[classification.role + 's']) {
                this.architectureSummary[classification.role + 's'].push(fileMeta.fullPath);
            } else if (classification.isTest) {
                this.architectureSummary.tests.push(fileMeta.fullPath);
            }

            // Extract symbols & imports
            fileMeta.symbols = this._extractSymbols(content, fileMeta.fullPath);
            fileMeta.imports = this._extractImports(content, fileMeta.fullPath);
            fileMeta.injections = this._extractInjections(content);

            for (const sym of fileMeta.symbols) {
                if (!this.symbolIndex.has(sym.name)) {
                    this.symbolIndex.set(sym.name, []);
                }
                this.symbolIndex.get(sym.name).push({
                    filePath: fileMeta.fullPath,
                    relPath: fileMeta.relPath,
                    kind: sym.kind,
                    line: sym.line
                });
            }

            this.indexedFiles.set(fileMeta.fullPath, fileMeta);
        } catch (err) {
            // Ignore unreadable files
        }
    }

    _classifyFile(relPath, content) {
        const lowerPath = relPath.toLowerCase();
        const baseName = path.basename(lowerPath);

        const isTest = lowerPath.includes('test') || baseName.endsWith('.test.kora') || baseName.endsWith('_test.kora');
        const hasMain = /\bfn\s+main\s*\(/.test(content);
        const isRunnable = isTest || hasMain || /\blet\s+suite\s*=\s*[A-Za-z0-9_]+Test/.test(content);

        let role = 'service';
        if (lowerPath.includes('controller') || /@get|@post|@put|@delete|class\s+[A-Za-z0-9_]+Controller/.test(content)) {
            role = 'controller';
        } else if (lowerPath.includes('repo') || /class\s+[A-Za-z0-9_]+Repository|interface\s+[A-Za-z0-9_]+Repository/.test(content)) {
            role = 'repository';
        } else if (lowerPath.includes('entit') || /@table\b|@collection\b|@entity\b/.test(content)) {
            role = 'entity';
        } else if (lowerPath.includes('model') || lowerPath.includes('dto') || /\bmodel\s+[A-Za-z0-9_]+/.test(content)) {
            role = 'model';
        } else if (isTest) {
            role = 'test';
        } else if (lowerPath.endsWith('.toml') || lowerPath.endsWith('.json')) {
            role = 'config';
        }

        return { role, isTest, isRunnable };
    }

    _extractSymbols(content, filePath) {
        const symbols = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // class or actor
            const classMatch = line.match(/^\s*(?:export\s+)?(class|actor)\s+([A-Za-z0-9_]+)(?:\s+implements\s+([A-Za-z0-9_,\s]+))?/);
            if (classMatch) {
                symbols.push({
                    name: classMatch[2],
                    kind: classMatch[1] === 'actor' ? 'Actor' : 'Class',
                    implements: classMatch[3] ? classMatch[3].split(',').map(s => s.trim()) : [],
                    line: i + 1
                });
                continue;
            }

            // interface
            const ifaceMatch = line.match(/^\s*(?:export\s+)?interface\s+([A-Za-z0-9_]+)/);
            if (ifaceMatch) {
                symbols.push({
                    name: ifaceMatch[1],
                    kind: 'Interface',
                    line: i + 1
                });
                continue;
            }

            // model
            const modelMatch = line.match(/^\s*(?:export\s+)?model\s+([A-Za-z0-9_]+)/);
            if (modelMatch) {
                symbols.push({
                    name: modelMatch[1],
                    kind: 'Model',
                    line: i + 1
                });
                continue;
            }

            // top-level functions
            const fnMatch = line.match(/^\s*(?:export\s+)?fn\s+([A-Za-z0-9_]+)\s*\((.*?)\)(?:\s*->\s*([A-Za-z0-9_<>\[\]]+))?/);
            if (fnMatch) {
                symbols.push({
                    name: fnMatch[1],
                    kind: 'Function',
                    params: fnMatch[2],
                    returnType: fnMatch[3] || 'Unit',
                    line: i + 1
                });
            }
        }

        return symbols;
    }

    _extractImports(content, filePath) {
        const imports = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // import "path" or import { a, b } from "path"
            const match = line.match(/^import\s+(?:\{([^}]+)\}\s+from\s+)?["']([^"']+)["']/);
            if (match) {
                imports.push({
                    specifiers: match[1] ? match[1].split(',').map(s => s.trim()) : ['*'],
                    source: match[2],
                    line: i + 1
                });
            }
        }
        return imports;
    }

    _extractInjections(content) {
        // init(repo: UserRepository, db: Database)
        const initMatch = content.match(/init\s*\(([^)]*)\)/);
        if (!initMatch || !initMatch[1].trim()) return [];
        return initMatch[1].split(',').map(param => {
            const parts = param.trim().split(':');
            return {
                name: parts[0] ? parts[0].trim() : '',
                type: parts[1] ? parts[1].trim() : 'Unknown'
            };
        }).filter(p => p.name);
    }

    _buildDependencyGraphs() {
        for (const [fullPath, meta] of this.indexedFiles) {
            const importedSet = new Set();
            const currentDir = path.dirname(fullPath);

            for (const imp of meta.imports || []) {
                let resolvedTarget = null;
                const source = imp.source;

                if (source.startsWith('.')) {
                    // relative import
                    const candidate1 = path.resolve(currentDir, source);
                    const candidate2 = path.resolve(currentDir, source + '.kora');
                    const candidate3 = path.resolve(currentDir, source + '.kr');
                    if (this.indexedFiles.has(candidate1)) resolvedTarget = candidate1;
                    else if (this.indexedFiles.has(candidate2)) resolvedTarget = candidate2;
                    else if (this.indexedFiles.has(candidate3)) resolvedTarget = candidate3;
                } else {
                    // check by file base name match
                    for (const [fPath, fMeta] of this.indexedFiles) {
                        if (fMeta.relPath === source || fMeta.fileName === source || fMeta.fileName === `${source}.kora`) {
                            resolvedTarget = fPath;
                            break;
                        }
                    }
                }

                if (resolvedTarget) {
                    importedSet.add(resolvedTarget);
                    if (!this.reverseGraph.has(resolvedTarget)) {
                        this.reverseGraph.set(resolvedTarget, new Set());
                    }
                    this.reverseGraph.get(resolvedTarget).add(fullPath);
                }
            }

            this.dependencyGraph.set(fullPath, importedSet);
        }
    }

    getArchitectureCounts() {
        return {
            controllers: this.architectureSummary.controllers.length,
            services: this.architectureSummary.services.length,
            repositories: this.architectureSummary.repositories.length,
            entities: this.architectureSummary.entities.length,
            models: this.architectureSummary.models.length,
            tests: this.architectureSummary.tests.length,
            configs: this.architectureSummary.configs.length
        };
    }

    /**
     * Finds related files for a given target file (dependencies and dependents).
     */
    getRelatedFiles(filePath) {
        const fullPath = path.resolve(filePath);
        const related = new Set();

        const deps = this.dependencyGraph.get(fullPath);
        if (deps) {
            for (const d of deps) related.add(d);
        }

        const callers = this.reverseGraph.get(fullPath);
        if (callers) {
            for (const c of callers) related.add(c);
        }

        // Also check if any file references the symbols declared in filePath
        const meta = this.indexedFiles.get(fullPath);
        if (meta && meta.symbols) {
            for (const sym of meta.symbols) {
                const occurrences = this.symbolIndex.get(sym.name) || [];
                for (const occ of occurrences) {
                    if (occ.filePath !== fullPath) {
                        related.add(occ.filePath);
                    }
                }
            }
        }

        return Array.from(related).map(p => this.indexedFiles.get(p)).filter(Boolean);
    }

    /**
     * Intelligently selects context files for a user prompt or goal.
     */
    buildContextForQuery(prompt, options = {}) {
        const query = (prompt || '').toLowerCase();
        const activePath = options.activeFilePath ? path.resolve(options.activeFilePath) : null;
        const selectedFiles = options.selectedFiles ? options.selectedFiles.map(f => path.resolve(f)) : [];

        const contextItems = [];
        const addedPaths = new Set();

        const addFileToContext = (filePath, reason) => {
            if (addedPaths.has(filePath)) return;
            const meta = this.indexedFiles.get(filePath);
            if (!meta || meta.isTooLarge || !meta.content) return;
            addedPaths.add(filePath);
            contextItems.push({
                filePath,
                relPath: meta.relPath,
                fileName: meta.fileName,
                role: meta.role,
                reason,
                content: meta.content
            });
        };

        // 1. Explicitly selected files
        for (const sf of selectedFiles) {
            addFileToContext(sf, 'User explicitly selected file');
        }

        // 2. Active editor file
        if (activePath && !addedPaths.has(activePath)) {
            addFileToContext(activePath, 'Active editor document');
            // Add immediate dependencies of active file
            for (const rel of this.getRelatedFiles(activePath)) {
                if (contextItems.length < 10) {
                    addFileToContext(rel.fullPath, `Dependency/Caller of ${path.basename(activePath)}`);
                }
            }
        }

        // 3. Keyword and symbol matching across the workspace
        const words = query.split(/[\s,._-]+/).filter(w => w.length > 2);
        for (const [symName, occurrences] of this.symbolIndex) {
            const symLower = symName.toLowerCase();
            if (words.some(w => symLower.includes(w) || w.includes(symLower))) {
                for (const occ of occurrences) {
                    if (contextItems.length < 15) {
                        addFileToContext(occ.filePath, `Matches symbol "${symName}"`);
                    }
                }
            }
        }

        // 4. Layer matching (e.g. "auth", "controller", "repository")
        for (const [fPath, meta] of this.indexedFiles) {
            if (contextItems.length >= 15) break;
            const nameLower = meta.relPath.toLowerCase();
            if (words.some(w => nameLower.includes(w))) {
                addFileToContext(fPath, `File path matches query keywords`);
            }
        }

        // Build summary header
        const counts = this.getArchitectureCounts();
        const summaryText = `Workspace Architecture Overview:
- Total Indexed Files: ${this.indexedFiles.size}
- Controllers: ${counts.controllers}
- Services: ${counts.services}
- Repositories: ${counts.repositories}
- Entities: ${counts.entities}
- Models/DTOs: ${counts.models}
- Test Suites: ${counts.tests}`;

        return {
            summaryText,
            files: contextItems,
            totalFilesScanned: this.indexedFiles.size
        };
    }

    /**
     * Formats context into LLM prompt text.
     */
    formatContextForPrompt(context) {
        let text = `${context.summaryText}\n\nRelevant Workspace Context Files (${context.files.length}):\n`;
        for (const file of context.files) {
            text += `\n--- [File: ${file.relPath}] (${file.role}, ${file.reason}) ---\n`;
            text += `\`\`\`kora\n${file.content.slice(0, 3000)}\n\`\`\`\n`;
        }
        return text;
    }
}

module.exports = { WorkspaceContextEngine };
