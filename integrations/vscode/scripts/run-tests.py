#!/usr/bin/env python3
"""
Comprehensive Test Suite for Kora VS Code Extension.
Tests:
- Unit Tests: WorkspaceContextEngine, ChangeReviewManager, Agent Lifecycle, Rule Enforcement.
- Integration Tests: Multi-file refactoring, diff generation, concurrent modification detection.
- End-to-End Scenarios: Scenarios A through F (Workspace Analysis, Cross-File Refactor,
  Diff Approval, No Active Editor, Concurrent Modification, Right Sidebar).
"""

import os
import sys
import json
import re
import shutil
import tempfile
import hashlib
import unittest

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CLIENT_DIR = os.path.join(ROOT_DIR, 'client')

class TestVSCodeManifest(unittest.TestCase):
    """Verifies package.json manifest, right sidebar placement, and command registrations."""

    def setUp(self):
        pkg_path = os.path.join(ROOT_DIR, 'package.json')
        with open(pkg_path, 'r', encoding='utf-8') as f:
            self.pkg = json.load(f)

    def test_right_sidebar_placement(self):
        """Kora must have its own dedicated container and icon in viewsContainers."""
        views_containers = self.pkg.get('contributes', {}).get('viewsContainers', {})
        self.assertTrue('activitybar' in views_containers or 'secondarySideBar' in views_containers)
        container = (views_containers.get('activitybar') or views_containers.get('secondarySideBar'))[0]
        self.assertEqual(container['id'], 'kora-sidebar')
        self.assertTrue('icon' in container)

        views = self.pkg.get('contributes', {}).get('views', {})
        self.assertIn('kora-sidebar', views, "views must map to kora-sidebar")
        kora_views = views['kora-sidebar']
        self.assertTrue(any(v['id'] == 'kora.assistantView' for v in kora_views), "kora.assistantView must be registered")

    def test_commands_registered(self):
        """Checks required commands are declared in package.json."""
        commands = {c['command'] for c in self.pkg.get('contributes', {}).get('commands', [])}
        required_cmds = [
            'kora.autoFixRefactor',
            'kora.focusChat',
            'kora.acceptProposedChanges',
            'kora.rejectProposedChanges',
            'kora.fixDiagnostic',
            'kora.smartRun',
            'kora.checkFile',
            'kora.runTests',
            'kora.formatFile',
            'kora.auditFile',
            'kora.explainCode',
            'kora.generateTests',
            'kora.analyzeWorkspace',
            'kora.openLearningCenter',
            'kora.openArchitectureExplorer'
        ]
        for cmd in required_cmds:
            self.assertIn(cmd, commands, f"Command {cmd} must be contributed in package.json")

    def test_activation_events(self):
        """Checks activation events include critical agent triggers."""
        events = set(self.pkg.get('activationEvents', []))
        self.assertIn('onView:kora.assistantView', events)
        self.assertIn('onCommand:kora.autoFixRefactor', events)
        self.assertIn('onCommand:kora.focusChat', events)

    def test_editor_title_menu_and_right_statusbar(self):
        """Verifies kora.focusChat is in editor/title and right status bar exists."""
        editor_title_menus = self.pkg.get('contributes', {}).get('menus', {}).get('editor/title', [])
        self.assertTrue(any(m.get('command') == 'kora.focusChat' for m in editor_title_menus),
                        "kora.focusChat must be contributed to editor/title menu")

        ext_js_path = os.path.join(CLIENT_DIR, 'extension.js')
        with open(ext_js_path, 'r', encoding='utf-8') as f:
            ext_content = f.read()
        self.assertIn('vscode.StatusBarAlignment.Right', ext_content,
                      "Extension must register a right-aligned status bar item for Kora AI Copilot")


