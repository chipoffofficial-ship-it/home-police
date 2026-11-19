// Установщик HOME POLICE с выбором параметров установки
package main

import (
	_ "embed"
	"encoding/base64"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unicode/utf16"
	"unsafe"
)

//go:embed game.exe
var gameExe []byte

//go:embed icon.ico
var iconIco []byte

//go:embed logo.png
var logoPng []byte

const (
	title   = "HOME POLICE — установка"
	mbOK    = 0x00000040
	mbErr   = 0x00000010
	mbWarn  = 0x00000030
	mbYesNo = 0x00000004 | 0x00000020
	idYes   = 6
	regKey  = `HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\HOMEPOLICE`
)

type options struct {
	dir                string
	desktop, menu, run bool
}

func msgBox(text, caption string, flags uint32) int {
	u := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW")
	t, _ := syscall.UTF16PtrFromString(text)
	c, _ := syscall.UTF16PtrFromString(caption)
	r, _, _ := u.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), uintptr(flags|0x00010000))
	return int(r)
}

func hidden(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return cmd
}

// psCmd — фоновый PowerShell без окон (для служебных команд).
func psCmd(script string) *exec.Cmd {
	return hidden(psRaw(script))
}

// psForm — PowerShell для окна установки: без консоли, но окно формы ДОЛЖНО быть видимым,
// поэтому HideWindow (SW_HIDE) здесь не ставим — иначе Windows скрывает и саму форму.
func psForm(script string) *exec.Cmd {
	c := psRaw(script)
	c.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000}
	return c
}

func psRaw(script string) *exec.Cmd {
	u := utf16.Encode([]rune(script))
	b := make([]byte, len(u)*2)
	for i, v := range u {
		b[i*2] = byte(v)
		b[i*2+1] = byte(v >> 8)
	}
	enc := base64.StdEncoding.EncodeToString(b)
	return exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-EncodedCommand", enc)
}

func ps(script string) error { return psCmd(script).Run() }

func q(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }

func b64(s string) string { return base64.StdEncoding.EncodeToString([]byte(s)) }

func unb64(s string) string {
	b, err := base64.StdEncoding.DecodeString(strings.TrimSpace(s))
	if err != nil {
		return ""
	}
	return string(b)
}

func defaultDir() string {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base = filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Local")
	}
	return filepath.Join(base, "Programs", "HOME POLICE")
}

