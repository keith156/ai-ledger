
import { GoogleGenAI, Type } from "@google/genai";
import { ParseResult, TransactionType } from "../types";

/**
 * Note: process.env.API_KEY is replaced at build time by Vite's 'define' config.
 * We initialize inside the function to ensure the latest value is used.
 */
const getAI = () => {
  // Directly use process.env.API_KEY as required.
  return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

export const parseInputText = async (text: string): Promise<ParseResult> => {
  try {
    const ai = getAI();
    
    const systemInstruction = `
      You are an intelligent ledger assistant for small business owners.
      Convert natural language business activities into structured data.
      
      INTENTS:
      - RECORD: For business transactions.
      - QUERY: For looking up data ("Show sales", "How much today").
      
      TRANSACTION TYPES & RULES:
      - INCOME: General sales.
      - EXPENSE: Money spent.
      - DEBT: Someone owes you ("Musa owes me 1000"). COUNTERPARTY must be the name.
      - DEBT_PAYMENT: Someone pays back ("Musa paid 500"). COUNTERPARTY must be the name.
      
      When a person's name is mentioned in relation to money owed or paid back, extract that name into "counterparty".
      
      RESPONSE FORMAT: Valid JSON only.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: text,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: { 
              type: Type.STRING, 
              description: "The user's intent: 'RECORD', 'QUERY', or 'UNKNOWN'."
            },
            type: { 
              type: Type.STRING, 
              description: "The transaction type: INCOME, EXPENSE, DEBT, or DEBT_PAYMENT."
            },
            amount: { 
              type: Type.NUMBER, 
              description: "The numeric value of the transaction."
            },
            category: { 
              type: Type.STRING, 
              description: "The business category (e.g., Stock, Rent, Sales)."
            },
            counterparty: { 
              type: Type.STRING, 
              description: "The name of the person involved."
            },
            queryRange: { 
              type: Type.STRING, 
              description: "Time range for queries: today, week, or month."
            }
          },
          required: ["intent"],
          propertyOrdering: ["intent", "type", "amount", "category", "counterparty", "queryRange"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return { ...parsed, rawText: text };
  } catch (error) {
    console.error("AI Parsing Error:", error);
    return { intent: 'UNKNOWN', rawText: text };
  }
};

export const parseReceiptImage = async (base64Data: string, mimeType: string): Promise<ParseResult> => {
  try {
    const ai = getAI();
    
    const systemInstruction = `
      Analyze the image of this receipt or invoice and extract details for a business ledger.
      Default to EXPENSE unless it is clearly a sales receipt.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Extract receipt details: type, amount, category, counterparty." }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            counterparty: { type: Type.STRING }
          },
          required: ["type", "amount", "category"],
          propertyOrdering: ["type", "amount", "category", "counterparty"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return { 
      intent: 'RECORD', 
      ...parsed, 
      rawText: `Receipt from ${parsed.counterparty || 'Unknown'}` 
    };
  } catch (error) {
    console.error("AI Receipt Error:", error);
    return { intent: 'UNKNOWN', rawText: "Failed to scan receipt" };
  }
};
