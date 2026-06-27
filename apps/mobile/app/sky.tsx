import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useObserverStore } from '../store/observerStore';
import { useRenderedStarStore } from '../store/renderedStarStore';
import { magnitudeToSize, magnitudeToOpacity } from '../lib/astro';

const SPHERE_RADIUS = 100;

export default function SkyViewScreen() {
  const [isViewDrifted, setIsViewDrifted] = useState(false);
  const [compassLabel, setCompassLabel] = useState('↑ 북');

  const lat = useObserverStore((s) => s.lat);
  const lng = useObserverStore((s) => s.lng);
  const timestamp = useObserverStore((s) => s.timestamp);
  const renderedStars = useRenderedStarStore((s) => s.renderedStars);

  // renderedStars 없이 직접 진입한 경우 로딩으로 복귀 (마운트 시 1회만 체크)
  useEffect(
    () => {
      if (renderedStars.length === 0) {
        router.replace('/loading');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const rotationRef = useRef({ azimuth: 0, altitude: 0 });
  const initialRotRef = useRef({ azimuth: 0, altitude: 0 });
  // 트윈 목표값 — null이면 트윈 비활성
  const tweenTargetRef = useRef<{ azimuth: number; altitude: number } | null>(null);
  const fovRef = useRef(75);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rafRef = useRef<number | null>(null);

  const now = new Date(timestamp ?? Date.now());
  const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const locationLabel = lat != null && lng != null
    ? `${lat.toFixed(1)}°N  ${Math.abs(lng).toFixed(1)}°${lng >= 0 ? 'E' : 'W'}`
    : '위치 없음';

  const onContextCreate = async (gl: WebGLRenderingContext) => {
    glRef.current = gl;

    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x05080f);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      fovRef.current,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    // 별 Points — 등급별 3그룹으로 분리 (per-star 크기 적용)
    if (renderedStars.length > 0) {
      const groups = [
        { stars: renderedStars.filter((s) => s.magnitude < 1),                      size: magnitudeToSize(0),   opacity: magnitudeToOpacity(0) },
        { stars: renderedStars.filter((s) => s.magnitude >= 1 && s.magnitude < 3),  size: magnitudeToSize(2),   opacity: magnitudeToOpacity(2) },
        { stars: renderedStars.filter((s) => s.magnitude >= 3),                     size: magnitudeToSize(4),   opacity: magnitudeToOpacity(4) },
      ];

      for (const { stars: group, size, opacity } of groups) {
        if (group.length === 0) continue;
        const positions = new Float32Array(group.length * 3);
        const colors = new Float32Array(group.length * 3);

        group.forEach((star, i) => {
          positions[i * 3]     = star.x;
          positions[i * 3 + 1] = star.y;
          positions[i * 3 + 2] = star.z;
          // 등급에 따른 색상 — 밝은 별은 더 희게
          const b = opacity;
          colors[i * 3]     = 0.75 * b + 0.25;
          colors[i * 3 + 1] = 0.85 * b + 0.15;
          colors[i * 3 + 2] = 1.0 * b;
        });

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
          vertexColors: true,
          size,
          sizeAttenuation: false,
          transparent: true,
          opacity,
        });
        scene.add(new THREE.Points(geo, mat));
      }
    }

    // 지평선 링
    const horizonGeo = new THREE.RingGeometry(SPHERE_RADIUS - 0.5, SPHERE_RADIUS + 0.5, 128);
    const horizonMat = new THREE.MeshBasicMaterial({
      color: 0x2a4060,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    scene.add(new THREE.Mesh(horizonGeo, horizonMat));

    // 렌더 루프 (lerp 트윈 포함)
    const LERP_FACTOR = 0.08;
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);

      // 트윈 활성화 중이면 현재 rotation을 목표로 보간
      const target = tweenTargetRef.current;
      if (target) {
        const cur = rotationRef.current;
        const nextAz  = cur.azimuth  + (target.azimuth  - cur.azimuth)  * LERP_FACTOR;
        const nextAlt = cur.altitude + (target.altitude - cur.altitude) * LERP_FACTOR;
        rotationRef.current = { azimuth: nextAz, altitude: nextAlt };
        initialRotRef.current = { azimuth: nextAz, altitude: nextAlt };
        // 목표에 충분히 가까우면 트윈 종료
        if (Math.abs(nextAz - target.azimuth) < 0.001 && Math.abs(nextAlt - target.altitude) < 0.001) {
          rotationRef.current = { ...target };
          initialRotRef.current = { ...target };
          tweenTargetRef.current = null;
        }
      }

      const { azimuth, altitude } = rotationRef.current;
      camera.lookAt(
        Math.cos(altitude) * Math.sin(azimuth) * SPHERE_RADIUS,
        Math.sin(altitude) * SPHERE_RADIUS,
        Math.cos(altitude) * Math.cos(azimuth) * SPHERE_RADIUS,
      );
      renderer.render(scene, camera);
      // expo-gl 전용 확장 메서드 — 표준 WebGLRenderingContext 타입에 미포함
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (gl as any).endFrameEXP();
    };
    animate();
  };

  // 현재 방향으로 카메라 복귀 (트윈 애니메이션)
  const resetView = () => {
    tweenTargetRef.current = { azimuth: 0, altitude: 0.5 };
    setIsViewDrifted(false);
  };

  // 방위각(rad) → 방향 레이블 계산
  const azimuthToCompass = (az: number): string => {
    // azimuth 0 = 북, 증가 방향은 동쪽
    const deg = ((az * 180) / Math.PI + 360) % 360;
    if (deg < 22.5 || deg >= 337.5) return '↑ 북';
    if (deg < 67.5)  return '↑ 북동';
    if (deg < 112.5) return '→ 동';
    if (deg < 157.5) return '↓ 남동';
    if (deg < 202.5) return '↓ 남';
    if (deg < 247.5) return '↓ 남서';
    if (deg < 292.5) return '← 서';
    return '↑ 북서';
  };

  // 드래그 제스처
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const newAz = initialRotRef.current.azimuth - e.translationX * 0.005;
      const newAlt = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, initialRotRef.current.altitude + e.translationY * 0.003)
      );
      rotationRef.current = { azimuth: newAz, altitude: newAlt };

      // 15° = 0.2618 rad 벗어나면 버튼 표시
      const drifted =
        Math.abs(newAz % (2 * Math.PI)) > 0.2618 ||
        Math.abs(newAlt - 0.5) > 0.2618;
      runOnJS(setIsViewDrifted)(drifted);
      runOnJS(setCompassLabel)(azimuthToCompass(newAz));
    })
    .onEnd(() => {
      initialRotRef.current = { ...rotationRef.current };
    });

  // 핀치 제스처
  const pinchGesture = Gesture.Pinch().onUpdate((e) => {
    const camera = cameraRef.current;
    if (!camera) return;
    const newFov = Math.max(20, Math.min(120, fovRef.current / e.scale));
    camera.fov = newFov;
    camera.updateProjectionMatrix();
  }).onEnd((e) => {
    fovRef.current = Math.max(20, Math.min(120, fovRef.current / e.scale));
  });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  useEffect(() => {
    rotationRef.current = { azimuth: 0, altitude: 0.5 };
    initialRotRef.current = { azimuth: 0, altitude: 0.5 };
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* 3D GL 뷰 */}
      <GestureDetector gesture={composed}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      </GestureDetector>

      {/* 상단 정보 바 */}
      <SafeAreaView style={styles.topBar} pointerEvents="none">
        <View style={styles.topLeft}>
          <Text style={styles.menuIcon}>☰</Text>
          <Text style={styles.timeText}>{timeLabel}</Text>
        </View>
        <View style={styles.topRight}>
          <Text style={styles.locationText}>📍 {locationLabel}</Text>
          <Text style={styles.starCount}>{renderedStars.length}개</Text>
        </View>
      </SafeAreaView>

      {/* 방위 힌트 */}
      <View style={styles.compass} pointerEvents="none">
        <Text style={styles.compassText}>{compassLabel}</Text>
      </View>

      {/* 현재 하늘로 돌아오기 버튼 */}
      {isViewDrifted && (
        <View style={styles.resetWrapper}>
          <TouchableOpacity style={styles.resetButton} onPress={resetView} activeOpacity={0.8}>
            <Text style={styles.resetText}>현재 하늘로 돌아오기</Text>
          </TouchableOpacity>
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
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuIcon: {
    color: '#4a6080',
    fontSize: 18,
  },
  timeText: {
    color: '#8090b0',
    fontSize: 14,
  },
  locationText: {
    color: '#8090b0',
    fontSize: 14,
  },
  starCount: {
    color: '#3a5070',
    fontSize: 12,
  },
  compass: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
  },
  compassText: {
    color: '#3a5070',
    fontSize: 13,
  },
  resetWrapper: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
  },
  resetButton: {
    backgroundColor: '#1a2a4a',
    borderWidth: 1,
    borderColor: '#3a5080',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  resetText: {
    color: '#c8d8f8',
    fontSize: 14,
  },
});
