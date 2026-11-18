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

console.log(`[Package] 1. Building VSIX package for Kora v${version}...`);

// Use native python packaging (cross-node compatible, no Node >= 22 requirements)
let packageSucceeded = false;
try {
    const pythonScript = path.join(__dirname, 'package-vsix.py');
    execSync(`python3 "${pythonScript}"`, {
        cwd: rootDir,
        stdio: 'inherit'
    });
    packageSucceeded = true;
} catch (e) {
    console.warn(`[Notice] Python packaging fallback, trying vsce...`);
}

if (!packageSucceeded) {
    // Pin to vsce 2.15.0 which supports Node 18+ (vsce 4+ requires Node >= 22)
    execSync(`npx --yes @vscode/vsce@2.15.0 package --no-git-tag-version --baseImagesUrl https://raw.githubusercontent.com/Hwai-technology/kora-framework/main/integrations/vscode/`, {
        cwd: rootDir,
        stdio: 'inherit'
    });
}

// Delegate to install-local.py for unified deployment across all IDE profiles
try {
    const installScript = path.join(__dirname, 'install-local.py');
    execSync(`python3 "${installScript}"`, {
        cwd: rootDir,
        stdio: 'inherit'
    });
} catch (e) {
    console.error(`[Error] Installation failed: ${e.message}`);
    process.exit(1);
}

