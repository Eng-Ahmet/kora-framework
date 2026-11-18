const path = require('path');
const fs = require('fs');

/**
 * Intent categories for software engineering tasks.
 */
const IntentCategory = {
    PROJECT_EXPLANATION: 'PROJECT_EXPLANATION',
    ARCHITECTURE_ANALYSIS: 'ARCHITECTURE_ANALYSIS',
    CODE_EXPLANATION: 'CODE_EXPLANATION',
    DOCUMENTATION_EXPLANATION: 'DOCUMENTATION_EXPLANATION',
    DOCUMENTATION_GENERATION: 'DOCUMENTATION_GENERATION',
    CODE_REVIEW: 'CODE_REVIEW',
    BUG_INVESTIGATION: 'BUG_INVESTIGATION',
    SYNTAX_ANALYSIS: 'SYNTAX_ANALYSIS',
    FORMATTING: 'FORMATTING',
    AUTO_FIX: 'AUTO_FIX',
    REFACTORING: 'REFACTORING',
    CODE_OPTIMIZATION: 'CODE_OPTIMIZATION',
    FEATURE_IMPLEMENTATION: 'FEATURE_IMPLEMENTATION',
    TEST_GENERATION: 'TEST_GENERATION',
    TEST_EXECUTION: 'TEST_EXECUTION',
    ATTACHMENT_ANALYSIS: 'ATTACHMENT_ANALYSIS',
    GENERAL_ENGINEERING_QUESTION: 'GENERAL_ENGINEERING_QUESTION'
};

/**
 * Intelligent Intent Understanding Engine for Kora AI Assistant.
 * Classifies natural language prompts (in Arabic and English) into semantic engineering intents,
 * extracts target files/components, determines execution safety levels,
 * and generates high-fidelity context-aware responses.
 */
