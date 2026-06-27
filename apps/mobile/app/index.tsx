import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import * as Location from 'expo-location';
import { router } from 'expo-router';

export default function Index() {
  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      // 이미 허용됨 → 권한 화면 건너뛰고 로딩으로
      router.replace('/loading');
    } else {
      router.replace('/permission');
    }
  };

  return null;
}
