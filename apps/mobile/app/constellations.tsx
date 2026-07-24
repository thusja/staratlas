import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useConstellations, useDeleteConstellation } from '../hooks/useConstellations';
import type { Constellation } from '@staratlas/shared';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function ConstellationsScreen() {
  const token = useAuthStore((s) => s.token);
  const user  = useAuthStore((s) => s.user);

  const { data: constellations, isLoading, error } = useConstellations();
  const deleteConstellation = useDeleteConstellation();

  const handleDelete = (item: Constellation) => {
    Alert.alert(
      '별자리 삭제',
      `"${item.name}"을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () =>
            deleteConstellation.mutate(item.id, {
              onError: (e) => Alert.alert('삭제 실패', e.message),
            }),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← 하늘로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>내 별자리</Text>
        {token ? (
          <Text style={styles.userEmail}>{user?.email}</Text>
        ) : (
          <TouchableOpacity onPress={() => router.push('/auth')}>
            <Text style={styles.loginLink}>로그인</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 비로그인 상태 */}
      {!token && (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyIcon}>✦</Text>
          <Text style={styles.emptyText}>로그인하면 별자리를 저장하고{'\n'}다시 볼 수 있어요</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/auth')}>
            <Text style={styles.loginButtonText}>로그인 / 회원가입</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 로그인 + 로딩 */}
      {token && isLoading && (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyText}>불러오는 중...</Text>
        </View>
      )}

      {/* 에러 */}
      {token && error && (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyText}>불러오기 실패</Text>
        </View>
      )}

      {/* 목록 */}
      {token && !isLoading && !error && (
        <FlatList
          data={constellations ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              <Text style={styles.emptyIcon}>·✦·</Text>
              <Text style={styles.emptyText}>
                아직 저장된 별자리가 없어요{'\n'}
                하늘 뷰에서 별을 이어 만들어 보세요
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/constellation/${item.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{item.name}</Text>
                {item.memo && <Text style={styles.cardMemo} numberOfLines={1}>{item.memo}</Text>}
                <View style={styles.cardMeta}>
                  <Text style={styles.cardDate}>{formatDate(item.observedAt)}</Text>
                  <Text style={styles.cardStarCount}>✦ {item.stars.length}개</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item)}
                hitSlop={8}
              >
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05080f',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f1c2e',
    gap: 6,
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
  userEmail: {
    color: '#3a5070',
    fontSize: 12,
  },
  loginLink: {
    color: '#8ab4ff',
    fontSize: 13,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#0d1a28',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1a3050',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    color: '#c8d8f8',
    fontSize: 16,
  },
  cardMemo: {
    color: '#6a8090',
    fontSize: 13,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cardDate: {
    color: '#3a5070',
    fontSize: 12,
  },
  cardStarCount: {
    color: '#4a6080',
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
  },
  deleteText: {
    color: '#3a4a60',
    fontSize: 14,
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  emptyIcon: {
    color: '#2a3a50',
    fontSize: 32,
    letterSpacing: 8,
  },
  emptyText: {
    color: '#4a6080',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  loginButton: {
    backgroundColor: '#1a3a80',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  loginButtonText: {
    color: '#c8d8f8',
    fontSize: 14,
  },
});