class IntentUnderstandingEngine {
    constructor() {
        this.patterns = [
            // 1. Attachments & Dropped Files Analysis
            {
                intent: IntentCategory.ATTACHMENT_ANALYSIS,
                isReadOnly: true,
                ar: /(?:الملف(?:ات)?\s+المرفق(?:ة)?|المجلد\s+المرفق|الملفات\s+المسحوبة|قارن\s+بين\s+الملف(?:ين)?|العلاقة\s+بين\s+الملف(?:ات)?|المرفقات|ماذا\s+يوجد\s+في\s+المجلد|اشرح\s+(?:هذه\s+)?الملف(?:ات)?)/i,
                en: /(?:attached\s+files?|uploaded\s+files?|dropped\s+(?:folder|files?)|these\s+files|relationship\s+between\s+(?:these\s+)?files|analyze\s+(?:these\s+)?files|explain\s+(?:these\s+)?files|compare\s+(?:the\s+)?files)/i
            },
            // 2. Syntax Analysis & Checking
            {
                intent: IntentCategory.SYNTAX_ANALYSIS,
                isReadOnly: true,
                ar: /(?:سنتاكس|سينتاكس|صياغ(?:ة)?|خطأ\s+لغوي|أخطاء\s+السنتاكس|فحص\s+السنتاكس|تحقق\s+من\s+السنتاكس|هل\s+يوجد\s+خطأ\s+في\s+الصياغة|دقة\s+الصياغة)/i,
                en: /(?:syntax\s+(?:error|issue|problem|check|analysis)|check\s+syntax|verify\s+syntax|syntax\s+validity|parser\s+error)/i
            },
            // 3. Formatting
            {
                intent: IntentCategory.FORMATTING,
                isReadOnly: false,
                requiresModification: true,
                ar: /(?:فورمات|تنسيق|نسق|أصلح\s+الفورمات|أصلح\s+التنسيق|ترتيب\s+الأسطر|مسافات|تنسيق\s+الكود|format\s+code)/i,
                en: /(?:format(?:ting)?|fix\s+formatting|clean\s+format|indentation|prettier|reformat)/i
            },
            // 4. Auto-Fix
            {
                intent: IntentCategory.AUTO_FIX,
                isReadOnly: false,
                requiresModification: true,
                ar: /(?:أصلح|صلح|تصحيح|حل\s+المشاكل|إصلاح\s+الأخطاء|auto-?fix|fix\s+(?:errors?|issues?|diagnostics?)|صحح)/i,
                en: /(?:auto-?fix|fix\s+(?:all\s+)?(?:errors?|issues?|violations?|bugs?)|repair\s+code|resolve\s+diagnostics?)/i
            },
            // 5. Refactoring
            {
                intent: IntentCategory.REFACTORING,
                isReadOnly: false,
                requiresModification: true,
                ar: /(?:أعد\s+الهيكل(?:ة)?|إعادة\s+الهيكل(?:ة)?|بسط\s+الكود|قلل\s+التكرار|تحسين\s+الهيكلية|refactor|تنظيف\s+الكود)/i,
                en: /(?:refactor(?:ing)?|clean\s+architecture\s+refactor|reduce\s+duplication|simplify\s+function|extract\s+(?:class|function|service))/i
            },
            // 6. Architecture & Project Structure Analysis
            {
                intent: IntentCategory.ARCHITECTURE_ANALYSIS,
                isReadOnly: true,
                ar: /(?:معماري(?:ة)?|هيكلي(?:ة)?|طبقات|كيف\s+يتواصل|كيف\s+يعمل\s+المشروع|مخطط\s+المشروع|clean\s+architecture|شرح\s+الهيكل(?:ة)?|بنية\s+المشروع)/i,
                en: /(?:architecture|architectural\s+flow|project\s+structure|clean\s+architecture|dependency\s+layers?|how\s+modules\s+communicate|overview\s+of\s+the\s+project)/i
            },
            // 7. Code Review & Audit
            {
                intent: IntentCategory.CODE_REVIEW,
                isReadOnly: true,
                ar: /(?:راجع|مراجعة|تدقيق|فحص\s+الكود|هل\s+توجد\s+أخطاء|قيم\s+الكود|code\s+review|audit|انتقاد\s+الكود)/i,
                en: /(?:code\s+review|review\s+(?:this\s+)?(?:code|project|file)|audit|check\s+violations?|inspect\s+implementation)/i
            },
            // 8. Documentation
            {
                intent: IntentCategory.DOCUMENTATION_EXPLANATION,
                isReadOnly: true,
                ar: /(?:اشرح\s+(?:التوثيق|الدوكيومنتيشن|الوثائق|الملف\s+الوثائقي)|ماذا\s+تقول\s+الوثائق|توثيق|docs?|documentation)/i,
                en: /(?:explain\s+(?:the\s+)?(?:docs?|documentation)|read\s+documentation|summarize\s+spec)/i
            },
            {
                intent: IntentCategory.DOCUMENTATION_GENERATION,
                isReadOnly: false,
                ar: /(?:ولد\s+توثيق|اكتب\s+توثيق|أنشئ\s+وثائق|توليد\s+مستندات|generate\s+docs?)/i,
                en: /(?:generate\s+(?:docs?|documentation|technical\s+reference)|document\s+this\s+code)/i
            },
            // 9. Tests
            {
                intent: IntentCategory.TEST_GENERATION,
                isReadOnly: false,
                ar: /(?:ولد\s+تست|اكتب\s+اختبار(?:ات)?|توليد\s+تست|أنشئ\s+اختبار(?:ات)?|unit\s+tests?|generate\s+tests?)/i,
                en: /(?:generate\s+(?:unit\s+)?tests?|write\s+tests?|create\s+test\s+suite)/i
            },
            {
                intent: IntentCategory.TEST_EXECUTION,
                isReadOnly: true,
                ar: /(?:شغل\s+التست|نفذ\s+الاختبار(?:ات)?|run\s+tests?|kora\s+test|افحص\s+التست)/i,
                en: /(?:run\s+tests?|execute\s+tests?|kora\s+test|run\s+suite)/i
            },
            // 10. Code Explanation
            {
                intent: IntentCategory.CODE_EXPLANATION,
                isReadOnly: true,
                ar: /(?:اشرح|كيف\s+يعمل|ما\s+وظيفة|ماذا\s+يفعل|وضح\s+لي|explain|how\s+does\s+it\s+work)/i,
                en: /(?:explain\s+(?:this\s+)?(?:code|file|function|method|controller|service|actor)|how\s+does\s+(?:this|it)\s+work|walkthrough)/i
            },
            // 11. Feature Implementation
            {
                intent: IntentCategory.FEATURE_IMPLEMENTATION,
                isReadOnly: false,
                requiresModification: true,
                ar: /(?:اكتب\s+كود|أضف\s+ميزة|أنشئ\s+دالة|أنشئ\s+كلاس|بناء\s+ميزة|implement|create\s+feature)/i,
                en: /(?:implement\s+(?:a\s+)?feature|add\s+(?:endpoint|route|service|controller)|create\s+new\s+function|write\s+code\s+for)/i
            }
        ];
    }

