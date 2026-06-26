# Star Atlas — MVP 워크플로우 & 데이터 흐름

> MVP 범위: 현재 위치/시각 기반 3D 밤하늘 렌더링  
> 워크플로우 구간: **앱 진입** → **3D 하늘 탐색**

---

## 전체 흐름 요약

```
유저 행동        앱 실행 → 권한 허용 → (로딩) → 3D 하늘 탐색
화면             [01] 권한 요청 → [02] 로딩 → [03] 메인 하늘 뷰
API 호출         0회              1회         0회
DB 접근          없음             읽기(별 카탈로그)   없음
```

> MVP에서 API 호출은 **별 카탈로그 1회** 뿐.  
> 천체력 계산 전체는 클라이언트에서 수행 — 오프라인에서도 동작함.

---

## 단계별 상세 흐름

### STEP 1. 앱 실행

| 항목 | 내용 |
|------|------|
| 트리거 | 사용자가 앱 아이콘 탭 |
| 처리 주체 | **프론트** |
| 처리 내용 | 저장된 위치 권한 상태 확인 (`expo-location`) |

```
프론트
  └─ 권한 상태 확인
        ├─ 이미 허용됨  →  STEP 3 (로딩)으로 바로 이동
        └─ 미허용       →  STEP 2 (권한 요청 화면) 표시
```

**데이터**
```
입력: 없음
출력: permissionStatus ('granted' | 'denied' | 'undetermined')
저장: 없음
```

---

### STEP 2. GPS 권한 요청

| 항목 | 내용 |
|------|------|
| 트리거 | 사용자가 "위치 접근 허용하기" 탭 |
| 처리 주체 | **프론트 + 시스템** |
| 처리 내용 | 시스템 권한 다이얼로그 표시 → 결과 수신 |

```
프론트
  └─ requestForegroundPermissionsAsync()
        ├─ 허용  →  STEP 3으로 이동
        └─ 거부  →  버튼 문구 변경 ("설정에서 권한 허용하기")
                    탭 시 → 설정 앱으로 이동
```

**데이터**
```
입력: 없음
출력: permissionStatus ('granted' | 'denied')
저장: 없음 (시스템이 권한 상태 관리)
```

---

### STEP 3. 현재 위치 수집

| 항목 | 내용 |
|------|------|
| 트리거 | 권한 허용 직후 자동 실행 |
| 처리 주체 | **프론트** |
| 처리 내용 | GPS 좌표 + 현재 시각 수집 |

```
프론트
  └─ getCurrentPositionAsync()
        ├─ 성공  →  { latitude, longitude, timestamp } 획득
        │           STEP 4로 이동
        └─ 실패  →  5초 타임아웃 후 에러 토스트 + STEP 2로 복귀
```

**데이터**
```
입력: 없음
출력:
  latitude   : number   (예: 37.5665)
  longitude  : number   (예: 126.9780)
  timestamp  : number   (Unix ms, 예: 1751036054000)

저장: Zustand 전역 상태 (observerState)
  → { lat, lng, timestamp }
```

---

### STEP 4. 별 카탈로그 로드 ← API 호출 발생

| 항목 | 내용 |
|------|------|
| 트리거 | GPS 수집 완료 직후 |
| 처리 주체 | **프론트 → 백엔드 → DB** |
| 처리 내용 | magnitude ≤ 5 필터링된 별 목록 요청 |

```
프론트
  └─ GET /api/stars?magnitude_max=5
        │
        ▼
백엔드 (Fastify)
  └─ 쿼리 파라미터 검증 (zod)
     DB 조회 or Redis 캐시 확인
        ├─ 캐시 HIT   →  Redis에서 응답 (< 10ms)
        └─ 캐시 MISS  →  PostgreSQL 조회 → Redis 캐시 저장 → 응답
        │
        ▼
DB (PostgreSQL)
  └─ SELECT hip_id, ra, dec, magnitude, proper_name
     FROM stars
     WHERE magnitude <= 5
     -- 약 1,700개 행 반환

        │
        ▼
프론트
  └─ 별 목록 수신 → Zustand에 저장 (starCatalog)
```

