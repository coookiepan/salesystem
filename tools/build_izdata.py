#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""工業區CRM 主檔轉檔工具

用法：python3 tools/build_izdata.py <工業區名單.xlsx> [--seed 輸出seed路徑]

讀取「總表(工廠主檔)」與「待拜訪清單」分頁，輸出兩個檔案：

1. izdata.json（repo 根目錄，進版控）——只含公開的工廠名錄欄位：
   編號/行政區/園區/名稱/業種/電話/地址＋解析出的里、路。
   ⚠ 不含狀態、對應客戶等業務資料（那是個人紀錄層，不進公開 repo）。

2. seed 檔（預設 iz-seed.json，「不要」commit）——含狀態、對應客戶、
   待訪清單等個人紀錄，供 App 內「匯入備份」一次性帶入後走雲端同步。

id 規則：sha1(工廠名稱|地址) 前 10 碼十六進位。名單改版重轉時，
只要名稱＋地址沒變，id 不變，個人紀錄不會對不上。
"""
import sys, json, re, hashlib, unicodedata

# Big5 造字（私用區）→ 通用寫法對照；轉不掉的原樣保留
# U+E215＝𦰡（新化區𦰡拔里，俗寫「那拔里」）；U+E6E5＝𥕢（龍崎區石𥕢里，俗寫「石槽里」）
PUA_MAP = {'': '那', '': '槽'}

def clean(s):
    s = str(s if s is not None else '').strip()
    for k, v in PUA_MAP.items():
        s = s.replace(k, v)
    return unicodedata.normalize('NFC', s)

# 名錄某次編碼轉換把罕用字弄成了字面上的「?」。只修可百分之百確定的地名：
# 永康鹽行帶（鹽＝U+9E7D 丟失，約 890 筆）、官田南廍里（廍）、玉井噍吧哖東路（噍）。
# 其餘少量不確定者（山?里、客?內…）保留原樣，寧缺勿錯。
MOJIBAKE_FIX = [
    ('?行里', '鹽行里'), ('?洲里', '鹽洲里'), ('?和街', '鹽和街'),
    ('?信街', '鹽信街'), ('?平街', '鹽平街'), ('?行路', '鹽行路'),
    ('?忠街', '鹽忠街'), ('?吧哖', '噍吧哖'),
]

def fix_addr(addr):
    for k, v in MOJIBAKE_FIX:
        addr = addr.replace(k, v)
    if addr.startswith('臺南市官田區'):
        addr = addr.replace('南?里', '南廍里').replace('南?', '南廍')
    return addr

def fid(name, addr):
    return hashlib.sha1((name + '|' + addr).encode('utf-8')).hexdigest()[:10]

ADDR_RE = re.compile(r'^臺南市(\S+?區)(\S+?里)?')
ROAD_RE = re.compile(r'[\d~之]*鄰?\s*([^\d，,（(]*?[路街道段])')

def parse_addr(addr):
    """地址 → (行政區, 里, 路/街含段)。地號等非標準格式盡量退回部分結果。"""
    m = ADDR_RE.match(addr)
    if not m:
        return '', '', ''
    dist, li = m.group(1), m.group(2) or ''
    rest = addr[m.end():]
    rm = ROAD_RE.match(rest)
    road = rm.group(1).strip() if rm else ''
    if len(road) > 10:  # 誤抓到整串描述時放棄
        road = ''
    return dist, li, road

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    src = sys.argv[1]
    seed_path = 'iz-seed.json'
    if '--seed' in sys.argv:
        seed_path = sys.argv[sys.argv.index('--seed') + 1]

    import openpyxl
    wb = openpyxl.load_workbook(src, data_only=True)
    ws = wb['總表(工廠主檔)']

    factories, seed_records, dup = [], {}, 0
    seen_ids = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        name = clean(row[3])
        if not name:
            continue
        addr = fix_addr(clean(row[9]))
        _id = fid(name, addr)
        if _id in seen_ids:
            dup += 1
            continue
        seen_ids[_id] = True
        dist_x, park = clean(row[1]), clean(row[2])
        dist, li, road = parse_addr(addr)
        f = {'id': _id, 'no': int(row[0]) if str(row[0]).isdigit() else 0,
             'name': name, 'dist': dist or dist_x, 'li': li, 'road': road,
             'park': park if park != '(非園區)' else '',
             'ind': clean(row[4]), 'phone': clean(row[8]), 'addr': addr}
        factories.append(f)

        status, vdate, cust = clean(row[5]), clean(row[6]), clean(row[7])
        if status and status != '未成交':
            rec = {'updatedAt': 0}
            if status == '已成交':
                rec['status'] = '已成交'
            elif status == '列入清單':
                rec['status'] = '未接觸'
                rec['visitPlan'] = {'date': '', 'note': '來自Excel待拜訪清單'}
            else:
                rec['status'] = status
            if cust:
                rec['customer'] = cust
            if vdate and vdate not in ('0', '0.0'):
                rec['note'] = '拜訪日期(舊表)：' + vdate
            seed_records[_id] = rec

    factories.sort(key=lambda f: f['no'] or 10**9)
    with open('izdata.json', 'w', encoding='utf-8') as fp:
        json.dump({'v': 1, 'source': 'v10', 'count': len(factories),
                   'factories': factories}, fp, ensure_ascii=False,
                  separators=(',', ':'))
    with open(seed_path, 'w', encoding='utf-8') as fp:
        json.dump({'izcrmSeed': 1, 'records': seed_records}, fp,
                  ensure_ascii=False, indent=1)

    import os
    print(f'izdata.json: {len(factories)} 筆 (略過重複 {dup}), '
          f'{os.path.getsize("izdata.json")//1024} KB')
    print(f'{seed_path}: {len(seed_records)} 筆個人紀錄（勿 commit）')

if __name__ == '__main__':
    main()
