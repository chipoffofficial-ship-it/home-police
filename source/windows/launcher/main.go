// HOME POLICE — лаунчер: локальный сервер + окно игры
package main

import (
	_ "embed"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

//go:embed index.html
var page []byte

const updBase = "https://chipoffofficial-ship-it.github.io/home-police/game/"

var verRe = regexp.MustCompile(`name="hp-version" content="(\d+)"`)

func pageVer(b []byte) int {
	m := verRe.FindSubmatch(b)
	if m == nil {
		return 0
	}
	n, _ := strconv.Atoi(string(m[1]))
	return n
}

// Берём самую свежую версию игры: встроенную или скачанную ранее
func currentPage() []byte {
	cache, err := os.ReadFile(filepath.Join(dataDir(), "game.html"))
	if err == nil && pageVer(cache) > pageVer(page) {
		return cache
	}
	return page
}

// Проверяем обновление на GitHub; при успехе сохраняем и возвращаем новую версию
func updatePage(cur []byte) []byte {
	c := &http.Client{Timeout: 10 * time.Second}
	resp, err := c.Get(updBase + "version.json?t=" + strconv.FormatInt(time.Now().Unix(), 10))
	if err != nil {
		return cur
	}
	var v struct {
		Version int `json:"version"`
	}
	err = json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&v)
	resp.Body.Close()
	if err != nil || v.Version <= pageVer(cur) {
		return cur
	}
	c2 := &http.Client{Timeout: 60 * time.Second}
	r2, err := c2.Get(updBase + "game.html?v=" + strconv.Itoa(v.Version))
	if err != nil {
		return cur
	}
	defer r2.Body.Close()
	if r2.StatusCode != 200 {
		return cur
	}
	body, err := io.ReadAll(io.LimitReader(r2.Body, 30<<20))
	if err != nil || len(body) < 100000 || pageVer(body) != v.Version {
		return cur
	}
	f := filepath.Join(dataDir(), "game.html")
	if os.WriteFile(f+".tmp", body, 0644) == nil {
		os.Rename(f+".tmp", f)
	}
	return body
}

var browserCmd *exec.Cmd

var (
	mu       sync.Mutex
	lastPing = time.Now()
	gotPing  = false
)

func msgBox(text, title string, flags uint32) int {
	u := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW")
	t, _ := syscall.UTF16PtrFromString(text)
	c, _ := syscall.UTF16PtrFromString(title)
	r, _, _ := u.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), uintptr(flags))
	return int(r)
}

func dataDir() string {
	base := os.Getenv("APPDATA")
	if base == "" {
		base, _ = os.UserConfigDir()
	}
	d := filepath.Join(base, "HOME POLICE")
	os.MkdirAll(d, 0755)
	return d
}

func findBrowser() string {
	cands := []string{}
	for _, env := range []string{"ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"} {
		b := os.Getenv(env)
		if b == "" {
			continue
		}
		cands = append(cands,
			filepath.Join(b, "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(b, "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(b, "Yandex", "YandexBrowser", "Application", "browser.exe"),
		)
	}
	for _, c := range cands {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c
		}
	}
	return ""
}

var servePage []byte
var pageMu sync.Mutex

func getPage() []byte  { pageMu.Lock(); defer pageMu.Unlock(); return servePage }
func setPage(b []byte) { pageMu.Lock(); servePage = b; pageMu.Unlock() }

func main() {
	saveFile := filepath.Join(dataDir(), "save.json")
	servePage = currentPage()
	go func() {
		cur := getPage()
		nb := updatePage(cur)
		if pageVer(nb) > pageVer(cur) {
			setPage(nb)
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Write(getPage())
	})
	mux.HandleFunc("/api/ver", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Write([]byte(strconv.Itoa(pageVer(getPage()))))
	})
	mux.HandleFunc("/api/update", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "post", 405)
			return
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, 30<<20))
		if err != nil || len(body) < 100000 || pageVer(body) <= pageVer(getPage()) {
			w.Write([]byte("skip"))
			return
		}
		f := filepath.Join(dataDir(), "game.html")
		if os.WriteFile(f+".tmp", body, 0644) == nil {
			os.Rename(f+".tmp", f)
		}
		setPage(body)
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("/api/ping", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		lastPing = time.Now()
		gotPing = true
		mu.Unlock()
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("/api/save", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		lastPing = time.Now()
		gotPing = true
		mu.Unlock()
		if r.Method == http.MethodPost {
			b, err := io.ReadAll(io.LimitReader(r.Body, 20<<20))
			if err == nil && len(b) > 0 {
				tmp := saveFile + ".tmp"
				if os.WriteFile(tmp, b, 0644) == nil {
					os.Rename(tmp, saveFile)
				}
			}
			w.Write([]byte("ok"))
			return
		}
		b, err := os.ReadFile(saveFile)
		if err != nil {
			w.Write([]byte("{}"))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(b)
	})
	mux.HandleFunc("/api/quit", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("bye"))
		go func() {
			time.Sleep(300 * time.Millisecond)
			if browserCmd != nil && browserCmd.Process != nil {
				browserCmd.Process.Kill()
			}
			os.Exit(0)
		}()
	})

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		msgBox("Не удалось запустить игру: "+err.Error(), "HOME POLICE", 0x10)
		return
	}
	url := "http://" + ln.Addr().String() + "/"
	go http.Serve(ln, mux)

	br := findBrowser()
	if br != "" {
		prof := filepath.Join(dataDir(), "window")
		cmd := exec.Command(br, "--app="+url, "--user-data-dir="+prof, "--no-first-run",
			"--no-default-browser-check", "--disable-sync", "--disable-features=Translate,msEdgeSidebarV2,msUndersideButton",
			"--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--start-fullscreen")
		if cmd.Start() != nil {
			br = ""
		} else {
			browserCmd = cmd
		}
	}
	if br == "" {
		exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	}

	// работаем, пока окно игры присылает сигналы
	start := time.Now()
	for {
		time.Sleep(2 * time.Second)
		mu.Lock()
		g, lp := gotPing, lastPing
		mu.Unlock()
		if !g && time.Since(start) > 90*time.Second {
			msgBox("Окно игры не открылось. Убедитесь, что установлен Microsoft Edge или Google Chrome.", "HOME POLICE", 0x30)
			return
		}
		if g && time.Since(lp) > 150*time.Second {
			return
		}
	}
}