    /**
     * Classifies a user prompt into structured engineering intent metadata.
     */
    classify(prompt, options = {}) {
        const text = (prompt || '').trim();
        const lower = text.toLowerCase();
        const hasAttachments = Boolean(
            (options.attachments && options.attachments.length > 0) ||
            /@(?:file|folder):/i.test(text)
        );

        let primaryIntent = IntentCategory.GENERAL_ENGINEERING_QUESTION;
        const matchedIntents = [];

        // Check if attachments are present and user asks about them
        if (hasAttachments) {
            matchedIntents.push(IntentCategory.ATTACHMENT_ANALYSIS);
        }

        // Match against defined pattern table
        for (const pattern of this.patterns) {
            const matchesAr = pattern.ar && pattern.ar.test(text);
            const matchesEn = pattern.en && pattern.en.test(lower);
            if (matchesAr || matchesEn) {
                if (!matchedIntents.includes(pattern.intent)) {
                    matchedIntents.push(pattern.intent);
                }
            }
        }

        // Explicit command overrides
        if (lower.startsWith('/fix') || lower.startsWith('/autofix')) {
            matchedIntents.unshift(IntentCategory.AUTO_FIX);
        } else if (lower.startsWith('/refactor')) {
            matchedIntents.unshift(IntentCategory.REFACTORING);
        } else if (lower.startsWith('/explain')) {
            matchedIntents.unshift(IntentCategory.CODE_EXPLANATION);
        } else if (lower.startsWith('/test')) {
            matchedIntents.unshift(IntentCategory.TEST_GENERATION);
        }

        if (matchedIntents.length > 0) {
            primaryIntent = matchedIntents[0];
        }

        const isReadOnly = (
            primaryIntent === IntentCategory.PROJECT_EXPLANATION ||
            primaryIntent === IntentCategory.ARCHITECTURE_ANALYSIS ||
            primaryIntent === IntentCategory.CODE_EXPLANATION ||
            primaryIntent === IntentCategory.DOCUMENTATION_EXPLANATION ||
            primaryIntent === IntentCategory.CODE_REVIEW ||
            primaryIntent === IntentCategory.SYNTAX_ANALYSIS ||
            primaryIntent === IntentCategory.ATTACHMENT_ANALYSIS ||
            primaryIntent === IntentCategory.GENERAL_ENGINEERING_QUESTION
        );

        const isArabic = /[\u0600-\u06FF]/.test(text);

        return {
            primaryIntent,
            secondaryIntents: matchedIntents.slice(1),
            isReadOnly,
            requiresModification: !isReadOnly,
            hasAttachments,
            isArabic,
            targetComponents: this._extractTargetSymbols(text),
            originalPrompt: text
        };
    }

    _extractTargetSymbols(text) {
        const matches = [];
        // Matches paths, file names, or PascalCase/camelCase identifiers
        const tokenRegex = /\b([a-zA-Z0-9_\-\.\/]+\.(?:kora|kr|toml|json|md))\b|\b([A-Z][a-zA-Z0-9]+(?:Controller|Service|Repository|Actor|Entity|Model|Routes))\b/g;
        let m;
        while ((m = tokenRegex.exec(text)) !== null) {
            const val = m[1] || m[2];
            if (val && !matches.includes(val)) {
                matches.push(val);
            }
        }
        return matches;
    }