**데이터**
```
요청:
  GET /api/stars?magnitude_max=5

응답:
  [
    {
      hip_id    : number,   // Hipparcos 카탈로그 ID
      ra        : number,   // 적경 (도, 0~360)
      dec       : number,   // 적위 (도, -90~90)
      magnitude : number,   // 겉보기 등급
      name      : string | null   // 고유명 (예: "Sirius")
    },
    ...   // ~1,700개
  ]

DB에 저장되는 것: 없음 (읽기만)
프론트에서 캐시: Zustand (앱 세션 동안 유지)
```

---

### STEP 5. 천체력 계산 (좌표 변환)

| 항목 | 내용 |
|------|------|
| 트리거 | 별 카탈로그 수신 완료 |
| 처리 주체 | **프론트** (클라이언트 전용) |
| 처리 내용 | 각 별의 적경/적위 → 지평좌표 → 3D XYZ 변환 |

```
프론트
  └─ 별 ~1,700개 루프
        │
        ├─ 1. Julian Date 계산
        │      julianDate = toJulianDate(timestamp)
        │
        ├─ 2. 적경/적위 → 지평좌표 (astronomy-engine)
        │      { altitude, azimuth } = Astronomy.HorizonFromEquatorial(
        │        ra, dec, lat, lng, julianDate
        │      )
        │
        ├─ 3. 지평선 아래 별 제거
        │      altitude < 0  →  skip
        │
        └─ 4. 지평좌표 → 3D 구체 XYZ (three.js 좌표계)
               x = R * cos(alt) * sin(az)
               y = R * sin(alt)
               z = R * cos(alt) * cos(az)
```

**데이터**
```
입력:
  star[]      : { ra, dec, magnitude, hip_id }
  lat, lng    : number
  timestamp   : number (→ Julian Date 변환)

출력:
  starPoints[] : {
    hip_id    : number,
    x, y, z   : number,   // three.js 좌표
    magnitude : number,
    name      : string | null
  }

저장: Zustand (renderedStars) — 메모리만, DB 기록 없음
```

---

### STEP 6. 3D 렌더링

| 항목 | 내용 |
|------|------|
| 트리거 | 좌표 계산 완료 |
| 처리 주체 | **프론트** (expo-gl / three.js) |
| 처리 내용 | THREE.Points 오브젝트 생성 → GL 렌더 루프 시작 |

```
프론트
  └─ THREE.BufferGeometry에 XYZ 좌표 일괄 업로드
     THREE.Points(geometry, material) 생성
        │
        ├─ magnitude → vertex color & size 매핑
        │    magnitude < 1   →  size: 4px, opacity: 1.0
        │    magnitude 1~3   →  size: 2px, opacity: 0.85
        │    magnitude 3~5   →  size: 1px, opacity: 0.6
        │
        └─ requestAnimationFrame 루프 시작
             드래그  →  구체 회전 (OrbitControls)
             핀치    →  카메라 FOV 조정
```

**데이터**
```
입력: starPoints[] (STEP 5 출력)
출력: 렌더링된 3D 장면 (화면)
저장: 없음
API:  없음
```

---

### STEP 7. 사용자 하늘 탐색 (지속)

| 항목 | 내용 |
|------|------|
| 트리거 | 3D 렌더 완료 후 사용자 인터랙션 |
| 처리 주체 | **프론트** |
| 처리 내용 | 드래그/핀치 이벤트 → 카메라 행렬 업데이트 |

```
프론트
  └─ GestureDetector (react-native-gesture-handler)
        ├─ 한 손가락 드래그  →  OrbitControls.update() → 카메라 회전
        ├─ 핀치              →  camera.fov 조정 → camera.updateProjectionMatrix()
        └─ 현재 방향 이탈     →  "현재 하늘로 돌아오기" 버튼 노출
                                  탭 시 → 카메라 초기 각도로 트윈 애니메이션
```