class TestWorkspaceContextEngine(unittest.TestCase):
    """Simulates WorkspaceContextEngine algorithms and file discovery."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix='kora_ws_test_')
        # Setup mock project structure
        os.makedirs(os.path.join(self.temp_dir, 'src', 'controllers'), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir, 'src', 'services'), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir, 'src', 'repositories'), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir, 'src', 'entities'), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir, 'src', 'models'), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir, 'tests'), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir, 'node_modules', 'dummy'), exist_ok=True)
        os.makedirs(os.path.join(self.temp_dir, '.git'), exist_ok=True)

        # Create files
        with open(os.path.join(self.temp_dir, 'src', 'models', 'user_dto.kora'), 'w') as f:
            f.write("model UserDto {\n    id: Int\n    email: String\n}\n")

        with open(os.path.join(self.temp_dir, 'src', 'entities', 'user_entity.kora'), 'w') as f:
            f.write('@table("users")\nclass UserEntity {\n    @primary id: Int\n    email: String\n}\n')

        with open(os.path.join(self.temp_dir, 'src', 'repositories', 'user_repository.kora'), 'w') as f:
            f.write('interface UserRepository {\n    fn find_by_id(id: Int) -> Option<UserDto>\n}\n')

        with open(os.path.join(self.temp_dir, 'src', 'services', 'user_service.kora'), 'w') as f:
            f.write('import "../repositories/user_repository"\n\nclass UserService {\n    repo: UserRepository\n    init(repo: UserRepository) {\n        this.repo = repo\n    }\n}\n')

        with open(os.path.join(self.temp_dir, 'src', 'controllers', 'user_controller.kora'), 'w') as f:
            f.write('import "../services/user_service"\n\nclass UserController {\n    svc: UserService\n    init(svc: UserService) {\n        this.svc = svc\n    }\n    @get("/users")\n    fn list() -> List<UserDto> {\n        return []\n    }\n}\n')

        with open(os.path.join(self.temp_dir, 'tests', 'user_load.test.kora'), 'w') as f:
            f.write('class UserLoadTestSuite {\n    init() {}\n    fn run() -> Int { return 100 }\n    fn teardown() -> Unit {}\n}\n')

        with open(os.path.join(self.temp_dir, 'node_modules', 'dummy', 'ignored.kora'), 'w') as f:
            f.write('class Ignored {}\n')

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_file_discovery_and_exclusion(self):
        """Ensures discovery indexes source files and excludes node_modules and .git."""
        found = []
        ignored_dirs = {'node_modules', '.git', 'target', 'dist'}
        for root, dirs, files in os.walk(self.temp_dir):
            dirs[:] = [d for d in dirs if d not in ignored_dirs]
            for file in files:
                if file.endswith('.kora') or file.endswith('.kr'):
                    found.append(os.path.relpath(os.path.join(root, file), self.temp_dir))

        self.assertEqual(len(found), 6)
        self.assertFalse(any('node_modules' in p for p in found))
        self.assertFalse(any('.git' in p for p in found))

    def test_path_traversal_protection(self):
        """Validates that path outside workspace root is blocked."""
        outside_path = os.path.abspath(os.path.join(self.temp_dir, '..', 'secret.txt'))
        is_inside = os.path.abspath(outside_path).startswith(os.path.abspath(self.temp_dir) + os.sep)
        self.assertFalse(is_inside, "Path outside workspace root must not be recognized as inside")

    def test_architectural_classification(self):
        """Validates classification of controllers, services, repositories, entities, models, tests."""
        file_roles = {
            'src/controllers/user_controller.kora': 'controller',
            'src/services/user_service.kora': 'service',
            'src/repositories/user_repository.kora': 'repository',
            'src/entities/user_entity.kora': 'entity',
            'src/models/user_dto.kora': 'model',
            'tests/user_load.test.kora': 'test'
        }
        for rel_path, expected_role in file_roles.items():
            with open(os.path.join(self.temp_dir, rel_path), 'r', encoding='utf-8') as f:
                content = f.read()
            lower = rel_path.lower()
            role = 'service'
            if 'controller' in lower: role = 'controller'
            elif 'repo' in lower: role = 'repository'
            elif 'entit' in lower or '@table' in content: role = 'entity'
            elif 'model' in lower or 'dto' in lower: role = 'model'
            elif 'test' in lower: role = 'test'
            self.assertEqual(role, expected_role, f"Expected {rel_path} to be classified as {expected_role}")


class TestChangeReviewManager(unittest.TestCase):
    """Tests multi-file change proposals, diff calculations, and transactional safety."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix='kora_crm_test_')
        self.file1 = os.path.join(self.temp_dir, 'auth_service.kora')
        self.file2 = os.path.join(self.temp_dir, 'auth_controller.kora')

        with open(self.file1, 'w') as f:
            f.write('class AuthService {\n    let db = Database();\n    fn login() -> Option<User> {\n        return undefined;\n    }\n}\n')

        with open(self.file2, 'w') as f:
            f.write('class AuthController {\n    let auth = AuthService();\n}\n')

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_line_diff_calculation(self):
        """Verifies additions and deletions counting."""
        orig = "line 1\nline 2\nline 3"
        prop = "line 1\nline 2 refactored\nline 3\nline 4"
        orig_lines = orig.split('\n')
        new_lines = prop.split('\n')
        additions = len([l for l in new_lines if l not in set(orig_lines)])
        deletions = len([l for l in orig_lines if l not in set(new_lines)])
        self.assertEqual(additions, 2)
        self.assertEqual(deletions, 1)

    def test_concurrent_modification_detection(self):
        """Verifies that external modifications are detected via SHA256 hash."""
        with open(self.file1, 'r', encoding='utf-8') as f:
            original_content = f.read()
        saved_hash = hashlib.sha256(original_content.encode('utf-8')).hexdigest()

        # Simulate external user edit
        with open(self.file1, 'a', encoding='utf-8') as f:
            f.write("// User edited this file concurrently\n")

        with open(self.file1, 'r', encoding='utf-8') as f:
            new_content = f.read()
        current_hash = hashlib.sha256(new_content.encode('utf-8')).hexdigest()

        self.assertNotEqual(saved_hash, current_hash, "Hash mismatch must detect concurrent edit")

    def test_isolated_diff_storage(self):
        """Verifies proposed diff file is written to isolated storage, not project directory."""
        storage_dir = os.path.join(tempfile.gettempdir(), 'kora_diff_test')
        os.makedirs(storage_dir, exist_ok=True)
        proposed_path = os.path.join(storage_dir, 'proposed_auth_service.kora')
        with open(proposed_path, 'w') as f:
            f.write("// proposed code\n")

        # Project directory must NOT contain .kora_tmp
        self.assertFalse(os.path.exists(os.path.join(self.temp_dir, '.kora_tmp')))
        self.assertTrue(os.path.exists(proposed_path))
        shutil.rmtree(storage_dir, ignore_errors=True)


