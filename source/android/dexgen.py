"""Мини-ассемблер DEX: несколько классов, методы с метками, поля. Без Android SDK."""
import struct, zlib, hashlib


def uleb(n):
    out = bytearray()
    while True:
        b = n & 0x7f; n >>= 7
        if n: out.append(b | 0x80)
        else: out.append(b); return bytes(out)


def mutf8(s):
    out = bytearray()
    u16 = s.encode('utf-16-be')
    for i in range(0, len(u16), 2):
        c = (u16[i] << 8) | u16[i + 1]
        if c != 0 and c < 0x80: out.append(c)
        elif c < 0x800: out += bytes([0xc0 | (c >> 6), 0x80 | (c & 0x3f)])
        else: out += bytes([0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)])
    return bytes(out)


def u16len(s): return len(s.encode('utf-16-le')) // 2
def u16key(s): return s.encode('utf-16-be')


class Ref:
    """Сборщик ссылок: первый проход собирает, второй выдаёт индексы."""
    def __init__(self):
        self.strings, self.types, self.protos, self.fields, self.methods = set(), set(), set(), set(), set()
        self.final = False

    def s(self, x):
        if not self.final: self.strings.add(x); return 0
        return self.sidx[x]

    def t(self, x):
        if not self.final: self.types.add(x); self.strings.add(x); return 0
        return self.tidx[x]

    def shorty(self, ret, params):
        c = lambda t: 'L' if t[0] in 'L[' else t
        return c(ret) + ''.join(c(p) for p in params)

    def p(self, ret, params):
        k = (ret, tuple(params))
        if not self.final:
            self.protos.add(k); self.t(ret); [self.t(x) for x in params]; self.strings.add(self.shorty(ret, params)); return 0
        return self.pidx[k]

    def f(self, cls, name, typ):
        k = (cls, name, typ)
        if not self.final: self.fields.add(k); self.t(cls); self.t(typ); self.s(name); return 0
        return self.fidx[k]

    def m(self, cls, name, ret, params):
        k = (cls, name, ret, tuple(params))
        if not self.final: self.methods.add(k); self.t(cls); self.s(name); self.p(ret, params); return 0
        return self.midx[k]

    def finish(self):
        self.slist = sorted(self.strings, key=u16key)
        self.sidx = {x: i for i, x in enumerate(self.slist)}
        self.tlist = sorted(self.types, key=lambda x: self.sidx[x])
        self.tidx = {x: i for i, x in enumerate(self.tlist)}
        self.plist = sorted(self.protos, key=lambda k: (self.tidx[k[0]], [self.tidx[x] for x in k[1]]))
        self.pidx = {x: i for i, x in enumerate(self.plist)}
        self.flist = sorted(self.fields, key=lambda k: (self.tidx[k[0]], self.sidx[k[1]], self.tidx[k[2]]))
        self.fidx = {x: i for i, x in enumerate(self.flist)}
        self.mlist = sorted(self.methods, key=lambda k: (self.tidx[k[0]], self.sidx[k[1]], self.pidx[(k[2], k[3])]))
        self.midx = {x: i for i, x in enumerate(self.mlist)}
        self.final = True


