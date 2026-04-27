[CmdletBinding()]
param(
    [string]$RepoUrl = "https://gitlab.com/dasun-sathsara/pandokary.git",
    [string]$RepoDir = "",
    [string]$InstallDir = "",
    [switch]$SkipDependencyInstall,
    [switch]$ForcePull
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-WarnMsg {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Test-CommandAvailable {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $combined = @($machinePath, $userPath) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    $env:Path = ($combined -join ";")
}

function Install-WithManager {
    param(
        [string]$Name,
        [string]$WingetId,
        [string]$ChocoId,
        [string]$ScoopId
    )

    if (Test-CommandAvailable "winget") {
        Write-Info "Installing $Name with winget..."
        & winget install --id $WingetId --exact --silent --accept-source-agreements --accept-package-agreements --disable-interactivity
        Refresh-ProcessPath
        return
    }

    if (Test-CommandAvailable "choco") {
        Write-Info "Installing $Name with Chocolatey..."
        & choco install $ChocoId -y
        Refresh-ProcessPath
        return
    }

    if (Test-CommandAvailable "scoop") {
        Write-Info "Installing $Name with Scoop..."
        & scoop install $ScoopId
        Refresh-ProcessPath
        return
    }

    throw "No supported package manager found to install $Name. Install it manually and re-run this script."
}

function Get-GoVersionMinor {
    if (-not (Test-CommandAvailable "go")) {
        return -1
    }

    $raw = (& go version)
    if ($raw -match "go(\d+)\.(\d+)") {
        $major = [int]$Matches[1]
        $minor = [int]$Matches[2]
        if ($major -gt 1) {
            return 999
        }
        return $minor
    }

    return -1
}

function Ensure-Dependency {
    param(
        [string]$Name,
        [string]$Command,
        [string]$WingetId,
        [string]$ChocoId,
        [string]$ScoopId,
        [object]$NeedsInstall = $null
    )

    $needsInstall = $false
    if ($NeedsInstall -is [scriptblock]) {
        $needsInstall = & $NeedsInstall
    } else {
        $needsInstall = -not (Test-CommandAvailable $Command)
    }

    if (-not $needsInstall) {
        Write-Info "$Name already available."
        return
    }

    if ($SkipDependencyInstall) {
        throw "$Name is missing/outdated and -SkipDependencyInstall was provided."
    }

    Install-WithManager -Name $Name -WingetId $WingetId -ChocoId $ChocoId -ScoopId $ScoopId

    if ($NeedsInstall -is [scriptblock]) {
        $needsInstall = & $NeedsInstall
    } else {
        $needsInstall = -not (Test-CommandAvailable $Command)
    }
    if ($needsInstall) {
        throw "$Name is still missing/outdated after installation attempt."
    }
}

function Add-PathForCurrentUser {
    param([string]$PathEntry)

    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $parts = @()
    if (-not [string]::IsNullOrWhiteSpace($userPath)) {
        $parts = $userPath.Split(";") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    }

    if ($parts -contains $PathEntry) {
        Write-Info "Install directory already in user PATH."
        return
    }

    $newPath = ($parts + $PathEntry) -join ";"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path = "$PathEntry;$env:Path"
    Write-Info "Added install directory to user PATH."
}

if ($env:OS -ne "Windows_NT") {
    throw "This installer is intended for Windows."
}

if ([string]::IsNullOrWhiteSpace($RepoDir)) {
    if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot "go.mod"))) {
        $RepoDir = $PSScriptRoot
    } else {
        $RepoDir = Join-Path $HOME "src\pandokary"
    }
}

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $baseInstallRoot = if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        Join-Path $HOME "AppData\Local"
    } else {
        $env:LOCALAPPDATA
    }
    $InstallDir = Join-Path $baseInstallRoot "Programs\pdy"
}

Write-Info "Repo directory: $RepoDir"
Write-Info "Install directory: $InstallDir"

Refresh-ProcessPath

Ensure-Dependency -Name "Git" -Command "git" -WingetId "Git.Git" -ChocoId "git" -ScoopId "git"
Ensure-Dependency -Name "Go (>= 1.21)" -Command "go" -WingetId "GoLang.Go" -ChocoId "golang" -ScoopId "go" -NeedsInstall {
    $minor = Get-GoVersionMinor
    return $minor -lt 21
}
Ensure-Dependency -Name "Pandoc" -Command "pandoc" -WingetId "JohnMacFarlane.Pandoc" -ChocoId "pandoc" -ScoopId "pandoc"

if (-not (Test-Path $RepoDir)) {
    $parent = Split-Path -Parent $RepoDir
    if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    Write-Info "Cloning repository..."
    & git clone $RepoUrl $RepoDir
} else {
    $gitDir = Join-Path $RepoDir ".git"
    if (-not (Test-Path $gitDir)) {
        throw "Repo directory exists but is not a Git repository: $RepoDir"
    }

    if ($ForcePull) {
        Write-Info "Pulling latest changes..."
        & git -C $RepoDir pull --ff-only
    } else {
        Write-WarnMsg "Repository already exists. Use -ForcePull to update."
    }
}

if (-not (Test-Path (Join-Path $RepoDir "go.mod"))) {
    throw "go.mod not found in $RepoDir. Confirm this is the pdy repository."
}

Write-Info "Building pdy.exe..."
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Push-Location $RepoDir
try {
    & go build -o (Join-Path $InstallDir "pdy.exe") ./cmd/pdy

    $installAssetsDir = Join-Path $InstallDir "assets"
    New-Item -ItemType Directory -Path $installAssetsDir -Force | Out-Null
    Copy-Item -Path (Join-Path $RepoDir "assets\*") -Destination $installAssetsDir -Recurse -Force
} finally {
    Pop-Location
}

Add-PathForCurrentUser -PathEntry $InstallDir

Write-Info "Running smoke test..."
& (Join-Path $InstallDir "pdy.exe") --help | Out-Null

Write-Host ""
Write-Host "pdy installation complete." -ForegroundColor Green
Write-Host "Restart PowerShell (or run: `$env:Path = `"$InstallDir;`$env:Path`") to use `pdy` immediately."
Write-Host "Quick check: pdy --help"
