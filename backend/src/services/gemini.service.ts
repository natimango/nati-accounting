import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import { BillExtractionResult, BillCategory } from '../types';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!config.gemini.apiKey) {
      console.warn('⚠️  Gemini API key not configured. Bill extraction will not work.');
      return;
    }

    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  async extractBillData(imageBuffer: Buffer, mimeType: string): Promise<BillExtractionResult> {
    if (!this.model) {
      throw new Error('Gemini API not configured');
    }

    try {
      const prompt = `
You are an AI assistant that extracts information from Indian business bills/invoices.
Analyze this bill image and extract the following information in JSON format:

{
  "vendor_name": "Name of the vendor/supplier",
  "vendor_gstin": "GST number (15 characters, format: 99AAACC9999A9Z9)",
  "bill_number": "Invoice/Bill number",
  "bill_date": "Bill date in YYYY-MM-DD format",
  "due_date": "Due date in YYYY-MM-DD format (if mentioned)",
  "total_amount": "Total amount as a number",
  "tax_amount": "GST/Tax amount as a number",
  "category": "One of: RAW_MATERIALS, ARTIST_ROYALTY, MARKETING, LOGISTICS, RENT, UTILITIES, SALARY, OTHER",
  "line_items": [
    {
      "description": "Item description",
      "quantity": "Quantity as number (if mentioned)",
      "rate": "Rate per unit as number (if mentioned)",
      "amount": "Line item amount as number"
    }
  ],
  "confidence_score": "Your confidence in this extraction (0-100)"
}

Important:
- Return ONLY valid JSON, no additional text
- If a field is not found, use null
- For category, make your best guess based on the bill content
- confidence_score should reflect how clear and complete the bill is
- Amounts should be numbers without currency symbols or commas
- Dates must be in YYYY-MM-DD format

Extract the data now:
`;

      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType
        }
      };

      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      // Clean up the response - remove markdown code blocks if present
      let cleanedText = text.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.substring(7);
      }
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.substring(3);
      }
      if (cleanedText.endsWith('```')) {
        cleanedText = cleanedText.substring(0, cleanedText.length - 3);
      }
      cleanedText = cleanedText.trim();

      const extractedData = JSON.parse(cleanedText);

      return {
        vendor_name: extractedData.vendor_name || undefined,
        vendor_gstin: extractedData.vendor_gstin || undefined,
        bill_number: extractedData.bill_number || undefined,
        bill_date: extractedData.bill_date || undefined,
        due_date: extractedData.due_date || undefined,
        total_amount: extractedData.total_amount ? parseFloat(extractedData.total_amount) : undefined,
        tax_amount: extractedData.tax_amount ? parseFloat(extractedData.tax_amount) : undefined,
        category: this.validateCategory(extractedData.category),
        line_items: extractedData.line_items || [],
        confidence_score: extractedData.confidence_score || 50,
        raw_response: extractedData
      };
    } catch (error) {
      console.error('Gemini extraction error:', error);
      throw new Error('Failed to extract bill data');
    }
  }

  private validateCategory(category: string): BillCategory | undefined {
    const validCategories = Object.values(BillCategory);
    if (validCategories.includes(category as BillCategory)) {
      return category as BillCategory;
    }
    return BillCategory.OTHER;
  }
}

export const geminiService = new GeminiService();
