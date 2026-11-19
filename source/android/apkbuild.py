#!/usr/bin/env python3
"""Сборка APK без Android SDK: бинарный манифест, resources.arsc, classes.dex, подпись jarsigner.
Приложение — полноэкранный WebView, который открывает assets/index.html."""
import struct, zlib, hashlib, zipfile, os, sys, subprocess

PKG = 'com.homepolice.game'
ACT = PKG + '.MainActivity'
LABEL = 'HOME POLICE'
VCODE, VNAME = 5, '5.0'
MIN_SDK, TARGET_SDK = 21, 29

# ---------------------------------------------------------------- DEX
def uleb(n):
    out = bytearray()
    while True:
        b = n & 0x7f; n >>= 7
        if n: out.append(b | 0x80)
        else: out.append(b); return bytes(out)

def mutf8(s):
    return s.encode('utf-8')  # только ASCII-строки

def build_dex():
    cls = 'L' + ACT.replace('.', '/') + ';'
    T_ACT, T_CTX, T_BUNDLE, T_VIEW, T_WS, T_WV, T_STR = ('Landroid/app/Activity;', 'Landroid/content/Context;', 'Landroid/os/Bundle;',
        'Landroid/view/View;', 'Landroid/webkit/WebSettings;', 'Landroid/webkit/WebView;', 'Ljava/lang/String;')
    URL = 'file:///android_asset/index.html'
    # прототипы: (shorty, return, [params])
    protos_def = [
        ('V', 'V', []), ('VL', 'V', [T_BUNDLE]), ('VL', 'V', [T_CTX]), ('VL', 'V', [T_STR]), ('VL', 'V', [T_VIEW]),
        ('ZI', 'Z', ['I']), ('VZ', 'V', ['Z']), ('L', T_WS, []), ('Z', 'Z', []),
    ]
    methods_def = [  # (class, name, proto-index)
        (T_ACT, '<init>', 0), (T_ACT, 'onCreate', 1), (T_ACT, 'requestWindowFeature', 5), (T_ACT, 'setContentView', 4),
        (T_WS, 'setAllowFileAccess', 6), (T_WS, 'setDomStorageEnabled', 6), (T_WS, 'setJavaScriptEnabled', 6),
        (T_WS, 'setMediaPlaybackRequiresUserGesture', 6),
        (T_WV, '<init>', 2), (T_WV, 'getSettings', 7), (T_WV, 'loadUrl', 3),
        (T_WV, 'canGoBack', 8), (T_WV, 'goBack', 0), (T_ACT, 'onBackPressed', 0),
        (cls, '<init>', 0), (cls, 'onCreate', 1), (cls, 'onBackPressed', 0),
    ]
    FIELD = (cls, 'w', T_WV)
    types_set = {T_ACT, T_CTX, T_BUNDLE, T_VIEW, T_WS, T_WV, T_STR, cls, 'V', 'Z', 'I'}
    strings = set(types_set) | {m[1] for m in methods_def} | {p[0] for p in protos_def} | {URL, FIELD[1]}
    # сортировка строк: по UTF-16 кодам (ASCII → обычная сортировка)
    strings = sorted(strings)
    sidx = {s: i for i, s in enumerate(strings)}
    types = sorted(types_set, key=lambda t: sidx[t])
    tidx = {t: i for i, t in enumerate(types)}
    # прототипы: уникальные (return, params), сортировка по return idx, затем по параметрам
    pkeys = []
    for sh, r, ps in protos_def:
        k = (tidx[r], tuple(tidx[p] for p in ps), sh)
        if k not in pkeys: pkeys.append(k)
    pkeys.sort(key=lambda k: (k[0], k[1]))
    def proto_index(i):
        sh, r, ps = protos_def[i]
        return next(j for j, k in enumerate(pkeys) if k[0] == tidx[r] and k[1] == tuple(tidx[p] for p in ps))
    mkeys = sorted({(tidx[c], sidx[n], proto_index(p)) for c, n, p in methods_def})
    def midx(c, n, p): return mkeys.index((tidx[c], sidx[n], proto_index(p)))
    F_IDX = 0

    # --- байткод
    def i35c(op, mref, regs):
        regs = list(regs) + [0] * (5 - len(regs))
        a = len([r for r in regs if r is not None])
        return struct.pack('<BBHH', op, (a << 4) | 0, mref, regs[0] | (regs[1] << 4) | (regs[2] << 8) | (regs[3] << 12))
    def inv(op, mref, regs):
        n = len(regs)
        rr = list(regs) + [0] * (4 - n)
        return struct.pack('<BBHH', op, (n << 4) | 0, mref, rr[0] | (rr[1] << 4) | (rr[2] << 8) | (rr[3] << 12))
    INV_VIRT, INV_SUPER, INV_DIRECT = 0x6e, 0x6f, 0x70
    def const4(reg, v): return struct.pack('<BB', 0x12, ((v & 0xf) << 4) | reg)
    def new_inst(reg, t): return struct.pack('<BBH', 0x22, reg, t)
    def mro(reg): return struct.pack('<BB', 0x0c, reg)
    def cstr(reg, s): return struct.pack('<BBH', 0x1a, reg, s)
    RET_VOID = struct.pack('<BB', 0x0e, 0)
    # конструктор: registers=1 (p0=v0)
    init_code = inv(INV_DIRECT, midx(T_ACT, '<init>', 0), [0]) + RET_VOID
    # onCreate: v0..v2 локальные, p0=v3 (this), p1=v4 (bundle)
    oc = b''
    oc += inv(INV_SUPER, midx(T_ACT, 'onCreate', 1), [3, 4])
    oc += const4(0, 1)
    oc += inv(INV_VIRT, midx(T_ACT, 'requestWindowFeature', 5), [3, 0])
    oc += new_inst(0, tidx[T_WV])
    oc += inv(INV_DIRECT, midx(T_WV, '<init>', 2), [0, 3])
    oc += inv(INV_VIRT, midx(T_WV, 'getSettings', 7), [0])
    oc += mro(1)
    oc += const4(2, 1)
    oc += inv(INV_VIRT, midx(T_WS, 'setJavaScriptEnabled', 6), [1, 2])
    oc += inv(INV_VIRT, midx(T_WS, 'setDomStorageEnabled', 6), [1, 2])
    oc += inv(INV_VIRT, midx(T_WS, 'setAllowFileAccess', 6), [1, 2])
    oc += const4(2, 0)
    oc += inv(INV_VIRT, midx(T_WS, 'setMediaPlaybackRequiresUserGesture', 6), [1, 2])
    oc += cstr(1, sidx[URL])
    oc += inv(INV_VIRT, midx(T_WV, 'loadUrl', 3), [0, 1])
    oc += struct.pack('<BBH', 0x5b, (3 << 4) | 0, F_IDX)  # iput-object v0, this.w
    oc += inv(INV_VIRT, midx(T_ACT, 'setContentView', 4), [3, 0])
    oc += RET_VOID
    # onBackPressed: v0,v1 локальные, p0 = v2
    ob = b''
    ob += struct.pack('<BBH', 0x54, (2 << 4) | 0, F_IDX)          # iget-object v0, this.w      @0
    ob += inv(INV_VIRT, midx(T_WV, 'canGoBack', 8), [0])          # @2
    ob += struct.pack('<BB', 0x0a, 1)                              # move-result v1              @5
    ob += struct.pack('<BBh', 0x38, 1, 6)                          # if-eqz v1, +6 → @12         @6
    ob += inv(INV_VIRT, midx(T_WV, 'goBack', 0), [0])              # @8
    ob += RET_VOID                                                 # @11
    ob += inv(INV_SUPER, midx(T_ACT, 'onBackPressed', 0), [2])     # @12
    ob += RET_VOID                                                 # @15
    def code_item(regs, ins, outs, insns):
        assert len(insns) % 2 == 0
        return struct.pack('<HHHHII', regs, ins, outs, 0, 0, len(insns) // 2) + insns

    # --- раскладка
    HDR = 0x70
    off = HDR
    string_ids_off = off; off += 4 * len(strings)
    type_ids_off = off; off += 4 * len(types)
    proto_ids_off = off; off += 12 * len(pkeys)
    field_ids_off = off; off += 8
    method_ids_off = off; off += 8 * len(mkeys)
    class_defs_off = off; off += 32
    data_off = off
    data = bytearray()
    def align4():
        while (data_off + len(data)) % 4: data.append(0)
    # code items
    align4(); code_init_off = data_off + len(data); data += code_item(1, 1, 1, init_code)
    align4(); code_oc_off = data_off + len(data); data += code_item(5, 2, 2, oc)
    align4(); code_ob_off = data_off + len(data); data += code_item(3, 1, 1, ob)
    # type lists
    tl_off = {}
    for k in pkeys:
        if k[1] and k[1] not in tl_off:
            align4(); tl_off[k[1]] = data_off + len(data)
            data += struct.pack('<I', len(k[1])) + b''.join(struct.pack('<H', t) for t in k[1])
    n_tl = len(tl_off)
    # string data
    sd_off = []
    str_data_start = data_off + len(data)
    for s in strings:
        sd_off.append(data_off + len(data))
        data += uleb(len(s)) + mutf8(s) + b'\x00'
    # class data
    class_data_off = data_off + len(data)
    m_init = midx(cls, '<init>', 0); m_oc = midx(cls, 'onCreate', 1); m_ob = midx(cls, 'onBackPressed', 0)
    data += uleb(0) + uleb(1) + uleb(1) + uleb(2)
    data += uleb(F_IDX) + uleb(0x2)
    data += uleb(m_init) + uleb(0x10001) + uleb(code_init_off)
    virt = sorted([(m_oc, code_oc_off), (m_ob, code_ob_off)])
    prev = 0
    for k, (mi, co) in enumerate(virt):
        data += uleb(mi - prev if k else mi) + uleb(0x0001) + uleb(co); prev = mi
    # map
    align4(); map_off = data_off + len(data)
    items = [(0x0000, 1, 0), (0x0001, len(strings), string_ids_off), (0x0002, len(types), type_ids_off), (0x0003, len(pkeys), proto_ids_off),
             (0x0004, 1, field_ids_off), (0x0005, len(mkeys), method_ids_off), (0x0006, 1, class_defs_off), (0x2001, 3, code_init_off)]
    if n_tl: items.append((0x1001, n_tl, min(tl_off.values())))
    items += [(0x2002, len(strings), str_data_start), (0x2000, 1, class_data_off), (0x1000, 1, map_off)]
    items.sort(key=lambda x: x[2])
    data += struct.pack('<I', len(items)) + b''.join(struct.pack('<HHII', t, 0, n, o) for t, n, o in items)
    file_size = data_off + len(data)
    # ids
    ids = bytearray()
    for i in range(len(strings)): ids += struct.pack('<I', sd_off[i])
    for t in types: ids += struct.pack('<I', sidx[t])
    shorty_of = {}
    for sh, r, ps in protos_def: shorty_of[(tidx[r], tuple(tidx[p] for p in ps))] = sh
    for k in pkeys: ids += struct.pack('<III', sidx[k[2]], k[0], tl_off.get(k[1], 0) if k[1] else 0)
    ids += struct.pack('<HHI', tidx[FIELD[0]], tidx[FIELD[2]], sidx[FIELD[1]])
    for c, n, p in mkeys: ids += struct.pack('<HHI', c, p, n)
    ids += struct.pack('<IIIIIIII', tidx[cls], 0x1, tidx[T_ACT], 0, 0xffffffff, 0, class_data_off, 0)
    assert HDR + len(ids) == data_off
    body = bytearray(HDR) + ids + data
    struct.pack_into('<8s', body, 0, b'dex\n035\x00')
    struct.pack_into('<IIIIIIIIIIIIIIIIIIII', body, 32,
        file_size, HDR, 0x12345678, 0, 0, map_off,
        len(strings), string_ids_off, len(types), type_ids_off, len(pkeys), proto_ids_off,
        1, field_ids_off, len(mkeys), method_ids_off, 1, class_defs_off, file_size - data_off, data_off)
    sig = hashlib.sha1(bytes(body[32:])).digest()
    body[12:32] = sig
    struct.pack_into('<I', body, 8, zlib.adler32(bytes(body[12:])) & 0xffffffff)
    return bytes(body)

# ---------------------------------------------------------------- бинарный XML
ANDROID_NS = 'http://schemas.android.com/apk/res/android'
ATTR_IDS = {
    'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003, 'exported': 0x01010010,
    'screenOrientation': 0x0101001e, 'configChanges': 0x0101001f, 'minSdkVersion': 0x0101020c,
    'versionCode': 0x0101021b, 'versionName': 0x0101021c, 'windowSoftInputMode': 0x0101022b,
    'targetSdkVersion': 0x01010270, 'hardwareAccelerated': 0x010102d3,
}
T_REF, T_STRING, T_INT, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12

def string_pool_utf16(strs):
    offs, blob = [], bytearray()
    for s in strs:
        offs.append(len(blob))
        u = s.encode('utf-16-le')
        blob += struct.pack('<H', len(u) // 2) + u + b'\x00\x00'
    while len(blob) % 4: blob += b'\x00'
    hdr = 28
    start = hdr + 4 * len(strs)
    size = start + len(blob)
    return struct.pack('<HHIIIIII', 0x0001, hdr, size, len(strs), 0, 0, start, 0) + b''.join(struct.pack('<I', o) for o in offs) + bytes(blob)

def build_manifest():
    # дерево: (тег, [(ns?, имя, тип, значение)], [дети])
    A = lambda n, t, v: (True, n, t, v)
    tree = ('manifest', [A('versionCode', T_INT, VCODE), A('versionName', T_STRING, VNAME), (False, 'package', T_STRING, PKG)], [
        ('uses-sdk', [A('minSdkVersion', T_INT, MIN_SDK), A('targetSdkVersion', T_INT, TARGET_SDK)], []),
        ('uses-permission', [A('name', T_STRING, 'android.permission.INTERNET')], []),
        ('application', [A('label', T_STRING, LABEL), A('icon', T_REF, 0x7f010000), A('hardwareAccelerated', T_BOOL, True)], [
            ('receiver', [A('name', T_STRING, PKG + '.Rem'), A('exported', T_BOOL, False)], []),
            ('activity', [A('name', T_STRING, ACT), A('exported', T_BOOL, True), A('configChanges', T_HEX, 0x5b0), A('windowSoftInputMode', T_HEX, 0x10)], [
                ('intent-filter', [], [
                    ('action', [A('name', T_STRING, 'android.intent.action.MAIN')], []),
                    ('category', [A('name', T_STRING, 'android.intent.category.LAUNCHER')], []),
                ]),
            ]),
        ]),
    ])
    # строки: сначала имена атрибутов с id (в порядке id), затем остальные
    used = []
    def walk(n):
        for a in n[1]:
            if a[0] and a[1] not in used: used.append(a[1])
        for c in n[2]: walk(c)
    walk(tree)
    used.sort(key=lambda x: ATTR_IDS[x])
    strs = list(used)
    def S(s):
        if s not in strs: strs.append(s)
        return strs.index(s)
    for s in ['android', ANDROID_NS]: S(s)
    def collect(n):
        S(n[0])
        for a in n[1]:
            if not a[0]: S(a[1])
            if a[2] == T_STRING: S(a[3])
        for c in n[2]: collect(c)
    collect(tree)
    chunks = bytearray()
    line = [1]
    def start_el(n):
        attrs = []
        for ns, name, t, v in n[1]:
            nsi = S(ANDROID_NS) if ns else 0xffffffff
            if t == T_STRING: raw, data = S(v), S(v)
            elif t == T_BOOL: raw, data = 0xffffffff, 0xffffffff if v else 0
            else: raw, data = 0xffffffff, v
            rid = ATTR_IDS.get(name, 0) if ns else 0
            attrs.append((0 if rid else 1, rid, nsi, S(name), raw, t, data))
        attrs.sort(key=lambda a: (a[0], a[1]))
        body = struct.pack('<IIHHHHHH', 0xffffffff, S(n[0]), 20, 20, len(attrs), 0, 0, 0)
        for _, _, nsi, nm, raw, t, data in attrs:
            body += struct.pack('<IIIHBBI', nsi, nm, raw, 8, 0, t, data)
        ch = struct.pack('<HHIII', 0x0102, 16, 16 + len(body), line[0], 0xffffffff) + body
        line[0] += 1
        return ch
    def end_el(n):
        ch = struct.pack('<HHIIIII', 0x0103, 16, 24, line[0], 0xffffffff, 0xffffffff, S(n[0]))
        line[0] += 1
        return ch
    def emit(n):
        out = start_el(n)
        for c in n[2]: out += emit(c)
        return out + end_el(n)
    body = struct.pack('<HHIIIII', 0x0100, 16, 24, 1, 0xffffffff, S('android'), S(ANDROID_NS))
    body += emit(tree)
    body += struct.pack('<HHIIIII', 0x0101, 16, 24, line[0], 0xffffffff, S('android'), S(ANDROID_NS))
    pool = string_pool_utf16(strs)
    resmap = struct.pack('<HHI', 0x0180, 8, 8 + 4 * len(used)) + b''.join(struct.pack('<I', ATTR_IDS[u]) for u in used)
    total = 8 + len(pool) + len(resmap) + len(body)
    return struct.pack('<HHI', 0x0003, 8, total) + pool + resmap + bytes(body)

# ---------------------------------------------------------------- resources.arsc
def build_arsc(paths):
    gpool = string_pool_utf16(paths)
    tpool = string_pool_utf16(['drawable'])
    kpool = string_pool_utf16(['icon', 'notif'][:len(paths)])
    n = len(paths)
    typespec = struct.pack('<HHIBBHI', 0x0202, 16, 16 + 4 * n, 1, 0, 0, n) + b''.join(struct.pack('<I', 0) for _ in range(n))
    config = bytearray(struct.pack('<I', 64) + b'\x00' * 60); struct.pack_into('<H', config, 14, 640); config = bytes(config)
    entries = b''.join(struct.pack('<HHI', 8, 0, i) + struct.pack('<HBBI', 8, 0, T_STRING, i) for i in range(n))
    offs = b''.join(struct.pack('<I', 16 * i) for i in range(n))
    thdr = 8 + 4 + 4 + 4 + len(config)
    tchunk = struct.pack('<HHIBBHII', 0x0201, thdr, thdr + 4 * n + len(entries), 1, 0, 0, n, thdr + 4 * n) + config + offs + entries
    name = PKG.encode('utf-16-le').ljust(256, b'\x00')
    phdr = 288
    pkg_body = tpool + kpool + typespec + tchunk
    pkg = struct.pack('<HHII', 0x0200, phdr, phdr + len(pkg_body), 0x7f) + name + struct.pack('<IIIII', phdr, 1, phdr + len(tpool), n, 0) + pkg_body
    assert len(pkg) == phdr + len(pkg_body)
    return struct.pack('<HHII', 0x0002, 12, 12 + len(gpool) + len(pkg), 1) + gpool + pkg

# ---------------------------------------------------------------- сборка
def build(html_path, icon_png, out_apk, keystore, storepass):
    tmp = out_apk + '.unsigned'
    import app_dex
    dex, man, arsc = app_dex.build(), build_manifest(), build_arsc(['res/drawable-xxxhdpi/icon.png', 'res/drawable-xxxhdpi/notif.png'])
    with zipfile.ZipFile(tmp, 'w') as z:
        def add(name, data, store=False):
            zi = zipfile.ZipInfo(name, date_time=(2026, 11, 18, 12, 0, 0))
            zi.compress_type = zipfile.ZIP_STORED if store else zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            z.writestr(zi, data)
        add('AndroidManifest.xml', man)
        add('classes.dex', dex)
        add('resources.arsc', arsc, store=True)
        add('res/drawable-xxxhdpi/icon.png', open(icon_png, 'rb').read(), store=True)
        add('res/drawable-xxxhdpi/notif.png', open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'notif.png'), 'rb').read(), store=True)
        add('assets/index.html', open(html_path, 'rb').read())
    if not os.path.exists(keystore):
        subprocess.run(['keytool', '-genkeypair', '-keystore', keystore, '-storepass', storepass, '-keypass', storepass, '-alias', 'homepolice',
                        '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=HOME POLICE, O=HOME POLICE, C=RU'], check=True)
    subprocess.run(['jarsigner', '-keystore', keystore, '-storepass', storepass, '-sigalg', 'SHA256withRSA', '-digestalg', 'SHA-256',
                    '-signedjar', out_apk, tmp, 'homepolice'], check=True, capture_output=True)
    os.remove(tmp)
    return dex, man, arsc

if __name__ == '__main__':
    html, icon, out, ks, pw = sys.argv[1:6]
    d, m, a = build(html, icon, out, ks, pw)
    open(out + '.dex', 'wb').write(d); open(out + '.axml', 'wb').write(m); open(out + '.arsc', 'wb').write(a)
    print('ok', os.path.getsize(out))
