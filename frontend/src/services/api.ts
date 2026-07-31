// src/services/api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config';

const api = axios.create({
  baseURL: config.API_URL,
  timeout: 60000,
});

// 토큰 자동 첨부
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API 함수들
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/api/v1/auth/login', { email, password });
    return response.data;
  },

  signup: async (email: string, password: string, username: string) => {
    const response = await api.post('/api/v1/auth/signup', { email, password, username });
    return response.data;
  },
};

export const photoAPI = {
  upload: async (photos: any[]) => {
    const formData = new FormData();
    photos.forEach((photo, index) => {
      formData.append('files', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: `photo_${index}.jpg`,
      } as any);
    });

    const response = await api.post('/api/v1/photos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default api;

export const worldcupAPI = {
  create: async (photoIds: string[], roundType: number) => {
    const response = await api.post('/api/v1/worldcup', {
      photo_ids: photoIds,
      round_type: roundType,
    });
    return response.data;
  },

  selectMatch: async (worldcupId: string, matchId: string, selectedPhotoId: string) => {
    const response = await api.post(
      `/api/v1/worldcup/${worldcupId}/matches/${matchId}/select`,
      { selected_photo_id: selectedPhotoId }
    );
    return response.data;
  },

  getResult: async (worldcupId: string) => {
    const response = await api.get(`/api/v1/worldcup/${worldcupId}/result`);
    return response.data;
  },

  getMyWorldcups: async (page: number = 1, limit: number = 20) => {
    const response = await api.get('/api/v1/worldcup/my', {
      params: { skip: (page - 1) * limit, limit }
    });
    return response.data;
  },

    getWorldcup: async (worldcupId: string) => {
    const response = await api.get(`/api/v1/worldcup/${worldcupId}`);
    return response.data;
  },

  deleteWorldcup: async (worldcupId: string) => {
    const response = await api.delete(`/api/v1/worldcup/${worldcupId}`);
    return response.data;
  },
  getInsights: async (worldcupId: string) => {
    const response = await api.get(`/api/v1/worldcup/${worldcupId}/insights`);
    return response.data;
  },

  generateCardNews: async (worldcupId: string) => {
    const response = await api.post(`/api/v1/worldcup/${worldcupId}/cardnews`);
    return response.data;
  },

  createShare: async (worldcupId: string, isPublic: boolean = true) => {
    const response = await api.post(`/api/v1/share/worldcup/${worldcupId}`, {
      is_public: isPublic
    });
    return response.data;
  },
};