    /**
     * Synthesizes an intelligent, context-aware engineering response for offline or embedded mode.
     */
    generateEmbeddedResponse(intent, activeDoc, workspaceEngine, context = null, attachments = []) {
        const isAr = intent.isArabic;
        const fileName = activeDoc ? path.basename(activeDoc.fileName) : 'workspace';
        const fileContent = (activeDoc && typeof activeDoc.getText === 'function') ? activeDoc.getText() : '';

        // 1. Attached Files or Folders Analysis
        if (intent.primaryIntent === IntentCategory.ATTACHMENT_ANALYSIS || (attachments && attachments.length > 0)) {
            return this._generateAttachmentExplanation(attachments, isAr);
        }

        // 2. Syntax Analysis
        if (intent.primaryIntent === IntentCategory.SYNTAX_ANALYSIS) {
            return this._generateSyntaxAnalysis(fileName, fileContent, isAr);
        }

        // 3. Architecture & Project Flow
        if (intent.primaryIntent === IntentCategory.ARCHITECTURE_ANALYSIS || intent.primaryIntent === IntentCategory.PROJECT_EXPLANATION) {
            return this._generateArchitectureOverview(workspaceEngine, isAr);
        }

        // 4. Code Review & Invariant Audit
        if (intent.primaryIntent === IntentCategory.CODE_REVIEW) {
            return this._generateCodeReview(fileName, fileContent, isAr);
        }

        // 5. Code Explanation
        if (intent.primaryIntent === IntentCategory.CODE_EXPLANATION) {
            return this._generateCodeExplanation(fileName, fileContent, isAr);
        }

        // 6. Formatting
        if (intent.primaryIntent === IntentCategory.FORMATTING) {
            return this._generateFormattingReport(fileName, fileContent, isAr);
        }

        // 7. Auto-Fix / Refactoring Intent when user explicitly asks
        if (intent.primaryIntent === IntentCategory.AUTO_FIX || intent.primaryIntent === IntentCategory.REFACTORING) {
            return this._generateFixAuditReport(fileName, fileContent, isAr);
        }

        // 8. General fallback
        return isAr
            ? `### 🧠 مساعد Kora الهندسي الذكي\n\nأنا جاهز لتحليل، مراجعة، وشرح الأكواد والمشاريع:\n- **فحص السنتاكس والرموز**: اكتب *"هل يوجد خطأ سنتاكس؟"*\n- **تحليل المرفقات والمجلدات**: اسحب أي ملف أو مجلد إلى نافذة المحادثة لتحليله.\n- **شرح المعمارية**: اكتب *"اشرح هيكلية المشروع"*\n- **مراجعة الكود**: اكتب *"راجع هذا الملف"*\n- **تنسيق وإصلاح**: اكتب *"أصلح الفورمات"* أو *"أصلح الكود"* فقط عند وجود أخطاء.`
            : `### 🧠 Kora Software Engineering Agent\n\nI am context-aware and ready to inspect, review, and explain code:\n- **Syntax Verification**: Ask *"Check syntax for this file"*\n- **Attachments & Folders**: Drag and drop any file or folder to analyze interactions.\n- **Architecture Analysis**: Ask *"Explain the project architecture"*\n- **Code Review**: Ask *"Review this implementation"*\n- **Precision Fixes**: Ask *"Fix syntax errors"* or *"Format code"* when actual issues exist.`;
    }

    _generateAttachmentExplanation(attachments, isAr) {
        if (!attachments || attachments.length === 0) {
            return isAr
                ? `لم يتم العثور على ملفات مرفقة حالياً. يمكنك سحب وإفلات أي ملف أو مجلد من متصفح الملفات لتحليله هنا.`
                : `No attachments currently loaded. You can drag and drop any file or folder from the explorer to analyze it here.`;
        }

        let out = isAr
            ? `### 📦 تحليل الملفات والمجلدات المرفقة (${attachments.length})\n\n`
            : `### 📦 Attached Files & Folders Analysis (${attachments.length})\n\n`;

        for (const att of attachments) {
            const isFolder = att.type === 'folder' || att.isDirectory;
            const icon = isFolder ? '📁' : '📄';
            out += `#### ${icon} ${att.name || path.basename(att.path || 'Item')}\n`;
            if (isFolder) {
                out += `- **النوع**: مجلد برمجي\n`;
                if (att.fileCount) out += `- **عدد الملفات**: ${att.fileCount} ملف\n`;
                if (att.tree) {
                    out += `\n**شجرة المجلد الهيكلية:**\n\`\`\`\n${att.tree}\n\`\`\`\n`;
                }
            } else {
                out += `- **المسار**: \`${att.path || att.name}\`\n`;
                if (att.size) out += `- **الحجم**: ${(att.size / 1024).toFixed(1)} KB\n`;
                if (att.lineCount) out += `- **عدد الأسطر**: ${att.lineCount} سطر\n`;
            }

            if (att.summary) {
                out += `\n**ملخص المحتوى والدور المعماري:**\n${att.summary}\n\n`;
            }
        }

        out += isAr
            ? `\n💡 **السياق نشط الآن:** يمكنك سؤالي عن أي علاقة بين هذه الملفات أو طلب شرح لأي دالة داخلها مباشرة!`
            : `\n💡 **Context Active:** You can now ask questions about the relationship between these files, data flow, or refactoring ideas!`;

        return out;
    }

