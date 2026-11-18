const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Change Review Manager for Kora VS Code Extension.
 * Handles multi-file refactoring proposals, visual side-by-side diffs (using vscode.diff),
 * transactional safety checks, concurrent modification detection, and per-file approvals.
 */
class ChangeReviewManager {
    constructor(vscodeInstance = null, storagePath = null) {
        this.vscode = vscodeInstance;
        this.storagePath = storagePath || path.join(os.tmpdir(), 'kora_diff_storage');
        this.activeProposals = new Map(); // proposalId -> Proposal
        this.currentProposalId = null;

        try {
            if (!fs.existsSync(this.storagePath)) {
                fs.mkdirSync(this.storagePath, { recursive: true });
            }
        } catch (e) {}
    }

    _computeHash(content) {
        return crypto.createHash('sha256').update(content || '', 'utf8').digest('hex');
    }

    _calculateLineDiff(origContent, newContent) {
        const origLines = (origContent || '').split('\n');
        const newLines = (newContent || '').split('\n');
        let additions = 0;
        let deletions = 0;

        const origSet = new Set(origLines);
        const newSet = new Set(newLines);

        for (const line of newLines) {
            if (!origSet.has(line)) additions++;
        }
        for (const line of origLines) {
            if (!newSet.has(line)) deletions++;
        }

        return {
            additions: Math.max(additions, Math.abs(newLines.length - origLines.length)),
            deletions: Math.max(deletions, Math.abs(origLines.length - newLines.length))
        };
    }

    /**
     * Creates a new multi-file proposal.
     * @param {string} title Summary or task description
     * @param {Array<{ filePath: string, originalContent?: string, proposedContent: string, isNew?: boolean, isDeleted?: boolean }>} fileChanges
     */
    createProposal(title, fileChanges) {
        const proposalId = 'prop_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const files = [];

        for (const change of fileChanges) {
            const fullPath = path.resolve(change.filePath);
            let origContent = change.originalContent;

            if (origContent === undefined && fs.existsSync(fullPath)) {
                try {
                    origContent = fs.readFileSync(fullPath, 'utf8');
                } catch (e) {
                    origContent = '';
                }
            } else if (origContent === undefined) {
                origContent = '';
            }

            const proposedContent = change.proposedContent !== undefined ? change.proposedContent : '';
            const diffStats = this._calculateLineDiff(origContent, proposedContent);

            files.push({
                filePath: fullPath,
                fileName: path.basename(fullPath),
                originalContent: origContent,
                proposedContent: proposedContent,
                originalHash: this._computeHash(origContent),
                status: 'pending', // 'pending' | 'accepted' | 'rejected' | 'applied'
                isNew: change.isNew || !fs.existsSync(fullPath),
                isDeleted: !!change.isDeleted,
                additions: diffStats.additions,
                deletions: diffStats.deletions
            });
        }

        const proposal = {
            id: proposalId,
            title,
            timestamp: Date.now(),
            files,
            status: 'pending' // 'pending' | 'partially_accepted' | 'applied' | 'rejected'
        };

        this.activeProposals.set(proposalId, proposal);
        this.currentProposalId = proposalId;
        return proposal;
    }

    getProposal(proposalId = null) {
        const id = proposalId || this.currentProposalId;
        return this.activeProposals.get(id) || null;
    }

    /**
     * Sets approval state for an individual file in a proposal.
     */
    setFileStatus(proposalId, filePath, status) {
        const proposal = this.getProposal(proposalId);
        if (!proposal) return null;

        const normTarget = filePath ? path.resolve(filePath) : null;
        const file = proposal.files.find(f => (normTarget && path.resolve(f.filePath) === normTarget) || f.filePath === filePath || f.fileName === path.basename(filePath || ''));
        if (file) {
            file.status = status;
        }

        this._updateProposalStatus(proposal);
        return proposal;
    }

    acceptAll(proposalId = null) {
        const proposal = this.getProposal(proposalId);
        if (!proposal) return null;
        for (const f of proposal.files) {
            f.status = 'accepted';
        }
        proposal.status = 'accepted';
        return proposal;
    }

    rejectAll(proposalId = null) {
        const proposal = this.getProposal(proposalId);
        if (!proposal) return null;
        for (const f of proposal.files) {
            f.status = 'rejected';
        }
        proposal.status = 'rejected';
        return proposal;
    }

    _updateProposalStatus(proposal) {
        const allAccepted = proposal.files.every(f => f.status === 'accepted' || f.status === 'applied');
        const allRejected = proposal.files.every(f => f.status === 'rejected');
        if (allAccepted) {
            proposal.status = 'accepted';
        } else if (allRejected) {
            proposal.status = 'rejected';
        } else {
            proposal.status = 'pending';
        }
    }

