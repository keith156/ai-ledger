
import { GoogleGenAI, Type } from "@google/genai";
import { ParseResult, TransactionType } from "../types";

const API_KEY = process.env.API_KEY || "";

export const parseInputText = async (text: string): Promise<ParseResult> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
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
    - DEBT_PAYMENT: Someone pays back ("Musa paid 500"). COUNTERPARTY must be the name. This is CRITICAL.
    
    When a person's name is mentioned in relation to money owed or money paid back, ALWAYS extract that name into the "counterparty" field.
    
    RESPONSE FORMAT: 
    Must be a valid JSON object matching the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: text,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: { type: Type.STRING, enum: ["RECORD", "QUERY", "UNKNOWN"] },
            type: { type: Type.STRING, enum: ["INCOME", "EXPENSE", "DEBT", "DEBT_PAYMENT"], nullable: true },
            amount: { type: Type.NUMBER, nullable: true },
            category: { type: Type.STRING, nullable: true },
            counterparty: { type: Type.STRING, nullable: true },
            queryRange: { type: Type.STRING, enum: ["today", "week", "month"], nullable: true }
          },
          required: ["intent"]
        }
      }
    });

    const parsed = JSON.parse(response.text);
    return { ...parsed, rawText: text };
  } catch (error) {
    console.error("AI Parsing Error:", error);
    return { intent: 'UNKNOWN', rawText: text };
  }
};

export const parseReceiptImage = async (base64Data: string, mimeType: string): Promise<ParseResult> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const systemInstruction = `
    You are an intelligent business assistant. 
    Analyze the image of this receipt or invoice and extract:
    1. Total Amount
    2. Category (Stock, Rent, Fuel, Food, Salaries, etc.)
    3. Counterparty (The Merchant or Store Name)
    
    Usually receipts are EXPENSES. If it's a sales receipt, it might be INCOME. Default to EXPENSE.
    
    RESPONSE FORMAT: 
    Must be a JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Extract receipt details." }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ["INCOME", "EXPENSE", "DEBT", "DEBT_PAYMENT"] },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            counterparty: { type: Type.STRING }
          },
          required: ["type", "amount", "category"]
        }
      }
    });

    const parsed = JSON.parse(response.text);
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
