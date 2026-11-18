param(
  [Parameter(Mandatory=$true)][string]$SourceSdk,
  [string]$JavaHome='C:\Program Files\JAVA\jdk-17',
  [switch]$DirectInstall
)
$ErrorActionPreference='Stop'
$TaskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$TaskSdk=Join-Path $TaskRoot '.local/android-sdk'
$TaskSource=[IO.Path]::GetFullPath($SourceSdk)
if(!(Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))){throw 'JDK 17 is required'}
if(!(Test-Path -LiteralPath (Join-Path $TaskSource 'cmdline-tools/latest/bin/sdkmanager.bat'))){throw 'The source SDK must include command-line tools'}
New-Item -ItemType Directory -Force -Path $TaskSdk | Out-Null
# Reuse already installed public tools. New platform packages stay in this workspace.
foreach($component in @('cmdline-tools','platform-tools','ndk','cmake')){
  $target=Join-Path $TaskSdk $component
  if(!(Test-Path -LiteralPath $target)){
    $source=Join-Path $TaskSource $component
    if(!(Test-Path -LiteralPath $source)){throw "SDK component is unavailable: $component"}
    New-Item -ItemType Junction -Path $target -Target $source | Out-Null
  }
}
# Keep build-tools versions installed for Tracksy inside this workspace.
$TaskBuildTools=Join-Path $TaskSdk 'build-tools'
$TaskSourceTools=Join-Path $TaskSource 'build-tools'
if(Test-Path -LiteralPath $TaskBuildTools){
  $item=Get-Item -LiteralPath $TaskBuildTools -Force
  if($item.LinkType -eq 'Junction'){
    if($item.FullName -ne $TaskBuildTools -or $item.Target[0] -ne $TaskSourceTools){throw 'Unexpected build-tools junction'}
    [IO.Directory]::Delete($TaskBuildTools,$false)
  }
}
[IO.Directory]::CreateDirectory($TaskBuildTools)|Out-Null
Get-ChildItem -LiteralPath $TaskSourceTools -Directory|ForEach-Object {
  $target=Join-Path $TaskBuildTools $_.Name
  if(!(Test-Path -LiteralPath $target)){New-Item -ItemType Junction -Path $target -Target $_.FullName|Out-Null}
}
New-Item -ItemType Directory -Force -Path (Join-Path $TaskSdk 'platforms'),(Join-Path $TaskSdk 'licenses') | Out-Null
Get-ChildItem -LiteralPath (Join-Path $TaskSource 'licenses') -File | ForEach-Object {
  $destination=Join-Path (Join-Path $TaskSdk 'licenses') $_.Name
  if(!(Test-Path -LiteralPath $destination)){Copy-Item -LiteralPath $_.FullName -Destination $destination}
}
$env:JAVA_HOME=$JavaHome
$env:DEBUG=''
$env:Path=(Join-Path $JavaHome 'bin')+';'+$env:Path
$env:ANDROID_HOME=$TaskSdk
$env:ANDROID_SDK_ROOT=$TaskSdk
# AGP libraries can request its default Build Tools 35 even when the app uses 36.
$TaskTools35=Join-Path $TaskBuildTools '35.0.0'
if(!(Test-Path -LiteralPath (Join-Path $TaskTools35 'source.properties'))){
  if(Test-Path -LiteralPath $TaskTools35){
    $item=Get-Item -LiteralPath $TaskTools35 -Force
    if($item.LinkType -eq 'Junction'){
      if($item.FullName -ne $TaskTools35 -or !$item.FullName.StartsWith($TaskSdk+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected Build Tools path'}
      [IO.Directory]::Delete($TaskTools35,$false)
    }
  }
  $ProgressPreference='SilentlyContinue'
  $repository='https://dl.google.com/android/repository/'
  [xml]$manifest=(Invoke-WebRequest -Uri ($repository+'repository2-1.xml') -UseBasicParsing -TimeoutSec 120).Content
  $package=$manifest.SelectSingleNode("//*[local-name()='remotePackage' and @path='build-tools;35.0.0']")
  $archive=$package.SelectSingleNode(".//*[local-name()='archive'][*[local-name()='host-os']='windows']/*[local-name()='complete']")
  if(!$archive){throw 'Official Windows Build Tools 35 archive was not found'}
  $name=$archive.SelectSingleNode("*[local-name()='url']").InnerText
  $expected=$archive.SelectSingleNode("*[local-name()='checksum']").InnerText.Trim()
  if($name -notmatch '^[A-Za-z0-9_.-]+\.zip$'){throw 'Unexpected official Build Tools archive name'}
  $algorithm=if($expected.Length -eq 40){'SHA1'}elseif($expected.Length -eq 64){'SHA256'}else{throw 'Unsupported Build Tools checksum'}
  $downloads=Join-Path $TaskRoot '.local/android-downloads'
  [IO.Directory]::CreateDirectory($downloads)|Out-Null
  $zip=Join-Path $downloads $name
  if(!(Test-Path -LiteralPath $zip)){
    Write-Output 'Downloading official Android Build Tools 35...'
    Invoke-WebRequest -Uri ($repository+$name) -OutFile $zip -UseBasicParsing -TimeoutSec 600
  }
  if((Get-FileHash -LiteralPath $zip -Algorithm $algorithm).Hash.ToLowerInvariant() -ne $expected.ToLowerInvariant()){throw 'Build Tools archive checksum mismatch'}
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Directory]::CreateDirectory($TaskTools35)|Out-Null
  $file=[IO.Compression.ZipFile]::OpenRead($zip)
  try{
    $prefix=$file.Entries[0].FullName.Split('/')[0]+'/'
    if($prefix -ne 'android-15/'){throw 'Unexpected Build Tools archive root'}
    foreach($entry in $file.Entries){
      if(!$entry.FullName.StartsWith($prefix)){throw 'Unexpected Build Tools archive entry'}
      $relative=$entry.FullName.Substring($prefix.Length)
      if(!$relative){continue}
      $destination=[IO.Path]::GetFullPath((Join-Path $TaskTools35 $relative))
      if(!$destination.StartsWith($TaskTools35+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Build Tools archive escapes its target'}
      if(!$entry.Name){[IO.Directory]::CreateDirectory($destination)|Out-Null;continue}
      [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))|Out-Null
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$destination,$true)
    }
  }finally{$file.Dispose()}
  if(!(Test-Path -LiteralPath (Join-Path $TaskTools35 'aapt2.exe'))){throw 'Build Tools 35 extraction failed'}
}
$TaskJar=Join-Path $TaskSdk 'platforms/android-36/android.jar'
$TaskPlatformProperties=Join-Path $TaskSdk 'platforms/android-36/source.properties'
if((Test-Path -LiteralPath $TaskJar) -and (Test-Path -LiteralPath $TaskPlatformProperties) -and ((Get-Content -LiteralPath $TaskPlatformProperties -Raw) -notmatch 'AndroidVersion\.IsBaseSdk=false')){Write-Output "Tracksy Android SDK ready: $TaskSdk";return}
if(!$DirectInstall){
  & (Join-Path $TaskSdk 'cmdline-tools/latest/bin/sdkmanager.bat') "--sdk_root=$TaskSdk" 'platforms;android-36'
  if($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $TaskJar)){Write-Output "Tracksy Android SDK ready: $TaskSdk";return}
  Write-Output 'SDK manager extraction failed; using the checksum-verified official platform archive.'
}
$ProgressPreference='SilentlyContinue'
$TaskRepository='https://dl.google.com/android/repository/'
$TaskResponse=(Invoke-WebRequest -Uri ($TaskRepository+'repository2-1.xml') -UseBasicParsing -TimeoutSec 120).Content
[xml]$TaskManifest=$TaskResponse
$TaskPackage=$TaskManifest.SelectNodes("//*[local-name()='remotePackage' and @path='platforms;android-36']")|Where-Object {
  $_.SelectSingleNode(".//*[local-name()='complete']/*[local-name()='url']").InnerText -match '^platform-36_r[0-9]+\.zip$'
}|Select-Object -First 1
if(!$TaskPackage){throw 'The official base Android API 36 package was not found'}
$TaskArchive=$TaskPackage.SelectSingleNode(".//*[local-name()='complete']")
$TaskArchiveName=$TaskArchive.SelectSingleNode("*[local-name()='url']").InnerText
$TaskExpected=$TaskArchive.SelectSingleNode("*[local-name()='checksum']").InnerText.Trim()
if($TaskArchiveName -notmatch '^[A-Za-z0-9_.-]+\.zip$'){throw 'Unexpected official platform archive name'}
$TaskAlgorithm=if($TaskExpected.Length -eq 40){'SHA1'}elseif($TaskExpected.Length -eq 64){'SHA256'}else{throw 'Unsupported official platform checksum'}
$TaskDownloads=Join-Path $TaskRoot '.local/android-downloads'
New-Item -ItemType Directory -Force -Path $TaskDownloads|Out-Null
$TaskZip=Join-Path $TaskDownloads $TaskArchiveName
if(!(Test-Path -LiteralPath $TaskZip)){
  Write-Output 'Downloading the official Android API 36 platform archive...'
  Invoke-WebRequest -Uri ($TaskRepository+$TaskArchiveName) -OutFile $TaskZip -UseBasicParsing -TimeoutSec 600
}
if((Get-FileHash -LiteralPath $TaskZip -Algorithm $TaskAlgorithm).Hash.ToLowerInvariant() -ne $TaskExpected.ToLowerInvariant()){throw 'Android platform archive checksum mismatch'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$TaskPlatform=[IO.Path]::GetFullPath((Join-Path $TaskSdk 'platforms/android-36'))
New-Item -ItemType Directory -Force -Path $TaskPlatform|Out-Null
$TaskArchiveFile=[IO.Compression.ZipFile]::OpenRead($TaskZip)
try{
  $TaskArchivePrefix=$TaskArchiveFile.Entries[0].FullName.Split('/')[0]+'/'
  if($TaskArchivePrefix -notmatch '^android-36(?:-ext[0-9]+)?/$'){throw 'Unexpected Android platform archive root'}
  foreach($entry in $TaskArchiveFile.Entries){
    if(!$entry.FullName.StartsWith($TaskArchivePrefix)){throw 'Unexpected Android platform archive root'}
    $relative=$entry.FullName.Substring($TaskArchivePrefix.Length)
    if(!$relative){continue}
    $destination=[IO.Path]::GetFullPath((Join-Path $TaskPlatform $relative))
    if(!$destination.StartsWith($TaskPlatform+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Archive entry escapes the SDK platform directory'}
    if(!$entry.Name){[IO.Directory]::CreateDirectory($destination)|Out-Null;continue}
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))|Out-Null
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$destination,$true)
  }
}finally{$TaskArchiveFile.Dispose()}
if(!(Test-Path -LiteralPath $TaskJar)){throw 'The official Android platform archive did not contain android.jar'}
if((Get-Content -LiteralPath $TaskPlatformProperties -Raw) -match 'AndroidVersion\.IsBaseSdk=false'){throw 'The installed platform is an extension SDK rather than the required base API 36'}
Write-Output "Tracksy Android SDK ready: $TaskSdk"
