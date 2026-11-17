const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
const vsixName = `kora-vscode-${version}.vsix`;
const vsixPath = path.join(rootDir, vsixName);
const distDir = path.resolve(rootDir, '../../dist');

console.log(`📦 1. Building VSIX package for Kora v${version}...`);
execSync(`npx --yes @vscode/vsce package --no-git-tag-version --baseImagesUrl https://raw.githubusercontent.com/Hwai-technology/kora-framework/main/integrations/vscode/`, {
    cwd: rootDir,
    stdio: 'inherit'
});

if (fs.existsSync(distDir)) {
    fs.copyFileSync(vsixPath, path.join(distDir, vsixName));
    console.log(`✓ Copied ${vsixName} to dist/`);
}

const unpackDir = path.join(os.tmpdir(), `kora_install_${Date.now()}`);
fs.mkdirSync(unpackDir, { recursive: true });
execSync(`unzip -q "${vsixPath}" -d "${unpackDir}"`);

const sourceExt = path.join(unpackDir, 'extension');

// Target 1: Antigravity IDE
const agyExtDir = path.join(os.homedir(), '.antigravity-ide', 'extensions');
if (fs.existsSync(agyExtDir)) {
    const targetAgy = path.join(agyExtDir, `kora-framework.kora-vscode-${version}-universal`);
    fs.rmSync(targetAgy, { recursive: true, force: true });
    fs.cpSync(sourceExt, targetAgy, { recursive: true });
    console.log(`✓ Installed to Antigravity IDE: ${targetAgy}`);

    // Clean .obsolete
    const obsoletePath = path.join(agyExtDir, '.obsolete');
    if (fs.existsSync(obsoletePath)) {
        try {
            const obs = JSON.parse(fs.readFileSync(obsoletePath, 'utf8'));
            delete obs[`kora-framework.kora-vscode-${version}`];
            delete obs[`kora-framework.kora-vscode-${version}-universal`];
            fs.writeFileSync(obsoletePath, JSON.stringify(obs));
        } catch (e) {}
    }

    // Register in extensions.json
    const extJsonPath = path.join(agyExtDir, 'extensions.json');
    if (fs.existsSync(extJsonPath)) {
        try {
            let list = JSON.parse(fs.readFileSync(extJsonPath, 'utf8'));
            list = list.filter(item => item.identifier && item.identifier.id !== 'kora-framework.kora-vscode' && item.identifier.id !== 'kora-lang.kora-vscode');
            list.push({
                identifier: { id: 'kora-framework.kora-vscode' },
                version: version,
                location: {
                    $mid: 1,
                    path: targetAgy,
                    scheme: 'file'
                },
                relativeLocation: `kora-framework.kora-vscode-${version}-universal`,
                metadata: {
                    installedTimestamp: Date.now(),
                    pinned: true,
                    source: 'vsix',
                    publisherDisplayName: 'kora-framework',
                    targetPlatform: 'universal',
                    updated: true,
                    private: false,
                    isPreReleaseVersion: false,
                    hasPreReleaseVersion: false
                }
            });
            fs.writeFileSync(extJsonPath, JSON.stringify(list));
            console.log(`✓ Registered in Antigravity extensions.json`);
        } catch (e) {}
    }
}

// Target 2: Standard VS Code
const vscodeExtDir = path.join(os.homedir(), '.vscode', 'extensions');
if (fs.existsSync(vscodeExtDir)) {
    const targetVsCode = path.join(vscodeExtDir, `kora-framework.kora-vscode-${version}`);
    fs.rmSync(targetVsCode, { recursive: true, force: true });
    fs.cpSync(sourceExt, targetVsCode, { recursive: true });
    console.log(`✓ Installed to VS Code: ${targetVsCode}`);
}

fs.rmSync(unpackDir, { recursive: true, force: true });
console.log(`\n🎉 Kora Language Support v${version} built and locally installed successfully!`);