// Окно выбора параметров (WinForms через PowerShell)
func showForm(def options) (options, bool) {
	tmp, _ := os.MkdirTemp("", "homepolice-setup")
	defer os.RemoveAll(tmp)
	ico := filepath.Join(tmp, "icon.ico")
	png := filepath.Join(tmp, "logo.png")
	os.WriteFile(ico, iconIco, 0644)
	os.WriteFile(png, logoPng, 0644)
	bi := func(v bool) string {
		if v {
			return "$true"
		}
		return "$false"
	}
	script := `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$def = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('` + b64(def.dir) + `'))
$gold = [Drawing.Color]::FromArgb(227,181,94)
$dark = [Drawing.Color]::FromArgb(20,25,34)
$f = New-Object Windows.Forms.Form
$f.Text = 'HOME POLICE — установка'
$f.AutoScaleMode = 'Dpi'
$f.ClientSize = New-Object Drawing.Size(560, 400)
$f.FormBorderStyle = 'FixedDialog'; $f.MaximizeBox = $false; $f.MinimizeBox = $false
$f.StartPosition = 'CenterScreen'
$f.WindowState = 'Normal'
$f.ShowInTaskbar = $true
$f.TopMost = $true
try { $f.Icon = New-Object Drawing.Icon(` + q(ico) + `) } catch {}
$f.Font = New-Object Drawing.Font('Segoe UI', 10)
$f.BackColor = [Drawing.Color]::FromArgb(246,241,230)

$hdr = New-Object Windows.Forms.Panel
$hdr.Dock = 'Top'; $hdr.Height = 100; $hdr.BackColor = $dark
$pic = New-Object Windows.Forms.PictureBox
try { $pic.Image = [Drawing.Image]::FromFile(` + q(png) + `) } catch {}
$pic.SizeMode = 'Zoom'; $pic.Location = New-Object Drawing.Point(22,14); $pic.Size = New-Object Drawing.Size(72,72); $pic.BackColor = $dark
$t1 = New-Object Windows.Forms.Label
$t1.Text = 'HOME POLICE'; $t1.ForeColor = $gold; $t1.BackColor = $dark
$t1.Font = New-Object Drawing.Font('Georgia', 22, [Drawing.FontStyle]::Bold)
$t1.Location = New-Object Drawing.Point(108,16); $t1.AutoSize = $true
$t2 = New-Object Windows.Forms.Label
$t2.Text = 'Детектив: допросы, улики, телефоны, банки'; $t2.ForeColor = [Drawing.Color]::FromArgb(160,168,185); $t2.BackColor = $dark
$t2.Location = New-Object Drawing.Point(111,60); $t2.AutoSize = $true
$hdr.Controls.AddRange(@($pic,$t1,$t2))

$l = New-Object Windows.Forms.Label
$l.Text = 'Куда установить игру:'; $l.Location = New-Object Drawing.Point(24,118); $l.AutoSize = $true
$l.Font = New-Object Drawing.Font('Segoe UI', 10, [Drawing.FontStyle]::Bold)
$tb = New-Object Windows.Forms.TextBox
$tb.Text = $def; $tb.Location = New-Object Drawing.Point(24,144); $tb.Size = New-Object Drawing.Size(400,28)
$bb = New-Object Windows.Forms.Button
$bb.Text = 'Обзор…'; $bb.Location = New-Object Drawing.Point(434,142); $bb.Size = New-Object Drawing.Size(102,30)
$bb.Add_Click({ try {
  $d = New-Object Windows.Forms.FolderBrowserDialog
  $d.Description = 'Выберите папку. Игра будет установлена в подпапку «HOME POLICE».'
  $d.ShowNewFolderButton = $true
  $cur = $tb.Text.Trim()
  if ($cur -and (Test-Path -LiteralPath (Split-Path -Parent $cur))) { $d.SelectedPath = (Split-Path -Parent $cur) }
  if ($d.ShowDialog($f) -eq 'OK') {
    $p = $d.SelectedPath
    if (-not ($p.TrimEnd('\').ToLower().EndsWith('home police'))) { $p = Join-Path $p 'HOME POLICE' }
    $tb.Text = $p
  }
} catch {} })
$c1 = New-Object Windows.Forms.CheckBox
$c1.Text = 'Создать ярлык на рабочем столе'; $c1.Checked = ` + bi(def.desktop) + `
$c1.Location = New-Object Drawing.Point(24,190); $c1.AutoSize = $true
$c2 = New-Object Windows.Forms.CheckBox
$c2.Text = 'Добавить в меню «Пуск»'; $c2.Checked = ` + bi(def.menu) + `
$c2.Location = New-Object Drawing.Point(24,218); $c2.AutoSize = $true
$c3 = New-Object Windows.Forms.CheckBox
$c3.Text = 'Запустить игру после установки'; $c3.Checked = ` + bi(def.run) + `
$c3.Location = New-Object Drawing.Point(24,246); $c3.AutoSize = $true
$info = New-Object Windows.Forms.Label
$info.Text = 'Нужно около 15 МБ. Прогресс хранится отдельно и не пропадёт при переустановке или смене папки.'
$info.ForeColor = [Drawing.Color]::FromArgb(110,98,76)
$info.Location = New-Object Drawing.Point(24,284); $info.Size = New-Object Drawing.Size(512,44)
$ok = New-Object Windows.Forms.Button
$ok.Text = 'Установить'; $ok.Location = New-Object Drawing.Point(316,346); $ok.Size = New-Object Drawing.Size(112,36)
$ok.BackColor = $gold; $ok.FlatStyle = 'Flat'; $ok.FlatAppearance.BorderColor = [Drawing.Color]::FromArgb(185,138,55)
$ok.Font = New-Object Drawing.Font('Segoe UI', 10, [Drawing.FontStyle]::Bold)
$ok.DialogResult = 'OK'
$cn = New-Object Windows.Forms.Button
$cn.Text = 'Отмена'; $cn.Location = New-Object Drawing.Point(436,346); $cn.Size = New-Object Drawing.Size(100,36)
$cn.DialogResult = 'Cancel'
$f.AcceptButton = $ok; $f.CancelButton = $cn
$f.Controls.AddRange(@($hdr,$l,$tb,$bb,$c1,$c2,$c3,$info,$ok,$cn))
$f.Add_Shown({ $f.Activate(); $f.TopMost = $false; $ok.Focus() })
$r = $f.ShowDialog()
if ($r -eq [Windows.Forms.DialogResult]::OK) {
  $b = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($tb.Text.Trim()))
  Write-Output ('OK|' + $b + '|' + [int]$c1.Checked + '|' + [int]$c2.Checked + '|' + [int]$c3.Checked)
} else { Write-Output 'CANCEL' }
`
	out, err := psForm(script).Output()
	if err != nil && len(out) == 0 {
		// PowerShell недоступен — запасной вариант без окна
		if msgBox("Установить HOME POLICE в папку:\n"+def.dir+"\n\nБудут созданы ярлыки на рабочем столе и в меню «Пуск».", title, mbYesNo) == idYes {
			return def, true
		}
		return def, false
	}
	line := ""
	for _, s := range strings.Split(strings.ReplaceAll(string(out), "\r", ""), "\n") {
		if strings.HasPrefix(s, "OK|") || s == "CANCEL" {
			line = s
		}
	}
	if !strings.HasPrefix(line, "OK|") {
		return def, false
	}
	p := strings.Split(line, "|")
	if len(p) < 5 {
		return def, false
	}
	return options{dir: unb64(p[1]), desktop: p[2] == "1", menu: p[3] == "1", run: p[4] == "1"}, true
}

