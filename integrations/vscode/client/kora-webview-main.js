

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
                getState: () => ({ history: [], activeTab: 'ask' }),
                setState: () => {}
            };
        }

        const TAB_CONFIG = {
            ask: {
                buttonId: 'tab-nav-ask',
                sectionId: 'tab-ask',
                display: 'flex'
            },
            copilot: {
                buttonId: 'tab-nav-copilot',
                sectionId: 'tab-copilot',
                display: 'block'
            },
            arch: {
                buttonId: 'tab-nav-arch',
                sectionId: 'tab-arch',
                display: 'block'
            },
            learn: {
                buttonId: 'tab-nav-learn',
                sectionId: 'tab-learn',
                display: 'block'
            },
            examples: {
                buttonId: 'tab-nav-examples',
                sectionId: 'tab-examples',
                display: 'block'
            },
            settings: {
                buttonId: 'tab-nav-settings',
                sectionId: 'tab-settings',
                display: 'block'
            }
        };

        const TabNavigationController = {
            _initialized: false,
            _activeTab: 'ask',
            vscode: null,

            normalizeTab(rawName) {
                if (!rawName) return 'ask';
                let t = String(rawName).toLowerCase().trim();
                if (t.startsWith('tab-')) t = t.substring(4);
                if (t === 'learning') return 'learn';
                if (t === 'architecture') return 'arch';
                if (t === 'inspector') return 'copilot';
                if (t === 'chat' || t === 'agent') return 'ask';
                if (t === 'example') return 'examples';
                if (t === 'setting') return 'settings';
                return TAB_CONFIG[t] ? t : 'ask';
            },

            init(vscodeApi) {
                this.vscode = vscodeApi;
                if (this._initialized) return;
                this._initialized = true;

                // Restore persisted state safely
                let initialTab = 'ask';
                try {
                    if (this.vscode && this.vscode.getState) {
                        const s = this.vscode.getState();
                        if (s && s.activeTab) {
                            initialTab = this.normalizeTab(s.activeTab);
                        }
                    }
                } catch (err) {}

                this.switchTo(initialTab);
            },

            switchTo(rawName) {
                const targetTab = this.normalizeTab(rawName);
                this._activeTab = targetTab;

                // 1. Update tab buttons
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    const tab = btn.getAttribute('data-tab');
                    const isActive = (tab === targetTab);
                    btn.classList.toggle('active', isActive);
                    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
                });

                // 2. Update sections
                const targetSectionId = TAB_CONFIG[targetTab] ? TAB_CONFIG[targetTab].sectionId : 'tab-ask';
                document.querySelectorAll('.section').forEach(sec => {
                    const isActive = (sec.id === targetSectionId);
                    sec.classList.toggle('active', isActive);
                });

                // 3. Persist state
                try {
                    if (this.vscode && this.vscode.getState && this.vscode.setState) {
                        const s = this.vscode.getState() || { history: [] };
                        s.activeTab = targetTab;
                        this.vscode.setState(s);
                    }
                } catch (err) {}
            },

            getActiveTab() {
                return this._activeTab;
            }
        };

        window.TabNavigationController = TabNavigationController;
        window.switchTab = function(tabName) {
            TabNavigationController.switchTo(tabName);
        };
        window.openArch = function() { TabNavigationController.switchTo('arch'); };
        window.openLearning = function() { TabNavigationController.switchTo('learn'); };
        window.openExamples = function() { TabNavigationController.switchTo('examples'); };
        window.openInspector = function() { TabNavigationController.switchTo('copilot'); };
        window.openSettings = function() { TabNavigationController.switchTo('settings'); };

        // Unified deterministic click delegation for all interactive UI elements
        document.addEventListener('click', function(e) {
            // 1. Tab buttons
            const tabBtn = e.target.closest('.tab-btn');
            if (tabBtn) {
                e.preventDefault();
                const tab = tabBtn.getAttribute('data-tab');
                if (tab) TabNavigationController.switchTo(tab);
                return;
            }

            // 2. Active model pill in header
            if (e.target.closest('#active-model-pill')) {
                e.preventDefault();
                TabNavigationController.switchTo('settings');
                return;
            }

            // 3. Action buttons with data-action
            const actionEl = e.target.closest('[data-action]');
            if (actionEl) {
                const act = actionEl.getAttribute('data-action');
                e.preventDefault();
                dispatchAction(act, actionEl, e);
                return;
            }

            // 4. Suggestion chips
            const chip = e.target.closest('.chip');
            if (chip) {
                const txt = chip.getAttribute('data-chip') || chip.innerText.trim();
                if (txt && typeof askChip === 'function') {
                    e.preventDefault();
                    askChip(txt);
                    return;
                }
            }

            // 5. Mention pills
            const mentionPill = e.target.closest('.btn-mention-pill');
            if (mentionPill) {
                const tok = mentionPill.getAttribute('data-token') || mentionPill.innerText.trim();
                if (tok) {
                    e.preventDefault();
                    insertMentionToken(tok);
                    return;
                }
            }

            // 5b. File reference pill in markdown
            const filePill = e.target.closest('.file-ref-pill');
            if (filePill) {
                const targetPath = filePill.getAttribute('data-path') || filePill.getAttribute('title');
                if (targetPath) {
                    e.preventDefault();
                    openFile(targetPath);
                    return;
                }
            }

            // 6. Example clone / card
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
            } else if (el.id === 'cfg-settings-ollama-select') {
                const val = el.value;
                const inpMo = document.getElementById('cfg-input-model');
                if (inpMo) {
                    inpMo.value = val === 'auto' ? (window.koraLastDetectedOllamaModel || 'qwen2.5-coder:7b') : val;
                }
                const headerSelect = document.getElementById('cfg-ollama-model');
                if (headerSelect) headerSelect.value = val;
            } else if (el.id === 'cfg-ollama-endpoint' || el.id === 'cfg-input-endpoint') {
                refreshOllamaModels(el.value.trim());
            }
        });

        // Initialize TabNavigationController immediately
        TabNavigationController.init(vscode);

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

        // Request available files for context mention autocomplete and auto-discover models
        vscode.postMessage({ type: 'getAvailableContextOptions' });
        vscode.postMessage({ type: 'fetchOllamaModels' });

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
            updateConfigBoxVisibility(provider);
            const statusIndicator = document.getElementById('engine-indicator');
            if (statusIndicator) {
                statusIndicator.innerText = provider === 'embedded' ? 'Active (Embedded)' : 'Connected: ' + provider;
            }
            const pill = document.getElementById('active-model-pill');
            if (pill) {
                if (provider === 'embedded') pill.innerText = 'Embedded';
                else if (provider === 'copilot') pill.innerText = 'Copilot';
                else if (provider === 'ollama') pill.innerText = window.koraLastDetectedOllamaModel || 'qwen2.5-coder:7b';
                else pill.innerText = provider;
            }
            if (provider === 'ollama') {
                refreshOllamaModels();
            }
            vscode.postMessage({ type: 'updateProvider', provider: provider });
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

        function refreshOllamaModels(customEp) {
            let endpoint = customEp;
            if (!endpoint) {
                const olEnd = document.getElementById('cfg-ollama-endpoint');
                const inpEnd = document.getElementById('cfg-input-endpoint');
                const candidate = (olEnd && olEnd.value.trim()) || (inpEnd && inpEnd.value.trim());
                if (candidate) {
                    const low = candidate.toLowerCase();
                    if (!low.includes('azure.com') && !low.includes('openai.com') && !low.includes('anthropic.com') && !low.includes('googleapis.com')) {
                        endpoint = candidate;
                    }
                }
            }
            const statusEl = document.getElementById('ollama-scan-status');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.style.color = '#60A5FA';
                statusEl.innerText = 'Scanning Ollama endpoints & models...';
            }
            vscode.postMessage({ type: 'fetchOllamaModels', endpoint: endpoint || '' });
        }

        function onOllamaSelectChange(val) {
            const customInput = document.getElementById('cfg-ollama-custom');
            const settingsSelect = document.getElementById('cfg-settings-ollama-select');
            if (settingsSelect && settingsSelect.value !== val) {
                settingsSelect.value = val;
            }
            if (val === 'custom') {
                if (customInput) customInput.style.display = 'block';
            } else {
                if (customInput) customInput.style.display = 'none';
                const modelInput = document.getElementById('cfg-input-model');
                if (modelInput) modelInput.value = (val === 'auto' ? (window.koraLastDetectedOllamaModel || 'qwen2.5-coder:7b') : val);
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
            const olEnd = document.getElementById('cfg-ollama-endpoint');
            const inpEnd = document.getElementById('cfg-input-endpoint');
            const endpoint = (olEnd && olEnd.value.trim()) || (inpEnd && inpEnd.value.trim()) || 'http://localhost:11434';
            const selectVal = document.getElementById('cfg-ollama-model').value;
            const customInput = document.getElementById('cfg-ollama-custom');
            const customVal = customInput ? customInput.value.trim() : '';
            const model = (selectVal === 'custom' && customVal) ? customVal : (selectVal !== 'custom' ? selectVal : 'qwen2.5-coder:7b');
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
                if (modelInput && (!modelInput.value || modelInput.value === 'default' || modelInput.value.includes('gpt') || modelInput.value === 'gemma:2b')) {
                    modelInput.value = window.koraLastDetectedOllamaModel || 'qwen2.5-coder:7b';
                }
                if (endInput) {
                    const cur = (endInput.value || '').toLowerCase();
                    if (!endInput.value || cur.includes('azure.com') || cur.includes('openai.com') || cur.includes('googleapis.com')) {
                        endInput.value = 'http://localhost:11434';
                    }
                }
                refreshOllamaModels(endInput ? endInput.value.trim() : null);
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

        function formatInlineMarkdown(str) {
            if (!str) return '';
            let s = str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
            s = s.replace(/\*\*(.+?)\*\*/g, '<strong style="color: #F3F4F6;">$1</strong>');
            s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            s = s.replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 10.5px; color: #FBBF24;">$1</code>');
            s = s.replace(/\[([^\]]+)\]\(file:\/\/([^)]+)\)/g, '<span class="file-ref-pill" data-path="$2" title="Click to open">$1</span>');

            return s;
        }

        function renderMarkdownBlock(text) {
            const lines = text.split('\n');
            let html = '';
            let inList = false;

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];

                const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
                if (hMatch) {
                    if (inList) { html += '</ul>'; inList = false; }
                    const level = hMatch[1].length;
                    const content = formatInlineMarkdown(hMatch[2]);
                    const fontSize = level === 1 ? '14px' : (level === 2 ? '13px' : '12px');
                    const color = level === 1 ? '#60A5FA' : (level === 2 ? '#34D399' : '#F3F4F6');
                    html += `<div style="font-size: ${fontSize}; font-weight: 700; color: ${color}; margin: 8px 0 4px 0;">${content}</div>`;
                    continue;
                }

                if (line.startsWith('>')) {
                    if (inList) { html += '</ul>'; inList = false; }
                    const bqText = formatInlineMarkdown(line.replace(/^>\s*/, ''));
                    html += `<div class="md-blockquote">${bqText}</div>`;
                    continue;
                }

                const listMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
                if (listMatch) {
                    if (!inList) { html += '<ul style="margin: 4px 0; padding-left: 16px;">'; inList = true; }
                    html += `<li style="margin: 2px 0;">${formatInlineMarkdown(listMatch[2])}</li>`;
                    continue;
                } else if (inList) {
                    html += '</ul>';
                    inList = false;
                }

                if (!line.trim()) {
                    html += '<div style="height: 6px;"></div>';
                    continue;
                }

                html += `<div style="margin: 2px 0; line-height: 1.5;">${formatInlineMarkdown(line)}</div>`;
            }

            if (inList) { html += '</ul>'; }
            return html;
        }

        function appendMarkdownText(text, container) {
            const block = document.createElement('div');
            block.className = 'md-content-block';
            block.innerHTML = renderMarkdownBlock(text);
            container.appendChild(block);
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
            } else if (msg.type === 'streamChunk') {
                removeTypingIndicator();
                let streamingEl = document.getElementById('active-streaming-message');
                const history = document.getElementById('chat-history');
                const scrollArea = document.getElementById('chat-scroll-area');
                if (!streamingEl) {
                    streamingEl = document.createElement('div');
                    streamingEl.id = 'active-streaming-message';
                    streamingEl.className = 'msg-assistant streaming';
                    history.appendChild(streamingEl);
                }
                renderMarkdownWithCodeActions(msg.fullText, streamingEl);
                if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
            } else if (msg.type === 'assistantAnswer') {
                isGenerating = false;
                const btnSend = document.getElementById('btn-send');
                const btnStop = document.getElementById('btn-stop');
                if (btnSend) btnSend.disabled = false;
                if (btnStop) btnStop.style.display = 'none';
                removeTypingIndicator();
                hideAgentTracker();
                const streamingEl = document.getElementById('active-streaming-message');
                if (streamingEl) {
                    streamingEl.removeAttribute('id');
                    streamingEl.classList.remove('streaming');
                    renderMarkdownWithCodeActions(msg.answer, streamingEl);
                    const s = vscode.getState() || { history: [] };
                    s.history = s.history || [];
                    s.history.push({ type: 'message', role: 'assistant', text: msg.answer });
                    vscode.setState(s);
                } else {
                    appendMessage('assistant', msg.answer, true);
                }
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
                const streamingEl = document.getElementById('active-streaming-message');
                if (streamingEl) streamingEl.remove();

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
                const streamingEl = document.getElementById('active-streaming-message');
                if (streamingEl) {
                    streamingEl.removeAttribute('id');
                    streamingEl.classList.remove('streaming');
                }
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
                const settingsSelect = document.getElementById('cfg-settings-ollama-select');
                const statusEl = document.getElementById('ollama-scan-status');

                if (msg.activeModel) {
                    window.koraLastDetectedOllamaModel = msg.activeModel;
                }

                if (msg.endpoint) {
                    const olEnd = document.getElementById('cfg-ollama-endpoint');
                    const inpEnd = document.getElementById('cfg-input-endpoint');
                    if (olEnd) olEnd.value = msg.endpoint;
                    if (inpEnd) {
                        const cur = (inpEnd.value || '').toLowerCase();
                        if (!inpEnd.value || cur.includes('azure.com') || cur.includes('openai.com') || cur.includes('googleapis.com')) {
                            inpEnd.value = msg.endpoint;
                        }
                    }
                }

                if (msg.activeModel) {
                    const inpMo = document.getElementById('cfg-input-model');
                    if (inpMo && (!inpMo.value || inpMo.value === 'default' || inpMo.value === 'gemma:2b' || inpMo.value.includes('gpt'))) {
                        inpMo.value = msg.activeModel;
                    }
                }

                const models = msg.detailedModels || (msg.models ? msg.models.map(m => ({ name: m })) : []);

                if (statusEl) {
                    statusEl.style.display = 'block';
                    if (msg.status === 'no_models') {
                        statusEl.style.color = '#F87171';
                        statusEl.innerText = 'Connected: ' + (msg.endpoint || 'http://localhost:11434') + ' (0 models installed)';
                    } else {
                        statusEl.style.color = '#34D399';
                        statusEl.innerText = 'Connected: ' + (msg.endpoint || 'http://localhost:11434') + ' (' + models.length + ' model' + (models.length > 1 ? 's' : '') + ' available)';
                    }
                }

                if (msg.status === 'no_models') {
                    if (banner && bannerText) {
                        banner.style.display = 'block';
                        banner.style.background = 'rgba(239, 68, 68, 0.15)';
                        banner.style.borderColor = '#ef4444';
                        bannerText.innerHTML = '<b>0 Ollama models found!</b> Run: <code style="background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 3px;">ollama pull qwen2.5-coder:7b</code> <button class="btn-prop-sm" onclick="copyText(\'ollama pull qwen2.5-coder:7b\')">Copy</button>';
                    }
                    if (pill) pill.innerText = '0 Models (Ollama)';
                } else if (msg.status === 'error') {
                    if (banner && bannerText) {
                        banner.style.display = 'block';
                        banner.style.background = 'rgba(239, 68, 68, 0.15)';
                        banner.style.borderColor = '#ef4444';
                        bannerText.innerHTML = '<b>Ollama Error:</b> ' + (msg.resolution ? msg.resolution.message : 'Could not connect to Ollama');
                    }
                    if (pill) pill.innerText = 'Ollama Error';
                } else {
                    if (banner) banner.style.display = 'none';
                    if (pill && msg.activeModel) pill.innerText = msg.activeModel;
                }

                [select, settingsSelect].forEach(sel => {
                    if (!sel) return;
                    sel.innerHTML = '';
                    if (models.length === 0) {
                        const opt = document.createElement('option');
                        opt.value = 'auto';
                        opt.innerText = 'No models found (Run: ollama pull qwen2.5-coder:7b)';
                        sel.appendChild(opt);
                    } else {
                        const autoOpt = document.createElement('option');
                        autoOpt.value = 'auto';
                        autoOpt.innerText = 'Auto-select best model (' + (msg.activeModel || models[0].name) + ')';
                        sel.appendChild(autoOpt);

                        models.forEach(m => {
                            const opt = document.createElement('option');
                            opt.value = m.name;
                            const sizeStr = m.parameterSize ? (' [' + m.parameterSize + ']') : '';
                            const catStr = m.category === 'coding' ? ' [Coding]' : (m.category === 'agentic' ? ' [Agentic]' : '');
                            opt.innerText = m.name + sizeStr + catStr;
                            if (m.name === msg.activeModel) {
                                opt.selected = true;
                            }
                            sel.appendChild(opt);
                        });
                    }
                    if (sel === select) {
                        const optCustom = document.createElement('option');
                        optCustom.value = 'custom';
                        optCustom.innerText = 'Enter custom model name...';
                        sel.appendChild(optCustom);
                    }
                });
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

    
    