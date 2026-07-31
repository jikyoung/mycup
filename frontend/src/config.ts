export const config = {
  API_URL: process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000',
};

export const resolveMediaUrl = (url: string): string => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${config.API_URL}${normalizedPath}`;
};