func validDir(d string) bool {
	if d == "" || !filepath.IsAbs(d) || len(filepath.VolumeName(d)) == 0 {
		return false
	}
	return !strings.ContainsAny(d[len(filepath.VolumeName(d)):], `<>:"|?*`)
}

func canWrite(dir string) bool {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return false
	}
	t := filepath.Join(dir, ".write-test")
	if err := os.WriteFile(t, []byte("ok"), 0644); err != nil {
		return false
	}
	os.Remove(t)
	return true
}

func elevate(args string) bool {
	self, err := os.Executable()
	if err != nil {
		return false
	}
	sh := syscall.NewLazyDLL("shell32.dll").NewProc("ShellExecuteW")
	verb, _ := syscall.UTF16PtrFromString("runas")
	file, _ := syscall.UTF16PtrFromString(self)
	par, _ := syscall.UTF16PtrFromString(args)
	r, _, _ := sh.Call(0, uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(file)), uintptr(unsafe.Pointer(par)), 0, 1)
	return r > 32
}

func optArgs(o options) string {
	bs := func(v bool) string {
		if v {
			return "1"
		}
		return "0"
	}
	return "--elevated " + b64(o.dir) + " " + bs(o.desktop) + bs(o.menu) + bs(o.run)
}

func doInstall(o options, elevated bool) {
	hidden(exec.Command("taskkill", "/F", "/IM", "HOME POLICE.exe")).Run()
	time.Sleep(400 * time.Millisecond)
	dir := o.dir
	if !canWrite(dir) {
		if elevated {
			msgBox("Нет доступа к папке:\n"+dir+"\n\nВыберите другую папку.", title, mbErr)
			return
		}
		if msgBox("Для установки в эту папку нужны права администратора:\n"+dir+"\n\nПерезапустить установщик с правами администратора?", title, mbYesNo) == idYes {
			if !elevate(optArgs(o)) {
				msgBox("Не удалось получить права администратора. Выберите другую папку, например в своей папке пользователя.", title, mbWarn)
			}
		}
		return
	}
	exe := filepath.Join(dir, "HOME POLICE.exe")
	ico := filepath.Join(dir, "HOME POLICE.ico")
	unin := filepath.Join(dir, "Удалить HOME POLICE.exe")
	if err := os.WriteFile(exe, gameExe, 0755); err != nil {
		msgBox("Не удалось записать файл игры:\n"+err.Error(), title, mbErr)
		return
	}
	os.WriteFile(ico, iconIco, 0644)
	if self, err := os.Executable(); err == nil {
		if b, err := os.ReadFile(self); err == nil {
			os.WriteFile(unin, b, 0755)
		}
	}
	bi := func(v bool) string {
		if v {
			return "$true"
		}
		return "$false"
	}
	script := `
$ErrorActionPreference = 'SilentlyContinue'
$exe = ` + q(exe) + `
$ico = ` + q(ico) + `
$dir = ` + q(dir) + `
$unin = ` + q(unin) + `
$sh = New-Object -ComObject WScript.Shell
function MakeLink($path, $target, $arguments) {
  $l = $sh.CreateShortcut($path)
  $l.TargetPath = $target
  if ($arguments) { $l.Arguments = $arguments }
  $l.WorkingDirectory = $dir
  $l.IconLocation = "$ico,0"
  $l.Description = 'HOME POLICE — детективная игра'
  $l.Save()
}
$desk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'HOME POLICE.lnk'
$menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'HOME POLICE'
Remove-Item -Force $desk
Remove-Item -Recurse -Force $menu
if (` + bi(o.desktop) + `) { MakeLink $desk $exe $null }
if (` + bi(o.menu) + `) {
  New-Item -ItemType Directory -Force -Path $menu | Out-Null
  MakeLink (Join-Path $menu 'HOME POLICE.lnk') $exe $null
  MakeLink (Join-Path $menu 'Удалить HOME POLICE.lnk') $unin '--uninstall'
}
$k = '` + regKey + `'
$old = (Get-ItemProperty -Path $k -Name InstallLocation).InstallLocation
if ($old -and ($old -ne $dir) -and (Test-Path -LiteralPath (Join-Path $old 'HOME POLICE.exe'))) {
  Remove-Item -Force -LiteralPath (Join-Path $old 'HOME POLICE.exe')
  Remove-Item -Force -LiteralPath (Join-Path $old 'HOME POLICE.ico')
  Remove-Item -Force -LiteralPath (Join-Path $old 'Удалить HOME POLICE.exe')
  Remove-Item -Force -LiteralPath $old
}
New-Item -Path $k -Force | Out-Null
Set-ItemProperty -Path $k -Name DisplayName -Value 'HOME POLICE'
Set-ItemProperty -Path $k -Name DisplayVersion -Value '2.0'
Set-ItemProperty -Path $k -Name Publisher -Value 'HOME POLICE'
Set-ItemProperty -Path $k -Name DisplayIcon -Value $ico
Set-ItemProperty -Path $k -Name InstallLocation -Value $dir
Set-ItemProperty -Path $k -Name UninstallString -Value ('"' + $unin + '" --uninstall')
Set-ItemProperty -Path $k -Name NoModify -Value 1 -Type DWord
Set-ItemProperty -Path $k -Name NoRepair -Value 1 -Type DWord
Set-ItemProperty -Path $k -Name EstimatedSize -Value 15000 -Type DWord
`
	ps(script)

	where := "Игра установлена в папку:\n" + dir
	if o.desktop {
		where += "\n\nЯрлык HOME POLICE — на рабочем столе."
	} else if o.menu {
		where += "\n\nИгра — в меню «Пуск»."
	}
	msgBox("Установка завершена!\n\n"+where, title, mbOK)
	if o.run {
		c := exec.Command(exe)
		c.Dir = dir
		c.Start()
	}
}

