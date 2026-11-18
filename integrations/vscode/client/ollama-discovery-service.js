const http = require('http');
const https = require('https');
const os = require('os');

/**
 * Intelligent Ollama Model Discovery & Selection Service for Kora.
 * Discovers installed models, inspects capabilities via /api/show,
 * evaluates hardware budget (RAM, CPU), ranks models by programming capability,
 * and handles intelligent fallbacks without hardcoded defaults.
 */
class OllamaDiscoveryService {
    constructor(endpoint = 'http://localhost:11434') {
        this.endpoint = this._normalizeEndpoint(endpoint);
        this.cachedModels = null;
        this.cacheTimestamp = 0;
        this.cacheTtlMs = 30000; // 30s cache
        this.inspectedModelDetails = new Map(); // modelName -> details
        this.manualModel = null;
        this.selectionMode = 'auto'; // 'auto' | 'manual'
    }

    _normalizeEndpoint(endpoint) {
        let ep = endpoint || 'http://localhost:11434';
        if (!ep.startsWith('http://') && !ep.startsWith('https://')) {
            ep = 'http://' + ep;
        }
        return ep.replace(/\/+$/, '');
    }

    setEndpoint(endpoint) {
        this.endpoint = this._normalizeEndpoint(endpoint);
        this.invalidateCache();
    }

    setSelectionMode(mode, modelName = null) {
        this.selectionMode = mode;
        if (mode === 'manual' && modelName) {
            this.manualModel = modelName;
        } else if (mode === 'auto') {
            this.manualModel = null;
        }
    }

    invalidateCache() {
        this.cachedModels = null;
        this.cacheTimestamp = 0;
        this.inspectedModelDetails.clear();
    }

    /**
     * Checks if the Ollama server is running and accessible.
     */
    async checkServerStatus(customEndpoint = null) {
        const ep = customEndpoint ? this._normalizeEndpoint(customEndpoint) : this.endpoint;
        return new Promise((resolve) => {
            let urlObj;
            try {
                urlObj = new URL(ep + '/api/tags');
            } catch (e) {
                return resolve({ online: false, error: 'Invalid URL format: ' + ep });
            }

            const client = urlObj.protocol === 'https:' ? https : http;
            const req = client.get(urlObj, (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ online: true, statusCode: res.statusCode });
                } else {
                    resolve({ online: false, statusCode: res.statusCode, error: `HTTP ${res.statusCode}` });
                }
            });

            req.on('error', (err) => {
                resolve({ online: false, error: err.message });
            });

