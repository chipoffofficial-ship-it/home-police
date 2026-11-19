set -e
cd /home/claude/det
for f in portrait.js case1.js det.js; do node --check $f; done
node assemble.js
cp dist/index.html ../go/launcher/index.html
cd /home/claude
(cd go/launcher && GOOS=windows GOARCH=amd64 go vet . && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -H windowsgui" -o "HOME POLICE.exe" .)
cp "go/launcher/HOME POLICE.exe" go/setup/game.exe
(cd go/setup && GOOS=windows GOARCH=amd64 go vet . && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -H windowsgui" -o HOME_POLICE_Setup.exe .)
mkdir -p out && cp go/setup/HOME_POLICE_Setup.exe out/
ls -la out
