# WSLの開発画面をスマートフォンで確認する

Windows上のWSL2で起動したVite開発サーバーを、同じローカルネットワークに接続したスマートフォンから開く手順です。

この構成では、WindowsのLAN側IPアドレスで受けた通信を`portproxy`でWSLへ転送します。本書では、実際に使用した次の値を例にします。

| 項目 | 例 |
|---|---|
| WindowsのLAN側IP | `192.168.2.200` |
| WSLのIP | `172.22.251.226` |
| Viteのポート | `5173` |

IPアドレスは環境や再起動によって変わるため、設定時に必ず現在値を確認してください。

## 前提

- Windows PCとスマートフォンが同じローカルネットワークに接続されている
- Windows側のネットワークプロファイルが「プライベート」になっている
- WSL側で依存関係のインストールが完了している
- `portproxy`とファイアウォールの設定は、管理者権限のPowerShellで行う

## 1. IPアドレスを確認する

WSLのターミナルで次を実行し、WSLのIPv4アドレスを確認します。

```sh
hostname -I
```

複数表示された場合、この環境では`172.22.251.226`のようなWSL用アドレスを使用します。

Windows側では`ipconfig`を実行し、使用中のEthernetまたはWi-FiアダプターのIPv4アドレスを確認します。

```powershell
ipconfig
```

ここではWindows側を`192.168.2.200`、WSL側を`172.22.251.226`として進めます。

## 2. WSLでViteを起動する

WSLのリポジトリルートで、外部接続を受け付けるように開発サーバーを起動します。

```sh
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

`--strictPort`により、5173が使用中なら別ポートへ自動変更せず、起動をエラーで終了します。使用中のサーバーを停止するか、Vite・`portproxy`・ファイアウォール規則のポートを揃えて変更してください。

WSL内から次のURLを開けることを確認します。

```text
http://localhost:5173/youtube-quiz-battle/?quiz=sample
```

## 3. WindowsからWSLへポートを転送する

管理者権限のPowerShellを開き、現在のIPアドレスを指定して実行します。

```powershell
$WindowsLanIp = "192.168.2.200"
$WslIp = "172.22.251.226"
$Port = 5173

netsh interface portproxy add v4tov4 `
  listenaddress=$WindowsLanIp listenport=$Port `
  connectaddress=$WslIp connectport=$Port
```

設定内容は次のコマンドで確認できます。

```powershell
netsh interface portproxy show v4tov4
```

すでに同じWindows側IP・ポートの設定があり、WSLのIPだけが変わった場合は、古い設定を削除してから追加し直します。

```powershell
netsh interface portproxy delete v4tov4 `
  listenaddress=$WindowsLanIp listenport=$Port

netsh interface portproxy add v4tov4 `
  listenaddress=$WindowsLanIp listenport=$Port `
  connectaddress=$WslIp connectport=$Port
```

## 4. Windows Defender Firewallで許可する

初回に、同一サブネットからWindows側の`5173`ポートへ接続できるようにします。WindowsのLAN側IPやポートを変更した場合も、規則の更新が必要です。

```powershell
New-NetFirewallRule `
  -DisplayName "WSL Vite Dev 5173" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 5173 `
  -LocalAddress 192.168.2.200 `
  -RemoteAddress LocalSubnet `
  -Profile Private `
  -Action Allow
```

`LocalSubnet`と`Private`に限定しているため、パブリックネットワーク全体へ開放する設定にはしないでください。ポートを変更する場合は、Vite・`portproxy`・ファイアウォール規則の3か所を同じ値に揃えます。

## 5. 接続を確認する

まずWindowsのPowerShellから転送先へ到達できることを確認します。

```powershell
Test-NetConnection 192.168.2.200 -Port 5173
```

`TcpTestSucceeded`が`True`なら、スマートフォンのブラウザで次を開きます。

```text
http://192.168.2.200:5173/youtube-quiz-battle/?quiz=sample
```

Viteの起動ログに表示される`172.*`や`10.*`のアドレスはWSL内部側のものです。スマートフォンからは、転送を待ち受けているWindowsの`192.168.*`アドレスを使用します。

## 接続できない場合

次の順で確認します。

1. WSLでViteが終了していないか
2. Viteを`--host 0.0.0.0`付きで起動しているか
3. `hostname -I`で確認したWSLのIPが`portproxy`の`connectaddress`と一致しているか
4. `ipconfig`で確認したWindowsのIPが`portproxy`の`listenaddress`とファイアウォール規則の`LocalAddress`の両方に一致しているか
5. スマートフォンがPCと同じLANまたはWi-Fiに接続されているか
6. Windowsのネットワークプロファイルがプライベートか
7. ファイアウォール規則が有効か

設定の確認には次を使用します。

```powershell
netsh interface portproxy show v4tov4
Get-NetFirewallRule -DisplayName "WSL Vite Dev 5173"
Get-Service iphlpsvc
```

WSLを再起動するとWSL側IPが変わることがあります。その場合は、手順1で新しいIPを確認し、手順3の`portproxy`を更新します。

### WindowsのLAN側IPが変わった場合

WindowsのLAN側IPはDHCPや接続先ネットワークの変更によって変わることがあります。`portproxy`とファイアウォール規則の両方を、管理者権限のPowerShellで更新します。

1. `netsh interface portproxy show v4tov4`で旧`listenaddress`を確認し、「設定を削除する」のコマンドに旧IPと対象ポートを指定して転送設定を削除します。
2. 手順3の`$WindowsLanIp`を現在のWindows側IP、`$WslIp`を現在のWSL側IPにして、転送設定を追加します。
3. `Remove-NetFirewallRule -DisplayName "WSL Vite Dev 5173"`で既存の対象規則を削除し、手順4の`-LocalAddress`を新しいWindows側IPに置き換えて規則を作り直します。ポートを変更している場合は対象の規則名・ポートも合わせます。
4. 手順5の接続先URLも新しいWindows側IPへ変更し、スマートフォンから接続を確認します。

## 設定を削除する

転送設定とファイアウォール規則が不要になった場合は、管理者権限のPowerShellで削除できます。

```powershell
netsh interface portproxy delete v4tov4 `
  listenaddress=192.168.2.200 listenport=5173

Remove-NetFirewallRule -DisplayName "WSL Vite Dev 5173"
```

開発サーバーはLAN内へ公開されるため、確認が終わったらViteを終了してください。
