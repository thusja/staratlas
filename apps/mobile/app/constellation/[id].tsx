import { useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useConstellation } from '../../hooks/useConstellations';
import { useStarCatalog } from '../../hooks/useStarCatalog';
import { starToPoint3D, magnitudeToSize, magnitudeToOpacity } from '../../lib/astro';
import type { StarPoint3D } from '../../store/types';

const SPHERE_RADIUS = 100;

export default function ConstellationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const constellationId = id ? parseInt(id, 10) : null;

  const { data: constellation, isLoading: loadingC, error: errorC } = useConstellation(constellationId);
  const { data: catalog,       isLoading: loadingS, error: errorS } = useStarCatalog(true);

  const isLoading = loadingC || loadingS;
  const error     = errorC || errorS;

  // 저장된 시각·위치로 모든 별 위치 재계산
  const allStars = useMemo<StarPoint3D[]>(() => {
    if (!catalog || !constellation) return [];
    const date = new Date(constellation.observedAt);
    return catalog
      .map((s) => starToPoint3D(s, constellation.lat, constellation.lng, date))
      .filter((s): s is StarPoint3D => s !== null);
  }, [catalog, constellation]);

  // 별자리 구성 별들 (순서대로)
  const constellationStarPoints = useMemo<StarPoint3D[]>(() => {
    if (!allStars.length || !constellation) return [];
    const sorted = [...constellation.stars].sort((a, b) => a.order - b.order);
    return sorted
      .map((cs) => allStars.find((s) => s.hipId === cs.hipId))
      .filter((s): s is StarPoint3D => s != null);
  }, [allStars, constellation]);

  const [selectedStar, setSelectedStar]   = useState<StarPoint3D | null>(null);
  const glLayoutRef   = useRef({ width: 1, height: 1 });
  const cameraRef     = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef   = useRef<Renderer | null>(null);
  const rotationRef   = useRef({ azimuth: 0, altitude: 0.5 });
  const initialRotRef = useRef({ azimuth: 0, altitude: 0.5 });
  const fovRef        = useRef(75);
  const rafRef        = useRef<number | null>(null);

  const onContextCreate = async (gl: WebGLRenderingContext) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x05080f);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      fovRef.current,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    // 별 Points — 등급별 3그룹
    if (allStars.length > 0) {
      const groups = [
        { stars: allStars.filter((s) => s.magnitude < 1),                     size: magnitudeToSize(0),   opacity: magnitudeToOpacity(0) },
        { stars: allStars.filter((s) => s.magnitude >= 1 && s.magnitude < 3), size: magnitudeToSize(2),   opacity: magnitudeToOpacity(2) },
        { stars: allStars.filter((s) => s.magnitude >= 3),                    size: magnitudeToSize(4),   opacity: magnitudeToOpacity(4) },
      ];

      for (const { stars: group, size, opacity } of groups) {
        if (group.length === 0) continue;
        const positions = new Float32Array(group.length * 3);
        const colors    = new Float32Array(group.length * 3);
        group.forEach((star, i) => {
          positions[i * 3]     = star.x;
          positions[i * 3 + 1] = star.y;
          positions[i * 3 + 2] = star.z;
          const b = opacity;
          colors[i * 3]     = 0.75 * b + 0.25;
          colors[i * 3 + 1] = 0.85 * b + 0.15;
          colors[i * 3 + 2] = 1.0 * b;
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
        scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
          vertexColors: true, size, sizeAttenuation: false, transparent: true, opacity,
        })));
      }
    }

    // 지평선 링
    const horizonGeo = new THREE.RingGeometry(SPHERE_RADIUS - 0.5, SPHERE_RADIUS + 0.5, 128);
    scene.add(new THREE.Mesh(horizonGeo, new THREE.MeshBasicMaterial({
      color: 0x2a4060, side: THREE.DoubleSide, transparent: true, opacity: 0.4,
    })));

    // 별자리 연결선
    if (constellationStarPoints.length >= 2) {
      const points = constellationStarPoints.map((s) => new THREE.Vector3(s.x, s.y, s.z));
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color: 0x4a80ff, opacity: 0.85, transparent: true });
      scene.add(new THREE.Line(geo, mat));

      // 별자리 별 강조 표시
      const hlPositions = new Float32Array(constellationStarPoints.length * 3);
      constellationStarPoints.forEach((s, i) => {
        hlPositions[i * 3]     = s.x;
        hlPositions[i * 3 + 1] = s.y;
        hlPositions[i * 3 + 2] = s.z;
      });
      const hlGeo = new THREE.BufferGeometry();
      hlGeo.setAttribute('position', new THREE.BufferAttribute(hlPositions, 3));
      scene.add(new THREE.Points(hlGeo, new THREE.PointsMaterial({
        color: 0x8ab4ff, size: 6, sizeAttenuation: false, transparent: true, opacity: 0.9,
      })));

      // 카메라를 첫 번째 별자리 별을 향하도록 초기화
      const first = constellationStarPoints[0];
      const az  = Math.atan2(first.x, first.z);
      const alt = Math.asin(first.y / SPHERE_RADIUS);
      rotationRef.current  = { azimuth: az, altitude: alt };
      initialRotRef.current = { azimuth: az, altitude: alt };
    }

    // 렌더 루프
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const { azimuth, altitude } = rotationRef.current;
      camera.lookAt(
        Math.cos(altitude) * Math.sin(azimuth) * SPHERE_RADIUS,
        Math.sin(altitude) * SPHERE_RADIUS,
        Math.cos(altitude) * Math.cos(azimuth) * SPHERE_RADIUS,
      );
      renderer.render(scene, camera);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (gl as any).endFrameEXP();
    };
    animate();
  };

  const hitTestStar = (touchX: number, touchY: number): StarPoint3D | null => {
    const camera = cameraRef.current;
    if (!camera) return null;
    const { width, height } = glLayoutRef.current;
    const ndcX =  (touchX / width)  * 2 - 1;
    const ndcY = -(touchY / height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    let closest: StarPoint3D | null = null;
    let closestAngle = Infinity;
    const THRESHOLD = 0.04;
    for (const star of allStars) {
      const sv = new THREE.Vector3(star.x, star.y, star.z).normalize();
      const rd = raycaster.ray.direction.clone().normalize();
      const angle = Math.acos(Math.min(1, Math.max(-1, sv.dot(rd))));
      if (angle < THRESHOLD && angle < closestAngle) {
        closestAngle = angle;
        closest = star;
      }
    }
    return closest;
  };

  const handleTap = (x: number, y: number) => {
    if (selectedStar) { setSelectedStar(null); return; }
    setSelectedStar(hitTestStar(x, y));
  };

  const tapGesture = Gesture.Tap().maxDuration(250).onEnd((e) => {
    runOnJS(handleTap)(e.x, e.y);
  });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      rotationRef.current = {
        azimuth:  initialRotRef.current.azimuth - e.translationX * 0.005,
        altitude: Math.max(-Math.PI / 2, Math.min(Math.PI / 2,
          initialRotRef.current.altitude + e.translationY * 0.003)),
      };
    })
    .onEnd(() => { initialRotRef.current = { ...rotationRef.current }; });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const camera = cameraRef.current;
      if (!camera) return;
      camera.fov = Math.max(20, Math.min(120, fovRef.current / e.scale));
      camera.updateProjectionMatrix();
    })
    .onEnd((e) => {
      fovRef.current = Math.max(20, Math.min(120, fovRef.current / e.scale));
    });

  const composed = Gesture.Exclusive(tapGesture, Gesture.Simultaneous(panGesture, pinchGesture));

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a80ff" />
        <Text style={styles.loadingText}>하늘을 복원하는 중...</Text>
      </SafeAreaView>
    );
  }

  if (error || !constellation) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>불러오기 실패</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← 돌아가기</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const observedDate = new Date(constellation.observedAt);
  const dateLabel = `${observedDate.getFullYear()}.${String(observedDate.getMonth() + 1).padStart(2, '0')}.${String(observedDate.getDate()).padStart(2, '0')} ${String(observedDate.getHours()).padStart(2, '0')}:${String(observedDate.getMinutes()).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <GLView
          style={StyleSheet.absoluteFill}
          onContextCreate={onContextCreate}
          onLayout={(e) => {
            glLayoutRef.current = {
              width:  e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            };
          }}
        />
      </GestureDetector>

      {/* 상단 정보 바 */}
      <SafeAreaView style={styles.topBar} pointerEvents="none">
        <View style={styles.topBarInner}>
          <Text style={styles.constellationName}>{constellation.name}</Text>
          <Text style={styles.metaText}>{dateLabel}</Text>
          {constellation.memo ? (
            <Text style={styles.memoText} numberOfLines={1}>{constellation.memo}</Text>
          ) : null}
        </View>
      </SafeAreaView>

      {/* 뒤로 가기 버튼 */}
      <SafeAreaView style={styles.backWrapper}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.backButtonText}>← 목록</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* 별 정보 팝업 */}
      {selectedStar && (
        <View style={styles.popupOverlay}>
          <View style={styles.popup}>
            <View style={styles.popupHeader}>
              <Text style={styles.popupName}>
                {selectedStar.name ?? `HIP ${selectedStar.hipId}`}
              </Text>
              <TouchableOpacity onPress={() => setSelectedStar(null)} hitSlop={12}>
                <Text style={styles.popupClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.popupMag}>등급 {selectedStar.magnitude.toFixed(2)}</Text>
            {constellationStarPoints.some((s) => s.hipId === selectedStar.hipId) && (
              <Text style={styles.popupInConst}>✦ 이 별자리의 구성 별</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05080f',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#05080f',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#6a8090',
    fontSize: 14,
  },
  backText: {
    color: '#4a80ff',
    fontSize: 14,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topBarInner: {
    paddingHorizontal: 80,
    paddingTop: 12,
    alignItems: 'center',
    gap: 2,
  },
  constellationName: {
    color: '#c8d8f8',
    fontSize: 18,
    letterSpacing: 2,
  },
  metaText: {
    color: '#4a6080',
    fontSize: 12,
  },
  memoText: {
    color: '#3a5060',
    fontSize: 12,
  },
  backWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButtonText: {
    color: '#4a6080',
    fontSize: 14,
  },
  popupOverlay: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
  },
  popup: {
    backgroundColor: 'rgba(10, 18, 35, 0.95)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1a3050',
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  popupName: {
    color: '#c8d8f8',
    fontSize: 16,
  },
  popupClose: {
    color: '#4a6080',
    fontSize: 14,
  },
  popupMag: {
    color: '#6a8090',
    fontSize: 13,
  },
  popupInConst: {
    color: '#8ab4ff',
    fontSize: 12,
    marginTop: 6,
  },
});
