/**
 * Integration Test Suite for Kora VS Code Webview Navigation & State.
 * Verifies real DOM execution, CSP nonces, TabNavigationController,
 * exclusive section visibility, and state restoration.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

// Mock vscode API for headless testing
const origRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    if (id === 'vscode') {
        return {
            Uri: { joinPath: (base, ...parts) => ({ fsPath: parts.join('/') }) }
        };
    }
    return origRequire.apply(this, arguments);
};

const { getWebviewHtml, EXAMPLES_CATALOG, getNonce } = require('../client/kora-webview-html');

let JSDOM, VirtualConsole;
try {
    const jsdomPkg = require('/tmp/dom_test/node_modules/jsdom');
    JSDOM = jsdomPkg.JSDOM;
    VirtualConsole = jsdomPkg.VirtualConsole;
} catch (e) {
    // If running in an environment with jsdom installed locally or globally
    const jsdomPkg = require('jsdom');
    JSDOM = jsdomPkg.JSDOM;
    VirtualConsole = jsdomPkg.VirtualConsole;
}

function runTests() {
    const mockWebview = {
        cspSource: 'vscode-webview:',
        asWebviewUri: (uri) => 'vscode-resource:/icon.png'
    };
    const mockUri = { fsPath: '/test/path' };
    const nonce = getNonce();
    const html = getWebviewHtml(mockWebview, mockUri, EXAMPLES_CATALOG, nonce);

    const virtualConsole = new VirtualConsole();
    const errors = [];
    virtualConsole.on('error', (err) => { errors.push(err); });

    let persistedState = { history: [], activeTab: 'ask' };
    const postedMessages = [];

    const dom = new JSDOM(html, {
        runScripts: 'dangerously',
        resources: 'usable',
        virtualConsole,
        beforeParse(window) {
            window.acquireVsCodeApi = () => {
                return {
                    postMessage: (m) => { postedMessages.push(m); },
                    getState: () => persistedState,
                    setState: (s) => { persistedState = s; }
                };
            };
        }
    });

    const { window } = dom;
    const { document } = window;

    function getVisibleSections() {
        return [...document.querySelectorAll('.section')].filter(sec => {
            const style = window.getComputedStyle(sec);
            return style.display !== 'none';
        }).map(s => s.id);
    }

    function getActiveButtons() {
        return [...document.querySelectorAll('.tab-btn.active')].map(b => b.getAttribute('data-tab'));
    }

    // 1. Initial State
    const initVisible = getVisibleSections();
    const initActive = getActiveButtons();
    if (initVisible.length !== 1 || initVisible[0] !== 'tab-ask' || initActive[0] !== 'ask') {
        throw new Error('Initial state failed: exactly tab-ask must be visible.');
    }

    // 2. Click every tab
    const tabs = ['copilot', 'arch', 'learn', 'examples', 'settings', 'ask'];
    for (const tab of tabs) {
        const btn = document.querySelector('.tab-btn[data-tab="' + tab + '"]');
        if (!btn) throw new Error('Button not found for tab ' + tab);
        btn.click();

        const vis = getVisibleSections();
        const act = getActiveButtons();
        const expectedSection = 'tab-' + tab;

        if (vis.length !== 1 || vis[0] !== expectedSection) {
            throw new Error('Expected exactly 1 visible section ' + expectedSection + ', got ' + JSON.stringify(vis));
        }
        if (act.length !== 1 || act[0] !== tab) {
            throw new Error('Expected exactly 1 active button ' + tab + ', got ' + JSON.stringify(act));
        }
        if (persistedState.activeTab !== tab) {
            throw new Error('Expected persisted state ' + tab + ', got ' + persistedState.activeTab);
        }
    }

    // 3. Active model pill click
    const pill = document.getElementById('active-model-pill');
    if (!pill) throw new Error('Active model pill not found!');
    pill.click();
    if (getVisibleSections()[0] !== 'tab-settings') {
        throw new Error('Clicking model pill did not switch to settings!');
    }

    // 4. Invalid tab fallback
    window.TabNavigationController.switchTo('unknown-tab-identifier');
    if (getVisibleSections()[0] !== 'tab-ask') {
        throw new Error('Invalid tab did not safely fall back to ask!');
    }

    // 5. State restoration
    persistedState = { history: [], activeTab: 'learn' };
    const domRestored = new JSDOM(html, {
        runScripts: 'dangerously',
        resources: 'usable',
        virtualConsole,
        beforeParse(win) {
            win.acquireVsCodeApi = () => ({
                postMessage: () => {},
                getState: () => persistedState,
                setState: (s) => { persistedState = s; }
            });
        }
    });
    const restVis = [...domRestored.window.document.querySelectorAll('.section')].filter(sec => {
        return domRestored.window.getComputedStyle(sec).display !== 'none';
    }).map(s => s.id);
    const restAct = [...domRestored.window.document.querySelectorAll('.tab-btn.active')].map(b => b.getAttribute('data-tab'));
    if (restVis.length !== 1 || restVis[0] !== 'tab-learn' || restAct[0] !== 'learn') {
        throw new Error('State restoration failed!');
    }

    // 6. Proposal Card, Diff & Event Delegation Verification
    postedMessages.length = 0;

    const testProposal = {
        id: 'prop_test_123',
        title: 'Auto-Fix and refactor Kora invariants',
        totalFiles: 1,
        files: [{
            filePath: '/test/workspace/order_status.enum.kora',
            fileName: 'order_status.enum.kora',
            status: 'pending',
            additions: 2,
            deletions: 2,
            originalContent: 'enum OrderStatus {\n    Pending\n    Cancelled(String)\n}\n',
            proposedContent: 'enum OrderStatus {\n    Pending\n    Cancelled(String, Int)\n}\n',
            codePreview: 'enum OrderStatus {\n    Pending\n    Cancelled(String, Int)\n}\n'
        }]
    };

    window.dispatchEvent(new window.MessageEvent('message', {
        data: {
            type: 'proposalCreated',
            proposal: testProposal
        }
    }));

    const propCard = document.getElementById('card-prop_test_123');
    if (!propCard) throw new Error('Proposal card was not rendered into DOM');

    const inlineOnclicks = propCard.querySelectorAll('[onclick]');
    if (inlineOnclicks.length > 0) {
        throw new Error('Found ' + inlineOnclicks.length + ' illegal inline onclick handlers in proposal card! Must use data-action delegation.');
    }

    // Test Diff button click
    postedMessages.length = 0;
    const diffBtn = propCard.querySelector('button[data-action="previewDiff"]');
    if (!diffBtn) throw new Error('Diff button not found in proposal card');
    diffBtn.click();
    if (postedMessages.length === 0 || postedMessages[0].type !== 'previewDiff' || postedMessages[0].filePath !== '/test/workspace/order_status.enum.kora') {
        throw new Error('Clicking Diff button failed to post previewDiff message: ' + JSON.stringify(postedMessages));
    }

    // Test View toggle button click
    const viewBtn = propCard.querySelector('button[data-action="toggleInlineDiff"]');
    if (!viewBtn) throw new Error('View toggle button not found in proposal card');
    const inlineDiffEl = document.getElementById('inline-diff-prop_test_123-0');
    if (!inlineDiffEl) throw new Error('Inline diff container not found in proposal card');
    const initDisplay = inlineDiffEl.style.display;
    viewBtn.click();
    if (inlineDiffEl.style.display === initDisplay) {
        throw new Error('Clicking View button did not toggle inline diff container visibility');
    }

    // Test Accept button click
    postedMessages.length = 0;
    const acceptBtn = propCard.querySelector('button[data-action="setFileStatus"][data-status="accepted"]');
    if (!acceptBtn) throw new Error('Accept button not found in proposal card');
    acceptBtn.click();
    if (postedMessages.length === 0 || postedMessages[0].type !== 'setFileStatus' || postedMessages[0].status !== 'accepted') {
        throw new Error('Clicking Accept button failed to post setFileStatus message: ' + JSON.stringify(postedMessages));
    }

    // Test Accept All Changes button click
    postedMessages.length = 0;
    const acceptAllBtn = propCard.querySelector('button[data-action="acceptProposal"]');
    if (!acceptAllBtn) throw new Error('Accept All button not found in proposal card');
    acceptAllBtn.click();
    if (postedMessages.length === 0 || postedMessages[0].type !== 'acceptProposal') {
        throw new Error('Clicking Accept All button failed to post acceptProposal message: ' + JSON.stringify(postedMessages));
    }

    // 7. Test Refactoring Plan & Intent Approval Flow
    const testPlan = {
        id: 'plan_test_456',
        goal: 'Enforce Clean Architecture invariants',
        scope: 'workspace',
        understanding: 'Analyzed workspace and planned constructor dependency injection',
        filesCount: 1,
        steps: [{
            filePath: '/test/workspace/order_status.enum.kora',
            fileName: 'order_status.enum.kora',
            plannedChanges: ['Enforce Rule 01 (Single-Null Design): Replace undefined with null']
        }]
    };

    window.dispatchEvent(new window.MessageEvent('message', {
        data: {
            type: 'refactorPlanCreated',
            plan: testPlan
        }
    }));

    const planCard = document.getElementById('plan-plan_test_456');
    if (!planCard) throw new Error('Refactor plan card was not rendered');

    postedMessages.length = 0;
    const approveBtn = planCard.querySelector('button[data-action="executeRefactorPlan"]');
    if (!approveBtn) throw new Error('Approve plan button not found');
    approveBtn.click();
    if (postedMessages.length === 0 || postedMessages[0].type !== 'executeRefactorPlan') {
        throw new Error('Clicking Approve Plan failed to post executeRefactorPlan message: ' + JSON.stringify(postedMessages));
    }

    // 8. Test New Chat Action
    postedMessages.length = 0;
    const newChatBtn = document.querySelector('button[data-action="newChat"]');
    if (!newChatBtn) throw new Error('New Chat button not found');
    newChatBtn.click();
    if (postedMessages.length === 0 || postedMessages[0].type !== 'newChat') {
        throw new Error('Clicking New Chat failed to post newChat message: ' + JSON.stringify(postedMessages));
    }
    const chatHistoryEl = document.getElementById('chat-history');
    if (chatHistoryEl && chatHistoryEl.children.length > 0) {
        throw new Error('New Chat failed to clear chat history DOM elements');
    }

    // 9. Zero errors
    if (errors.length > 0) {
        throw new Error('Console recorded errors: ' + JSON.stringify(errors));
    }

    console.log('[PASS] All Webview real DOM navigation tests passed successfully!');
}

runTests();
