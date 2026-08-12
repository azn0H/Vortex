param(
    [switch]$Start
)

$ErrorActionPreference = "Stop"
$environmentPath = Join-Path $PSScriptRoot ".env"
$examplePath = Join-Path $PSScriptRoot ".env.example"
$composePath = Join-Path $PSScriptRoot "compose.yml"

function New-Secret([int]$Bytes) {
    $buffer = New-Object byte[] $Bytes
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $generator.GetBytes($buffer)
    $generator.Dispose()
    return [Convert]::ToBase64String($buffer).Replace("+", "A").Replace("/", "B").TrimEnd("=")
}

if (-not (Test-Path $environmentPath)) {
    $content = Get-Content -Raw $examplePath
    $content = $content.Replace("PG_PASS=", "PG_PASS=$(New-Secret 36)")
    $content = $content.Replace("AUTHENTIK_SECRET_KEY=", "AUTHENTIK_SECRET_KEY=$(New-Secret 60)")
    Set-Content -NoNewline -Path $environmentPath -Value $content
}

if ($Start) {
    docker compose --env-file $environmentPath -f $composePath pull
    docker compose --env-file $environmentPath -f $composePath up -d
    docker compose --env-file $environmentPath -f $composePath ps
}

Write-Output "Authentik configuration is ready at $environmentPath"
Write-Output "Open http://localhost:9000/ to complete the initial akadmin setup."
