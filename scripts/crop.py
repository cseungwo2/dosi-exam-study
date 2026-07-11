# 범용 크롭 스크립트.
# 사용법: python scripts/crop.py <tasks.json>
# tasks.json: [{ "src": "KakaoTalk_...jpg", "rotate": -90, "box": [l,t,r,b], "out": "2018-4-03.jpg" }, ...]
#   - rotate: PIL 기준 반시계 각도 (시계90°로 찍힌 사진은 rotate:-90 로 정방향).
#   - box: 회전 적용 후 이미지 좌표계에서의 크롭 영역. 생략하면 회전본 전체 저장(좌표 가늠용).
#   - out: images/ 아래 저장할 파일명.
import sys, json, os
from PIL import Image

SRC_DIR = r'C:\Users\tmddd\Desktop\도시계획기사기출이미지'
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'images')
os.makedirs(OUT_DIR, exist_ok=True)

tasks = json.load(open(sys.argv[1], encoding='utf-8'))
for t in tasks:
    img = Image.open(os.path.join(SRC_DIR, t['src']))
    r = t.get('rotate', 0)
    if r:
        img = img.rotate(r, expand=True)
    if 'box' in t:
        img = img.crop(t['box'])
    if img.width > 1200:
        img = img.resize((1200, round(img.height * 1200 / img.width)))
    out = os.path.join(OUT_DIR, t['out'])
    img.convert('RGB').save(out, quality=88)
    print(t['out'], '->', img.size)
