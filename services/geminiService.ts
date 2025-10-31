import { GoogleGenAI, Modality, GenerateContentResponse, Part } from "@google/genai";
import { ImageData } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const editImageWithGemini = async (prompt: string, image: ImageData, mask: ImageData | null): Promise<string> => {
  try {
    const parts: Part[] = [
      {
        inlineData: {
          data: image.base64,
          mimeType: image.mimeType,
        },
      },
    ];

    let finalPrompt = prompt;

    if (mask) {
      parts.push({
        inlineData: {
          data: mask.base64,
          mimeType: mask.mimeType,
        },
      });
      finalPrompt = `This is an image editing task. You are provided with an image and a mask. The user's prompt should be applied to the area highlighted by the mask. Output only the modified image. User prompt: "${prompt}"`;
    }
    
    parts.push({ text: finalPrompt });

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }

    throw new Error("No image data found in the API response.");
  } catch (error) {
    console.error("Error editing image with Gemini:", error);
    throw new Error("Failed to process the image edit. Please try again.");
  }
};