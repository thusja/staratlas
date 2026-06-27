import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  SafeAreaView,
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';

export default function PermissionScreen() {
  const [denied, setDenied] = useState(false);

  const handleRequest = async () => {
    if (denied) {
      // 이미 거부됐으면 설정 앱으로 이동
      await Linking.openSettings();
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status === 'granted') {
      router.replace('/loading');
    } else {
      setDenied(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 별 일러스트 */}
      <View style={styles.illustration}>
        <Text style={styles.starLarge}>✦</Text>
        <View style={styles.starRow}>
          <Text style={styles.starSmall}>·</Text>
          <Text style={styles.starMedium}>✦</Text>
          <Text style={styles.starSmall}>·</Text>
        </View>
        <View style={styles.starRow}>
          <Text style={styles.starMedium}>✦</Text>
          <Text style={styles.starSmall}>· ✦ ·</Text>
          <Text style={styles.starMedium}>✦</Text>
        </View>
        <View style={styles.starRow}>
          <Text style={styles.starSmall}>·</Text>
          <Text style={styles.starMedium}>✦</Text>
          <Text style={styles.starSmall}>·</Text>
        </View>
        <Text style={styles.starLarge}>✦</Text>
      </View>

      {/* 텍스트 */}
      <View style={styles.textArea}>
        <Text style={styles.title}>Star Atlas</Text>
        <Text style={styles.subtitle}>
          지금 이 순간, 당신 위치에서{'\n'}보이는 실제 밤하늘
        </Text>
      </View>

      {/* CTA 버튼 */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleRequest} activeOpacity={0.8}>
          <Text style={styles.buttonText}>
            {denied ? '⚙️  설정에서 권한 허용하기' : '📍  위치 접근 허용하기'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.caption}>
          위치 정보는 하늘 계산에만 사용되며 저장되지 않습니다
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05080f',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  illustration: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  starRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  starLarge: { fontSize: 28, color: '#c8d8f0' },
  starMedium: { fontSize: 18, color: '#a0b8e0' },
  starSmall: { fontSize: 12, color: '#607090' },
  textArea: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: '300',
    color: '#e8f0ff',
    letterSpacing: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#8090b0',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#1a2a4a',
    borderWidth: 1,
    borderColor: '#3a5080',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#c8d8f8',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  caption: {
    fontSize: 12,
    color: '#506070',
    textAlign: 'center',
    lineHeight: 18,
  },
});
