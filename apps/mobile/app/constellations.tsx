import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Alert,
  TextInput,
  Image,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'latest' | 'name'>('latest');

  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const { data: constellations, isLoading, error } = useConstellations();
  const deleteConstellation = useDeleteConstellation();

  const visibleConstellations = useMemo(() => {
    const base = [...(constellations ?? [])];
    const q = searchQuery.trim().toLowerCase();

    const filtered = q
      ? base.filter((item) => {
          const name = item.name.toLowerCase();
          const memo = (item.memo ?? '').toLowerCase();
          return name.includes(q) || memo.includes(q);
        })
      : base;

    filtered.sort((a, b) => {
      if (sortMode === 'name') {
        return a.name.localeCompare(b.name, 'ko');
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [constellations, searchQuery, sortMode]);

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← 하늘로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>내 별자리</Text>
        {token ? (
          <View style={styles.authRow}>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <TouchableOpacity
              onPress={() => {
                clearAuth().catch(() => {
                  Alert.alert('오류', '로그아웃에 실패했습니다.');
                });
              }}
            >
              <Text style={styles.logoutLink}>로그아웃</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => router.push('/auth?redirect=%2Fconstellations')}>
            <Text style={styles.loginLink}>로그인</Text>
          </TouchableOpacity>
        )}
      </View>

      {!token && (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyIcon}>✦</Text>
          <Text style={styles.emptyText}>로그인하면 별자리를 저장하고{`\n`}다시 볼 수 있어요</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth?redirect=%2Fconstellations')}
          >
            <Text style={styles.loginButtonText}>로그인 / 회원가입</Text>
          </TouchableOpacity>
        </View>
      )}

      {token && isLoading && (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyText}>불러오는 중...</Text>
        </View>
      )}

      {token && error && (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyText}>{error.message || '불러오기 실패'}</Text>
        </View>
      )}

      {token && !isLoading && !error && (
        <>
          <View style={styles.filterBar}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="이름/메모 검색"
              placeholderTextColor="#3a5070"
            />
            <View style={styles.sortTabs}>
              <TouchableOpacity
                style={[styles.sortTab, sortMode === 'latest' && styles.sortTabActive]}
                onPress={() => setSortMode('latest')}
              >
                <Text style={[styles.sortTabText, sortMode === 'latest' && styles.sortTabTextActive]}>
                  최신순
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortTab, sortMode === 'name' && styles.sortTabActive]}
                onPress={() => setSortMode('name')}
              >
                <Text style={[styles.sortTabText, sortMode === 'name' && styles.sortTabTextActive]}>
                  이름순
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={visibleConstellations}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyWrapper}>
                <Text style={styles.emptyIcon}>·✦·</Text>
                <Text style={styles.emptyText}>
                  {searchQuery.trim()
                    ? '검색 결과가 없어요'
                    : `아직 저장된 별자리가 없어요\n하늘 뷰에서 별을 이어 만들어 보세요`}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/constellation/${item.id}`)}
                activeOpacity={0.8}
              >
                {item.thumbnail ? (
                  <Image source={{ uri: item.thumbnail }} style={styles.cardThumb} />
                ) : (
                  <View style={styles.cardThumbPlaceholder}>
                    <Text style={styles.cardThumbPlaceholderText}>NO PREVIEW</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  {item.memo && <Text style={styles.cardMemo} numberOfLines={1}>{item.memo}</Text>}
                  <View style={styles.cardMeta}>
                    <Text style={styles.cardDate}>{formatDate(item.observedAt)}</Text>
                    <Text style={styles.cardStarCount}>✦ {item.stars.length}개</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)} hitSlop={8}>
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        </>
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
  authRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userEmail: {
    color: '#3a5070',
    fontSize: 12,
  },
  logoutLink: {
    color: '#8ab4ff',
    fontSize: 12,
  },
  loginLink: {
    color: '#8ab4ff',
    fontSize: 13,
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  searchInput: {
    backgroundColor: '#0d1a28',
    borderWidth: 1,
    borderColor: '#1a3050',
    borderRadius: 10,
    color: '#c8d8f8',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sortTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  sortTab: {
    borderWidth: 1,
    borderColor: '#1a3050',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#0b1422',
  },
  sortTabActive: {
    borderColor: '#2f66d8',
    backgroundColor: '#142b57',
  },
  sortTabText: {
    color: '#6a8090',
    fontSize: 12,
  },
  sortTabTextActive: {
    color: '#9cc0ff',
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
    gap: 12,
  },
  cardThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1a3050',
    backgroundColor: '#07101a',
  },
  cardThumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1a3050',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#081322',
  },
  cardThumbPlaceholderText: {
    color: '#395170',
    fontSize: 9,
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
