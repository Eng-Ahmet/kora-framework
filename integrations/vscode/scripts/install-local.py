#!/usr/bin/env python3
"""
Local Installer for Kora VS Code / Antigravity Extension.
Installs the extension directly into ~/.vscode/extensions and ~/.antigravity-ide/extensions.
"""

import os
import sys
import json
import shutil
import zipfile

def install_local():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    pkg_path = os.path.join(root_dir, 'package.json')
    with open(pkg_path, 'r', encoding='utf-8') as f:
        pkg = json.load(f)

    version = pkg.get('version', '0.10.3')
    name = pkg.get('name', 'kora-vscode')
    publisher = pkg.get('publisher', 'kora-framework')
    ext_id = f"{publisher}.{name}"
    
    home = os.path.expanduser('~')
    
    targets = [
        # Standard VS Code
        (os.path.join(home, '.vscode', 'extensions'), f"{ext_id}-{version}"),
        # Antigravity IDE
        (os.path.join(home, '.antigravity-ide', 'extensions'), f"{ext_id}-{version}-universal"),
        # VS Code Insiders
        (os.path.join(home, '.vscode-insiders', 'extensions'), f"{ext_id}-{version}"),
        # Cursor
        (os.path.join(home, '.cursor', 'extensions'), f"{ext_id}-{version}")
    ]
    
    installed_count = 0
    
    # Files to exclude from installation
    exclude_dirs = {'.git', 'node_modules', '.kora_tmp', '__pycache__'}
    exclude_extensions = {'.vsix'}

    for base_dir, folder_name in targets:
        try:
            if not os.path.exists(base_dir):
                continue

            target_path = os.path.join(base_dir, folder_name)
            
            # 1. Purge ANY existing older/conflicting Kora extension versions
            for entry in os.listdir(base_dir):
                entry_lower = entry.lower()
                if ('kora-framework' in entry_lower or 'kora-vscode' in entry_lower or 'kora-lang' in entry_lower):
                    full_old = os.path.join(base_dir, entry)
                    if os.path.isdir(full_old):
                        try:
                            shutil.rmtree(full_old)
                            print(f"  [Success] Purged legacy directory: {entry}")
                        except Exception as e:
                            print(f"  Notice purging {entry}: {e}")

            # 2. Clean .obsolete file
            obsolete_file = os.path.join(base_dir, '.obsolete')
            if os.path.exists(obsolete_file):
                try:
                    with open(obsolete_file, 'r', encoding='utf-8') as of:
                        obs = json.load(of)
                    cleaned_obs = {k: v for k, v in obs.items() if 'kora' not in k.lower()}
                    with open(obsolete_file, 'w', encoding='utf-8') as of:
                        json.dump(cleaned_obs, of, indent=2)
                    print(f"  [Success] Cleaned obsolete entries in {obsolete_file}")
                except Exception as e:
                    print(f"  Notice updating .obsolete: {e}")

            os.makedirs(target_path, exist_ok=True)
            
            # Copy all files
            for root, dirs, files in os.walk(root_dir):
                dirs[:] = [d for d in dirs if d not in exclude_dirs]
                rel_root = os.path.relpath(root, root_dir)
                dest_root = target_path if rel_root == '.' else os.path.join(target_path, rel_root)
                os.makedirs(dest_root, exist_ok=True)
                
                for file in files:
                    if any(file.endswith(ext) for ext in exclude_extensions):
                        continue
                    src_file = os.path.join(root, file)
                    dst_file = os.path.join(dest_root, file)
                    shutil.copy2(src_file, dst_file)
                    
            print(f"[Success] Successfully installed to: {target_path}")
            installed_count += 1
            
            # Register in extensions.json if exists
            ext_json_path = os.path.join(base_dir, 'extensions.json')
            if os.path.exists(ext_json_path):
                try:
                    with open(ext_json_path, 'r', encoding='utf-8') as f:
                        ext_list = json.load(f)
                    ext_list = [item for item in ext_list if item.get('identifier', {}).get('id', '').lower() != ext_id.lower()]
                    ext_list.append({
                        "identifier": { "id": ext_id },
                        "version": version,
                        "location": { "$mid": 1, "path": target_path, "scheme": "file" },
                        "relativeLocation": folder_name,
                        "metadata": {
                            "installedTimestamp": 1700000000000,
                            "pinned": True,
                            "source": "local",
                            "publisherDisplayName": publisher
                        }
                    })
                    with open(ext_json_path, 'w', encoding='utf-8') as f:
                        json.dump(ext_list, f, indent=2)
                    print(f"  [Success] Updated {ext_json_path}")
                except Exception as e:
                    print(f"  Notice updating extensions.json: {e}")
                    
        except Exception as e:
            # If target dir is read-only or doesn't exist
            # If target dir is read-only or doesn't exist
            print(f"Notice for {base_dir}: {e}")

    if installed_count > 0:
        print(f"\n[Done] Kora Extension v{version} installed into {installed_count} location(s)!")
    else:
        print("\n[Warning] No default IDE extension directories were writable inside the sandbox.")
        print(f"[Tip] You can install the generated VSIX directly in VS Code:")
        print(f"   Extensions -> ... (More Actions) -> Install from VSIX... -> {root_dir}/kora-vscode-{version}.vsix")

if __name__ == '__main__':
    install_local()
