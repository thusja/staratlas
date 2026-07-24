import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useObserverStore } from '../store/observerStore';
import { useDraftConstellationStore } from '../store/draftConstellationStore';
import { useAuthStore } from '../store/authStore';
import { useCreateConstellation } from '../hooks/useConstellations';

export default function SaveConstellationScreen() {
  const [name, setName]   = useState('');
  const [memo, setMemo]   = useState('');

  const lat       = useObserverStore((s) => s.lat);
  const lng       = useObserverStore((s) => s.lng);
  const timestamp = useObserverStore((s) => s.timestamp);

  const stars    = useDraftConstellationStore((s) => s.stars);
  const clearDraft = useDraftConstellationStore((s) => s.clear);

  const token = useAuthStore((s) => s.token);
  const create = useCreateConstellation();

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('입력 오류', '별자리 이름을 입력하세요.');
      return;
    }
    if (stars.length < 2) {
      Alert.alert('오류', '별자리는 최소 2개의 별이 필요합니다.');
      return;
    }
    if (lat == null || lng == null || timestamp == null) {
      Alert.alert('오류', '위치 정보가 없습니다. 로딩 화면으로 돌아가 다시 시도하세요.');
      return;
    }

    create.mutate(
      {
        name:       name.trim(),
        memo:       memo.trim() || undefined,
        lat,
        lng,
        observedAt: new Date(timestamp).toISOString(),
        stars:      stars.map((s, i) => ({ hipId: s.hipId, order: i })),
      },
      {
        onSuccess: () => {
          clearDraft();
          router.replace('/constellations');
        },
        onError: (e) => Alert.alert('저장 실패', e.message),
      },
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backText}>← 돌아가기</Text>
            </TouchableOpacity>
            <Text style={styles.title}>별자리 저장</Text>
          </View>

          {/* 선택된 별 목록 미리보기 */}
          <View style={styles.starPreview}>
            <Text style={styles.sectionLabel}>선택된 별 ({stars.length}개)</Text>
            <View style={styles.starList}>
              {stars.map((s, i) => (
                <View key={s.hipId} style={styles.starItem}>
                  <Text style={styles.starOrder}>{i + 1}</Text>
                  <Text style={styles.starName}>{s.name ?? `HIP ${s.hipId}`}</Text>
                  <Text style={styles.starMag}>등급 {s.magnitude.toFixed(1)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 입력 폼 */}
          <View style={styles.form}>
            <Text style={styles.label}>별자리 이름 *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="나만의 별자리 이름"
              placeholderTextColor="#3a5070"
              maxLength={50}
              editable={!create.isPending}
            />

            <Text style={styles.label}>메모 (선택)</Text>
            <TextInput
              style={[styles.input, styles.memoInput]}
              value={memo}
              onChangeText={setMemo}
              placeholder="이 별자리에 담긴 이야기..."
              placeholderTextColor="#3a5070"
              multiline
              maxLength={200}
              editable={!create.isPending}
            />

            {/* 로그인 필요 안내 */}
            {!token && (
              <TouchableOpacity style={styles.loginBanner} onPress={() => router.push('/auth')}>
                <Text style={styles.loginBannerText}>
                  ⚠ 저장하려면 로그인이 필요합니다. 탭하여 로그인
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.saveButton, (!token || create.isPending) && styles.saveButtonDisabled]}
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={!token || create.isPending}
            >
              <Text style={styles.saveText}>
                {create.isPending ? '저장 중...' : '별자리 저장하기'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05080f',
  },
  inner: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    flexGrow: 1,
  },
  header: {
    marginBottom: 24,
    gap: 12,
  },
  backText: {
    color: '#4a6080',
    fontSize: 14,
  },
  title: {
    color: '#c8d8f8',
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 2,
  },
  starPreview: {
    backgroundColor: '#0d1a28',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1a3050',
  },
  sectionLabel: {
    color: '#6a8090',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  starList: {
    gap: 8,
  },
  starItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  starOrder: {
    color: '#4a80ff',
    fontSize: 13,
    width: 20,
    textAlign: 'center',
  },
  starName: {
    color: '#c8d8f8',
    fontSize: 14,
    flex: 1,
  },
  starMag: {
    color: '#4a6080',
    fontSize: 12,
  },
  form: {
    gap: 8,
  },
  label: {
    color: '#6a8090',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0d1a28',
    borderWidth: 1,
    borderColor: '#1a3050',
    borderRadius: 10,
    color: '#c8d8f8',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  memoInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  loginBanner: {
    backgroundColor: '#1a1a0a',
    borderWidth: 1,
    borderColor: '#5a4010',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  loginBannerText: {
    color: '#c0a050',
    fontSize: 13,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#1a3a80',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveText: {
    color: '#c8d8f8',
    fontSize: 16,
  },
});
