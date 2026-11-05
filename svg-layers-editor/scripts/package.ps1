# Builds dist/<name>-<version>.vsix without Node.js.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/package.ps1
param([string]$OutDir = 'dist')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
$pkg = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$esc = { param($s) [Security.SecurityElement]::Escape([string]$s) }

$outPath = Join-Path $root $OutDir
New-Item -ItemType Directory -Force $outPath | Out-Null
$target = Join-Path $outPath "$($pkg.name)-$($pkg.version).vsix"
if (Test-Path $target) { Remove-Item $target }

$files = @('package.json', 'README.md', 'CHANGELOG.md')
$files += Get-ChildItem -Recurse -File (Join-Path $root 'src'), (Join-Path $root 'media'), (Join-Path $root 'docs') |
  ForEach-Object { $_.FullName.Substring($root.Length + 1) }

$contentTypes = @'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".css" ContentType="text/css"/>
  <Default Extension=".html" ContentType="text/html"/>
  <Default Extension=".md" ContentType="text/markdown"/>
  <Default Extension=".txt" ContentType="text/plain"/>
  <Default Extension=".png" ContentType="image/png"/>
  <Default Extension=".svg" ContentType="image/svg+xml"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>
'@

$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="$(& $esc $pkg.name)" Version="$(& $esc $pkg.version)" Publisher="$(& $esc $pkg.publisher)" />
    <DisplayName>$(& $esc $pkg.displayName)</DisplayName>
    <Description xml:space="preserve">$(& $esc $pkg.description)</Description>
    <Tags>$(& $esc ($pkg.keywords -join ','))</Tags>
    <Categories>$(& $esc ($pkg.categories -join ','))</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="$(& $esc $pkg.engines.vscode)" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace" />
      <Property Id="Microsoft.VisualStudio.Services.GitHubFlavoredMarkdown" Value="true" />
      <Property Id="Microsoft.VisualStudio.Services.Content.Pricing" Value="Free" />
    </Properties>
    <License>extension/LICENSE.txt</License>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE.txt" Addressable="true" />
  </Assets>
</PackageManifest>
"@

$utf8 = New-Object Text.UTF8Encoding $false
$zip = [IO.Compression.ZipFile]::Open($target, 'Create')
try {
  foreach ($entry in @(@('[Content_Types].xml', $contentTypes), @('extension.vsixmanifest', $manifest))) {
    $writer = New-Object IO.StreamWriter(($zip.CreateEntry($entry[0])).Open(), $utf8)
    $writer.Write($entry[1])
    $writer.Dispose()
  }
  # Entry names must use forward slashes or VS Code cannot find the files.
  foreach ($rel in $files) {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $root $rel), 'extension/' + ($rel -replace '\\', '/')) | Out-Null
  }
  [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $root 'LICENSE'), 'extension/LICENSE.txt') | Out-Null
} finally {
  $zip.Dispose()
}

Write-Host "Created $target ($($files.Count + 3) files)"
