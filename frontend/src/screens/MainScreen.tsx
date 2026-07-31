// src/screens/MainScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  FlatList,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { photoAPI, worldcupAPI } from '../services/api';
import { resolveMediaUrl } from '../config';

interface MainScreenProps {
  onLogout: () => void;
  onStartWorldcup: (worldcupData: any) => void;
  onViewResult: (worldcupId: string) => void;  // 추가
}

type Tab = 'create' | 'list';

export default function MainScreen({ onLogout, onStartWorldcup, onViewResult }: MainScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [selectedPhotos, setSelectedPhotos] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // 내 월드컵 목록
  const [myWorldcups, setMyWorldcups] = useState<any[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (activeTab === 'list') {
      loadMyWorldcups();
    }
  }, [activeTab]);

  const loadMyWorldcups = async () => {
    setIsLoadingList(true);
    try {
      const data = await worldcupAPI.getMyWorldcups(1, 20);
      setMyWorldcups(data.worldcups);
    } catch {
      Alert.alert('오류', '월드컵 목록을 불러올 수 없습니다');
    } finally {
      setIsLoadingList(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMyWorldcups();
    setRefreshing(false);
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 16,
    });

    if (!result.canceled && result.assets) {
      setSelectedPhotos(result.assets);
    }
  };

  const createWorldcup = async (roundType: number) => {
    const requiredPhotos = roundType;

    if (selectedPhotos.length !== requiredPhotos) {
      Alert.alert('오류', `${requiredPhotos}장의 사진을 선택해주세요.`);
      return;
    }

    setIsUploading(true);
    try {
      const uploadResponse = await photoAPI.upload(selectedPhotos);

      const photoIds = uploadResponse.photos.map((p: any) => p.id);
      const worldcupData = await worldcupAPI.create(photoIds, roundType);

      if (!worldcupData || (!worldcupData.matches && !worldcupData.current_match)) {
        throw new Error('월드컵 데이터가 올바르지 않습니다');
      }

      if (!worldcupData.matches && worldcupData.current_match) {
        worldcupData.matches = [worldcupData.current_match];
      }

      onStartWorldcup(worldcupData);

    } catch (error: any) {
      Alert.alert('실패', error.response?.data?.detail || error.message || '월드컵 생성 실패');
    } finally {
      setIsUploading(false);
    }
  };

