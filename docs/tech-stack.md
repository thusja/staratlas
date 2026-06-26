# Star Atlas — 최종 기술 스택

> MVP 범위: 현재 위치/시각 기반 3D 밤하늘 렌더링  
> 모든 설계 단계(wireframe → state-structure) 기반 확정

---

## Expo Go를 쓰지 않는 이유

| 구분 | Expo Go | **EAS Build + expo-dev-client** (채택) |
|------|---------|----------------------------------------|
| 빌드 | Expo 샌드박스 앱 안에서 실행 | 앱 자체를 `.apk` / `.ipa` 로 직접 빌드 |
| 네이티브 모듈 | 제한됨 (Expo 허용 목록만) | 모든 네이티브 모듈 사용 가능 |
| Android / iOS 분리 | 불가 | 처음부터 개별 빌드로 분리 관리 |
| 추후 ejection | 복잡 | 필요 없음 (이미 커스텀 빌드 구조) |

**채택 구조**: Expo managed workflow는 유지하되, `expo-dev-client`로 커스텀 개발 빌드를 생성. `eas build --platform android`와 `eas build --platform ios`로 각각 독립 빌드.

---

## 📱 프론트엔드

### 코어

| 패키지 | 버전 기준 | 이유 |
|--------|----------|------|
| `react-native` | Expo SDK 최신 | 크로스플랫폼 앱 기반 프레임워크 |
| `expo` | SDK 52+ | 네이티브 모듈 관리 및 빌드 툴체인 제공 |
| `expo-dev-client` | latest | Expo Go 대신 커스텀 개발 빌드 생성 — Android/iOS 각각 독립 빌드 가능 |
| `eas-cli` | latest | `eas build --platform android/ios` 로 플랫폼별 빌드 분리 실행 |
| `typescript` | 5.x | 타입 안전성 — 좌표 계산 및 API 응답 타입 오류를 빌드 시점에 잡음 |

### 내비게이션

| 패키지 | 이유 |
|--------|------|
| `expo-router` | 파일 기반 라우팅 — 화면 3개의 전환 흐름을 디렉토리 구조로 표현 |

### 3D 렌더링

| 패키지 | 이유 |
|--------|------|
| `expo-gl` | React Native에서 OpenGL ES 컨텍스트를 네이티브로 제공 — three.js의 렌더 타겟 |
| `expo-three` | expo-gl과 three.js를 연결하는 브릿지 레이어 |
| `three` | 3D 구체 메시, Points 오브젝트, 레이캐스팅 등 3D 렌더링 전담 |

### 천체력 계산

| 패키지 | 이유 |
|--------|------|
| `astronomy-engine` | NASA 검증 천체력 라이브러리 — 적경/적위 → 지평좌표 변환, Julian Date 계산을 클라이언트에서 직접 처리. TypeScript 지원 |

### 위치 & 센서

| 패키지 | 이유 |
|--------|------|
| `expo-location` | GPS 권한 요청 + 현재 위치 수집 — `getCurrentPositionAsync()` |

### 인터랙션

| 패키지 | 이유 |
|--------|------|
| `react-native-gesture-handler` | 드래그(구체 회전), 핀치(줌) 제스처를 네이티브 스레드에서 처리해 JS 스레드 블로킹 방지 |
| `react-native-reanimated` | 카메라 복귀 트윈 애니메이션 — gesture-handler와 함께 사용 |

### 상태관리

| 패키지 | 이유 |
|--------|------|
| `zustand` | `observerStore`, `renderedStarStore` 전역 상태 관리 — 보일러플레이트 없이 경량 |
| `@tanstack/react-query` | `GET /api/stars` 서버 상태 관리 — 캐시·로딩·에러·재시도를 자동 처리 |

### 개발 도구

| 패키지 | 이유 |
|--------|------|
| `eslint` + `@typescript-eslint` | 코드 품질 — 타입 관련 런타임 오류 사전 방지 |
| `prettier` | 코드 스타일 일관성 유지 |

---

## � 공유 타입 패키지 (`packages/shared`)

> 프론트와 백엔드가 동일한 TypeScript 타입을 참조하는 핵심 레이어

| 패키지 | 이유 |
|--------|------|
| `typescript` | 공유 타입 정의 전용 패키지 — 양쪽에서 `import`해서 사용 |

**공유되는 타입 목록**

```typescript
// packages/shared/src/types/star.ts
export type Star = {
  hipId: number;
  ra: number;
  dec: number;
  magnitude: number;
  name: string | null;
};

export type StarsResponse = {
  stars: Star[];
  total: number;
  magnitudeMax: number;
};
```

**왜 공유 패키지가 필요한가**

| 상황 | 공유 패키지 없을 때 | 공유 패키지 있을 때 |
|------|-------------------|-------------------|
| API 응답 필드 추가 | 프론트/백엔드 타입을 각각 수정 | `shared` 1곳만 수정 |
| 타입 불일치 | 런타임에서 발견 | 빌드 시점에 TypeScript가 즉시 오류 표시 |
| 필드명 오타 | 디버깅 필요 | 컴파일 에러로 차단 |

---

## �🖥️ 백엔드

### 코어