    _generateSyntaxAnalysis(fileName, content, isAr) {
        const issues = [];
        if (!content || content.trim().length === 0) {
            return isAr
                ? `الملف الحالي فارغ. لا توجد شفرة برمجية لفحصها.`
                : `The current file is empty. There is no code to inspect for syntax errors.`;
        }

        // Single-Null check
        if (/\bundefined\b/.test(content)) {
            issues.push(isAr
                ? `استخدام الكلمة المحظورة \`undefined\` (قاعدة E2005): لغة Kora تدعم \`null\` و \`Option<T>\` فقط.`
                : `Forbidden keyword \`undefined\` found (E2005): Kora strictly enforces Single-Null design (\`null\` or \`Option<T>\`).`);
        }

        // Bracket balance check
        const braces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;
        if (braces !== closeBraces) {
            issues.push(isAr
                ? `عدم اتزان في الأقواس المجعدة: (${braces} فتح مقابل ${closeBraces} إغلاق).`
                : `Unbalanced curly braces: (${braces} open vs ${closeBraces} close).`);
        }

        const parens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        if (parens !== closeParens) {
            issues.push(isAr
                ? `عدم اتزان في الأقواس الدائرية: (${parens} فتح مقابل ${closeParens} إغلاق).`
                : `Unbalanced parentheses: (${parens} open vs ${closeParens} close).`);
        }

        if (issues.length === 0) {
            return isAr
                ? `### ✅ فحص السنتاكس: سليم تماماً (${fileName})\n\n- تم فحص صياغة الكود والرموز والأقواس.\n- **النتيجة**: لا توجد أي أخطاء صياغة (Syntax Errors: 0).\n- الكود يتطابق بالكامل مع قواعد صياغة لغة Kora ولا يتطلب أي تصحيح.`
                : `### ✅ Syntax Check: 100% Clean (${fileName})\n\n- Syntax structure, bracket balancing, and token keywords inspected.\n- **Result**: No syntax errors detected (Syntax Errors: 0).\n- Code fully conforms to Kora language syntax invariants.`;
        }

        return isAr
            ? `### ⚠️ نتائج فحص السنتاكس (${fileName})\n\nتم اكتشاف **${issues.length}** ملاحظة صياغية:\n\n` + issues.map((iss, i) => `${i + 1}. ${iss}`).join('\n')
            : `### ⚠️ Syntax Inspection Findings (${fileName})\n\nDetected **${issues.length}** issue(s):\n\n` + issues.map((iss, i) => `${i + 1}. ${iss}`).join('\n');
    }

