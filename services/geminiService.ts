
import { GoogleGenAI } from "@google/genai";

export async function getBusinessInsights(data: any) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analise os seguintes dados da padaria "Madeira Master" e forneça 3 dicas de otimização de estoque ou redução de custos em português: ${JSON.stringify(data)}`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Não foi possível gerar insights no momento.";
  }
}
