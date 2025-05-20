import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';


const WORKER_URL = 'https://r2-upload-worker.jack-chouchani.workers.dev/';
// Accès à la clé API via process.env, en supposant que la variable est nommée R2_SECRET_KEY
const API_KEY = process.env.EXPO_PUBLIC_R2_SECRET_KEY;

export async function uploadToR2Worker(localUri: string, filename: string): Promise<string> {
  let body;

  if (Platform.OS === 'web') {
    // On web, the URI might be a data URL or a blob URL
    if (localUri.startsWith('data:')) {
      // Convert data URL to Blob
      const byteCharacters = atob(localUri.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      // Attempt to infer mime type from data URL prefix if possible
      const mimeMatch = localUri.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      body = new Blob([byteArray], { type: mimeType });
    } else if (localUri.startsWith('blob:')) {
      // Fetch the blob from the blob URL
      const response = await fetch(localUri);
      if (!response.ok) throw new Error(`Failed to fetch blob URL: ${response.status}`);
      body = await response.blob();
    } else {
       throw new Error(`Unsupported web URI format: ${localUri}`);
    }

  } else {
    // On native (iOS/Android), use FileSystem to read the file
    const fileBuffer = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    body = Buffer.from(fileBuffer, 'base64');
  }

  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'x-filename': filename, 'x-api-key': API_KEY },
    body: body,
  });
  if (!res.ok) {
    console.error(`[uploadToR2Worker] Erreur réponse R2: ${res.status} ${res.statusText}`);
    throw new Error('Erreur upload R2');
  }
  const data = await res.json();
  return data.filename;
}

export async function deleteFromR2Worker(filename: string): Promise<void> {
  const url = `${WORKER_URL}?filename=${encodeURIComponent(filename)}`;
  const res = await fetch(url, { method: 'DELETE', headers: { 'x-api-key': API_KEY } });
  if (!res.ok) throw new Error('Erreur suppression R2');
}

export function getImageUrl(filename: string): string {
  if (!filename) return '';
  return `https://images.comptoirvintage.com/${filename}`;
}