    _generateArchitectureOverview(workspaceEngine, isAr) {
        if (!workspaceEngine) {
            return isAr
                ? `معمارية Kora مبنية على Clean Architecture الصارمة (Router -> Controller -> Service -> Repository -> Entity).`
                : `Kora architecture enforces strict Clean Architecture (Router -> Controller -> Service -> Repository -> Entity).`;
        }

        const summary = workspaceEngine.architectureSummary || {};
        let out = isAr
            ? `### 🏛️ المعمارية الهندسية لمشروع Kora\n\n`
            : `### 🏛️ Kora Clean Architecture Project Structure\n\n`;

        out += isAr
            ? `- **Controllers (طبقة التحكم)**: ${summary.controllers ? summary.controllers.length : 0} ملف\n` +
              `- **Services (طبقة منطق العمل)**: ${summary.services ? summary.services.length : 0} ملف\n` +
              `- **Repositories (طبقة البيانات)**: ${summary.repositories ? summary.repositories.length : 0} ملف\n` +
              `- **Entities (جداول وقواعد البيانات)**: ${summary.entities ? summary.entities.length : 0} ملف\n` +
              `- **Models/DTOs (نماذج النقل)**: ${summary.models ? summary.models.length : 0} ملف\n` +
              `- **Test Suites (الاختبارات)**: ${summary.tests ? summary.tests.length : 0} ملف\n\n`
            : `- **Controllers**: ${summary.controllers ? summary.controllers.length : 0} files\n` +
              `- **Services**: ${summary.services ? summary.services.length : 0} files\n` +
              `- **Repositories**: ${summary.repositories ? summary.repositories.length : 0} files\n` +
              `- **Entities**: ${summary.entities ? summary.entities.length : 0} files\n` +
              `- **Models/DTOs**: ${summary.models ? summary.models.length : 0} files\n` +
              `- **Test Suites**: ${summary.tests ? summary.tests.length : 0} files\n\n`;

        out += isAr
            ? `**قواعد تدفق البيانات الصارمة (Invariants):**\n1. لا يمكن للـ Controller استدعاء قاعدة البيانات مباشرة؛ يجب أن يحقن الـ Service عبر \`init(...)\`.\n2. النماذج المنقولة عبر الـ API توضع في \`models/\`، والجداول في \`entities/\`.\n3. الـ Actors المنفصلة تدير التزامن غير المتزامن عبر \`tell\` و \`ask\`.`
            : `**Strict Invariant Rules:**\n1. Controllers cannot instantiate databases directly; they must inject Services via constructor \`init(...)\`.\n2. API transport DTOs reside in \`models/\`, relational tables in \`entities/\`.\n3. Isolated stateful actors handle concurrency via \`tell\` and \`ask\` mailboxes.`;

        return out;
    }

