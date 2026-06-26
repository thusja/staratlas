# Star Atlas — DB 스키마 설계

> MVP 범위: 현재 위치/시각 기반 3D 밤하늘 렌더링  
> API 설계 기준 — `GET /api/stars` 1개 엔드포인트 지원

---

## 체크리스트 결론 먼저

| 확인 항목 | 결론 |
|-----------|------|
| 정규화 필요 여부 | MVP 테이블 1개. 정규화 대상 없음 |
| 인덱스 위치 | `magnitude` 컬럼에 단일 인덱스 1개 |
| UUID vs 자동증가 ID | `stars` 테이블은 Hipparcos 자연키(`hip_id`) 사용. 별도 surrogate key 불필요 |

---

## schema.prisma

```prisma
// Star Atlas — Prisma Schema
// MVP: stars 테이블 단독

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// Hipparcos 별 카탈로그 (초기 1회 적재, 이후 읽기 전용)
model Star {
  /// Hipparcos 카탈로그 고유번호 — 자연키를 PK로 사용
  hipId     Int     @id @map("hip_id")

  /// 적경 Right Ascension (도, 0 ~ 360)
  ra        Float

  /// 적위 Declination (도, -90 ~ 90)
  dec       Float

  /// 겉보기 등급 (낮을수록 밝음, -1.46 ~ 6.5)
  magnitude Float

  /// 고유 명칭 (Sirius, Vega 등 — 없으면 null)
  name      String? @map("proper_name")

  /// magnitude 기준 필터 쿼리 최적화
  @@index([magnitude])

  @@map("stars")
}
```

---

## 테이블 상세

### `stars`

| 컬럼 | Prisma 타입 | PostgreSQL 타입 | Nullable | 설명 |
|------|------------|----------------|----------|------|
| `hip_id` | `Int` | `INTEGER` | NO | PK. Hipparcos 카탈로그 ID (1 ~ 118,218) |
| `ra` | `Float` | `DOUBLE PRECISION` | NO | 적경 (도 단위) |
| `dec` | `Float` | `DOUBLE PRECISION` | NO | 적위 (도 단위) |
| `magnitude` | `Float` | `DOUBLE PRECISION` | NO | 겉보기 등급 |
| `proper_name` | `String?` | `TEXT` | YES | 고유 명칭 |

**행 수**: magnitude ≤ 5 필터 시 약 1,700개 / 전체 적재 시 약 118,000개  
**쓰기 패턴**: 초기 데이터 시딩 1회. 이후 INSERT / UPDATE 없음  
**읽기 패턴**: `WHERE magnitude <= $1` 필터 + 전체 컬럼 SELECT

---

## 설계 판단 근거

### 정규화가 필요한 테이블이 있는가?

**없음.**

MVP 테이블이 `stars` 하나이고, 모든 컬럼이 `hip_id`에 직접 종속된 원자값.  
`proper_name`이 null을 허용하지만 별도 테이블로 분리할 필요는 없음 — 조인 비용만 늘고 얻는 게 없음.

```
✅ 1NF: 모든 컬럼이 원자값
✅ 2NF: 단일 PK이므로 부분 함수 종속 없음
✅ 3NF: PK → 모든 컬럼 직접 종속, 이행 종속 없음
```

---

### 인덱스를 어디에 걸어야 하는가?

**`magnitude` 컬럼에 단일 인덱스 1개.**

```sql
-- Prisma @@index([magnitude]) 가 생성하는 인덱스
CREATE INDEX "stars_magnitude_idx" ON "stars"("magnitude");
```

**근거:**

| 쿼리 패턴 | 인덱스 효과 |
|----------|------------|
| `WHERE magnitude <= 5` | B-Tree 인덱스로 범위 스캔 가능 |
| `SELECT *` (전체 컬럼) | 단, 약 1,700행 반환 → Index Scan보다 Seq Scan이 더 빠를 수 있음 |

> **실용적 판단**: 전체 테이블이 118,000행이고 magnitude ≤ 5 필터 결과가 1,700개(약 1.4%)인 경우 인덱스가 유효. 단, Redis 캐시가 앞단에 있으므로 이 인덱스가 실제로 히트될 빈도는 낮음 (캐시 TTL 24h).

`ra`, `dec`에는 인덱스 불필요 — API에서 이 컬럼으로 필터하는 쿼리가 없음.

