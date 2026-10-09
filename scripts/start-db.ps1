. "$PSScriptRoot/common.ps1"
$javaExe=Find-ProjectJava
$installDir=Join-Path $projectRoot '.tools/dynamodb-local'
$jar=Join-Path $installDir 'DynamoDBLocal.jar'
if (!(Test-Path $jar)) {
    Write-Host 'Downloading the official DynamoDB Local package...'
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    $archive=Join-Path $projectRoot '.tools/dynamodb-local.zip'
    $downloadUrl='https://d1ni2b6xgvw0s0.cloudfront.net/v2.x/dynamodb_local_latest.zip'
    Invoke-WebRequest -Uri $downloadUrl -OutFile $archive
    $expectedHash=(Invoke-WebRequest -Uri "$downloadUrl.sha256").Content
    if ($expectedHash -is [byte[]]) { $expectedHash=[System.Text.Encoding]::UTF8.GetString($expectedHash) }
    $expectedHash=$expectedHash.Trim().Split(' ')[0]
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expectedHash) { throw 'DynamoDB Local checksum mismatch' }
    Expand-Archive -LiteralPath $archive -DestinationPath $installDir -Force
}
$dataDir=Join-Path $projectRoot '.local-data/dynamodb'
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
Write-Host 'DynamoDB Local: port 8000. Keep this terminal open; Ctrl+C stops it.'
Write-Host "Development records persist in $dataDir"
& $javaExe "-Djava.library.path=$installDir/DynamoDBLocal_lib" -jar $jar -sharedDb -dbPath $dataDir -port 8000 -disableTelemetry
if ($LASTEXITCODE -ne 0) { throw 'DynamoDB Local exited with an error. Check Java 21 and whether port 8000 is already in use.' }