class Asm:
    """Байткод с метками. Каждая инструкция — функция (R, pos, labels) -> bytes фиксированной длины."""
    def __init__(self):
        self.ops = []  # (size_units, fn) или ('label', name)

    def label(self, n): self.ops.append(('label', n)); return self

    def raw(self, units, fn): self.ops.append((units, fn)); return self

    # --- инструкции
    def ret_void(self): return self.raw(1, lambda R, pos, L: struct.pack('<BB', 0x0e, 0))
    def ret(self, a): return self.raw(1, lambda R, pos, L: struct.pack('<BB', 0x0f, a))
    def move_obj(self, a, b): return self.raw(1, lambda R, pos, L: struct.pack('<BB', 0x07, (b << 4) | a))
    def const4(self, a, v): return self.raw(1, lambda R, pos, L: struct.pack('<BB', 0x12, ((v & 0xf) << 4) | a))
    def const16(self, a, v): return self.raw(2, lambda R, pos, L: struct.pack('<BBh', 0x13, a, v))
    def const(self, a, v): return self.raw(3, lambda R, pos, L: struct.pack('<BBi', 0x14, a, v))
    def const_wide32(self, a, v): return self.raw(3, lambda R, pos, L: struct.pack('<BBi', 0x17, a, v))
    def const_str(self, a, s): return self.raw(2, lambda R, pos, L: struct.pack('<BBH', 0x1a, a, R.s(s)))
    def const_class(self, a, t): return self.raw(2, lambda R, pos, L: struct.pack('<BBH', 0x1c, a, R.t(t)))
    def check_cast(self, a, t): return self.raw(2, lambda R, pos, L: struct.pack('<BBH', 0x1f, a, R.t(t)))
    def new_inst(self, a, t): return self.raw(2, lambda R, pos, L: struct.pack('<BBH', 0x22, a, R.t(t)))
    def move_result(self, a): return self.raw(1, lambda R, pos, L: struct.pack('<BB', 0x0a, a))
    def move_result_wide(self, a): return self.raw(1, lambda R, pos, L: struct.pack('<BB', 0x0b, a))
    def move_result_obj(self, a): return self.raw(1, lambda R, pos, L: struct.pack('<BB', 0x0c, a))
    def array_length(self, a, b): return self.raw(1, lambda R, pos, L: struct.pack('<BB', 0x21, (b << 4) | a))
    def aget_obj(self, a, arr, idx): return self.raw(2, lambda R, pos, L: struct.pack('<BBBB', 0x46, a, arr, idx))
    def sget(self, a, f): return self.raw(2, lambda R, pos, L: struct.pack('<BBH', 0x60, a, R.f(*f)))
    def iget_obj(self, a, b, f): return self.raw(2, lambda R, pos, L: struct.pack('<BBH', 0x54, (b << 4) | a, R.f(*f)))
    def iput_obj(self, a, b, f): return self.raw(2, lambda R, pos, L: struct.pack('<BBH', 0x5b, (b << 4) | a, R.f(*f)))
    def int_to_long(self, a, b): return self.raw(1, lambda R, pos, L: struct.pack('<BB', 0x81, (b << 4) | a))
    def long_to_int(self, a, b): return self.raw(1, lambda R, pos, L: struct.pack('<BB', 0x84, (b << 4) | a))
    def add_long2(self, a, b): return self.raw(1, lambda R, pos, L: struct.pack('<BB', 0xbb, (b << 4) | a))
    def div_long2(self, a, b): return self.raw(1, lambda R, pos, L: struct.pack('<BB', 0xbe, (b << 4) | a))
    def rem_long2(self, a, b): return self.raw(1, lambda R, pos, L: struct.pack('<BB', 0xbf, (b << 4) | a))
    def goto(self, lab): return self.raw(1, lambda R, pos, L: struct.pack('<Bb', 0x28, L[lab] - pos))
    def if_lt(self, a, b, lab): return self.raw(2, lambda R, pos, L: struct.pack('<BBh', 0x34, (b << 4) | a, L[lab] - pos))
    def if_eqz(self, a, lab): return self.raw(2, lambda R, pos, L: struct.pack('<BBh', 0x38, a, L[lab] - pos))

    def _inv(self, op, m, regs):
        assert len(regs) <= 5 and all(r < 16 for r in regs)
        def fn(R, pos, L):
            rr = list(regs) + [0] * (5 - len(regs))
            return struct.pack('<BBHH', op, (len(regs) << 4) | rr[4], R.m(*m), rr[0] | (rr[1] << 4) | (rr[2] << 8) | (rr[3] << 12))
        return self.raw(3, fn)
    def inv_virt(self, m, regs): return self._inv(0x6e, m, regs)
    def inv_super(self, m, regs): return self._inv(0x6f, m, regs)
    def inv_direct(self, m, regs): return self._inv(0x70, m, regs)
    def inv_static(self, m, regs): return self._inv(0x71, m, regs)
    def inv_iface(self, m, regs): return self._inv(0x72, m, regs)
    def goto16(self, lab): return self.raw(2, lambda R, pos, L: struct.pack('<BBh', 0x29, 0, L[lab] - pos))
    def if_lez(self, a, lab): return self.raw(2, lambda R, pos, L: struct.pack('<BBh', 0x3d, a, L[lab] - pos))
    def add_lit8(self, a, b, v): return self.raw(2, lambda R, pos, L: struct.pack('<BBBb', 0xd8, a, b, v))

    def assemble(self, R):
        L, pos = {}, 0
        for op in self.ops:
            if op[0] == 'label': L[op[1]] = pos
            else: pos += op[0]
        out, pos = bytearray(), 0
        for op in self.ops:
            if op[0] == 'label': continue
            b = op[1](R, pos, L)
            assert len(b) == op[0] * 2, (op, len(b))
            out += b; pos += op[0]
        return bytes(out)


