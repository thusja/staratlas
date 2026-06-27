import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExpoRoot } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

const queryClient = new QueryClient();

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        {/* expo-router require.context는 Expo 전용 확장으로 타입 미지원 */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ExpoRoot context={(require as any).context('./app')} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