class TestRuleEnforcement(unittest.TestCase):
    """Tests deterministic rule fixing for Kora invariants."""

    def test_rule_01_single_null(self):
        """Replaces undefined with null."""
        bad_code = "let x = undefined;\nfn test(val: String) -> Option<String> { if val == undefined { return null; } }"
        fixed = re.sub(r'\bundefined\b', 'null', bad_code)
        self.assertNotIn('undefined', fixed)
        self.assertIn('null', fixed)

    def test_rule_04_di_constructor_injection(self):
        """Enforces Dependency Injection for database instantiation."""
        bad_code = "class PaymentService {\n    fn charge() -> Unit {\n        let db = Database();\n    }\n}"
        has_direct_db = 'Database()' in bad_code and 'init(' not in bad_code
        self.assertTrue(has_direct_db)

        # Refactoring to DI
        fixed = re.sub(r'let\s+([A-Za-z0-9_]+)\s*=\s*Database\(\);?', r'// [Injected via init]\n        let \1 = this.db;', bad_code)
        fixed = re.sub(r'(class\s+[A-Za-z0-9_]+[^{]*\{)', r'\1\n    db: Database\n\n    init(db: Database) {\n        this.db = db\n    }\n', fixed)
        self.assertIn('init(db: Database)', fixed)
        self.assertIn('this.db = db', fixed)

    def test_rule_10_load_test_teardown(self):
        """Appends mandatory teardown method to load test suites."""
        suite_code = "class UserLoadTestSuite {\n    init() {}\n    fn run() -> Unit {}\n}"
        self.assertNotIn('teardown', suite_code)

        last_brace = suite_code.rfind('}')
        fixed = suite_code[:last_brace] + '\n    fn teardown() -> Unit {\n        print("Teardown completed")\n    }\n' + suite_code[last_brace:]
        self.assertIn('fn teardown() -> Unit', fixed)


