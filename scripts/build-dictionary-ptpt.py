# Acrescenta ao léxico do Palavras as palavras de 5 letras do dicionário
# ortográfico de português europeu (Hunspell pt_PT, projeto Natura/UMinho -
# GPL-2.0 / LGPL-2.1 / MPL-1.1), expandindo plurais, femininos e conjugações.
#
#   npm pack dictionary-pt-pt && tar xzf dictionary-pt-pt-*.tgz
#   python3 scripts/build-dictionary-ptpt.py package/index.aff package/index.dic \
#       src/games/palavras/data/ptDictionary.json
#
# O ficheiro de saída é unido com o que já lá estiver (não apaga palavras).
import re, sys, json
aff = open(sys.argv[1], encoding='utf-8').read().split('\n')
dic = open(sys.argv[2], encoding='utf-8').read().split('\n')
rules = {}  # flag -> (kind, cross, [(strip, add, addflags, cond_regex)])
i = 0
while i < len(aff):
    parts = aff[i].split()
    if len(parts) >= 4 and parts[0] in ('SFX', 'PFX') and parts[2] in ('Y', 'N'):
        kind, flag, cross, n = parts[0], parts[1], parts[2] == 'Y', int(parts[3])
        lst = []
        for j in range(1, n + 1):
            p = aff[i + j].split()
            strip = '' if p[2] == '0' else p[2]
            add = p[3]
            addflags = ''
            if '/' in add:
                add, addflags = add.split('/', 1)
            if add == '0':
                add = ''
            cond = p[4] if len(p) > 4 else '.'
            rx = re.compile((cond + '$') if kind == 'SFX' else ('^' + cond))
            lst.append((strip, add, addflags, rx))
        rules.setdefault(flag, (kind, cross, []))[2].extend(lst)
        i += n + 1
        continue
    i += 1

def apply_sfx(word, flags, depth=0):
    out = []
    for f in flags:
        r = rules.get(f)
        if not r or r[0] != 'SFX':
            continue
        for strip, add, addflags, rx in r[2]:
            if rx.search(word) and word.endswith(strip):
                w = word[: len(word) - len(strip)] + add
                out.append((w, r[1]))
                if addflags and depth < 1:
                    out += [(x, c) for x, c in apply_sfx(w, addflags, depth + 1)]
    return out

def apply_pfx(word, flags):
    out = []
    for f in flags:
        r = rules.get(f)
        if not r or r[0] != 'PFX':
            continue
        for strip, add, addflags, rx in r[2]:
            if rx.search(word) and word.startswith(strip):
                out.append((add + word[len(strip):], r[1]))
    return out

words = set()
for line in dic[1:]:
    line = line.split('\t')[0].strip()
    if not line:
        continue
    stem, _, flags = line.partition('/')
    forms = {stem}
    sfx = apply_sfx(stem, flags)
    forms |= {w for w, _ in sfx}
    for w, cross in [(stem, True)] + sfx:
        if cross:
            forms |= {p for p, c in apply_pfx(w, flags) if c}
    for w in forms:
        words.add(w)

ok = re.compile(r'^[a-záàâãéêíóôõúüç]{5}$')
five = {w.upper() for w in words if ok.match(w)}
# Grafias anteriores ao Acordo Ortográfico (ex.: ACTOR, TECTO) também valem.
for line in dic:
    for old in re.findall(r'PREAO90=([^,\]]+)', line):
        if ok.match(old):
            five.add(old.upper())
try:
    existing = set(json.load(open(sys.argv[3], encoding='utf-8')))
except FileNotFoundError:
    existing = set()
merged = sorted(existing | five)
json.dump(merged, open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(words), 'formas;', len(five), 'de 5 letras;', len(merged) - len(existing), 'novas; total', len(merged))
