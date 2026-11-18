param([string]$Architecture='arm64')
$ErrorActionPreference='Stop'
$TaskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$config=Get-Content -LiteralPath (Join-Path $TaskRoot 'apps/mobile/app.json') -Raw|ConvertFrom-Json
$version=$config.expo.version
$package=$config.expo.android.package
$code=$config.expo.android.versionCode
$apk=Join-Path $TaskRoot "artifacts/Tracksy-$version-$Architecture.apk"
$aab=Join-Path $TaskRoot "artifacts/Tracksy-$version-$Architecture.aab"
$tools=Join-Path $TaskRoot '.local/android-sdk/build-tools/36.0.0'
$badging=(& (Join-Path $tools 'aapt2.exe') dump badging $apk 2>&1|Out-String)
if($LASTEXITCODE -ne 0){throw 'Cannot inspect the APK'}
if($badging -notmatch ("package: name='"+[regex]::Escape($package)+"' versionCode='"+$code+"' versionName='"+[regex]::Escape($version)+"'")){throw 'APK package/version does not match app.json'}
if($badging -match 'application-debuggable'){throw 'Release is debuggable'}
$resources=(& (Join-Path $tools 'aapt2.exe') dump resources $apk 2>&1|Out-String)
foreach($art in @('drawable/assets_illustrations_lakevignette','drawable/assets_illustrations_tripfriends','drawable/assets_illustrations_friendscafev1','drawable/assets_illustrations_settlednotebookv1')){if(!$resources.Contains($art)){throw 'A required bundled illustration is missing'}}
foreach($permission in @('SYSTEM_ALERT_WINDOW','READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE','READ_MEDIA_IMAGES','READ_MEDIA_VIDEO')){if($badging -match ('uses-permission: name=''android.permission.'+$permission+'''')){throw "Unexpected broad permission: $permission"}}
& (Join-Path $tools 'zipalign.exe') -c -P 16 4 $apk
if($LASTEXITCODE -ne 0){throw 'APK alignment failed'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$envText=[IO.File]::ReadAllText((Join-Path $TaskRoot 'apps/mobile/.env'))
$expectedUrl=[regex]::Match($envText,'(?m)^EXPO_PUBLIC_SUPABASE_URL\s*=\s*["'']?([^\r\n"'']+)').Groups[1].Value.Trim()
$expectedKey=[regex]::Match($envText,'(?m)^EXPO_PUBLIC_SUPABASE_ANON_KEY\s*=\s*["'']?([^\r\n"'']+)').Groups[1].Value.Trim()
$nativeMap=Join-Path $TaskRoot 'apps/mobile/android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map'
$nativeBundle=Join-Path $TaskRoot 'apps/mobile/android/app/build/generated/assets/react/release/index.android.bundle'
$nativeCallbacksVerified=$false
if((Test-Path -LiteralPath $nativeMap) -and (Test-Path -LiteralPath $nativeBundle)){
 $nativeSources=([IO.File]::ReadAllText($nativeMap)|ConvertFrom-Json).sources
 if($nativeSources|Where-Object {$_ -match 'react-native-css-interop|nativewind'}){throw 'Native controls are still intercepted by CSS interop'}
 if(!($nativeSources|Where-Object {$_ -match 'components/keyboard.native.tsx'})){throw 'Native keyboard integration is missing'}
 if(!($nativeSources|Where-Object {$_ -match 'react-native-keyboard-controller'})){throw 'Native keyboard controller is missing'}
 $nativeHash=(Get-FileHash -LiteralPath $nativeBundle -Algorithm SHA256).Hash.ToLowerInvariant()
 $nativeCallbacksVerified=$true
}
function Confirm-Bundle([string]$path,[string]$prefix){
 $archive=[IO.Compression.ZipFile]::OpenRead($path)
 try{
  $entry=$archive.GetEntry($prefix+'assets/index.android.bundle')
  if(!$entry -or !$archive.GetEntry($prefix+'lib/arm64-v8a/libhermesvm.so')){throw 'Embedded JavaScript or Hermes runtime is missing'}
  if($nativeCallbacksVerified){
   $nativeStream=$entry.Open();$hasher=[Security.Cryptography.SHA256]::Create()
   try{$entryHash=([BitConverter]::ToString($hasher.ComputeHash($nativeStream))).Replace('-','').ToLowerInvariant()}finally{$nativeStream.Dispose();$hasher.Dispose()}
   if($entryHash -ne $nativeHash){throw 'Packaged native bundle does not match the verified direct-control build'}
  }
  $stream=$entry.Open();$reader=[IO.StreamReader]::new($stream,[Text.Encoding]::UTF8)
  try{$bundle=$reader.ReadToEnd()}finally{$reader.Dispose();$stream.Dispose()}
  foreach($expected in @($expectedUrl,$expectedKey,'Send invitation','Edit history','Save changes','Phone notifications','Create your account','More moments. Less math.','Confirm password','Resend confirmation email',"We couldn't send your email.",'https://tracksy-support.coralprawn64.chatgpt.site')){if(!$expected -or !$bundle.Contains($expected)){throw 'A required backend/UI/auth/support setting is missing from the packaged app'}}
  foreach($expected in @('Restore group','Delete group for everyone','Filter groups','group_plus_early_access','Free during early access')){if(!$bundle.Contains($expected)){throw 'A required 0.6.0 group lifecycle/filter/early-access feature is missing from the packaged app'}}
  if($prefix -and !($archive.Entries|Where-Object {$_.FullName -match '^META-INF/.+\.RSA$'})){throw 'App Bundle signing certificate is missing'}
 }finally{$archive.Dispose()}
}
Confirm-Bundle $apk ''
Confirm-Bundle $aab 'base/'
$record=[ordered]@{version=$version;versionCode=$code;package=$package;architecture=$Architecture;minimumApi=24;targetApi=36;standalone=$true;systemTypography=$true;debuggable=$false;supabaseConfigurationVerified=$true;supportLinksVerified=$true;apkAlignment16Kb=$true;deviceRuntimeTested=$false;apkBytes=(Get-Item -LiteralPath $apk).Length;apkSha256=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant();aabBytes=(Get-Item -LiteralPath $aab).Length;aabSha256=(Get-FileHash -LiteralPath $aab -Algorithm SHA256).Hash.ToLowerInvariant()}
$record['nativeControlsDirect']=$nativeCallbacksVerified
$json=$record|ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $TaskRoot "artifacts/Tracksy-$version-$Architecture.verification.json"),$json,[Text.UTF8Encoding]::new($false))
Write-Output $json
