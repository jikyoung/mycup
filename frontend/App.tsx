// App.tsx
import ResultScreen from './src/screens/ResultScreen';
import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import MainScreen from './src/screens/MainScreen';
import WorldcupScreen from './src/screens/WorldcupScreen';
import { worldcupAPI } from './src/services/api';

const queryClient = new QueryClient();

type Screen = 'login' | 'main' | 'worldcup' | 'result';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('main');
  const [worldcupData, setWorldcupData] = useState<any>(null);
  const [resultData, setResultData] = useState<any>(null);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    const token = await AsyncStorage.getItem('accessToken');
    setIsLoggedIn(!!token);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('accessToken');
    setIsLoggedIn(false);
    setCurrentScreen('main');
    setWorldcupData(null);
    setResultData(null);
  };

  const handleStartWorldcup = (data: any) => {
    setWorldcupData(data);
    setCurrentScreen('worldcup');
  };

  const handleWorldcupComplete = (result: any) => {
    setResultData(result);
    setCurrentScreen('result');
  };

  const handleBackToMain = () => {
    setCurrentScreen('main');
    setWorldcupData(null);
    setResultData(null);
  };

  const handleViewResult = async (worldcupId: string) => {
  try {
    const result = await worldcupAPI.getResult(worldcupId);
    setResultData(result);
    setCurrentScreen('result');
  } catch (error) {
    Alert.alert('오류', '결과를 불러올 수 없습니다');
  }
};

  if (!isLoggedIn) {
    return (
      <QueryClientProvider client={queryClient}>
        <LoginScreen onLogin={() => setIsLoggedIn(true)} />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {currentScreen === 'main' && (
        <MainScreen
          onLogout={handleLogout}
          onStartWorldcup={handleStartWorldcup}
          onViewResult={handleViewResult}
        />
      )}

      {currentScreen === 'worldcup' && worldcupData && (
        <WorldcupScreen
          worldcupData={worldcupData}
          onComplete={handleWorldcupComplete}
          onBack={handleBackToMain}
        />
      )}

      {currentScreen === 'result' && resultData && (
        <ResultScreen
          resultData={resultData}
          onBack={handleBackToMain}
        />
      )}
    </QueryClientProvider>
  );
}
