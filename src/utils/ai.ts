import { GoogleGenAI } from '@google/genai';

export interface ParsedCategory {
    name: string;
    name_ar: string;
    products: ParsedProduct[];
}

export interface ParsedProduct {
    name: string;
    name_ar: string;
    price: number;
    sizes?: {
        mini?: number;
        medium?: number;
        large?: number;
        roll?: number;
    },
    image_query?: string;
}

export const parseMenuFile = async (apiKey: string, file: File): Promise<ParsedCategory[]> => {
    const ai = new GoogleGenAI({ apiKey });

    const getBase64 = (f: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = () => {
                let result = reader.result as string;
                // Remove the data:mime/type;base64, prefix
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    };

    const base64Data = await getBase64(file);

    const prompt = `You are a menu parsing assistant. I am providing you with an image/document of a restaurant menu. 
Please extract all categories and their corresponding products and prices.
CRITICAL INSTRUCTION: If you see the same product name with different sizes (like small, medium, large, roll, mini, etc.), do NOT create separate product entries. Instead, group them into a single product and use the "sizes" object to capture the prices for each size variant. The allowed sizes are "mini", "medium", "large", and "roll".

Output the data STRICTLY as a JSON array where each object has the following structure:
{
  "name": "English category name",
  "name_ar": "Arabic category name (translate if not present)",
  "products": [
    {
      "name": "English product name",
      "name_ar": "Arabic product name (translate if not present)",
      "price": number (the price if there are no sizes. If there are sizes, you can leave this as 0),
      "image_query": "A 1-2 word english keyword representing the SPECIFIC food item and its main ingredient (e.g., 'crepe', 'pizza', 'waffle', 'burger', 'salad'). We will search Wikimedia for a food image.",
      "sizes": { // Optional: only include if the product has different size variants
         "mini": number (optional price for small/mini),
         "medium": number (optional price for medium/regular),
         "large": number (optional price for large),
         "roll": number (optional price for roll/wrap)
      }
    }
  ]
}
If a category or product only has an Arabic name, please translate it to English for the 'name' field, and vice versa. 
Do not output any markdown formatting around the JSON, just the raw JSON array.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: file.type
                    }
                },
                prompt
            ]
        });

        let text = response.text || "[]";

        // Clean up potential markdown formatting if the model still adds it
        if (text.startsWith('\`\`\`json')) {
            text = text.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '');
        } else if (text.startsWith('\`\`\`')) {
            text = text.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '');
        }

        const parsedData: ParsedCategory[] = JSON.parse(text.trim());
        return parsedData;

    } catch (error) {
        console.error("Error parsing menu file:", error);
        throw error;
    }
};
