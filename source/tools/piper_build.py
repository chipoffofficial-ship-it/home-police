#!/usr/bin/env python3
"""Собирает папку /voice сайта: движок Piper для браузера (sherpa-onnx WASM) и русские голоса.

Запуск: python3 source/tools/piper_build.py <папка_сайта>/voice
Нужен интернет (файлы берутся из релизов github.com/k2-fsa/sherpa-onnx).
После замены файлов увеличьте PACK в source/game/piper.js — игроки скачают голоса заново.
"""
import os, re, sys, tarfile, tempfile, urllib.request

SHERPA = '1.13.8'
WASM_URL = f'https://github.com/k2-fsa/sherpa-onnx/releases/download/v{SHERPA}/sherpa-onnx-wasm-simd-{SHERPA}-vits-piper-en_US-libritts_r-medium.tar.bz2'
VOICE_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-ru_RU-{}-medium.tar.bz2'
VOICES = ['dmitri', 'irina', 'denis', 'ruslan']
ESPEAK_KEEP = ('intonations', 'phondata', 'phondata-manifest', 'phonindex', 'phontab', 'ru_dict', 'ru')


def fetch(url, tmp):
    f = os.path.join(tmp, url.rsplit('/', 1)[1])
    if not os.path.exists(f):
        print('скачиваю', url)
        urllib.request.urlretrieve(url, f)
    d = f + '.d'
    if not os.path.isdir(d):
        with tarfile.open(f) as t:
            t.extractall(d, filter='data')
    sub = os.listdir(d)
    return os.path.join(d, sub[0]) if len(sub) == 1 else d


def cut_package(js):
    i = js.find('loadPackage({')
    j = js.find('})})();', i) + 1
    if i < 0 or j <= 0:
        raise SystemExit('не найден список файлов в ' + js[:40])
    return i, j


def main(out):
    os.makedirs(out, exist_ok=True)
    tmp = os.path.join(tempfile.gettempdir(), 'hp-piper')
    os.makedirs(tmp, exist_ok=True)
    src = fetch(WASM_URL, tmp)
    ph = os.path.join(src, 'piper-phonemize')
    # фонемизатор espeak-ng: оставляем только русские данные
    s = open(os.path.join(ph, 'piper-phonemize-wasm-main.js'), encoding='utf8').read()
    data = open(os.path.join(ph, 'piper-phonemize-wasm-main.data'), 'rb').read()
    i, j = cut_package(s)
    blob, meta = b'', []
    for f, a, b in re.findall(r'filename:"([^"]*)",start:(\d+),end:(\d+)', s[i:j]):
        if f.split('/')[-1] in ESPEAK_KEEP:
            meta.append('{filename:"%s",start:%d,end:%d}' % (f, len(blob), len(blob) + int(b) - int(a)))
            blob += data[int(a):int(b)]
    s = s[:i] + 'loadPackage({files:[%s],remote_package_size:%d}' % (','.join(meta), len(blob)) + s[j:]
    s += '\n' + open(os.path.join(ph, 'piper-phonemize.js'), encoding='utf8').read()
    open(os.path.join(out, 'phon.js'), 'w', encoding='utf8').write(s)
    open(os.path.join(out, 'phon.data'), 'wb').write(blob)
    open(os.path.join(out, 'phon.wasm'), 'wb').write(open(os.path.join(ph, 'piper-phonemize-wasm-main.wasm'), 'rb').read())
    # синтезатор: без встроенной модели, модели подкладывает игра
    t = open(os.path.join(src, 'sherpa-onnx-wasm-main-tts.js'), encoding='utf8').read()
    i, j = cut_package(t)
    t = t[:i] + 'loadPackage({files:[],remote_package_size:0}' + t[j:]
    t += '\n' + open(os.path.join(src, 'sherpa-onnx-tts.js'), encoding='utf8').read()
    open(os.path.join(out, 'tts.js'), 'w', encoding='utf8').write(t)
    open(os.path.join(out, 'tts.wasm'), 'wb').write(open(os.path.join(src, 'sherpa-onnx-wasm-main-tts.wasm'), 'rb').read())
    for v in VOICES:
        d = fetch(VOICE_URL.format(v), tmp)
        open(os.path.join(out, v + '.onnx'), 'wb').write(open(os.path.join(d, f'ru_RU-{v}-medium.onnx'), 'rb').read())
        open(os.path.join(out, v + '.txt'), 'wb').write(open(os.path.join(d, 'tokens.txt'), 'rb').read())
    for f in sorted(os.listdir(out)):
        print(f, os.path.getsize(os.path.join(out, f)))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
