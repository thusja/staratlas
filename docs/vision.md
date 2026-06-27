# Star Atlas — 원본 아이디어 & 전체 비전

> 이 문서는 프로젝트의 최초 아이디어를 보존하고,  
> MVP 이후 2단계·3단계 기능 계획의 기준이 됩니다.

---

## 원본 아이디어 (최초 기획)

**"Star Atlas" — 실제 천체 기반 3D 하늘 탐험 + 나만의 별자리 만들기**

- 앱을 열면 현재 위치/시간 기준으로 계산된 실제 밤하늘이 3D 구체 안에 펼쳐짐  
  — 손가락으로 돌리고 확대하면서 둘러볼 수 있음

- 보이는 별들 중 마음에 드는 것들을 골라 선으로 이어 나만의 별자리 생성,  
  이름과 짧은 의미를 붙여서 저장

- 내가 만든 별자리는 "그날 그 장소에서 그 시각에 보였던 하늘" 메타데이터  
  (위치·날짜·실제 별 좌표)와 함께 기록되어,  
  나중에 다시 그 시점의 하늘을 3D로 복원해볼 수 있음

- 다른 사용자가 만든 별자리도 탐색 가능  
  — 위치/날짜가 다르면 같은 별자리라도 하늘에서의 배치가 다르게 보임  
  (실제 천체 운동 반영)

- **기술 포인트**
  - 천체력 계산 (적경·적위 → 지평좌표 변환, Julian Date)
  - 3D 구체 위 별 좌표 매핑 및 렌더링 (three.js)
  - 3D 공간 내 점-선 연결 인터랙션
  - 별자리 저장/조회 API
  - 위치·시간 기반 하늘 재계산 로직

---

## MVP vs 전체 비전 비교

| 기능 | MVP (현재 완성) | 2단계 | 3단계 |
|------|:-:|:-:|:-:|
| 현재 위치/시각 기반 실제 밤하늘 렌더링 | ✅ | | |
| 별 등급별 크기·밝기 표현 | ✅ | | |
| 3D 구체 드래그/핀치 탐색 | ✅ | | |
| GPS 권한 요청 및 위치 수집 | ✅ | | |
| 별 카탈로그 API + Redis 캐시 | ✅ | | |
| 별 탭 → 별 정보 팝업 (이름, 등급) | | ✅ | |
| 별 선택 모드 + 선으로 잇기 (별자리 드로잉) | | ✅ | |
| 별자리 이름/메모 입력 및 저장 | | ✅ | |
| 저장된 별자리 목록 화면 | | ✅ | |
| 과거 하늘 복원 (저장 시각+위치로 재계산) | | ✅ | |
| 회원가입/로그인 (JWT) | | ✅ | |
| 다른 사용자 별자리 탐색 피드 | | | ✅ |
| 같은 별자리를 다른 위치/날짜에서 보기 | | | ✅ |
| 별자리 좋아요 / 공유 | | | ✅ |

---

## 2단계 상세 기획

### 핵심 기능: 나만의 별자리 만들기

#### UI 흐름
```
[03] 하늘 뷰  →  별 탭  →  별 선택 모드 진입
                              │
                    별들을 순서대로 탭
                    탭한 별끼리 선으로 연결 (3D)
                              │
                    "별자리 저장" 버튼
                              │
                    [04] 별자리 이름/메모 입력 화면
                              │
                    POST /api/constellations
                              │
                    [05] 내 별자리 목록 화면
```

#### 새로 필요한 화면
| # | 화면 | 역할 |
|---|------|------|
| 04 | 별자리 저장 | 이름·메모 입력, 썸네일 미리보기 |
| 05 | 내 별자리 목록 | 저장된 별자리 카드 목록 |
| 06 | 별자리 상세 | 저장 시점의 하늘 복원 + 별자리 선 표시 |
| 07 | 로그인/회원가입 | JWT 인증 |

#### 새로 필요한 API
| 메서드 | 엔드포인트 | 역할 |
|--------|-----------|------|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 → JWT 발급 |
| POST | `/api/constellations` | 별자리 저장 |
| GET | `/api/constellations` | 내 별자리 목록 |
| GET | `/api/constellations/:id` | 별자리 상세 |
| DELETE | `/api/constellations/:id` | 별자리 삭제 |

#### 새로 필요한 DB 테이블
```prisma
model User {
  id            Int             @id @default(autoincrement())
  email         String          @unique
  passwordHash  String
  createdAt     DateTime        @default(now())
  constellations Constellation[]
}

model Constellation {
  id          Int      @id @default(autoincrement())
  userId      Int
  name        String
  memo        String?
  // 저장 시점 메타데이터
  lat         Float
  lng         Float
  observedAt  DateTime          // 관측 시각 (과거 하늘 복원에 사용)
  stars       ConstellationStar[]
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
}

model ConstellationStar {
  id              Int           @id @default(autoincrement())
  constellationId Int
  hipId           Int           // Star 테이블의 FK
  order           Int           // 선 연결 순서
  constellation   Constellation @relation(fields: [constellationId], references: [id])
}
```

#### 3D 인터랙션 구현 포인트
- **별 탭 감지**: Three.js `Raycaster`로 터치 좌표 → 3D 구체 위 별 히트 테스트
- **선 연결**: `THREE.Line` + `LineBasicMaterial`로 선택된 별끼리 연결
- **선택 상태**: `selectedStars: StarPoint3D[]` 로컬 상태로 관리
- **과거 하늘 복원**: 저장된 `observedAt` + `lat/lng`으로 `starToPoint3D()` 재실행

---

## 3단계 상세 기획

### 핵심 기능: 커뮤니티 탐색

- 다른 사용자의 별자리를 피드로 탐색
- 내 현재 위치/시각으로 "이 별자리가 지금 내 하늘에서 어떻게 보이는지" 재계산
- 좋아요, 저장, 공유

---

## 기술적 도전 과제 (2단계)

| 과제 | 해결 방향 |
|------|-----------|
| 3D 공간에서 터치로 별 선택 | `Raycaster.setFromCamera()` + Points 히트 테스트 |
| 별 선택 → 선 연결 시각화 | `THREE.LineSegments` + `BufferGeometry` 동적 업데이트 |
| 과거 하늘 복원 | `observedAt`(UTC) + `lat/lng` → `starToPoint3D()` 재실행. 기존 로직 재사용 가능 |
| JWT 인증 | `@fastify/jwt` + httpOnly 쿠키 or Bearer 토큰 |
| 별자리 썸네일 | GL 렌더 결과를 `gl.readPixels()`로 캡처 → base64 저장 |
