#!/usr/bin/env python3
"""
Pure Python VSIX Packager for Kora VS Code Extension.
Builds a standard, fully compliant .vsix package without requiring npm or vsce.
"""

import os
import sys
import json
import zipfile

def build_vsix():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    pkg_path = os.path.join(root_dir, 'package.json')
    
    with open(pkg_path, 'r', encoding='utf-8') as f:
        pkg = json.load(f)
        
    version = pkg.get('version', '0.10.3')
    name = pkg.get('name', 'kora-vscode')
    publisher = pkg.get('publisher', 'kora-framework')
    display_name = pkg.get('displayName', 'Kora Language Support')
    description = pkg.get('description', 'Kora Language Support & AI Agent')
    
    vsix_filename = f"{name}-{version}.vsix"
    vsix_path = os.path.join(root_dir, vsix_filename)
    dist_dir = os.path.abspath(os.path.join(root_dir, '..', '..', 'dist'))
    
    print(f"[Package] Packaging {name} v{version} into {vsix_filename}...")
    
    content_types_xml = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="png" ContentType="image/png" />
  <Default Extension="svg" ContentType="image/svg+xml" />
  <Default Extension="md" ContentType="text/markdown" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="toml" ContentType="text/plain" />
  <Default Extension="kora" ContentType="text/plain" />
  <Default Extension="kr" ContentType="text/plain" />
  <Default Extension="vsixmanifest" ContentType="text/xml" />
</Types>"""

    vsix_manifest_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="{name}" Version="{version}" Publisher="{publisher}" />
    <DisplayName>{display_name}</DisplayName>
    <Description xml:space="preserve">{description}</Description>
    <Tags>kora,clean-architecture,compiler,copilot,ai-agent</Tags>
    <Categories>Programming Languages,Linters,Snippets,Other</Categories>
    <Icon>extension/icon.png</Icon>
    <License>extension/LICENSE</License>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/icon.png" Addressable="true" />
  </Assets>
</PackageManifest>"""

    # Files to include
    exclude_dirs = {'.git', 'node_modules', '.kora_tmp', '__pycache__'}
    exclude_extensions = {'.vsix'}

    file_count = 0
    with zipfile.ZipFile(vsix_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        # Add [Content_Types].xml
        zf.writestr('[Content_Types].xml', content_types_xml)
        # Add extension.vsixmanifest
        zf.writestr('extension.vsixmanifest', vsix_manifest_xml)
        
        # Add all extension files under extension/
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                if any(file.endswith(ext) for ext in exclude_extensions):
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, root_dir)
                archive_path = os.path.join('extension', rel_path).replace('\\', '/')
                zf.write(full_path, archive_path)
                file_count += 1
                
    file_size_kb = os.path.getsize(vsix_path) / 1024
    print(f"[Success] Created {vsix_path} ({file_count} files, {file_size_kb:.1f} KB)")
    
    if os.path.exists(dist_dir):
        os.makedirs(dist_dir, exist_ok=True)
        dist_vsix = os.path.join(dist_dir, vsix_filename)
        with open(vsix_path, 'rb') as src_f, open(dist_vsix, 'wb') as dst_f:
            dst_f.write(src_f.read())
        print(f"[Success] Copied to dist: {dist_vsix}")
        
    return vsix_path

if __name__ == '__main__':
    build_vsix()