    /**
     * Previews visual side-by-side diff using VS Code's native diff editor.
     */
    async openVisualDiff(filePath, proposalId = null) {
        const proposal = this.getProposal(proposalId);
        if (!proposal) throw new Error('No active proposal found to diff');

        const normTarget = filePath ? path.resolve(filePath) : null;
        let fileChange = null;
        if (normTarget) {
            fileChange = proposal.files.find(f => (normTarget && path.resolve(f.filePath) === normTarget) || f.filePath === filePath || f.fileName === path.basename(filePath));
        }
        if (!fileChange && proposal.files.length > 0) {
            fileChange = proposal.files[0];
        }
        if (!fileChange) throw new Error(`File ${filePath || ''} not in proposal`);

        const resolvedTarget = fileChange.filePath ? path.resolve(fileChange.filePath) : normTarget;
        const fileName = path.basename(resolvedTarget);
        const subDir = path.join(this.storagePath, proposal.id);
        if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });

        const proposedFilePath = path.join(subDir, `proposed_${fileName}`);
        fs.writeFileSync(proposedFilePath, fileChange.proposedContent, 'utf8');

        if (this.vscode && this.vscode.commands && this.vscode.Uri) {
            const origUri = this.vscode.Uri.file(resolvedTarget);
            const proposedUri = this.vscode.Uri.file(proposedFilePath);
            const title = `${fileName} (Current) <-> ${fileName} (AI Proposed Refactor)`;
            await this.vscode.commands.executeCommand('vscode.diff', origUri, proposedUri, title);
        }

        return proposedFilePath;
    }

    /**
     * Applies all approved changes safely.
     * Validates that files were not modified externally before applying.
     */
    async applyApprovedChanges(proposalId = null) {
        const proposal = this.getProposal(proposalId);
        if (!proposal) throw new Error('No proposal found to apply');

        const filesToApply = proposal.files.filter(f => f.status === 'accepted' || f.status === 'pending');
        if (filesToApply.length === 0) {
            return { success: true, appliedCount: 0, warnings: ['No accepted changes to apply.'] };
        }

        const results = {
            applied: [],
            conflicts: [],
            errors: []
        };

        // 1. Pre-validation: Check for external modifications
        for (const file of filesToApply) {
            if (fs.existsSync(file.filePath)) {
                try {
                    const currentDiskContent = fs.readFileSync(file.filePath, 'utf8');
                    const currentHash = this._computeHash(currentDiskContent);
                    if (currentHash !== file.originalHash) {
                        results.conflicts.push({
                            filePath: file.filePath,
                            reason: 'File was modified externally after proposal generation'
                        });
                    }
                } catch (e) {
                    results.errors.push({ filePath: file.filePath, error: e.message });
                }
            }
        }

        if (results.conflicts.length > 0) {
            throw new Error(`Concurrent modification detected in ${results.conflicts.length} file(s). Please review diff before overwriting.`);
        }

        // 2. Apply changes via VS Code WorkspaceEdit if available, or fs fallback
        if (this.vscode && this.vscode.workspace && this.vscode.WorkspaceEdit) {
            const edit = new this.vscode.WorkspaceEdit();

            for (const file of filesToApply) {
                const uri = this.vscode.Uri.file(file.filePath);
                if (file.isDeleted) {
                    edit.deleteFile(uri, { ignoreIfNotExists: true });
                } else if (file.isNew && !fs.existsSync(file.filePath)) {
                    edit.createFile(uri, { ignoreIfExists: true });
                    const fullRange = new this.vscode.Range(new this.vscode.Position(0, 0), new this.vscode.Position(0, 0));
                    edit.insert(uri, fullRange.start, file.proposedContent);
                } else {
                    let doc;
                    try {
                        doc = await this.vscode.workspace.openTextDocument(uri);
                    } catch (e) {
                        doc = null;
                    }

                    if (doc) {
                        const fullRange = new this.vscode.Range(
                            doc.positionAt(0),
                            doc.positionAt(doc.getText().length)
                        );
                        edit.replace(uri, fullRange, file.proposedContent);
                    } else {
                        // File not open in editor, write safely
                        const parent = path.dirname(file.filePath);
                        if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
                        fs.writeFileSync(file.filePath, file.proposedContent, 'utf8');
                    }
                }
            }

            const success = await this.vscode.workspace.applyEdit(edit);
            if (!success) {
                throw new Error('VS Code WorkspaceEdit failed to apply changes.');
            }

            // Save documents
            for (const file of filesToApply) {
                try {
                    const uri = this.vscode.Uri.file(file.filePath);
                    const doc = await this.vscode.workspace.openTextDocument(uri);
                    await doc.save();
                    file.status = 'applied';
                    results.applied.push(file.filePath);
                } catch (e) {
                    file.status = 'applied';
                    results.applied.push(file.filePath);
                }
            }
        } else {
            // Standalone filesystem execution
            for (const file of filesToApply) {
                try {
                    if (file.isDeleted) {
                        if (fs.existsSync(file.filePath)) fs.unlinkSync(file.filePath);
                    } else {
                        const parent = path.dirname(file.filePath);
                        if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
                        fs.writeFileSync(file.filePath, file.proposedContent, 'utf8');
                    }
                    file.status = 'applied';
                    results.applied.push(file.filePath);
                } catch (err) {
                    results.errors.push({ filePath: file.filePath, error: err.message });
                }
            }
        }

        proposal.status = 'applied';
        return {
            success: results.errors.length === 0,
            appliedCount: results.applied.length,
            appliedFiles: results.applied,
            errors: results.errors
        };
    }

    /**
     * Serializes proposal for Webview transmission.
     */
    serializeProposal(proposalId = null) {
        const prop = this.getProposal(proposalId);
        if (!prop) return null;

        return {
            id: prop.id,
            title: prop.title,
            timestamp: prop.timestamp,
            status: prop.status,
            totalFiles: prop.files.length,
            files: prop.files.map(f => ({
                filePath: f.filePath,
                fileName: f.fileName,
                status: f.status,
                isNew: f.isNew,
                isDeleted: f.isDeleted,
                additions: f.additions,
                deletions: f.deletions,
                originalContent: f.originalContent || '',
                proposedContent: f.proposedContent || '',
                codePreview: f.proposedContent || ''
            }))
        };
    }
}

module.exports = { ChangeReviewManager };
