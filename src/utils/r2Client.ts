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

export async function uploadInvoiceToR2(pdfBlob: Blob, filename: string): Promise<string> {
  const response = await fetch('https://r2-invoice-worker.jack-chouchani.workers.dev', {
    method: 'POST',
    headers: {
      'x-filename': filename,
      'x-api-key': API_KEY,
      'Content-Type': 'application/pdf'
    },
    body: pdfBlob
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[uploadInvoiceToR2] Erreur réponse R2: ${response.status} ${response.statusText} - ${errorText}`);
    throw new Error(`Erreur upload facture R2: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.url || `https://invoices.comptoirvintage.com/${data.filename}`;
}
