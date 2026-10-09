$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
function Find-ProjectJava {
    if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin/java.exe'))) { return (Join-Path $env:JAVA_HOME 'bin/java.exe') }
    $portable=Get-ChildItem (Join-Path $projectRoot '.tools/jdk') -Filter java.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($portable) { return $portable.FullName }
    $javaCommand=Get-Command java -ErrorAction SilentlyContinue
    if ($javaCommand) { return $javaCommand.Source }
    throw 'Install Java 21 and set JAVA_HOME first.'
}
function Find-ProjectMaven {
    $mavenCommand=Get-Command mvn.cmd -ErrorAction SilentlyContinue
    if ($mavenCommand) { return $mavenCommand.Source }
    $portable=Get-ChildItem (Join-Path $projectRoot '.tools') -Filter mvn.cmd -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($portable) { return $portable.FullName }
    throw 'Install Maven 3.9 first.'
}