def build_dex(classes):
    """classes: [{name, super, access, fields:[(name,type,access)], methods:[{name, ret, params, access, regs, ins, outs, code:Asm}]}]"""
    R = Ref()
    def walk():
        for c in classes:
            R.t(c['name']); R.t(c['super']); [R.t(x) for x in c.get('interfaces', [])]
            for fn, ft, fa in c.get('fields', []): R.f(c['name'], fn, ft)
            for m in c['methods']:
                R.m(c['name'], m['name'], m['ret'], m['params'])
                m['code'].assemble(R)
    walk(); R.finish()
    codes = {}
    for c in classes:
        for m in c['methods']: codes[(c['name'], m['name'], m['ret'], tuple(m['params']))] = m['code'].assemble(R)

    HDR = 0x70
    off = HDR
    string_ids_off = off; off += 4 * len(R.slist)
    type_ids_off = off; off += 4 * len(R.tlist)
    proto_ids_off = off; off += 12 * len(R.plist)
    field_ids_off = off; off += 8 * len(R.flist)
    method_ids_off = off; off += 8 * len(R.mlist)
    class_defs_off = off; off += 32 * len(classes)
    data_off = off
    data = bytearray()
    pos = lambda: data_off + len(data)
    def align4():
        while pos() % 4: data.append(0)
    # code items
    code_off = {}
    first_code = None
    for c in classes:
        for m in c['methods']:
            align4(); k = (c['name'], m['name'], m['ret'], tuple(m['params']))
            code_off[k] = pos(); first_code = first_code or pos()
            ins = codes[k]
            data += struct.pack('<HHHHII', m['regs'], m['ins'], m['outs'], 0, 0, len(ins) // 2) + ins
    n_code = len(code_off)
    # type lists
    tl_off = {}
    for c in classes:
        k = tuple(c.get('interfaces', []))
        if k and k not in tl_off:
            align4(); tl_off[k] = pos(); data += struct.pack('<I', len(k)) + b''.join(struct.pack('<H', R.tidx[t]) for t in k)
    for ret, ps in R.plist:
        if ps and ps not in tl_off:
            align4(); tl_off[ps] = pos()
            data += struct.pack('<I', len(ps)) + b''.join(struct.pack('<H', R.tidx[t]) for t in ps)
    # string data
    sd_start = pos(); sd_off = []
    for s in R.slist:
        sd_off.append(pos()); data += uleb(u16len(s)) + mutf8(s) + b'\x00'
    # class data
    cd_start = pos(); cd_off = []
    for c in classes:
        cd_off.append(pos())
        sf = [f for f in c.get('fields', []) if f[2] & 0x8]; inf = [f for f in c.get('fields', []) if not f[2] & 0x8]
        dm = [m for m in c['methods'] if m['access'] & (0x8 | 0x2 | 0x10000)]
        vm = [m for m in c['methods'] if m not in dm]
        data += uleb(len(sf)) + uleb(len(inf)) + uleb(len(dm)) + uleb(len(vm))
        for group in (sf, inf):
            items = sorted((R.fidx[(c['name'], fn, ft)], fa) for fn, ft, fa in group); prev = 0
            for i, (fi, fa) in enumerate(items): data += uleb(fi - prev if i else fi) + uleb(fa); prev = fi
        for group in (dm, vm):
            items = sorted((R.midx[(c['name'], m['name'], m['ret'], tuple(m['params']))], m['access'], code_off[(c['name'], m['name'], m['ret'], tuple(m['params']))]) for m in group); prev = 0
            for i, (mi, ma, co) in enumerate(items): data += uleb(mi - prev if i else mi) + uleb(ma) + uleb(co); prev = mi
    # map
    align4(); map_off = pos()
    items = [(0x0000, 1, 0), (0x0001, len(R.slist), string_ids_off), (0x0002, len(R.tlist), type_ids_off), (0x0003, len(R.plist), proto_ids_off)]
    if R.flist: items.append((0x0004, len(R.flist), field_ids_off))
    items += [(0x0005, len(R.mlist), method_ids_off), (0x0006, len(classes), class_defs_off), (0x2001, n_code, first_code)]
    if tl_off: items.append((0x1001, len(tl_off), min(tl_off.values())))
    items += [(0x2002, len(R.slist), sd_start), (0x2000, len(classes), cd_start), (0x1000, 1, map_off)]
    items.sort(key=lambda x: x[2])
    data += struct.pack('<I', len(items)) + b''.join(struct.pack('<HHII', t, 0, n, o) for t, n, o in items)
    file_size = pos()
    ids = bytearray()
    for i in range(len(R.slist)): ids += struct.pack('<I', sd_off[i])
    for t in R.tlist: ids += struct.pack('<I', R.sidx[t])
    for ret, ps in R.plist: ids += struct.pack('<III', R.sidx[R.shorty(ret, ps)], R.tidx[ret], tl_off[ps] if ps else 0)
    for c, n, t in R.flist: ids += struct.pack('<HHI', R.tidx[c], R.tidx[t], R.sidx[n])
    for c, n, ret, ps in R.mlist: ids += struct.pack('<HHI', R.tidx[c], R.pidx[(ret, ps)], R.sidx[n])
    for i, c in enumerate(classes): ids += struct.pack('<IIIIIIII', R.tidx[c['name']], c['access'], R.tidx[c['super']], tl_off[tuple(c['interfaces'])] if c.get('interfaces') else 0, 0xffffffff, 0, cd_off[i], 0)
    assert HDR + len(ids) == data_off
    body = bytearray(HDR) + ids + data
    struct.pack_into('<8s', body, 0, b'dex\n035\x00')
    struct.pack_into('<IIIIIIIIIIIIIIIIIIII', body, 32,
        file_size, HDR, 0x12345678, 0, 0, map_off,
        len(R.slist), string_ids_off, len(R.tlist), type_ids_off, len(R.plist), proto_ids_off,
        len(R.flist), field_ids_off if R.flist else 0, len(R.mlist), method_ids_off, len(classes), class_defs_off, file_size - data_off, data_off)
    body[12:32] = hashlib.sha1(bytes(body[32:])).digest()
    struct.pack_into('<I', body, 8, zlib.adler32(bytes(body[12:])) & 0xffffffff)
    return bytes(body)
