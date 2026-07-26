import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, SafeAreaView } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useObserverStore } from '../store/observerStore';
import { useRenderedStarStore } from '../store/renderedStarStore';
import { useStarCatalog } from '../hooks/useStarCatalog';
import { starToPoint3D } from '../lib/astro';

const STEPS: Record<1 | 2 | 3, string> = {
  1: '위치를 확인하는 중...',
  2: '별 목록을 불러오는 중...',
  3: '하늘을 계산하는 중...',
};

export default function LoadingScreen() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [locationLabel, setLocationLabel] = useState('');
  const [locationReady, setLocationReady] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;

  const setObserver = useObserverStore((s) => s.setObserver);
  const setRenderedStars = useRenderedStarStore((s) => s.setRenderedStars);

  // 위치 수집 완료 후 카탈로그 자동 fetch 시작
  const { data: stars, isSuccess, isError } = useStarCatalog(locationReady);

  // 스피너 애니메이션
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const collectLocation = useCallback(async () => {
    setStep(1);
    try {
      // 먼저 마지막으로 알려진 위치 시도 (에뮬레이터 친화적)
      let location = await Location.getLastKnownPositionAsync();

      if (!location) {
        // 실시간 GPS 시도 (타임아웃 10초)
        location = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
        ]) as typeof location;
      }

      let lat: number;
      let lng: number;
      let timestamp: number;

      if (location) {
        lat = location.coords.latitude;
        lng = location.coords.longitude;
        timestamp = location.timestamp;
      } else {
        // GPS 없는 환경(에뮬레이터)에서는 서울 기본값 사용
        lat = 37.5665;
        lng = 126.978;
        timestamp = Date.now();
        setLocationLabel('서울 (기본값)');
      }

      if (!locationLabel) {
        try {
          const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          setLocationLabel(geo?.city || geo?.region || `${lat.toFixed(2)}, ${lng.toFixed(2)}`);
        } catch {
          setLocationLabel(`${lat.toFixed(2)}, ${lng.toFixed(2)}`);
        }
      }

      setObserver(lat, lng, timestamp);
      setStep(2);
      setLocationReady(true);
    } catch {
      // 권한 자체가 없는 경우에만 permission으로 이동
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        router.replace('/permission');
      } else {
        // 권한은 있지만 GPS 실패 → 서울 기본값
        const lat = 37.5665;
        const lng = 126.978;
        setLocationLabel('서울 (기본값)');
        setObserver(lat, lng, Date.now());
        setStep(2);
        setLocationReady(true);
      }
    }
  }, [setObserver, locationLabel]);

  // STEP 1 — GPS 수집
  useEffect(() => {
    collectLocation();
  }, [collectLocation]);

  const computeStars = useCallback(async () => {
    setStep(3);
    const observer = useObserverStore.getState();
    if (observer.lat == null || observer.lng == null || observer.timestamp == null) return;

    const date = new Date(observer.timestamp);
    const points = (stars ?? [])
      .map((star) => starToPoint3D(star, observer.lat!, observer.lng!, date))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    setRenderedStars(points);
    router.replace('/sky');
  }, [stars, setRenderedStars]);

  // STEP 2→3 — 카탈로그 로드 완료 후 좌표 변환
  useEffect(() => {
    if (!locationReady || !isSuccess || !stars) return;
    computeStars();
  }, [locationReady, isSuccess, stars, computeStars]);

  // 카탈로그 로드 실패
  useEffect(() => {
    if (isError) {
      // 서버 오류는 permission 화면이 아닌 재시도로 처리
      console.warn('별 카탈로그 로드 실패, 재시도 중...');
      const timer = setTimeout(() => setLocationReady(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isError]);

  const now = new Date();
  const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateLabel = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.container}>
      <Animated.Text style={[styles.spinner, { transform: [{ rotate: spin }] }]}>
        ✦
      </Animated.Text>
      <Text style={styles.statusText}>{STEPS[step]}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((step) / 3) * 100}%` }]} />
      </View>
      {locationLabel ? (
        <Text style={styles.meta}>
          📍 {locationLabel}  ·  {dateLabel}  {timeLabel}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05080f',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 40,
  },
  spinner: {
    fontSize: 48,
    color: '#a0c0e8',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#8090b0',
    letterSpacing: 0.5,
  },
  progressTrack: {
    width: '100%',
    height: 2,
    backgroundColor: '#1a2a3a',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4a7ab8',
    borderRadius: 1,
  },
  meta: {
    fontSize: 13,
    color: '#506070',
    marginTop: 8,
  },
});
