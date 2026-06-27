import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, SafeAreaView } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useObserverStore } from '../store/observerStore';
import { useRenderedStarStore } from '../store/renderedStarStore';
import { useStarCatalog } from '../hooks/useStarCatalog';
import { starToPoint3D } from '../lib/astro';

const STEPS = [
  '위치를 확인하는 중...',
  '별 목록을 불러오는 중...',
  '하늘을 계산하는 중...',
];

export default function LoadingScreen() {
  const [step, setStep] = useState(0);
  const [locationLabel, setLocationLabel] = useState('');
  const spinAnim = useRef(new Animated.Value(0)).current;

  const setObserver = useObserverStore((s) => s.setObserver);
  const setRenderedStars = useRenderedStarStore((s) => s.setRenderedStars);
  const { data: stars, refetch } = useStarCatalog();

  // 스피너 애니메이션
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    run();
  }, []);

  const run = async () => {
    // STEP 1 — GPS 수집
    setStep(0);
    let location: Location.LocationObject;
    try {
      location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch {
      router.replace('/permission');
      return;
    }

    const { latitude: lat, longitude: lng, altitude } = location.coords;
    const timestamp = location.timestamp;

    // 위치명 역지오코딩
    try {
      const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      setLocationLabel(geo?.city || geo?.region || `${lat.toFixed(2)}, ${lng.toFixed(2)}`);
    } catch {
      setLocationLabel(`${lat.toFixed(2)}, ${lng.toFixed(2)}`);
    }

    setObserver(lat, lng, timestamp);

    // STEP 2 — 별 카탈로그 로드
    setStep(1);
    const result = await refetch();
    const catalog = result.data ?? [];

    // STEP 3 — 좌표 변환
    setStep(2);
    const date = new Date(timestamp);
    const points = catalog
      .map((star) => starToPoint3D(star, lat, lng, date))
      .filter((p) => p !== null);

    setRenderedStars(points);

    // 완료 → 하늘 뷰로 이동
    router.replace('/sky');
  };

  const now = new Date();
  const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateLabel = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.container}>
      {/* 스피너 */}
      <Animated.Text style={[styles.spinner, { transform: [{ rotate: spin }] }]}>
        ✦
      </Animated.Text>

      {/* 상태 텍스트 */}
      <Text style={styles.statusText}>{STEPS[step]}</Text>

      {/* 프로그레스 바 */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((step + 1) / 3) * 100}%` }]} />
      </View>

      {/* 위치 & 시각 */}
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