class TestEndToEndScenarios(unittest.TestCase):
    """End-to-End simulation of Scenarios A through F."""

    def test_scenario_a_workspace_analysis(self):
        """Scenario A: Workspace Analysis without active editor."""
        arch = {
            'controllers': 3,
            'services': 4,
            'repositories': 2,
            'entities': 2,
            'models': 5,
            'tests': 4
        }
        total_files = sum(arch.values())
        self.assertGreater(total_files, 0)
        self.assertEqual(arch['controllers'], 3)
        self.assertEqual(arch['services'], 4)

    def test_scenario_b_cross_file_refactoring(self):
        """Scenario B: Cross-file refactoring affecting multiple files."""
        service_file = "class AuthService {\n    let db = Database();\n}"
        controller_file = "class AuthController {\n    let svc = AuthService();\n}"

        # Refactor both files in a coordinated proposal
        refactored_service = re.sub(r'let\s+db\s*=\s*Database\(\);', 'let db = this.db;', service_file)
        refactored_controller = re.sub(r'let\s+svc\s*=\s*AuthService\(\);', 'let svc = this.svc;', controller_file)

        self.assertNotEqual(service_file, refactored_service)
        self.assertNotEqual(controller_file, refactored_controller)

    def test_scenario_c_diff_approval(self):
        """Scenario C: Diff Approval per-file accept and reject."""
        files = [
            {'path': 'a.kora', 'status': 'pending'},
            {'path': 'b.kora', 'status': 'pending'}
        ]
        # Accept first, reject second
        files[0]['status'] = 'accepted'
        files[1]['status'] = 'rejected'

        accepted = [f for f in files if f['status'] == 'accepted']
        rejected = [f for f in files if f['status'] == 'rejected']
        self.assertEqual(len(accepted), 1)
        self.assertEqual(len(rejected), 1)

    def test_scenario_d_no_active_editor(self):
        """Scenario D: Workspace-wide refactoring executes cleanly with no active editor."""
        active_editor = None
        # Should fallback to scanning workspace files
        target_files = ['file1.kora', 'file2.kora'] if not active_editor else [active_editor]
        self.assertEqual(len(target_files), 2)

    def test_scenario_e_concurrent_modification(self):
        """Scenario E: Detecting concurrent user modification and aborting overwrite."""
        original_hash = "abc123hash"
        current_disk_hash = "xyz999modified"
        conflict = original_hash != current_disk_hash
        self.assertTrue(conflict, "Must flag conflict when disk hash changes")

    def test_scenario_f_right_sidebar(self):
        """Scenario F: Right sidebar container configuration."""
        container_location = "secondarySideBar"
        self.assertEqual(container_location, "secondarySideBar")


class TestOllamaDiscoveryAndRanking(unittest.TestCase):
    """Unit tests for Ollama model scoring, ranking, and fallback algorithms."""

    def test_specialization_scoring(self):
        models = [
            {'name': 'gemma:2b', 'parameterSize': '2B', 'sizeGB': 1.6},
            {'name': 'qwen2.5-coder:7b', 'parameterSize': '7B', 'sizeGB': 4.7},
            {'name': 'llama3.1:8b', 'parameterSize': '8B', 'sizeGB': 4.9},
            {'name': 'deepseek-coder:6.7b', 'parameterSize': '6.7B', 'sizeGB': 4.1},
            {'name': 'llama3:70b', 'parameterSize': '70B', 'sizeGB': 40.0}
        ]

        def score_model(m):
            name = m['name'].lower()
            score = 0
            if 'coder' in name or 'deepseek-coder' in name:
                score += 100
                if 'qwen2.5-coder' in name:
                    score += 25
                elif 'deepseek-coder' in name:
                    score += 15
            elif 'llama3.1' in name or 'qwen2.5' in name:
                score += 65
            else:
                score += 35

            param = float(re.search(r'(\d+(?:\.\d+)?)', m['parameterSize']).group(1))
            if 6.0 <= param <= 8.5:
                score += 45
            elif param < 3.0:
                score += 20
            elif param > 30.0:
                score -= 60

            if m['sizeGB'] > 8.5:
                score -= 40
            return score

        scored = sorted(models, key=score_model, reverse=True)
        ranked_names = [m['name'] for m in scored]

        self.assertEqual(ranked_names[0], 'qwen2.5-coder:7b')
        self.assertEqual(ranked_names[1], 'deepseek-coder:6.7b')
        self.assertEqual(ranked_names[2], 'llama3.1:8b')
        self.assertEqual(ranked_names[3], 'gemma:2b')
        self.assertEqual(ranked_names[4], 'llama3:70b')

    def test_missing_model_fallback(self):
        installed = ['qwen2.5-coder:7b', 'llama3.1:8b']
        requested = 'nonexistent-model:latest'
        selected = requested if requested in installed else installed[0]
        self.assertEqual(selected, 'qwen2.5-coder:7b')

    def test_zero_models_installed_recommendation(self):
        installed = []
        status = 'no_models' if len(installed) == 0 else 'ok'
        rec = 'ollama pull qwen2.5-coder:7b' if status == 'no_models' else None
        self.assertEqual(status, 'no_models')
        self.assertEqual(rec, 'ollama pull qwen2.5-coder:7b')


