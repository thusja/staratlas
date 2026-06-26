# Star Atlas — 상태 구조 설계

> MVP 범위: 현재 위치/시각 기반 3D 밤하늘 렌더링  
> 워크플로우 + API 설계 기반

---

## 체크리스트 결론 먼저

| 확인 항목 | 결론 |
|-----------|------|
| 서버 상태 / 클라이언트 상태 분리 | 분리함. 서버 상태는 TanStack Query, 클라이언트 상태는 Zustand |
| React Query / SWR 사용 여부 | **TanStack Query 사용** — 이유는 아래 상세 |

---

## 상태 분류 원칙

```
전역 상태 (Zustand)        : 여러 화면·컴포넌트에서 공유되어야 하는 데이터
서버 상태 (TanStack Query) : API 응답 — 로딩/에러/캐시 생명주기가 있는 데이터
로컬 상태 (useState)       : 해당 컴포넌트에서만 쓰이고 다른 곳에선 필요 없는 데이터
```

**전역이어야 하는 기준**: "이 데이터가 없으면 다른 화면이 렌더링될 수 없는가?"  
→ YES이면 전역, NO이면 로컬

---

## 전체 상태 맵

```
┌─────────────────────────────────────────────────────────────┐
│                     앱 전체 상태                              │
│                                                               │
│  ┌──────────────────────┐   ┌───────────────────────────┐   │
│  │   Zustand            │   │   TanStack Query          │   │
│  │   (클라이언트 상태)    │   │   (서버 상태)              │   │
│  │                      │   │                           │   │
│  │  observerStore       │   │  useStarCatalog()         │   │
│  │  ├─ lat              │   │  ├─ data: Star[]           │   │
│  │  ├─ lng              │   │  ├─ isLoading              │   │
│  │  └─ timestamp        │   │  ├─ isError                │   │
│  │                      │   │  └─ (자동 캐시·재시도)      │   │
│  │  renderedStarStore   │   │                           │   │
│  │  └─ renderedStars[]  │   └───────────────────────────┘   │
│  │     (XYZ 변환 결과)   │                                   │
│  └──────────────────────┘                                   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  컴포넌트 로컬 상태 (useState)                          │   │
│  │                                                        │   │
│  │  PermissionScreen   LoadingScreen    SkyViewScreen     │   │
│  │  permissionStatus   loadingStep      isViewDrifted     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. 서버 상태 — TanStack Query

### 왜 TanStack Query를 쓰는가

MVP에서 API 호출이 1개뿐이라 "과하지 않나?" 싶을 수 있음.  
하지만 직접 `fetch`로 관리할 때 생기는 문제들이 있음:

| 직접 fetch 시 구현해야 할 것 | TanStack Query가 대신 처리 |
|-----------------------------|--------------------------|
| isLoading 상태 직접 관리 | 자동 |
| 에러 발생 시 재시도 로직 | 자동 (기본 3회) |
| 컴포넌트 언마운트 후 응답 무시 | 자동 |
| 동일 쿼리 중복 호출 방지 | 자동 (staleTime 설정) |
| 앱 포커스 복귀 시 재검증 | 설정으로 제어 |

별 카탈로그는 "한 번 받으면 앱 세션 동안 변하지 않는 데이터"이므로 **staleTime을 길게 설정**하면 사실상 세션 캐시처럼 동작함.

### 구현

```typescript
// hooks/useStarCatalog.ts
import { useQuery } from '@tanstack/react-query';

type Star = {
  hipId: number;
  ra: number;
  dec: number;
  magnitude: number;
  name: string | null;
};

