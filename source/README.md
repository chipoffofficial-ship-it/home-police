# HOME POLICE — исходный код

Всё, что нужно, чтобы собрать игру заново.

## Состав
- `game/` — сама игра (HTML/JS/CSS):
  - `det.js` — движок;
  - `case1.js` — авторское дело «Партия 17»;
  - `gen.js` — генератор 100 дел и обучающего дела;
  - `portrait.js` — рисованные портреты;
  - `piper.js` — нейросетевые голоса Piper: сами скачиваются с сайта (`/voice/`) при первом запуске, хранятся на устройстве и работают без интернета;
  - `det.css` — оформление;
  - `assemble.js` — склеивает всё в один файл `dist/index.html`, номер версии берётся из `version.txt`.
- `game/solver.js`, `logic2.js`, `timeline.js`, `crimecheck.js`, `audit.js` — проверки, что все дела проходятся и в них нет противоречий.
- `game/audit2.js` — ищет «очевидные» отличия преступника от невиновных (порядок, длина ответов, переписки, выписки, заметки). Запуск: `node game/audit2.js 400`; строки с ⚠️ — повод исправить генератор.
- `windows/launcher` — программа для ПК на Go: окно игры, сохранения, автообновление.
- `windows/setup` — установщик для ПК на Go.
- `android/` — сборка APK без Android SDK:
  - `apkbuild.py` — сборщик APK;
  - `app_dex.py` — код приложения: WebView, напоминания, озвучка;
  - `dexgen.py` — ассемблер DEX.
- `tools/piper_build.py` — собирает папку `/voice/` сайта (движок и русские голоса Piper). После замены файлов увеличьте `PACK` в `game/piper.js`.
- `tools/` — `mksyso.py` (иконка и сведения о файле для Windows), `rebuild.sh` (полная сборка ПК-версии), `ico/` (иконки).

## Как выпустить обновление
1. Увеличить число в `game/version.txt`.
2. Выполнить `node game/assemble.js`, затем `node game/solver.js`.
3. Скопировать `game/dist/index.html` в `/game/game.html` сайта.
4. В `/game/version.json` записать новый номер версии.
5. Сделать commit и push — игры на ПК и телефоне обновятся сами.

## Сборка установщика для ПК
Нужен Go 1.22+:

```
cp game/dist/index.html windows/launcher/index.html
cd windows/launcher && GOOS=windows GOARCH=amd64 go build -ldflags "-s -w -H windowsgui" -o "HOME POLICE.exe" .
cp "HOME POLICE.exe" ../setup/game.exe
cd ../setup && GOOS=windows GOARCH=amd64 go build -ldflags "-s -w -H windowsgui" -o HOME_POLICE_Setup.exe .
```

## Сборка APK
Нужны Python 3 и JDK (`keytool`, `jarsigner`):

```
python3 android/apkbuild.py game/dist/index.html android/icon192.png HOME_POLICE.apk hp.keystore <пароль>
```

**Ключ подписи `hp.keystore` в репозиторий не выкладывается: храните его отдельно.** Без того же ключа новый APK не установится поверх старого — игрокам придётся удалять приложение вместе с сохранениями.
