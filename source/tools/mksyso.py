# Пишет COFF-объект .syso с иконкой и манифестом для Go (amd64)
import struct, sys
def _pad(b):
    while len(b) % 4: b += b'\x00'
    return b
def _node(key, value=b'', wtype=1, children=(), vlen=None):
    k = (key + '\x00').encode('utf-16-le')
    hdr_len = 6 + len(k)
    body = bytearray(6) + k
    body = _pad(body)
    body += value
    if children:
        body = _pad(body)
        for i, c in enumerate(children):
            body = _pad(body); body += c
    if vlen is None: vlen = len(value) // 2 if wtype == 1 else len(value)
    struct.pack_into('<HHH', body, 0, len(body), vlen, wtype)
    return bytes(body)
def versioninfo(fields, ver=(1, 0, 0, 0)):
    ms, ls = (ver[0] << 16) | ver[1], (ver[2] << 16) | ver[3]
    fixed = struct.pack('<IIIIIIIIIIIII', 0xFEEF04BD, 0x00010000, ms, ls, ms, ls, 0x3f, 0, 0x40004, 1, 0, 0, 0)
    strs = [_node(k, (v + '\x00').encode('utf-16-le'), 1) for k, v in fields]
    table = _node('041904B0', b'', 1, strs, 0)
    sfi = _node('StringFileInfo', b'', 1, [table], 0)
    var = _node('Translation', struct.pack('<HH', 0x0419, 0x04B0), 0)
    vfi = _node('VarFileInfo', b'', 1, [var], 0)
    return _node('VS_VERSION_INFO', fixed, 0, [sfi, vfi])
def build(pngs, out, manifest=None, vinfo=None):
    # ресурсы: (type, id, data)
    res = []
    for i, p in enumerate(pngs, 1):
        res.append((3, i, open(p, 'rb').read()))
    grp = struct.pack('<HHH', 0, 1, len(pngs))
    from PIL import Image
    for i, p in enumerate(pngs, 1):
        w, h = Image.open(p).size
        data = open(p, 'rb').read()
        grp += struct.pack('<BBBBHHIH', w % 256, h % 256, 0, 0, 1, 32, len(data), i)
    res.append((14, 1, grp))
    if manifest: res.append((24, 1, manifest.encode('utf-8')))
    if vinfo: res.append((16, 1, vinfo))
    types = sorted(set(r[0] for r in res))
    # раскладка: root dir, type dirs, name dirs (lang), data entries, data
    root_size = 16 + 8 * len(types)
    off = root_size
    type_dir_off = {}
    for t in types:
        n = len([r for r in res if r[0] == t]); type_dir_off[t] = off; off += 16 + 8 * n
    lang_dir_off = {}
    for r in res:
        lang_dir_off[(r[0], r[1])] = off; off += 16 + 8
    data_entry_off = {}
    for r in res:
        data_entry_off[(r[0], r[1])] = off; off += 16
    data_off = {}
    for r in res:
        off = (off + 7) & ~7; data_off[(r[0], r[1])] = off; off += len(r[2])
    total = (off + 7) & ~7
    buf = bytearray(total)
    def dirhdr(o, n): struct.pack_into('<IIHHHH', buf, o, 0, 0, 0, 0, 0, n)
    dirhdr(0, len(types))
    for k, t in enumerate(types):
        struct.pack_into('<II', buf, 16 + 8 * k, t, 0x80000000 | type_dir_off[t])
    relocs = []
    for t in types:
        items = sorted([r for r in res if r[0] == t], key=lambda r: r[1])
        o = type_dir_off[t]; dirhdr(o, len(items))
        for k, r in enumerate(items):
            struct.pack_into('<II', buf, o + 16 + 8 * k, r[1], 0x80000000 | lang_dir_off[(t, r[1])])
    for r in res:
        o = lang_dir_off[(r[0], r[1])]; dirhdr(o, 1)
        struct.pack_into('<II', buf, o + 16, 1033, data_entry_off[(r[0], r[1])])
        de = data_entry_off[(r[0], r[1])]
        struct.pack_into('<IIII', buf, de, data_off[(r[0], r[1])], len(r[2]), 0, 0)
        relocs.append(de)
        buf[data_off[(r[0], r[1])]:data_off[(r[0], r[1])] + len(r[2])] = r[2]
    hdr_size = 20 + 40
    raw_ptr = hdr_size
    reloc_ptr = raw_ptr + total
    sym_ptr = reloc_ptr + 10 * len(relocs)
    out_b = bytearray()
    out_b += struct.pack('<HHIIIHH', 0x8664, 1, 0, sym_ptr, 1, 0, 0)
    out_b += struct.pack('<8sIIIIIIHHI', b'.rsrc', 0, 0, total, raw_ptr, reloc_ptr, 0, len(relocs), 0, 0x40000040)
    out_b += buf
    for r in relocs: out_b += struct.pack('<IIH', r, 0, 3)
    out_b += struct.pack('<8sIhHBB', b'.rsrc', 0, 1, 0, 3, 0)
    out_b += struct.pack('<I', 4)
    open(out, 'wb').write(out_b)
MANIFEST = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
<assemblyIdentity version="1.0.0.0" processorArchitecture="*" name="HomePolice" type="win32"/>
<trustInfo xmlns="urn:schemas-microsoft-com:asm.v3"><security><requestedPrivileges><requestedExecutionLevel level="asInvoker" uiAccess="false"/></requestedPrivileges></security></trustInfo>
<application xmlns="urn:schemas-microsoft-com:asm.v3"><windowsSettings><dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true</dpiAware></windowsSettings></application>
<dependency><dependentAssembly><assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/></dependentAssembly></dependency>
</assembly>'''
pngs = [f'ico/{s}.png' for s in [256, 64, 48, 32, 24, 16]]
DESC = {'launcher': ('HOME POLICE — детективная игра', 'HOME POLICE.exe'), 'setup': ('Установщик игры HOME POLICE', 'HOME_POLICE_Setup.exe')}
for d in sys.argv[1:]:
    desc, fn = DESC.get(d.rstrip('/').split('/')[-1], ('HOME POLICE', 'HOME POLICE.exe'))
    vi = versioninfo([('CompanyName', 'HOME POLICE Studio'), ('FileDescription', desc), ('FileVersion', '2.1.0.0'), ('InternalName', 'homepolice'),
                      ('LegalCopyright', '© 2026 HOME POLICE Studio'), ('OriginalFilename', fn), ('ProductName', 'HOME POLICE'), ('ProductVersion', '2.1.0.0')], (2, 1, 0, 0))
    build(pngs, d + '/rsrc_windows_amd64.syso', MANIFEST, vi)
print('ok')