const fetchStars = async (): Promise<Star[]> => {
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/stars?magnitude_max=5`);
  if (!res.ok) throw new Error('별 카탈로그를 불러오지 못했습니다');
  const json = await res.json();
  return json.stars;
};

export const useStarCatalog = () =>
  useQuery({
    queryKey: ['stars', { magnitudeMax: 5 }],
    queryFn: fetchStars,
    staleTime: Infinity,   // 앱 세션 동안 재요청 안 함 — 카탈로그는 변하지 않음
    retry: 2,              // 실패 시 2회 재시도
    gcTime: Infinity,      // 가비지 컬렉션 없음 (앱 종료 전까지 캐시 유지)
  });

// 사용처: LoadingScreen, SkyViewScreen
// const { data: stars, isLoading, isError } = useStarCatalog();
```

**SWR을 쓰지 않는 이유**: TanStack Query가 `staleTime`, `gcTime` 등 캐시 생명주기 제어가 더 세밀함. React Native 환경에서의 레퍼런스도 더 많음.

---

## 2. 클라이언트 전역 상태 — Zustand

### 왜 전역이어야 하는가

```
observerStore (lat, lng, timestamp)
→ LoadingScreen에서 수집
→ SkyViewScreen에서 천체력 계산에 사용
→ 두 화면을 거치므로 prop drilling 없이 공유되어야 함

renderedStarStore (renderedStars[])
→ SkyViewScreen에서 three.js가 렌더링
→ 향후 별 탭 인터랙션(2단계)에서도 접근 필요
→ 재계산이 무거운 작업(~1,700개 좌표 변환)이므로 한 번 저장 후 재사용
```

### 스토어 구조

```typescript
// store/observerStore.ts
import { create } from 'zustand';

type ObserverState = {
  lat: number | null;
  lng: number | null;
  timestamp: number | null;    // Unix ms
  setObserver: (lat: number, lng: number, timestamp: number) => void;
  reset: () => void;
};

export const useObserverStore = create<ObserverState>((set) => ({
  lat: null,
  lng: null,
  timestamp: null,
  setObserver: (lat, lng, timestamp) => set({ lat, lng, timestamp }),
  reset: () => set({ lat: null, lng: null, timestamp: null }),
}));
```

```typescript
// store/renderedStarStore.ts
import { create } from 'zustand';

type StarPoint3D = {
  hipId: number;
  x: number;
  y: number;
  z: number;
  magnitude: number;
  name: string | null;
};

type RenderedStarState = {
  renderedStars: StarPoint3D[];
  setRenderedStars: (stars: StarPoint3D[]) => void;
  clear: () => void;
};

export const useRenderedStarStore = create<RenderedStarState>((set) => ({
  renderedStars: [],
  setRenderedStars: (stars) => set({ renderedStars: stars }),
  clear: () => set({ renderedStars: [] }),
}));
```

**starCatalog(API 응답)을 Zustand에 넣지 않는 이유**:  
TanStack Query가 이미 캐시를 관리하고 있음. Zustand에 중복 저장하면 두 곳을 동기화해야 하는 문제가 생김. 서버 상태는 Query 레이어에 일임하고, Zustand는 순수 클라이언트 상태만 가짐.

---

## 3. 컴포넌트 로컬 상태 — useState

### 어떤 것이 로컬인가

**다른 화면이나 컴포넌트에서 이 상태를 알 필요가 없는 것.**

```typescript
// [01] PermissionScreen
const [permissionStatus, setPermissionStatus] =
  useState<'undetermined' | 'granted' | 'denied'>('undetermined');

// 이유: 권한 상태는 이 화면에서만 UI를 분기하는 데 사용.
//       권한이 허용되면 화면 자체가 전환되므로 다른 화면에서 이 값을 볼 일이 없음.
```

```typescript
// [02] LoadingScreen
const [loadingStep, setLoadingStep] = useState<1 | 2 | 3>(1);
// 1 = "위치 확인 중", 2 = "별 목록 불러오는 중", 3 = "하늘 계산 중"

// 이유: 로딩 텍스트 표시만을 위한 상태. 로딩 완료 후 화면 자체가 사라짐.
```

```typescript
// [03] SkyViewScreen
const [isViewDrifted, setIsViewDrifted] = useState(false);
// 카메라가 초기 방향에서 15° 이상 벗어났을 때 true → "돌아오기" 버튼 노출

// 이유: 이 버튼의 존재 여부는 SkyViewScreen 내부에서만 의미 있음.
//       다른 화면에서 카메라 각도를 알아야 할 이유가 없음.
```

---

## 4. 상태 흐름 — 화면 전환 시나리오

```
[01] PermissionScreen
  로컬: permissionStatus = 'undetermined'
  → 버튼 탭
  → permissionStatus = 'granted'
  → 화면 전환

        ↓

[02] LoadingScreen
  로컬: loadingStep = 1
  ─ GPS 수집 완료
    → useObserverStore.setObserver(lat, lng, timestamp)  ← 전역에 저장
    → loadingStep = 2

  ─ useStarCatalog() 호출 (TanStack Query)
    → isLoading = true
    → 서버에서 stars[] 수신
    → isLoading = false
    → loadingStep = 3

  ─ 좌표 변환 (astronomy-engine)
    → useRenderedStarStore.setRenderedStars(starPoints)  ← 전역에 저장
    → 화면 전환

        ↓

[03] SkyViewScreen
  전역: useObserverStore() → lat, lng, timestamp (TopInfoBar 표시)
  서버: useStarCatalog()   → stars[] (별 탭 시 이름 표시용 — 2단계)
  전역: useRenderedStarStore() → renderedStars (three.js 렌더 입력)
  로컬: isViewDrifted      → "돌아오기" 버튼 노출 제어
```

---

## 5. 전체 판단 요약

| 데이터 | 상태 위치 | 이유 |
|--------|-----------|------|
| `lat`, `lng`, `timestamp` | Zustand (전역) | 로딩→하늘 뷰 화면 간 공유 필수 |
| `renderedStars[]` | Zustand (전역) | 무거운 계산 결과 재사용, 2단계 인터랙션에서도 접근 |
| `stars[]` (API 응답) | TanStack Query | 서버 상태. 로딩/에러/캐시를 Query가 관리 |
| `permissionStatus` | useState (로컬) | PermissionScreen 안에서만 사용 |
| `loadingStep` | useState (로컬) | LoadingScreen UI 전용 |
| `isViewDrifted` | useState (로컬) | SkyViewScreen 내 버튼 노출 제어 |

---

## 6. 폴더 구조

```
src/
├── store/
│   ├── observerStore.ts       # Zustand — GPS + 시각
│   └── renderedStarStore.ts   # Zustand — 3D 좌표 변환 결과
│
├── hooks/
│   └── useStarCatalog.ts      # TanStack Query — GET /api/stars
│
└── app/
    ├── permission.tsx          # 로컬: permissionStatus
    ├── loading.tsx             # 로컬: loadingStep
    └── sky.tsx                 # 로컬: isViewDrifted
```
