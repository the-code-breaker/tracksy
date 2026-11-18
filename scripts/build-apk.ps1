param(
  [string]$JavaHome='C:\Program Files\JAVA\jdk-17',
  [string]$SdkRoot,
  [ValidateSet('arm64-v8a','armeabi-v7a','x86_64','arm64-v8a,armeabi-v7a','arm64-v8a,x86_64')][string]$Architecture='arm64-v8a',
  [ValidateSet('Apk','Both')][string]$Format='Apk',
  [switch]$PrepareOnly
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$TaskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$TaskMobile=Join-Path $TaskRoot 'apps/mobile'
$TaskLocal=Join-Path $TaskRoot '.local'
if(!$SdkRoot){$SdkRoot=Join-Path $TaskLocal 'android-sdk'}
$TaskSdk=[IO.Path]::GetFullPath($SdkRoot)
if(!(Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))){throw 'JDK 17 is required'}
if(!(Test-Path -LiteralPath (Join-Path $TaskMobile 'android/gradlew.bat'))){throw 'Run npx expo prebuild --platform android --no-install from apps/mobile first'}
$env:JAVA_HOME=$JavaHome
$env:Path=(Join-Path $JavaHome 'bin')+';'+$env:Path
$env:ANDROID_HOME=$TaskSdk
$env:ANDROID_SDK_ROOT=$TaskSdk
$TaskGradleCache=Join-Path ([IO.Path]::GetTempPath()) 'Tracksy-gradle'
$env:GRADLE_USER_HOME=$TaskGradleCache
New-Item -ItemType Directory -Force -Path $TaskGradleCache|Out-Null
$env:CI='1'
$env:NODE_ENV='production'
$env:DEBUG=''
$env:EXPO_NO_TELEMETRY='1'
$env:SENTRY_DISABLE_AUTO_UPLOAD='true'
$env:SENTRY_ALLOW_FAILURE='true'
$env:CMAKE_BUILD_PARALLEL_LEVEL='2'
$env:TRACKSY_NATIVE_BUILD_ROOT=Join-Path ([IO.Path]::GetTempPath()) 'Tracksy-native'
$TaskSigning=Join-Path $TaskLocal 'android-signing'
New-Item -ItemType Directory -Force -Path $TaskSigning | Out-Null
$TaskKeystore=Join-Path $TaskSigning 'tracksy-release.p12'
$TaskCredentials=Join-Path $TaskSigning 'credentials.xml'
if(!(Test-Path -LiteralPath $TaskCredentials)){
  if(Test-Path -LiteralPath $TaskKeystore){throw 'The release keystore exists but its protected credentials are missing'}
  $bytes=New-Object byte[] 32
  $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
  try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
  $password=[Convert]::ToBase64String($bytes)
  $secure=ConvertTo-SecureString $password -AsPlainText -Force
  (New-Object System.Management.Automation.PSCredential('tracksy-release',$secure))|Export-Clixml -LiteralPath $TaskCredentials
  $password=$null;$secure=$null
}
$credential=Import-Clixml -LiteralPath $TaskCredentials
$env:TRACKSY_BUILD_KEYSTORE=$TaskKeystore
$env:TRACKSY_BUILD_STORE_PASSWORD=$credential.GetNetworkCredential().Password
$env:TRACKSY_BUILD_KEY_PASSWORD=$env:TRACKSY_BUILD_STORE_PASSWORD
$env:TRACKSY_BUILD_KEY_ALIAS=$credential.UserName
try{
  if(!(Test-Path -LiteralPath $TaskKeystore)){
    & (Join-Path $JavaHome 'bin/keytool.exe') -genkeypair -keystore $TaskKeystore -storetype PKCS12 -storepass:env TRACKSY_BUILD_STORE_PASSWORD -keypass:env TRACKSY_BUILD_KEY_PASSWORD -alias $credential.UserName -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Tracksy, OU=Mobile, O=Tracksy' -noprompt
    if($LASTEXITCODE -ne 0){throw 'Release signing-key generation failed'}
  }
  $gradleFile=Join-Path $TaskMobile 'android/app/build.gradle'
  $source=[IO.File]::ReadAllText($gradleFile)
  if(!$source.Contains('TRACKSY_BUILD_KEYSTORE')){
    $signing=@'
    signingConfigs {
        release {
            storeFile file(System.getenv('TRACKSY_BUILD_KEYSTORE'))
            storePassword System.getenv('TRACKSY_BUILD_STORE_PASSWORD')
            keyAlias System.getenv('TRACKSY_BUILD_KEY_ALIAS')
            keyPassword System.getenv('TRACKSY_BUILD_KEY_PASSWORD')
        }
'@
    if(!$source.Contains('    signingConfigs {')){throw 'Unexpected Android signing template'}
    $source=$source.Replace('    signingConfigs {',$signing)
    $pattern='(?s)(buildTypes\s*\{.*?release\s*\{.*?)signingConfig signingConfigs\.debug'
    if(![regex]::IsMatch($source,$pattern)){throw 'Unexpected Android release build template'}
    $source=([regex]::new($pattern)).Replace($source,'$1signingConfig signingConfigs.release',1)
    [IO.File]::WriteAllText($gradleFile,$source,[Text.UTF8Encoding]::new($false))
  }
  [IO.File]::WriteAllText((Join-Path $TaskMobile 'android/local.properties'),('sdk.dir='+$TaskSdk.Replace('\','/')+"`n"),[Text.UTF8Encoding]::new($false))
  $wrapper=[IO.File]::ReadAllText((Join-Path $TaskMobile 'android/gradle/wrapper/gradle-wrapper.properties'))
  if($wrapper -notmatch 'gradle-([0-9.]+)-bin\.zip'){throw 'Cannot determine the Expo template Gradle version'}
  $version=$Matches[1]
  $downloads=Join-Path $TaskLocal 'android-downloads'
  New-Item -ItemType Directory -Force -Path $downloads | Out-Null
  $gradle=Join-Path $downloads "gradle-$version/bin/gradle.bat"
  if(!(Test-Path -LiteralPath $gradle)){
    $distribution="https://downloads.gradle.org/distributions/gradle-$version-bin.zip"
    $response=(Invoke-WebRequest -Uri ($distribution+'.sha256') -UseBasicParsing -TimeoutSec 120).Content
    $checksum=if($response -is [string]){$response.Trim()}else{[Text.Encoding]::UTF8.GetString($response).Trim()}
    if($checksum -notmatch '^[a-fA-F0-9]{64}$'){throw 'Invalid official Gradle checksum'}
    $zip=Join-Path $downloads "gradle-$version-bin.zip"
    if(!(Test-Path -LiteralPath $zip)){
      Write-Output "Downloading the verified Gradle $version distribution..."
      Invoke-WebRequest -Uri $distribution -OutFile $zip -UseBasicParsing -TimeoutSec 600
    }
    if((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $checksum.ToLowerInvariant()){throw 'Gradle checksum mismatch'}
    Expand-Archive -LiteralPath $zip -DestinationPath $downloads -Force
  }
  if($PrepareOnly){Write-Output 'Release signing and Gradle are ready.';return}
  if(!(Test-Path -LiteralPath (Join-Path $TaskSdk 'platforms/android-36/android.jar'))){throw 'Install the Android API 36 platform first'}
  Push-Location (Join-Path $TaskMobile 'android')
  try{
    $TaskTargets=@(':app:assembleRelease')
    if($Format -eq 'Both'){$TaskTargets+= ':app:bundleRelease'}
    & $gradle @TaskTargets --no-daemon --no-watch-fs --no-parallel --stacktrace --console=plain --max-workers=1 '--init-script' (Join-Path $TaskRoot 'scripts/android-build.init.gradle') '-Dorg.gradle.internal.instrumentation.agent=false' '-Pkotlin.compiler.execution.strategy=in-process' "-PreactNativeArchitectures=$Architecture" '-Pandroid.enableMinifyInReleaseBuilds=false'
    if($LASTEXITCODE -ne 0){throw 'Android release compilation failed'}
  }finally{Pop-Location}
  $apk=Join-Path $TaskMobile 'android/app/build/outputs/apk/release/app-release.apk'
  if(!(Test-Path -LiteralPath $apk)){throw 'No APK was produced'}
  & (Join-Path $JavaHome 'bin/java.exe') -jar (Join-Path $TaskSdk 'build-tools/36.0.0/lib/apksigner.jar') verify --verbose --print-certs $apk
  if($LASTEXITCODE -ne 0){throw 'APK signature verification failed'}
  $config=Get-Content -LiteralPath (Join-Path $TaskMobile 'app.json') -Raw|ConvertFrom-Json
  $label=$Architecture.Replace('arm64-v8a','arm64').Replace('armeabi-v7a','armv7').Replace(',','-')
  $artifacts=Join-Path $TaskRoot 'artifacts'
  New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
  $output=Join-Path $artifacts ("Tracksy-$($config.expo.version)-$label.apk")
  Copy-Item -LiteralPath $apk -Destination $output -Force
  $hash=(Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()
  [IO.File]::WriteAllText(($output+'.sha256'),($hash+'  '+[IO.Path]::GetFileName($output)+"`n"),[Text.UTF8Encoding]::new($false))
  Write-Output "Signed Android APK ready: $output"
  if($Format -eq 'Both'){
    $bundle=Join-Path $TaskMobile 'android/app/build/outputs/bundle/release/app-release.aab'
    if(!(Test-Path -LiteralPath $bundle)){throw 'No Android App Bundle was produced'}
    $bundleOutput=Join-Path $artifacts ("Tracksy-$($config.expo.version)-$label.aab")
    & (Join-Path $JavaHome 'bin/jarsigner.exe') -verify $bundle
    if($LASTEXITCODE -ne 0){throw 'App Bundle signature verification failed'}
    Copy-Item -LiteralPath $bundle -Destination $bundleOutput -Force
    $bundleHash=(Get-FileHash -LiteralPath $bundleOutput -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText(($bundleOutput+'.sha256'),($bundleHash+'  '+[IO.Path]::GetFileName($bundleOutput)+"`n"),[Text.UTF8Encoding]::new($false))
    Write-Output "Signed Android App Bundle ready: $bundleOutput"
  }
}finally{
  $credential=$null
  Remove-Item Env:TRACKSY_BUILD_STORE_PASSWORD,Env:TRACKSY_BUILD_KEY_PASSWORD -ErrorAction SilentlyContinue
}
