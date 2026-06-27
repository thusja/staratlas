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
import { useObserverStore } from '../store/observerStore';
import { useRenderedStarStore } from '../store/renderedStarStore';

const SPHERE_RADIUS = 100;

export default function SkyViewScreen() {
  const [isViewDrifted, setIsViewDrifted] = useState(false);

  const lat = useObserverStore((s) => s.lat);
  const lng = useObserverStore((s) => s.lng);
  const timestamp = useObserverStore((s) => s.timestamp);
  const renderedStars = useRenderedStarStore((s) => s.renderedStars);

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const rotationRef = useRef({ azimuth: 0, altitude: 0 });
  const initialRotRef = useRef({ azimuth: 0, altitude: 0 });
  const fovRef = useRef(75);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rafRef = useRef<number | null>(null);

  const now = new Date(timestamp ?? Date.now());
  const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const locationLabel =
    lat && lng ? `${lat.toFixed(1)}°N ${lng.toFixed(1)}°E` : '';

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

    // 별 Points 생성
    if (renderedStars.length > 0) {
      const positions = new Float32Array(renderedStars.length * 3);
      const colors = new Float32Array(renderedStars.length * 3);
      const sizes = new Float32Array(renderedStars.length);

      renderedStars.forEach((star, i) => {
        positions[i * 3] = star.x;
        positions[i * 3 + 1] = star.y;
        positions[i * 3 + 2] = star.z;

        // 등급에 따른 밝기
        const brightness = star.magnitude < 1 ? 1.0 : star.magnitude < 3 ? 0.8 : 0.55;
        colors[i * 3] = 0.75 * brightness + 0.1;     // R
        colors[i * 3 + 1] = 0.85 * brightness + 0.1; // G
        colors[i * 3 + 2] = 1.0 * brightness;         // B

        sizes[i] = star.magnitude < 1 ? 4 : star.magnitude < 3 ? 2.5 : 1.5;
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        vertexColors: true,
        size: 2,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.9,
      });

      scene.add(new THREE.Points(geometry, material));
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
      gl.endFrameEXP();
    };
    animate();
  };

  // 현재 방향으로 카메라 복귀
  const resetView = () => {
    rotationRef.current = { azimuth: 0, altitude: 0.5 }; // 천정 방향
    setIsViewDrifted(false);
  };

  // 드래그 제스처
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      rotationRef.current = {
        azimuth: initialRotRef.current.azimuth - e.translationX * 0.005,
        altitude: Math.max(
          -Math.PI / 2,
          Math.min(
            Math.PI / 2,
            initialRotRef.current.altitude + e.translationY * 0.003
          )
        ),
      };
      const drifted =
        Math.abs(rotationRef.current.azimuth) > 0.3 ||
        Math.abs(rotationRef.current.altitude - 0.5) > 0.3;
      setIsViewDrifted(drifted);
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
        <Text style={styles.timeText}>{timeLabel}</Text>
        <Text style={styles.locationText}>📍 {locationLabel}</Text>
      </SafeAreaView>

      {/* 방위 힌트 */}
      <View style={styles.compass} pointerEvents="none">
        <Text style={styles.compassText}>↑ 북</Text>
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
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  timeText: {
    color: '#8090b0',
    fontSize: 14,
  },
  locationText: {
    color: '#8090b0',
    fontSize: 14,
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
