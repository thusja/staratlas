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
import { useLoginMutation, useRegisterMutation } from '../hooks/useAuth';

export default function AuthScreen() {
  const [mode, setMode]           = useState<'login' | 'register'>('login');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');

  const login    = useLoginMutation();
  const register = useRegisterMutation();

  const isLoading = login.isPending || register.isPending;

  const handleSubmit = async () => {
    const trimmedEmail    = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 모두 입력하세요.');
      return;
    }
    if (mode === 'register') {
      if (trimmedPassword.length < 8) {
        Alert.alert('입력 오류', '비밀번호는 8자 이상이어야 합니다.');
        return;
      }
      if (trimmedPassword !== confirm) {
        Alert.alert('입력 오류', '비밀번호가 일치하지 않습니다.');
        return;
      }
    }

    const mutation = mode === 'login' ? login : register;
    mutation.mutate(
      { email: trimmedEmail, password: trimmedPassword },
      {
        onSuccess: () => router.back(),
        onError:   (e) => Alert.alert('오류', e.message),
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
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← 돌아가기</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Star Atlas</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? '로그인' : '회원가입'}
          </Text>

          {/* 탭 전환 */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
                로그인
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'register' && styles.tabActive]}
              onPress={() => setMode('register')}
            >
              <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
                회원가입
              </Text>
            </TouchableOpacity>
          </View>

          {/* 입력 폼 */}
          <View style={styles.form}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="your@email.com"
              placeholderTextColor="#3a5070"
              editable={!isLoading}
            />

            <Text style={styles.label}>비밀번호</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder={mode === 'register' ? '8자 이상' : '••••••••'}
              placeholderTextColor="#3a5070"
              editable={!isLoading}
            />

            {mode === 'register' && (
              <>
                <Text style={styles.label}>비밀번호 확인</Text>
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  placeholder="비밀번호를 다시 입력"
                  placeholderTextColor="#3a5070"
                  editable={!isLoading}
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              <Text style={styles.submitText}>
                {isLoading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
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
    padding: 24,
    flexGrow: 1,
  },
  backButton: {
    marginBottom: 32,
  },
  backText: {
    color: '#4a6080',
    fontSize: 14,
  },
  title: {
    color: '#c8d8f8',
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#4a6080',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1a2a40',
    marginBottom: 28,
  },
  tab: {
    flex: 1,
    paddingBottom: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#4a80ff',
  },
  tabText: {
    color: '#3a5070',
    fontSize: 15,
  },
  tabTextActive: {
    color: '#8ab4ff',
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
  submitButton: {
    backgroundColor: '#1a3a80',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#c8d8f8',
    fontSize: 16,
  },
});
