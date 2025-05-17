import { Groq } from 'groq-sdk';
import * as FileSystem from 'expo-file-system';
import base64 from 'react-native-base64';
import config from '../config/env';

// Initialize Groq client
const groq = new Groq({
  apiKey: config.GROQ_API_KEY,
});

// Type definitions
export interface ReceiptItem {
  name: string;
  price: number;
  quantity?: number;
}

export interface ReceiptData {
  store: string;
  date: string | null;
  items: ReceiptItem[];
  subtotal: number;
  tax: number | null;
  tip: number | null;
  extraFees: number | null;
  total: number;
}

export interface ReceiptProcessResult {
  success: boolean;
  data?: ReceiptData;
  error?: string;
}

/**
 * Processes an image from a URI using Groq Vision API for OCR
 * @param imageUri - The URI of the image to process
 * @returns Promise with extracted receipt data including items, prices, and totals
 */
export const processReceiptImage = async (imageUri: string): Promise<ReceiptProcessResult> => {
  try {
    // Read the image file as base64
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Prepare the prompt for receipt OCR
    const prompt = `
      You are a receipt OCR assistant. Extract the following information from the receipt image in JSON format:
      1. Store or restaurant name
      2. Date of purchase (if available)
      3. All items with their names and prices
      4. Subtotal
      5. Tax amount (if available)
      6. Tip amount (if available)
      7. Extra fees amount (if available, for service charges, included gratuity, delivery fees, etc.)
      8. Total amount
      
      Return ONLY a valid JSON object with these fields:
      {
        "store": "string",
        "date": "string or null",
        "items": [
          {
            "name": "string",
            "price": number,
            "quantity": number (default to 1 if not specified)
          }
        ],
        "subtotal": number,
        "tax": number or null,
        "tip": number or null,
        "extraFees": number or null,
        "total": number
      }

      IMPORTANT: 
      - If tax or tip amounts are not clearly visible or specified on the receipt, return null for those fields. DO NOT calculate them.
      - For "extraFees", include any service charges, delivery fees, included gratuity, or other miscellaneous fees that are not tax or tip.
      - Make sure all prices are non-negative numbers.
    `;

    // Call Groq API with vision capabilities
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_completion_tokens: 1024,
    });

    // Parse the JSON response
    const responseContent = chatCompletion.choices[0].message.content || '{}'; // Provide default in case it's null
    const parsedData = JSON.parse(responseContent) as ReceiptData;
    
    return {
      success: true,
      data: parsedData
    };
  } catch (error: any) {
    console.error("Error processing receipt with Groq:", error);
    return {
      success: false,
      error: error.message || "Failed to process receipt"
    };
  }
}; 