**데이터**
```
입력: 터치 이벤트 (좌표 델타, 스케일 팩터)
출력: 카메라 행렬 갱신
저장: 없음
API:  없음
```

---

## 데이터 흐름 전체 다이어그램

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONT (React Native)                      │
│                                                                    │
│  STEP1          STEP2          STEP3          STEP5       STEP6   │
│  권한확인  →   권한요청  →   GPS수집   →   좌표변환  →  3D렌더  │
│                                   │               ▲               │
│                                   └── timestamp   │               │
│                                       lat, lng ───┤               │
│                                                   │               │
│  ────────────────────────────── STEP4 ────────────┘               │
│  GET /api/stars?magnitude_max=5                                    │
│       ▲                                                           │
└───────┼───────────────────────────────────────────────────────────┘
        │ HTTP
┌───────┼───────────────────────────────────────────────────────────┐
│       │              BACKEND (Fastify)                             │
│       │                                                            │
│  요청 검증 (zod)                                                   │
│       │                                                            │
│       ├─ Redis HIT  ──────────────────────────────────────────┐   │
│       └─ Redis MISS →  PostgreSQL 조회  →  Redis 캐시 저장  ──┘   │
│                                ▼                                   │
└───────────────────────────────┼────────────────────────────────────┘
                                │ SQL
┌───────────────────────────────┼────────────────────────────────────┐
│                               │     DATABASE                        │
│                               ▼                                     │
│   PostgreSQL: stars 테이블                                          │
│   (hip_id, ra, dec, magnitude, proper_name)                        │
│   — 읽기 전용, 앱 초기 데이터 적재 후 변경 없음                      │
│                                                                      │
│   Redis: stars:mag5 키                                              │
│   — 전체 1,700개 JSON 캐시, TTL 24h                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## MVP 검증 체크리스트

### 어떤 데이터가 DB에 저장되어야 하는가?

| 데이터 | 저장 여부 | 비고 |
|--------|-----------|------|
| 별 카탈로그 (Hipparcos) | ✅ PostgreSQL | 초기 1회 CSV 적재, 이후 읽기 전용 |
| 유저 GPS 좌표 | ❌ 저장 안 함 | 클라이언트 메모리만 사용 |
| 계산된 별 좌표 (XYZ) | ❌ 저장 안 함 | 매번 실시간 계산 |
| 권한 상태 | ❌ 저장 안 함 | 시스템이 관리 |

### 프론트 → 백엔드로 넘기는 데이터는?

| API | 프론트가 보내는 것 | 비고 |
|-----|-------------------|------|
| `GET /api/stars` | `magnitude_max=5` (쿼리 파라미터) | GPS 좌표는 보내지 않음 — 클라이언트에서 계산 |

> GPS 좌표를 서버로 보내지 않는 것이 **프라이버시 측면에서 의도적 설계**.  
> 천체력 계산을 클라이언트에서 수행하므로 서버는 좌표를 알 필요가 없음.

### API 호출은 몇 번 일어나는가?

| 시점 | API | 횟수 |
|------|-----|------|
| 로딩 단계 | `GET /api/stars?magnitude_max=5` | **1회** |
| 탐색 중 | 없음 | 0회 |
| **합계** | | **총 1회** |

---

## 상태 저장 위치 요약

```
Zustand (전역, 앱 세션 동안 유지)
  ├─ observerState    : { lat, lng, timestamp }
  ├─ starCatalog      : Star[]            ← API 응답 캐시
  └─ renderedStars    : StarPoint3D[]     ← 계산 결과

컴포넌트 로컬 상태
  ├─ permissionStatus : 'granted' | 'denied' | 'undetermined'
  ├─ loadingStep      : 1 | 2 | 3         ← 로딩 화면 텍스트 제어
  └─ isViewReset      : boolean           ← "돌아오기" 버튼 노출 여부
```
