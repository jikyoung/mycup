// src/screens/WorldcupScreen.tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { worldcupAPI } from '../services/api';
import { resolveMediaUrl } from '../config';

const { width, height } = Dimensions.get('window');

interface WorldcupScreenProps {
  worldcupData: any;
  onComplete: (result: any) => void;
  onBack: () => void;
}

export default function WorldcupScreen({
  worldcupData,
  onComplete,
  onBack
}: WorldcupScreenProps) {
  const initialMatch = worldcupData.matches?.[0] || worldcupData.current_match;
  const [currentMatch, setCurrentMatch] = useState(initialMatch);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(
    worldcupData.matches?.length || 1
  );
  const [isLoading, setIsLoading] = useState(false);

  if (!initialMatch) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>월드컵 데이터 로드 실패</Text>
        <TouchableOpacity onPress={onBack} style={{ marginTop: 20 }}>
          <Text style={styles.backButton}>← 돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

const handlePhotoSelect = async (selectedPhotoId: string) => {
  setIsLoading(true);

  try {
    const response = await worldcupAPI.selectMatch(
      worldcupData.id,
      currentMatch.id,
      selectedPhotoId
    );

    if (response.is_completed) {
      const result = await worldcupAPI.getResult(worldcupData.id);
      onComplete(result);
    } else if (response.next_match) {
      setCurrentMatch(response.next_match);
      setCurrentRound(currentRound + 1);
    } else {
      Alert.alert('오류', '응답 형식이 올바르지 않습니다');
    }
  } catch {
    Alert.alert('오류', '선택 처리 중 오류가 발생했습니다');
  } finally {
    setIsLoading(false);
  }
};

if (isLoading) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>AI가 사진을 분석하고 있어요...</Text>
      <Text style={[styles.loadingText, { fontSize: 14, opacity: 0.7, marginTop: 10 }]}>
        최대 1분 정도 걸릴 수 있습니다
      </Text>
    </View>
  );
}

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.roundText}>
          {worldcupData.round_type}강 ({currentRound}/{totalRounds})
        </Text>
        <View style={{ width: 50 }} />
      </View>

      {/* VS 텍스트 */}
      <View style={styles.vsContainer}>
        <Text style={styles.vsText}>VS</Text>
        <Text style={styles.questionText}>어떤 사진이 더 좋나요?</Text>
      </View>

      {/* 사진 선택 영역 */}
      <View style={styles.photoContainer}>
        {/* 왼쪽 사진 */}
        <TouchableOpacity
          style={styles.photoButton}
          onPress={() => handlePhotoSelect(currentMatch.photo_a.id)}
        >
          <Image
            source={{ uri: resolveMediaUrl(currentMatch.photo_a.url) }}
            style={styles.photo}
            resizeMode="contain"
          />
          <View style={styles.photoOverlay}>
            <Text style={styles.photoNumber}>1</Text>
          </View>
        </TouchableOpacity>

        {/* 오른쪽 사진 */}
        <TouchableOpacity
          style={styles.photoButton}
          onPress={() => handlePhotoSelect(currentMatch.photo_b.id)}
        >
          <Image
            source={{ uri: resolveMediaUrl(currentMatch.photo_b.url) }}
            style={styles.photo}
            resizeMode="cover"
          />
          <View style={styles.photoOverlay}>
            <Text style={styles.photoNumber}>2</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 프로그레스 바 */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(currentRound / totalRounds) * 100}%` }
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    color: '#fff',
    fontSize: 16,
  },
  roundText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  vsContainer: {
    position: 'absolute',
    top: height / 2 - 40,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  vsText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#FF3B30',
    width: 80,
    height: 80,
    borderRadius: 40,
    textAlign: 'center',
    lineHeight: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  questionText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  photoContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  photoButton: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
});