func uninstall(elevated bool) {
	self, _ := os.Executable()
	dir := filepath.Dir(self)
	if !elevated {
		if msgBox("Удалить HOME POLICE с этого компьютера?\n\nВаш прогресс сохранится — если установите игру снова, он вернётся.", "HOME POLICE — удаление", mbYesNo) != idYes {
			return
		}
		if !canWrite(dir) {
			if !elevate("--uninstall-confirmed") {
				msgBox("Для удаления нужны права администратора.", "HOME POLICE — удаление", mbWarn)
			}
			return
		}
	}
	hidden(exec.Command("taskkill", "/F", "/IM", "HOME POLICE.exe")).Run()
	time.Sleep(400 * time.Millisecond)
	ps(`
$ErrorActionPreference = 'SilentlyContinue'
Remove-Item -Force (Join-Path ([Environment]::GetFolderPath('Desktop')) 'HOME POLICE.lnk')
Remove-Item -Recurse -Force (Join-Path ([Environment]::GetFolderPath('Programs')) 'HOME POLICE')
Remove-Item -Recurse -Force '` + regKey + `'
`)
	os.Remove(filepath.Join(dir, "HOME POLICE.exe"))
	os.Remove(filepath.Join(dir, "HOME POLICE.ico"))
	// удалить себя и пустую папку после выхода (только если это папка игры)
	if strings.EqualFold(filepath.Base(dir), "HOME POLICE") {
		del := hidden(exec.Command("cmd.exe"))
		del.SysProcAttr.CmdLine = `cmd.exe /C ping -n 3 127.0.0.1 >nul & rmdir /S /Q "` + dir + `"`
		del.Start()
	} else {
		del := hidden(exec.Command("cmd.exe"))
		del.SysProcAttr.CmdLine = `cmd.exe /C ping -n 3 127.0.0.1 >nul & del /F /Q "` + self + `"`
		del.Start()
	}
	msgBox("HOME POLICE удалена.", "HOME POLICE — удаление", mbOK)
}

func main() {
	a := os.Args[1:]
	if len(a) > 0 {
		switch a[0] {
		case "--uninstall", "/uninstall":
			uninstall(false)
			return
		case "--uninstall-confirmed":
			uninstall(true)
			return
		case "--elevated":
			if len(a) >= 3 && len(a[2]) == 3 {
				o := options{dir: unb64(a[1]), desktop: a[2][0] == '1', menu: a[2][1] == '1', run: a[2][2] == '1'}
				if validDir(o.dir) {
					doInstall(o, true)
				}
			}
			return
		}
	}
	o := options{dir: defaultDir(), desktop: true, menu: true, run: true}
	for {
		var ok bool
		o, ok = showForm(o)
		if !ok {
			return
		}
		o.dir = filepath.Clean(strings.TrimSpace(o.dir))
		if !validDir(o.dir) {
			msgBox("Укажите полный путь к папке, например:\nC:\\Games\\HOME POLICE", title, mbWarn)
			continue
		}
		break
	}
	doInstall(o, false)
}
