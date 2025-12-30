
import { GoogleGenAI, Type } from "@google/genai";
import { ParseResult, TransactionType } from "../types";

// The GenAI client is initialized following strict guidelines.
// Always use new GoogleGenAI({ apiKey: process.env.API_KEY })
const getAI = () => {
  if (!process.env.API_KEY) {
    console.warn("Kazi Ledger: API_KEY is missing. AI features will be disabled.");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const parseInputText = async (text: string): Promise<ParseResult> => {
  try {
    const ai = getAI();
    if (!ai) return { intent: 'UNKNOWN', rawText: text };
    
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

    // Using ai.models.generateContent as per guidelines with defined model and contents.
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
              description: "The user's intent: 'RECORD' for transactions, 'QUERY' for reports/history, or 'UNKNOWN'."
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
              description: "The name of the person involved (Musa, John, etc.) if applicable."
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

    // Accessing response text directly via the .text property (not a method).
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
    if (!ai) return { intent: 'UNKNOWN', rawText: "AI service unavailable" };
    
    const systemInstruction = `
      Analyze the image of this receipt or invoice and extract:
      1. Total Amount
      2. Category (Stock, Rent, Fuel, Food, Salaries, etc.)
      3. Counterparty (The Merchant or Store Name)
      Default to EXPENSE.
    `;

    // Multimodal input using the parts array in contents.
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
            type: { 
              type: Type.STRING,
              description: "Usually 'EXPENSE' for scanned receipts."
            },
            amount: { 
              type: Type.NUMBER,
              description: "The total numerical amount on the document."
            },
            category: { 
              type: Type.STRING,
              description: "Category of business spend."
            },
            counterparty: { 
              type: Type.STRING,
              description: "The store or merchant name."
            }
          },
          required: ["type", "amount", "category"],
          propertyOrdering: ["type", "amount", "category", "counterparty"]
        }
      }
    });

    // Accessing response text directly via the .text property.
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