            req.setTimeout(3000, () => {
                req.destroy();
                resolve({ online: false, error: 'Connection timed out (3s)' });
            });
        });
    }

    /**
     * Fetches all installed models from GET /api/tags
     */
    async listInstalledModels(customEndpoint = null, forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && this.cachedModels && (now - this.cacheTimestamp < this.cacheTtlMs)) {
            return this.cachedModels;
        }

        const ep = customEndpoint ? this._normalizeEndpoint(customEndpoint) : this.endpoint;

        return new Promise((resolve, reject) => {
            let urlObj;
            try {
                urlObj = new URL(ep + '/api/tags');
            } catch (e) {
                return reject(new Error('Invalid Ollama endpoint: ' + ep));
            }

            const client = urlObj.protocol === 'https:' ? https : http;
            const req = client.get(urlObj, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        return reject(new Error(`Ollama API error: HTTP ${res.statusCode}`));
                    }
                    try {
                        const json = JSON.parse(data);
                        const models = (json && Array.isArray(json.models)) ? json.models : [];
                        const normalized = models.map(m => {
                            const details = m.details || {};
                            return {
                                name: m.name || m.model,
                                tag: (m.name && m.name.includes(':')) ? m.name.split(':')[1] : 'latest',
                                sizeBytes: m.size || 0,
                                sizeGB: Number(((m.size || 0) / (1024 * 1024 * 1024)).toFixed(2)),
                                parameterSize: details.parameter_size || this._inferParamSizeFromName(m.name),
                                quantization: details.quantization_level || 'unknown',
                                family: details.family || 'unknown',
                                modifiedAt: m.modified_at || ''
                            };
                        });

                        this.cachedModels = normalized;
                        this.cacheTimestamp = Date.now();
                        resolve(normalized);
                    } catch (err) {
                        reject(new Error('Failed to parse Ollama /api/tags response: ' + err.message));
                    }
                });
            });

            req.on('error', (err) => reject(err));
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Timeout retrieving installed models from Ollama'));
            });
        });
    }

    /**
     * Inspects a specific model via POST /api/show to retrieve capabilities
     */
    async inspectModel(modelName, customEndpoint = null) {
        if (this.inspectedModelDetails.has(modelName)) {
            return this.inspectedModelDetails.get(modelName);
        }

        const ep = customEndpoint ? this._normalizeEndpoint(customEndpoint) : this.endpoint;
        return new Promise((resolve) => {
            let urlObj;
            try {
                urlObj = new URL(ep + '/api/show');
            } catch (e) {
                return resolve(null);
            }

            const postData = JSON.stringify({ name: modelName });
            const client = urlObj.protocol === 'https:' ? https : http;
            const req = client.request(urlObj, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const capabilities = Array.isArray(json.capabilities) ? json.capabilities : [];
                        const info = {
                            capabilities,
                            hasTools: capabilities.includes('tools') || capabilities.includes('tool_call'),
                            hasCompletion: capabilities.includes('completion'),
                            parameters: json.parameters || '',
                            template: json.template || '',
                            details: json.details || {}
                        };
                        this.inspectedModelDetails.set(modelName, info);
                        resolve(info);
                    } catch (e) {
                        resolve(null);
                    }
                });
            });

            req.on('error', () => resolve(null));
            req.setTimeout(4000, () => {
                req.destroy();
                resolve(null);
            });
            req.write(postData);
            req.end();
        });
    }

    _inferParamSizeFromName(name) {
        if (!name) return 'unknown';
        const match = name.toLowerCase().match(/(\d+(?:\.\d+)?)[bB]/);
        return match ? (match[1] + 'B') : 'unknown';
    }

    _parseNumericParams(paramStr) {
        if (!paramStr || paramStr === 'unknown') return 3.0;
        const match = String(paramStr).match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : 3.0;
    }

    /**
     * Determines system hardware profile (RAM, CPU).
     */
    getHardwareProfile() {
        const totalMemBytes = os.totalmem();
        const totalMemGB = Number((totalMemBytes / (1024 * 1024 * 1024)).toFixed(1));
        const freeMemGB = Number((os.freemem() / (1024 * 1024 * 1024)).toFixed(1));
        const cpuCores = os.cpus() ? os.cpus().length : 4;

        // Determine profile tier
        let tier = 'balanced'; // 16GB target
        let maxModelSizeGB = 8.5; // Up to 7B-8B Q4 models comfortably in memory

        if (totalMemGB < 10) {
            tier = 'low'; // 8GB RAM
            maxModelSizeGB = 4.2; // 1.5B-3B models
        } else if (totalMemGB >= 24) {
            tier = 'high'; // 32GB+ RAM
            maxModelSizeGB = 18.0; // 14B-32B models
        }

        return {
            totalMemGB,
            freeMemGB,
            cpuCores,
            tier,
            maxModelSizeGB
        };
    }

    /**
     * Ranks installed models according to programming specialization, parameter size,
     * tool calling support, and hardware constraints.
     */
    rankModels(models, task = 'chat', hardwareProfile = null) {
        const hw = hardwareProfile || this.getHardwareProfile();
        if (!models || models.length === 0) return [];

        const scored = models.map(model => {
            const nameLower = model.name.toLowerCase();
            const paramNum = this._parseNumericParams(model.parameterSize);
            let score = 0;
            let category = 'General-Purpose';

            // 1. Coding Specialization (Weight: ~35%)
            const isSpecializedCoder = (
                nameLower.includes('coder') ||
                nameLower.includes('codegemma') ||
                nameLower.includes('deepseek-coder') ||
                nameLower.includes('codellama') ||
                nameLower.includes('starcoder') ||
                nameLower.includes('devstral') ||
                nameLower.includes('granite-code') ||
                nameLower.includes('wizardcoder')
            );

            const isAgenticModel = (
                nameLower.includes('qwen3') ||
                nameLower.includes('qwen2.5') ||
                nameLower.includes('llama3.3') ||
                nameLower.includes('llama3.1') ||
                nameLower.includes('mistral-nemo')
            );

            if (isSpecializedCoder) {
                category = 'Specialized Coding';
                score += 100;
                // Extra bonus for state-of-the-art coding families
                if (nameLower.includes('qwen2.5-coder') || nameLower.includes('qwen3-coder')) {
                    score += 25;
                } else if (nameLower.includes('deepseek-coder')) {
                    score += 15;
                }
            } else if (isAgenticModel) {
                category = 'Coding-Capable Agent';
                score += 65;
            } else {
                category = 'General-Purpose';
                score += 35;
            }

            // 2. Hardware and Parameter Fit (Weight: ~25%)
            if (hw.tier === 'low') {
                // 8GB RAM: 1.5B–3B is ideal
                if (paramNum >= 1.0 && paramNum <= 3.5) score += 40;
                else if (paramNum <= 7.5) score += 15;
                else score -= 50; // Too heavy for 8GB
            } else if (hw.tier === 'balanced') {
                // 16GB RAM (Target): 7B–8B is the sweet spot
                if (paramNum >= 6.0 && paramNum <= 8.5) score += 45;
                else if (paramNum >= 3.0 && paramNum < 6.0) score += 35;
                else if (paramNum < 3.0) score += 20;
                else if (paramNum > 8.5 && paramNum <= 14.5) score += 10;
                else score -= 60; // 32B+ too slow on 16GB CPU
            } else {
                // High resource (32GB+)
                if (paramNum >= 12.0 && paramNum <= 34.0) score += 45;
                else if (paramNum >= 7.0) score += 35;
                else score += 20;
            }

            // Check physical file size vs hardware memory budget
            if (model.sizeGB > hw.maxModelSizeGB) {
                score -= 40; // Exceeds safe CPU inference allocation
            }

            // 3. Task-Specific Adjustments (Weight: ~25%)
            if (task === 'agent') {
                // Prefer models known to support structured tool calls
                if (nameLower.includes('qwen2.5') || nameLower.includes('qwen3') || nameLower.includes('devstral') || nameLower.includes('llama3.1')) {
                    score += 20;
                }
            } else if (task === 'autocomplete') {
                // Autocomplete prioritizes sub-second latency
                if (paramNum <= 3.5) score += 30;
                else if (paramNum <= 7.5) score += 10;
                else score -= 30;
            }

            return {
                ...model,
                score,
                category,
                suitability: score >= 120 ? 'Optimal' : (score >= 80 ? 'Good' : 'Acceptable')
            };
        });

        // Sort descending by score
        scored.sort((a, b) => b.score - a.score);
        return scored;
    }

    /**
     * Resolves the best available Ollama model for the given task.
     * Automatically handles fallbacks if a requested model is missing.
     */
    async resolveBestModel(task = 'chat', requestedModel = null, customEndpoint = null) {
        const ep = customEndpoint ? this._normalizeEndpoint(customEndpoint) : this.endpoint;

        // 1. Check server health
        const status = await this.checkServerStatus(ep);
        if (!status.online) {
            return {
                success: false,
                status: 'server_unreachable',
                error: `Ollama server is unreachable at ${ep}. Make sure Ollama is installed and running ('ollama serve').`,
                message: `Ollama server is unreachable at ${ep}. Make sure Ollama is running.`,
                selectedModel: null,
                model: null
            };
        }

        // 2. Discover installed models
        let installedModels = [];
        try {
            installedModels = await this.listInstalledModels(ep);
        } catch (err) {
            return {
                success: false,
                status: 'discovery_error',
                error: `Failed to discover Ollama models: ${err.message}`,
                message: `Failed to discover Ollama models: ${err.message}`,
                selectedModel: null,
                model: null
            };
        }

        // 3. Zero models installed check
        if (installedModels.length === 0) {
            return {
                success: false,
                status: 'no_models',
                error: 'Ollama is running, but no local models are installed.',
                message: 'No models found installed in Ollama. Please run: ollama pull qwen2.5-coder:7b',
                recommendation: 'ollama pull qwen2.5-coder:7b',
                suggestedCommand: 'ollama pull qwen2.5-coder:7b',
                selectedModel: null,
                model: null
            };
        }

        const hw = this.getHardwareProfile();
        const ranked = this.rankModels(installedModels, task, hw);

        // 4. Handle manual selection
        const targetModel = requestedModel || (this.selectionMode === 'manual' ? this.manualModel : null);
        if (targetModel && targetModel !== 'default' && targetModel !== 'auto') {
            const foundExact = installedModels.find(m => m.name === targetModel || m.name.startsWith(targetModel + ':') || targetModel.startsWith(m.name + ':'));
            if (foundExact) {
                return {
                    success: true,
                    status: 'exact',
                    selectedModel: foundExact.name,
                    model: foundExact.name,
                    modelMeta: foundExact,
                    allModels: ranked,
                    hardware: hw
                };
            }

            // Fallback: The requested model is not installed!
            const bestAlternative = ranked[0];
            return {
                success: true,
                status: 'fallback',
                selectedModel: bestAlternative.name,
                model: bestAlternative.name,
                modelMeta: bestAlternative,
                allModels: ranked,
                hardware: hw,
                fallbackNotice: `Notice: Requested model '${targetModel}' is not installed in Ollama. Automatically switched to installed coding model: '${bestAlternative.name}' (${bestAlternative.category}).`,
                message: `Requested model '${targetModel}' not found in Ollama. Automatically fell back to '${bestAlternative.name}'.`
            };
        }

        // 5. Automatic selection of the top ranked model
        const topModel = ranked[0];
        return {
            success: true,
            status: 'exact',
            selectedModel: topModel.name,
            model: topModel.name,
            modelMeta: topModel,
            allModels: ranked,
            hardware: hw
        };
    }
}

module.exports = { OllamaDiscoveryService };