| 패키지 | 이유 |
|--------|------|
| `node.js` 20 LTS | 런타임 — TypeScript와 조합, 풀스택 언어 통일 |
| `fastify` | Express 대비 2~3배 처리량, JSON 직렬화 최적화 내장 — 별 카탈로그 응답에 적합 |
| `typescript` | API 라우트·서비스 레이어 전체 타입 적용 — `@staratlas/shared` 타입 import해서 사용 |

### API

| 패키지 | 이유 |
|--------|------|
| `@fastify/cors` | RN 개발 환경에서 API 요청 허용 |
| `zod` | 쿼리 파라미터 검증 (`magnitude_max` 범위 체크) — 런타임 유효성 보장 |

### ORM / DB 연결

| 패키지 | 이유 |
|--------|------|
| `prisma` | `schema.prisma` 기반 타입세이프 ORM — DB 스키마와 TypeScript 타입 자동 동기화 |
| `@prisma/client` | Prisma 런타임 클라이언트 |

### 캐시

| 패키지 | 이유 |
|--------|------|
| `ioredis` | Redis 연결 클라이언트 — 별 카탈로그 24h 캐시. `node-redis`보다 API가 직관적 |

### 환경설정

| 패키지 | 이유 |
|--------|------|
| `dotenv` | `DATABASE_URL`, `REDIS_URL` 등 환경변수 관리 |

### 개발 도구

| 패키지 | 이유 |
|--------|------|
| `tsx` | TypeScript 파일 직접 실행 (`ts-node` 후속) — 개발 서버 빠른 기동 |
| `nodemon` | 파일 변경 시 서버 자동 재시작 |

---

## 🗄️ 데이터베이스

| 기술 | 이유 |
|------|------|
| **PostgreSQL 16** | 별 카탈로그 118,000행 + 향후 별자리/유저 저장. `Float` 타입으로 좌표값 정밀 저장 |
| **Redis 7** | 별 카탈로그 전체를 메모리 캐시(TTL 24h) — DB 조회를 사실상 0으로 만듦 |

---

## 빌드 & 배포 구조

```
개발 환경
  ┌──────────────────────────────────────────┐
  │  eas build --profile development         │
  │    --platform android  →  .apk 설치       │
  │    --platform ios      →  시뮬레이터/실기기 │
  └──────────────────────────────────────────┘

프로덕션 빌드
  ┌──────────────────────────────────────────┐
  │  eas build --profile production          │
  │    --platform android  →  .aab (Play Store) │
  │    --platform ios      →  .ipa (App Store)  │
  └──────────────────────────────────────────┘
```

`eas.json` 에서 Android / iOS 프로필을 각각 독립 관리하므로, 빌드 설정을 나중에 분기하는 것도 자유롭게 가능.

---

## 패키지 설치 명령 정리

### 프론트 (`/apps/mobile`)

```bash
# Expo 프로젝트 생성 (bare workflow)
npx create-expo-app mobile --template bare-minimum
cd mobile

# dev-client (Expo Go 대체)
npx expo install expo-dev-client

# 3D 렌더링
npx expo install expo-gl expo-three three

# 천체력
npm install astronomy-engine

# 위치
npx expo install expo-location

# 제스처 & 애니메이션
npx expo install react-native-gesture-handler react-native-reanimated

# 내비게이션
npx expo install expo-router

# 상태관리
npm install zustand @tanstack/react-query

# 타입
npm install -D typescript @types/react @types/three

# 공유 타입 패키지 로컬 참조
npm install @staratlas/shared@"*"
```

### 공유 타입 패키지 (`/packages/shared`)

```bash
mkdir -p packages/shared/src/types && cd packages/shared
npm init -y
# package.json name을 "@staratlas/shared"로 설정
npm install -D typescript
```

```json
// packages/shared/package.json (핵심 필드)
{
  "name": "@staratlas/shared",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

### 백엔드 (`/apps/server`)

```bash
mkdir server && cd server
npm init -y

npm install fastify @fastify/cors zod prisma @prisma/client ioredis dotenv
npm install -D typescript tsx nodemon @types/node

# 공유 타입 패키지 로컬 참조
npm install @staratlas/shared@"*"

npx prisma init
```

---

## 모노레포 디렉토리 구조 (권장)

```
staratlas/
├── apps/
│   ├── mobile/          # React Native (Expo)
│   │   ├── app/         # Expo Router 화면
│   │   ├── store/       # Zustand 스토어
│   │   ├── hooks/       # TanStack Query 훅
│   │   └── eas.json     # Android / iOS 빌드 프로필
│   │
│   └── server/          # Fastify 백엔드
│       ├── src/
│       │   ├── routes/  # API 라우트
│       │   └── plugins/ # Redis, CORS 등
│       └── prisma/
│           ├── schema.prisma
│           └── seed.ts  # Hipparcos 카탈로그 시딩
│
├── packages/
│   └── shared/          # 공유 TypeScript 타입
│       └── src/
│           ├── index.ts
│           └── types/
│               └── star.ts   # Star, StarsResponse 등
│
└── docs/
    ├── wireframe.md
    ├── workflow.md
    ├── api-spec.md
    ├── db-schema.md
    ├── state-structure.md
    └── tech-stack.md    ← 현재 파일
```