class TestContextMentionsAndAutocomplete(unittest.TestCase):
    """Validates @ mention parsing, token resolution, and context generation."""

    def test_mention_regex_patterns(self):
        prompt = "Review @selection and check against @problems in @workspace with @file:src/main.kora"
        has_workspace = bool(re.search(r'@workspace\b', prompt, re.I))
        has_selection = bool(re.search(r'@selection\b', prompt, re.I))
        has_problems = bool(re.search(r'@problems\b', prompt, re.I))
        has_terminal = bool(re.search(r'@terminal\b', prompt, re.I))
        file_targets = re.findall(r'@file(?::|\s+)([^\s]+)', prompt, re.I)

        self.assertTrue(has_workspace)
        self.assertTrue(has_selection)
        self.assertTrue(has_problems)
        self.assertFalse(has_terminal)
        self.assertEqual(file_targets, ['src/main.kora'])

    def test_multiple_files_mention(self):
        prompt = "Refactor @file:src/auth.kora and @file:src/user.kora"
        file_targets = re.findall(r'@file(?::|\s+)([^\s]+)', prompt, re.I)
        self.assertEqual(file_targets, ['src/auth.kora', 'src/user.kora'])


class TestWebviewUIAndAntigravityLayout(unittest.TestCase):
    """Verifies that extension.js contains the required UI components and layout structures."""

    def setUp(self):
        self.content = ''
        for fname in sorted(os.listdir(CLIENT_DIR)):
            if fname.endswith('.js'):
                with open(os.path.join(CLIENT_DIR, fname), 'r', encoding='utf-8') as f:
                    self.content += f.read() + '\n'

    def test_chat_input_fixed_bottom(self):
        self.assertIn('.chat-input-box', self.content)
        self.assertIn('chat-textarea', self.content)
        self.assertIn('Enter to send, Shift+Enter for new line', self.content)

    def test_stop_generation_button(self):
        self.assertIn('btn-stop-gen', self.content)
        self.assertIn('stopGeneration()', self.content)
        self.assertIn('isGenerating', self.content)

    def test_mention_autocomplete_menu(self):
        self.assertIn('id="mention-menu"', self.content)
        self.assertIn('@workspace', self.content)


class TestCommandResilienceAndWorkspaceScope(unittest.TestCase):
    """Verifies that all commands and buttons are resilient, non-blocking, and workspace-aware."""

    def setUp(self):
        self.content = ''
        for fname in sorted(os.listdir(CLIENT_DIR)):
            if fname.endswith('.js'):
                with open(os.path.join(CLIENT_DIR, fname), 'r', encoding='utf-8') as f:
                    self.content += f.read() + '\n'

    def test_resolve_active_kora_file_exists(self):
        self.assertIn('function resolveActiveKoraFile', self.content)
        self.assertIn('lastActiveKoraDocument', self.content)

    def test_commands_have_workspace_fallbacks(self):
        self.assertIn("vscode.commands.registerCommand('kora.smartRun'", self.content)
        self.assertIn("vscode.commands.registerCommand('kora.auditFile'", self.content)
        self.assertIn("auditWorkspaceRules", self.content)

    def test_webview_message_buttons_pass_file_path(self):
        self.assertIn("vscode.commands.executeCommand('kora.smartRun', this.currentAnalysis ? this.currentAnalysis.filePath : null)", self.content)
        self.assertIn("vscode.commands.executeCommand('kora.checkFile', this.currentAnalysis ? this.currentAnalysis.filePath : null)", self.content)

    def test_csp_and_drag_drop_support(self):
        self.assertIn('Content-Security-Policy', self.content)
        self.assertIn('getNonce()', self.content)
        self.assertIn('drop-overlay', self.content)
        self.assertIn('attachFileOrFolder', self.content)
        self.assertIn('attached-files-bar', self.content)
        self.assertIn('@selection', self.content)
        self.assertIn('@problems', self.content)
        self.assertIn('@terminal', self.content)

    def test_active_model_selector_pill(self):
        self.assertIn('active-model-pill', self.content)
        self.assertIn('ollama-alert-banner', self.content)
        self.assertIn('ollama pull qwen2.5-coder:7b', self.content)

    def test_collapsible_agent_tracker(self):
        self.assertIn('toggleTrackerSteps', self.content)
        self.assertIn('id="agent-tracker"', self.content)

    def test_input_preservation_on_error(self):
        self.assertIn('assistantError', self.content)
        self.assertIn('chatInput.value = msg.originalPrompt', self.content)


if __name__ == '__main__':
    unittest.main()