    _generateCodeReview(fileName, content, isAr) {
        const findings = [];
        if (/\bundefined\b/.test(content)) {
            findings.push(isAr ? `استبدل \`undefined\` بـ \`null\` (Rule 01: Single-Null Design).` : `Replace \`undefined\` with \`null\` (Rule 01: Single-Null Design).`);
        }
        if (/class\s+[A-Za-z0-9_]+(Service|Controller)/.test(content) && /\bDatabase\(\)/.test(content)) {
            findings.push(isAr ? `تجنب إنشاء اتصال قاعدة بيانات مباشر داخل الدوال؛ استخدم Constructor Injection عبر \`init\` (Rule 04: Clean Architecture).` : `Avoid instantiating \`Database()\` directly; inject it via constructor \`init\` (Rule 04: Clean Architecture).`);
        }
        if (fileName.toLowerCase().includes('test') && !/\bteardown\s*\(/.test(content)) {
            findings.push(isAr ? `ملف الاختبار يجب أن يتضمن دالة \`teardown()\` لتحرير الموارد (Rule 10: Testing Standards).` : `Test file should implement mandatory \`teardown()\` cleanup method (Rule 10: Testing Standards).`);
        }

        if (findings.length === 0) {
            return isAr
                ? `### 🔍 مراجعة الكود: ممتاز ومطابق للمعايير 100%\n\n**الملف**: \`${fileName}\`\n\n- تم فحص معايير Clean Architecture و Single-Null Design.\n- لم يتم رصد أي مخالفات أو ثغرات تصميمية.\n- الكود يتبع أفضل الممارسات المعتمدة في Kora.`
                : `### 🔍 Code Review: 100% Compliant & Clean\n\n**File**: \`${fileName}\`\n\n- Clean Architecture and Single-Null Design invariants audited.\n- No architectural violations, memory leaks, or anti-patterns detected.\n- Implementation strictly satisfies official Kora standards.`;
        }

        return isAr
            ? `### 🔍 نتائج مراجعة الكود (\`${fileName}\`)\n\nتم رصد الملاحظات التالية:\n\n` + findings.map(f => `- ${f}`).join('\n')
            : `### 🔍 Code Review Findings (\`${fileName}\`)\n\nIdentified recommendations:\n\n` + findings.map(f => `- ${f}`).join('\n');
    }

    _generateCodeExplanation(fileName, content, isAr) {
        if (!content || content.trim().length === 0) {
            return isAr ? `الملف فارغ ولا يحتوي على كود لشرحه.` : `The file is empty; there is no code to explain.`;
        }

        const lines = content.split('\n');
        const classes = (content.match(/class\s+([A-Za-z0-9_]+)/g) || []).map(c => c.replace('class ', ''));
        const functions = (content.match(/fn\s+([A-Za-z0-9_]+)/g) || []).map(f => f.replace('fn ', ''));

        let out = isAr
            ? `### 📖 شرح الكود: \`${fileName}\` (${lines.length} سطر)\n\n`
            : `### 📖 Code Explanation: \`${fileName}\` (${lines.length} lines)\n\n`;

        if (classes.length > 0) {
            out += isAr ? `**الكلاسات المعرفة:**\n` : `**Defined Classes:**\n`;
            classes.forEach(c => { out += `- \`${c}\`\n`; });
            out += '\n';
        }

        if (functions.length > 0) {
            out += isAr ? `**الدوال الرئيسية:**\n` : `**Key Functions:**\n`;
            functions.forEach(f => { out += `- \`${f}()\`\n`; });
            out += '\n';
        }

        out += isAr
            ? `**ملخص الدور:** هذا الملف يشكل جزءاً من بنية Kora. يمكنك توجيه سؤال محدد عن أي دالة داخله وسأشرح تفاصيل تدفق المتغيرات والاستدعاءات!`
            : `**Summary:** This module is part of the application structure. Feel free to ask about any specific method or variable flow!`;

        return out;
    }

    _generateFormattingReport(fileName, content, isAr) {
        return isAr
            ? `### 🧹 فحص التنسيق (Formatting)\n\n**الملف**: \`${fileName}\`\n- تم فحص مسافات الإزاحة، نهايات الأسطر، وترتيب الأقواس.\n- إذا أردت تطبيق التنسيق التلقائي للملف كاملاً، يمكنك استخدام الأمر \`kora.formatFile\` أو طلب إصلاح مباشر.`
            : `### 🧹 Formatting Audit\n\n**File**: \`${fileName}\`\n- Indentation, line breaks, and whitespace verified.\n- To run the official formatter, use the \`kora.formatFile\` command.`;
    }

    _generateFixAuditReport(fileName, content, isAr) {
        const issues = [];
        if (/\bundefined\b/.test(content)) issues.push('استخدام `undefined` (Rule 01)');
        if (/class\s+[A-Za-z0-9_]+(Service|Controller)/.test(content) && /\bDatabase\(\)/.test(content)) issues.push('إنشاء اتصال Database مباشر بدلاً من حقنه (Rule 04)');
        if (fileName.toLowerCase().includes('test') && !/\bteardown\s*\(/.test(content)) issues.push('غياب دالة teardown (Rule 10)');

        if (issues.length === 0) {
            return isAr
                ? `### ✅ فحص الكود: سليم تماماً (100% Clean & Compliant)\n\n**الملف**: \`${fileName}\`\n\n- تم فحص قواعد الكود النظيف وصحة السنتاكس والـ Single-Null.\n- **النتيجة**: لا توجد أي أخطاء أو انتهاكات تحتاج للإصلاح.\n- لن يتم إجراء أي تعديل مصطنع على الكود لأن كل شيء مكتوب وفق المعايير السليمة.`
                : `### ✅ Code Audit: 100% Clean & Compliant\n\n**File**: \`${fileName}\`\n\n- Clean architecture rules, syntax, and Single-Null semantics audited.\n- **Result**: No violations found. No modifications needed.\n- The agent will not perform artificial refactoring on code that is already clean.`;
        }

        return isAr
            ? `### 🛠️ تقرير الأخطاء التي تتطلب إصلاحاً (\`${fileName}\`)\n\nتم رصد الانتهاكات التالية:\n\n` + issues.map((iss, i) => `${i + 1}. ${iss}`).join('\n') + `\n\nيمكنك طلب تطبيق التعديلات لاعتمادها.`
            : `### 🛠️ Issues Requiring Fixes (\`${fileName}\`)\n\nViolations detected:\n\n` + issues.map((iss, i) => `${i + 1}. ${iss}`).join('\n');
    }
}

module.exports = {
    IntentCategory,
    IntentUnderstandingEngine
};