---

### UUID vs 자동증가 ID 중 어떤 게 맞는가?

**`stars` 테이블은 Hipparcos 자연키(`hip_id`, INTEGER) 를 PK로 그대로 사용.**

| 방식 | 이 테이블에서의 적합성 |
|------|----------------------|
| UUID | ❌ 외부 시스템(Hipparcos)과 매핑 시 별도 컬럼 필요. 오버스펙 |
| SERIAL (자동증가) | ❌ 이미 전세계 공통 식별자인 `hip_id`가 있음. 중복 키 불필요 |
| **자연키 `hip_id`** | ✅ 카탈로그 ID 자체가 안정적 고유값. 프론트에서도 그대로 사용 가능 |

> **2단계 이후 추가될 `User`, `Constellation` 테이블은 UUID 사용 예정.**  
> 이유: 유저/별자리 ID는 외부 노출 가능성이 있고, 분산 환경에서의 충돌 방지 및  
> URL에 노출 시 순차 ID 추론 공격(IDOR) 방지를 위해 UUID v4 적용.

---

## 초기 데이터 시딩 계획

```
Hipparcos 카탈로그 원본
  hip_main.dat (ESA, 공개 데이터)
      │
      ▼
CSV 변환 스크립트 (Node.js)
  필드 추출: HIP, RArad, DErad, Vmag, SpType
  단위 변환: RArad(라디안) → ra(도) / DErad(라디안) → dec(도)
      │
      ▼
prisma db seed
  prisma/seed.ts
  → createMany({ data: stars, skipDuplicates: true })
  약 118,000행 일괄 적재 (magnitude 필터 없이 전체 적재 권장)
  — 필터링은 쿼리 시점에 수행
```

**시딩 후 검증 쿼리:**
```sql
SELECT COUNT(*)              FROM stars;                      -- 전체
SELECT COUNT(*), MIN(magnitude), MAX(magnitude)
  FROM stars WHERE magnitude <= 5;                            -- MVP 필터 대상
SELECT * FROM stars WHERE proper_name IS NOT NULL LIMIT 10;  -- 고유명 확인
```

---

## 2단계 이후 추가될 테이블 예고

> MVP 범위 외. 설계 방향 참고용.

```prisma
// 2단계 이후 추가 예정

model User {
  id        String   @id @default(uuid())   // UUID v4
  provider  String                           // "apple" | "google"
  providerId String  @unique @map("provider_id")
  username  String
  createdAt DateTime @default(now()) @map("created_at")

  constellations Constellation[]

  @@map("users")
}

model Constellation {
  id          String   @id @default(uuid())  // UUID v4
  userId      String   @map("user_id")
  name        String
  meaning     String?

  // 관측 메타데이터 — 하늘 재현에 필요한 최소 정보
  lat         Float
  lng         Float
  observedAt  DateTime @map("observed_at")   // 실제 관측 시각
  julianDate  Float    @map("julian_date")    // 재계산 정확도용

  // 별 연결 정보 — hip_id 쌍 배열 (JSON)
  // 예: [[32349, 69673], [69673, 91262]]
  starIds     Int[]    @map("star_ids")       // 선택한 별 목록
  connections Json                            // 연결선 쌍

  createdAt   DateTime @default(now()) @map("created_at")

  user        User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([observedAt])
  @@map("constellations")
}
```

---

## 전체 ER 다이어그램 (MVP + 2단계)

```
[MVP]
stars
  hip_id  PK
  ra
  dec
  magnitude  ← INDEX
  name

[2단계 이후]
users                    constellations
  id  PK (UUID)    1──N    id  PK (UUID)
  provider                 user_id  FK → users.id  ← INDEX
  provider_id              name
  username                 lat, lng
  created_at               observed_at              ← INDEX
                           julian_date
                           star_ids[]   (hip_id 참조, FK 없음)
                           connections  (JSON)
                           created_at
```

> `constellations.star_ids`는 `stars.hip_id`를 참조하지만 **외래키(FK)를 걸지 않음**.  
> 별 카탈로그는 변경되지 않는 정적 데이터이고, FK를 걸면 배열 타입에서 제약 설정이 복잡해지므로  
> 참조 무결성은 애플리케이션 레벨(API 유효성 검사)에서 관리.
