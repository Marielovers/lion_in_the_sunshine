# Windows PowerShell 5.1 or PowerShell 7; no Python, Node.js, GitHub, admin rights, or setup required.
# Binds only to 127.0.0.1: no LAN/external access.
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$server = $null
$port = 0
foreach ($candidate in 8765..8775) {
  try {
    $server = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidate)
    $server.Start(20)
    $port = $candidate
    break
  } catch {
    try { if ($server) { $server.Stop() } } catch {}
    $server = $null
  }
}
if (-not $server) { throw '8765~8775 포트에 로컬 서버를 열지 못했습니다.' }

function ContentType($name) {
  switch ([System.IO.Path]::GetExtension($name).ToLowerInvariant()) {
    '.html' { return 'text/html; charset=utf-8' }
    '.js'   { return 'text/javascript; charset=utf-8' }
    '.mjs'  { return 'text/javascript; charset=utf-8' }
    '.css'  { return 'text/css; charset=utf-8' }
    '.json' { return 'application/json; charset=utf-8' }
    '.moc3' { return 'application/octet-stream' }
    '.png'  { return 'image/png' }
    '.webp' { return 'image/webp' }
    '.wav'  { return 'audio/wav' }
    '.ico'  { return 'image/x-icon' }
    default { return 'application/octet-stream' }
  }
}

Write-Host ''
Write-Host '============================================' -ForegroundColor Magenta
Write-Host '  햇리온 Live2D - PC 로컬 서버' -ForegroundColor Magenta
Write-Host '============================================' -ForegroundColor Magenta
Write-Host "주소: http://127.0.0.1:$port/"
Write-Host '창을 닫거나 Ctrl+C를 누르면 게임 서버가 종료됩니다.'
Write-Host 'Live2D 라이브러리 첫 로딩에는 인터넷 연결이 필요합니다.'
Write-Host ''
try {
  Start-Process "http://127.0.0.1:$port/"
  while ($true) {
    $client = $server.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 6000
      $client.SendTimeout = 9000
      $stream = $client.GetStream()
      $buffer = New-Object byte[] 8192
      $readBytes = 0
      $requestBuffer = New-Object System.Text.StringBuilder
      while ($readBytes -lt 32768) {
        $count = $stream.Read($buffer, 0, $buffer.Length)
        if ($count -le 0) { break }
        [void]$requestBuffer.Append([System.Text.Encoding]::ASCII.GetString($buffer,0,$count))
        $readBytes += $count
        if ($requestBuffer.ToString().Contains("`r`n`r`n")) { break }
      }
      $firstLine = ($requestBuffer.ToString() -split "`r`n")[0]
      $httpStatus = '200 OK'
      $type = 'text/plain; charset=utf-8'
      $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
      if ($firstLine -match '^(GET|HEAD) ([^ ]+) HTTP/') {
        $method = $matches[1]
        $raw = $matches[2].Split('?')[0]
        $pathName = [Uri]::UnescapeDataString($raw)
        if ($pathName -eq '/') { $pathName = '/index.html' }
        $relative = $pathName.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        try {
          $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root,$relative))
          if (-not $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            $httpStatus = '403 Forbidden'
          } elseif ([System.IO.File]::Exists($fullPath)) {
            $body = [System.IO.File]::ReadAllBytes($fullPath)
            $type = ContentType $fullPath
          } else { $httpStatus = '404 Not Found' }
        } catch { $httpStatus = '400 Bad Request' }
      } else { $httpStatus = '405 Method Not Allowed' }
      if ($httpStatus -ne '200 OK') {
        $body = [System.Text.Encoding]::UTF8.GetBytes($httpStatus)
      }
      $header = "HTTP/1.1 $httpStatus`r`nContent-Type: $type`r`nCache-Control: no-cache`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`nContent-Length: $($body.Length)`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes,0,$headerBytes.Length)
      if ($method -ne 'HEAD') { $stream.Write($body,0,$body.Length) }
      $stream.Flush()
    } catch {
      Write-Host "요청 처리 오류: $($_.Exception.Message)" -ForegroundColor DarkYellow
    } finally { $client.Close() }
  }
} finally {
  if ($server) { $server.Stop() }
}
