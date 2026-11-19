# 설치 없이 Windows 기본 PowerShell 만으로 out 폴더를 localhost 로 서빙한다.
# 포트를 고정해 두어야 브라우저에 저장된 작업(PDF/영상)이 다음 실행 때도 유지된다.
$Port = 3217
$Root = Join-Path $PSScriptRoot 'out'

if (-not (Test-Path (Join-Path $Root 'index.html'))) {
  Write-Host 'out 폴더를 찾을 수 없습니다. portable 폴더 전체를 복사했는지 확인하세요.' -ForegroundColor Red
  Read-Host 'Enter 를 누르면 종료합니다'
  exit 1
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'
  '.mjs' = 'application/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'
  '.jpg' = 'image/jpeg'; '.ico' = 'image/x-icon'; '.woff2' = 'font/woff2'; '.woff' = 'font/woff'
  '.txt' = 'text/plain; charset=utf-8'; '.map' = 'application/json'; '.wasm' = 'application/wasm'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
  $listener.Start()
} catch {
  Write-Host "포트 $Port 를 사용할 수 없습니다. 이미 실행 중인 창이 있는지 확인하세요." -ForegroundColor Red
  Read-Host 'Enter 를 누르면 종료합니다'
  exit 1
}

Write-Host "강연자 화면 실행 중: http://localhost:$Port/admin" -ForegroundColor Green
Write-Host '이 창을 닫으면 종료됩니다. (작업 내용은 브라우저에 저장되어 다음에도 유지됩니다)'
Start-Process "http://localhost:$Port/admin"

function Resolve-File($urlPath) {
  $rel = [System.Uri]::UnescapeDataString($urlPath).TrimStart('/').Replace('/', '\')
  $full = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))
  if (-not $full.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) { return $null }  # 상위 폴더 접근 차단
  if (Test-Path $full -PathType Leaf) { return $full }
  if (Test-Path "$full.html" -PathType Leaf) { return "$full.html" }
  $idx = Join-Path $full 'index.html'
  if (Test-Path $idx -PathType Leaf) { return $idx }
  return $null
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $file = Resolve-File $ctx.Request.Url.AbsolutePath
    if ($file) {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
  } catch {
    $ctx.Response.StatusCode = 500
  } finally {
    $ctx.Response.Close()
  }
}
