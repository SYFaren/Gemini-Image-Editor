
export interface ChatMessage {
  id: string;
  role: 'user';
  content: string;
}

export interface ImageData {
  base64: string;
  mimeType: string;
}
