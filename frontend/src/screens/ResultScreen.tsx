// src/screens/ResultScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { worldcupAPI } from '../services/api';

import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { resolveMediaUrl } from '../config';

interface ResultScreenProps {
  resultData: any;
  onBack: () => void;
}

export default function ResultScreen({ resultData, onBack }: ResultScreenProps) {
  const [insights, setInsights] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [cardNews, setCardNews] = useState<string[]>([]);
  const [loadingCardNews, setLoadingCardNews] = useState(false);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    setLoadingInsights(true);
    try {
      const data = await worldcupAPI.getInsights(resultData.worldcup_id);
      setInsights(data);
    } catch {
      setInsights(null);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleGenerateCardNews = async () => {
    setLoadingCardNews(true);
    try {
      const data = await worldcupAPI.generateCardNews(resultData.worldcup_id);

      const fullUrls = data.card_images.map(resolveMediaUrl);

      setCardNews(fullUrls);
      Alert.alert('완료', '카드뉴스가 생성되었습니다!');
    } catch {
      Alert.alert('오류', '카드뉴스 생성에 실패했습니다');
    } finally {
      setLoadingCardNews(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareData = await worldcupAPI.createShare(resultData.worldcup_id, true);
      const url = shareData.share_url;

      await Share.share({
        message: `내 월드컵 결과를 확인해보세요!\n${url}`,
        url: url,
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        Alert.alert('오류', '공유 링크 생성에 실패했습니다');
      }
    }
  };

    const handleDownloadCardNews = async (imageUrl: string) => {
    try {
        // 권한 요청
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
        Alert.alert('권한 필요', '사진을 저장하려면 갤러리 접근 권한이 필요합니다');
        return;
        }

        Alert.alert('다운로드 중...', '잠시만 기다려주세요');

        // Expo SDK 54+ 방식: File과 Paths 사용
        const { File, Paths } = FileSystem;
        const downloaded = await File.downloadFileAsync(imageUrl, Paths.cache);

        // 갤러리에 저장
        await MediaLibrary.saveToLibraryAsync(downloaded.uri);

        Alert.alert('완료', '사진이 갤러리에 저장되었습니다');
    } catch {
        Alert.alert('오류', '다운로드에 실패했습니다');
    }
    };

  return (
    <ScrollView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← 돌아가기</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare}>
          <Text style={styles.shareButton}>공유하기 📤</Text>
        </TouchableOpacity>
      </View>

      {/* 타이틀 */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>🏆 월드컵 결과</Text>
        <Text style={styles.subtitle}>{resultData.round_type}강 완료</Text>
      </View>

      {/* 순위 */}
      <View style={styles.rankingsContainer}>
        {resultData.rankings.map((item: any, index: number) => (
          <View
            key={item.photo.id}
            style={[
              styles.rankCard,
              index === 0 && styles.firstPlace,
            ]}
          >
            <View style={styles.rankBadge}>
              <Text style={styles.rankNumber}>{item.rank}위</Text>
            </View>
            <Image
              source={{ uri: resolveMediaUrl(item.photo.url) }}
              style={styles.rankImage}
            />
            {index === 0 && (
              <View style={styles.crownBadge}>
                <Text style={styles.crownText}>👑</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* AI 인사이트 */}
      <View style={styles.insightsContainer}>
        <Text style={styles.sectionTitle}>✨ AI 분석 결과</Text>

        {loadingInsights ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>분석중...</Text>
          </View>
        ) : insights ? (
          <>
            {/* 키워드 */}
            <View style={styles.insightBox}>
              <Text style={styles.insightLabel}>주요 키워드</Text>
              <View style={styles.keywordsContainer}>
                {insights.overall_keywords.map((keyword: string, idx: number) => (
                  <View key={idx} style={styles.keywordBadge}>
                    <Text style={styles.keywordText}>#{keyword}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 감정 */}
            <View style={styles.insightBox}>
              <Text style={styles.insightLabel}>주요 감정</Text>
              <Text style={styles.insightValue}>{insights.primary_emotion}</Text>
            </View>

            {/* 우승 사진 분석 */}
            <View style={styles.insightBox}>
              <Text style={styles.insightLabel}>🏆 우승 사진 분석</Text>
              <Text style={styles.insightDescription}>
                {insights.winner_analysis.description}
              </Text>
            </View>

            {/* 스토리 */}
            <View style={styles.storyBox}>
              <Text style={styles.storyTitle}>📖 당신의 이야기</Text>
              <Text style={styles.storyText}>
                {insights.insight_story.summary}
              </Text>
              {insights.insight_story.detail && (
                <Text style={styles.storyDetail}>
                  {insights.insight_story.detail}
                </Text>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.errorText}>인사이트를 불러올 수 없습니다</Text>
        )}
      </View>

      {/* 카드뉴스 섹션 */}
      <View style={styles.cardNewsSection}>
        <Text style={styles.sectionTitle}>🎨 카드뉴스</Text>

        {cardNews.length === 0 ? (
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerateCardNews}
            disabled={loadingCardNews}
          >
            {loadingCardNews ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.generateButtonText}>  생성중...</Text>
              </>
            ) : (
              <Text style={styles.generateButtonText}>카드뉴스 생성하기</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.cardNewsContainer}>
            {cardNews.map((imageUrl, index) => (
              <View key={index} style={styles.cardNewsItem}>
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.cardNewsImage}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => handleDownloadCardNews(imageUrl)}
                >
                  <Text style={styles.downloadButtonText}>
                    다운로드 📥
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 하단 여백 */}
      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  backButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  shareButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  titleContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  rankingsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  rankCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  firstPlace: {
    borderColor: '#FFD700',
    borderWidth: 3,
  },
  rankBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  rankNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  rankImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  crownBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
  },
  crownText: {
    fontSize: 40,
  },
  insightsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  loadingBox: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  insightBox: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  insightLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  insightValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  insightDescription: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  keywordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keywordBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  keywordText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  storyBox: {
    backgroundColor: '#FFF9E6',
    borderRadius: 15,
    padding: 20,
    marginTop: 10,
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  storyText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  storyDetail: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
    marginTop: 10,
  },
  errorText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  cardNewsSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  generateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardNewsContainer: {
    gap: 20,
  },
  cardNewsItem: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardNewsImage: {
    width: '100%',
    height: 400,
    borderRadius: 10,
    marginBottom: 10,
  },
  downloadButton: {
    backgroundColor: '#34C759',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
