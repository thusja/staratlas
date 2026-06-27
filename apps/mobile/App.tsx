import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExpoRoot } from 'expo-router';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ExpoRoot context={require.context('./app')} />
    </QueryClientProvider>
  );
}