const handleWorldcupPress = async (worldcup: any) => {
  if (worldcup.status === 'completed') {
    onViewResult(worldcup.id);
  } else {
    try {
      const worldcupData = await worldcupAPI.getWorldcup(worldcup.id);

      if (!worldcupData.matches && worldcupData.current_match) {
        worldcupData.matches = [worldcupData.current_match];
      }

      onStartWorldcup(worldcupData);
    } catch {
      Alert.alert('오류', '월드컵을 불러올 수 없습니다');
    }
  }
};

    const handleDeleteWorldcup = async (worldcupId: string) => {
    Alert.alert(
        '삭제 확인',
        '정말 삭제하시겠습니까?',
        [
        { text: '취소', style: 'cancel' },
        {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
            try {
                await worldcupAPI.deleteWorldcup(worldcupId);
                Alert.alert('성공', '삭제되었습니다');
                loadMyWorldcups(); // 목록 새로고침
            } catch (error) {
                Alert.alert('오류', '삭제에 실패했습니다');
            }
            },
        },
        ]
    );
    };

    const renderWorldcupItem = ({ item }: { item: any }) => (
    <TouchableOpacity
        style={styles.worldcupCard}
        onPress={() => handleWorldcupPress(item)}
    >
        <View style={styles.cardContent}>
        {item.winner_photo ? (
            <Image
            source={{ uri: resolveMediaUrl(item.winner_photo.url) }}
            style={styles.winnerImage}
            />
        ) : (
            <View style={[styles.winnerImage, styles.noImage]}>
            <Text style={styles.noImageText}>진행중</Text>
            </View>
        )}

        <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{item.round_type}강 월드컵</Text>
            <Text style={styles.cardStatus}>
            {item.status === 'completed' ? '완료' : '진행중'}
            </Text>
            <Text style={styles.cardDate}>
            {new Date(item.created_at).toLocaleDateString('ko-KR')}
            </Text>
        </View>

        {/* 삭제 버튼 추가 */}
        <TouchableOpacity
            style={styles.deleteButton}
            onPress={(e) => {
            e.stopPropagation(); // 카드 클릭 이벤트 막기
            handleDeleteWorldcup(item.id);
            }}
        >
            <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
        </View>
    </TouchableOpacity>
    );

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>MyCup</Text>
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      {/* 탭 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'create' && styles.activeTab]}
          onPress={() => setActiveTab('create')}
        >
          <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>
            새로 만들기
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'list' && styles.activeTab]}
          onPress={() => setActiveTab('list')}
        >
          <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>
            내 월드컵
          </Text>
        </TouchableOpacity>
      </View>

      {/* 컨텐츠 */}
      {activeTab === 'create' ? (
        <ScrollView style={styles.content}>
          {/* 사진 선택 버튼 */}
          <TouchableOpacity style={styles.pickButton} onPress={pickImages}>
            <Text style={styles.pickButtonText}>📷 갤러리에서 사진 선택</Text>
            <Text style={styles.pickButtonSubtext}>최대 16장까지 선택 가능</Text>
          </TouchableOpacity>

          {/* 선택된 사진 미리보기 */}
          {selectedPhotos.length > 0 && (
            <View style={styles.previewContainer}>
              <Text style={styles.sectionTitle}>
                선택된 사진 ({selectedPhotos.length}장)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.photoGrid}>
                  {selectedPhotos.map((photo, index) => (
                    <Image
                      key={index}
                      source={{ uri: photo.uri }}
                      style={styles.thumbnail}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* 월드컵 생성 버튼들 */}
          {selectedPhotos.length > 0 && (
            <View style={styles.worldcupButtons}>
              <Text style={styles.sectionTitle}>월드컵 만들기</Text>

              <TouchableOpacity
                style={[
                  styles.worldcupButton,
                  selectedPhotos.length !== 4 && styles.disabledButton,
                ]}
                onPress={() => createWorldcup(4)}
                disabled={isUploading || selectedPhotos.length !== 4}
              >
                <Text style={styles.worldcupButtonText}>4강 (4장)</Text>
                <Text style={styles.worldcupButtonSubtext}>30초 완성</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.worldcupButton,
                  selectedPhotos.length !== 8 && styles.disabledButton,
                ]}
                onPress={() => createWorldcup(8)}
                disabled={isUploading || selectedPhotos.length !== 8}
              >
                <Text style={styles.worldcupButtonText}>8강 (8장)</Text>
                <Text style={styles.worldcupButtonSubtext}>1분 완성</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.worldcupButton,
                  selectedPhotos.length !== 16 && styles.disabledButton,
                ]}
                onPress={() => createWorldcup(16)}
                disabled={isUploading || selectedPhotos.length !== 16}
              >
                <Text style={styles.worldcupButtonText}>16강 (16장)</Text>
                <Text style={styles.worldcupButtonSubtext}>2분 완성</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.listContainer}>
          {isLoadingList && myWorldcups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>로딩중...</Text>
            </View>
          ) : myWorldcups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>아직 만든 월드컵이 없습니다</Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => setActiveTab('create')}
              >
                <Text style={styles.createButtonText}>월드컵 만들러 가기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={myWorldcups}
              renderItem={renderWorldcupItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          )}
        </View>
      )}
    </View>
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
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  logoutText: {
    color: '#007AFF',
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  pickButton: {
    backgroundColor: '#007AFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  pickButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  pickButtonSubtext: {
    color: '#fff',
    opacity: 0.8,
    fontSize: 14,
  },
  previewContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  photoGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  worldcupButtons: {
    marginTop: 10,
  },
  worldcupButton: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#f0f0f0',
  },
  worldcupButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  worldcupButtonSubtext: {
    color: '#666',
    fontSize: 14,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 20,
  },
  worldcupCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 15,
  },
  winnerImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  noImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: '#999',
    fontSize: 14,
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  cardStatus: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 5,
  },
  cardDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
},
  deleteButtonText: {
    fontSize: 24,
},
});
