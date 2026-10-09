param([string]$UserPoolId='')
. "$PSScriptRoot/common.ps1"
$javaExe=Find-ProjectJava
$env:JAVA_HOME=Split-Path (Split-Path $javaExe -Parent) -Parent
if ($UserPoolId) { $env:COGNITO_ISSUER="https://cognito-idp.us-east-1.amazonaws.com/$UserPoolId" }
if (!(Test-Path env:COGNITO_ISSUER)) {
    Write-Host 'Using the existing health tracker Cognito pool for login. Records go only to DynamoDB Local.'
}
$mavenExe=Find-ProjectMaven
Push-Location (Join-Path $projectRoot 'backend')
try {
    & $mavenExe "-Dmaven.repo.local=$projectRoot/.tools/m2" --batch-mode --no-transfer-progress '-DskipTests' package
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
    Write-Host 'Local API: http://127.0.0.1:8080 (development DynamoDB only)'
    & $javaExe -jar target/health-habits-api-boot.jar --spring.profiles.active=local
} finally { Pop-Location }
