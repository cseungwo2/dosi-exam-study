# 도시계획기사 실기 필답형 기출 학습

기출문제집 사진에서 추출한 270문제(2018~2026년)를 타이핑으로 풀고 채점받는 정적 웹앱.
빈칸·계산은 자동 채점, 서술형은 모범답안·핵심 키워드 비교 후 자가 확정, 작도형은 정답 그림 비교. 오답노트 자동 누적. 진행 상황은 브라우저에 저장(기기별).

**접속:** https://cseungwo2.github.io/dosi-exam-study/ (폰·PC 브라우저)

## 로컬 실행

```bash
python -m http.server 8000
# http://localhost:8000
```

## 구조

- `index.html`, `css/style.css`, `js/app.js` — 웹앱 (홈·풀이·오답노트 3뷰)
- `js/grading.js` — 유형별 채점 로직 (`tests/grading.test.mjs`, `node --test tests/`)
- `data/questions.js` — 문제은행 (`data/extracted/`의 배치 원본을 `scripts/merge.mjs`로 병합)
- `images/` — 문제·정답 그림 (원본 사진에서 크롭)
