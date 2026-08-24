# ==============================================================================
# Supabase Local & Scheduled Backup Script (PowerShell for Windows)
# ==============================================================================
# Requirement: Node.js (npx) installed and Supabase CLI / DB password.
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\backup-supabase.ps1
# ==============================================================================

param (
    [string]$ProjectRef = "lxfavbzmebqqsffgyyph",
    [string]$BackupDir = "$PSScriptRoot\..\backups",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

# Create timestamp format (YYYYMMDD_HHMMSS)
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$TargetDir = Resolve-Path (New-Item -ItemType Directory -Force -Path $BackupDir).FullName

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Starting Supabase Weekly Database Backup..." -ForegroundColor Cyan
Write-Host " Project Ref: $ProjectRef" -ForegroundColor Cyan
Write-Host " Backup Dir : $TargetDir" -ForegroundColor Cyan
Write-Host " Timestamp  : $Timestamp" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check if SUPABASE_ACCESS_TOKEN is available in environment or prompt
if (-not $env:SUPABASE_ACCESS_TOKEN) {
    Write-Host "[!] Note: SUPABASE_ACCESS_TOKEN not found in env. Running 'npx supabase login' if needed." -ForegroundColor Yellow
}

$SchemaFile = "$TargetDir\schema_$Timestamp.sql"
$RolesFile  = "$TargetDir\roles_$Timestamp.sql"
$DataFile   = "$TargetDir\data_public_$Timestamp.sql"
$ZipFile    = "$TargetDir\supabase_backup_$Timestamp.zip"

try {
    # 1. Dump Roles
    Write-Host "`n[1/4] Dumping Roles and Permissions..." -ForegroundColor Green
    npx -y supabase db dump --project-ref $ProjectRef --role-only -f "$RolesFile"

    # 2. Dump Schema
    Write-Host "`n[2/4] Dumping Database Schema (DDL)..." -ForegroundColor Green
    npx -y supabase db dump --project-ref $ProjectRef -f "$SchemaFile"

    # 3. Dump Data
    Write-Host "`n[3/4] Dumping Public Data (Records)..." -ForegroundColor Green
    npx -y supabase db dump --project-ref $ProjectRef --data-only -f "$DataFile"

    # 4. Compress to ZIP
    Write-Host "`n[4/4] Compressing Backup Files into ZIP..." -ForegroundColor Green
    Compress-Archive -Path "$SchemaFile", "$RolesFile", "$DataFile" -DestinationPath "$ZipFile" -Force
    
    # Remove raw SQL files after compression to save disk space
    Remove-Item "$SchemaFile", "$RolesFile", "$DataFile" -Force

    Write-Host "`n[OK] Backup successfully created at: $ZipFile" -ForegroundColor Cyan

    # 5. Clean up old backups older than $RetentionDays
    Write-Host "`nCleaning up backups older than $RetentionDays days..." -ForegroundColor Gray
    Get-ChildItem -Path $TargetDir -Filter "supabase_backup_*.zip" | Where-Object {
        $_.CreationTime -lt (Get-Date).AddDays(-$RetentionDays)
    } | ForEach-Object {
        Write-Host "Removing expired backup: $($_.Name)" -ForegroundColor DarkGray
        Remove-Item $_.FullName -Force
    }

    Write-Host "`n Backup process completed successfully!" -ForegroundColor Green
}
catch {
    Write-Host "`n[ERROR] Backup failed: $_" -ForegroundColor Red
    exit 1
}
