# Star Atlas — API 명세 (MVP)

> MVP 범위: 현재 위치/시각 기반 3D 밤하늘 렌더링  
> 워크플로우 기준 총 API 수: **1개**

---

## 방식 결정: REST vs GraphQL

**REST 채택.**

| 비교 항목 | REST | GraphQL |
|-----------|------|---------|
| MVP API 수 | 1개 | — |
| 응답 구조 유연성 필요 | 없음 (항상 동일 필드 필요) | 오버스펙 |
| 클라이언트 복잡도 | 낮음 | 높음 |
| 캐싱 | HTTP 캐시 그대로 활용 | 별도 설정 필요 |

MVP 구간에서 API가 1개이고, 응답 shape가 고정적이므로 GraphQL을 쓸 이유가 없음.  
2단계(별자리 저장/조회)에서도 CRUD 패턴이 명확하기 때문에 REST로 전체를 일관되게 가져가는 것이 적절.

---

## 인증 여부 판단

| API | 인증 필요 여부 | 이유 |
|-----|---------------|------|
| `GET /api/stars` | **불필요** | 별 카탈로그는 공개 데이터. 유저 식별 없이 동일한 데이터 반환 |

> MVP 범위에서는 인증이 필요한 API가 존재하지 않음.  
> 2단계(별자리 저장)부터 JWT 인증이 필요해짐 — 그때 `/api/auth` 추가.

---

## API 목록

### 전체 요약

| # | 메서드 | 엔드포인트 | 역할 | 인증 | 호출 시점 |
|---|--------|-----------|------|------|----------|
| 1 | GET | `/api/stars` | 별 카탈로그 조회 | 없음 | 로딩 화면 진입 시 1회 |

---

## API 상세

### 1. 별 카탈로그 조회

#### 기본 정보

| 항목 | 내용 |
|------|------|
| 메서드 | `GET` |
| 엔드포인트 | `/api/stars` |
| 인증 | 없음 |
| 캐시 | `Cache-Control: public, max-age=86400` (24h) |
| 호출 시점 | [02] 로딩 화면 — STEP 4 |

#### 요청

**Query Parameters**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| `magnitude_max` | `number` | 선택 | `5` | 최대 겉보기 등급 (클수록 어두움) |

```
GET /api/stars?magnitude_max=5
```

#### 응답

**성공 `200 OK`**

```json
{
  "stars": [
    {
      "hipId": 32349,
      "ra": 101.2872,
      "dec": -16.7161,
      "magnitude": -1.46,
      "name": "Sirius"
    },
    {
      "hipId": 69673,
      "ra": 213.9153,
      "dec": 19.1825,
      "magnitude": -0.05,
      "name": "Arcturus"
    },
    {
      "hipId": 91262,
      "ra": 279.2347,
      "dec": 38.7837,
      "magnitude": 0.03,
      "name": "Vega"
    }
    // ... 총 ~1,700개
  ],
  "total": 1702,
  "magnitudeMax": 5
}
```

**응답 필드 정의**

| 필드 | 타입 | 설명 | 프론트 사용처 |
|------|------|------|--------------|
| `stars[].hipId` | `number` | Hipparcos 카탈로그 ID (고유 식별자) | 2단계 별자리 저장 시 별 식별에 사용 |
| `stars[].ra` | `number` | 적경 (Right Ascension, 도 단위, 0~360) | `astronomy-engine` 좌표 변환 입력값 |
| `stars[].dec` | `number` | 적위 (Declination, 도 단위, -90~90) | `astronomy-engine` 좌표 변환 입력값 |
| `stars[].magnitude` | `number` | 겉보기 등급 (낮을수록 밝음) | 3D 렌더 시 별 크기·밝기 결정 |
| `stars[].name` | `string \| null` | 고유명 (없으면 null) | 별 라벨 표시 (MVP에서는 미사용) |
| `total` | `number` | 반환된 별 개수 | 로딩 진행 상태 표시 |
| `magnitudeMax` | `number` | 요청에 적용된 필터값 에코 | 디버깅용 |

**오류 응답**

| 상태코드 | 발생 조건 | 응답 body |
|---------|----------|-----------|
| `400 Bad Request` | `magnitude_max`가 숫자가 아니거나 범위 초과 (0 미만 또는 10 초과) | `{ "error": "invalid_magnitude", "message": "magnitude_max must be between 0 and 10" }` |
| `500 Internal Server Error` | DB 조회 실패 | `{ "error": "server_error", "message": "Failed to load star catalog" }` |

---

## 응답 구조 — 프론트에서 바로 쓸 수 있는가?

**판단: 별도 변환 없이 바로 사용 가능.**

```typescript
// API 응답 타입 (프론트)
type Star = {
  hipId: number;
  ra: number;       // astronomy-engine에 그대로 전달
  dec: number;      // astronomy-engine에 그대로 전달
  magnitude: number;
  name: string | null;
};

type StarsResponse = {
  stars: Star[];
  total: number;
  magnitudeMax: number;
};

// 사용 예시 — STEP 5 천체력 계산으로 바로 연결
const { stars } = await fetch('/api/stars?magnitude_max=5').then(r => r.json());

const rendered = stars
  .map(star => {
    const { altitude, azimuth } = toHorizonCoords(star.ra, star.dec, lat, lng, date);
    if (altitude < 0) return null;   // 지평선 아래 제거
    return { ...star, ...toXYZ(altitude, azimuth) };
  })
  .filter(Boolean);
```

`ra`, `dec` 가 도(degree) 단위로 바로 내려오기 때문에 `astronomy-engine` API에 그대로 전달 가능. 별도 단위 변환 불필요.

---

## 백엔드 처리 흐름 (Fastify)

```
GET /api/stars?magnitude_max=5
  │
  ├─ 1. 쿼리 파라미터 검증 (zod)
  │      z.number().min(0).max(10).default(5)
  │
  ├─ 2. Redis 캐시 확인
  │      key: "stars:mag:{magnitudeMax}"
  │      ├─ HIT  →  Redis에서 JSON 파싱 후 응답
  │      └─ MISS →  3번으로
  │
  ├─ 3. PostgreSQL 조회
  │      SELECT hip_id, ra, dec, magnitude, proper_name
  │      FROM stars
  │      WHERE magnitude <= $1
  │      ORDER BY magnitude ASC
  │
  └─ 4. Redis 캐시 저장 후 응답
         key: "stars:mag:{magnitudeMax}"
         TTL: 86400s (24h)
         — 별 카탈로그는 변하지 않으므로 TTL을 길게 설정
```

---

## 2단계 이후 추가될 API 예고

> MVP 범위 외. 설계 참고용으로만 기록.

| 메서드 | 엔드포인트 | 역할 | 인증 |
|--------|-----------|------|------|
| `POST` | `/api/auth/login` | 소셜 로그인 | 없음 |
| `POST` | `/api/constellations` | 별자리 저장 | **필요** |
| `GET` | `/api/constellations` | 내 별자리 목록 | **필요** |
| `GET` | `/api/constellations/:id` | 별자리 상세 + 하늘 메타데이터 | **필요** |
| `GET` | `/api/feed` | 커뮤니티 별자리 피드 | **필요** |
