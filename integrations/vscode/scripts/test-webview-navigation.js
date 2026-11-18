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

    const dom = new JSDOM(html, {
        runScripts: 'dangerously',
        resources: 'usable',
        virtualConsole,
        beforeParse(window) {
            window.acquireVsCodeApi = () => {
                return {
                    postMessage: () => {},
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

    // 6. Zero errors
    if (errors.length > 0) {
        throw new Error('Console recorded errors: ' + JSON.stringify(errors));
    }

    console.log('[PASS] All Webview real DOM navigation tests passed successfully!');
}

runTests();
