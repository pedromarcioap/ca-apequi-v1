
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

/**
 * Analisa arquivos (Imagens ou PDFs) enviados pelo usuário.
 * O Gemini 3 Pro processa documentos PDF de forma nativa quando enviados como inlineData.
 */
export async function analyzeEditalFile(base64Data: string, mimeType: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Analise este arquivo (Edital Cultural) e extraia os dados estruturados seguindo rigorosamente as instruções do sistema. Se for um PDF com várias páginas, analise o conteúdo integral." }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nome_edital: { type: Type.STRING },
            ente_pagador: { type: Type.STRING },
            objeto_resumido: { type: Type.STRING },
            areas: { type: Type.ARRAY, items: { type: Type.STRING } },
            valor_teto: { type: Type.STRING },
            data_limite: { type: Type.STRING },
            elegibilidade: { type: Type.STRING },
            vedacoes: { type: Type.STRING },
            grau_dificuldade: { type: Type.NUMBER },
            documentos_exigidos: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["nome_edital", "objeto_resumido", "valor_teto", "data_limite"]
        }
      },
    });

    if (!response.text) throw new Error("A IA não conseguiu ler o conteúdo do arquivo enviado.");
    
    // Limpeza de possíveis marcações de bloco de código na resposta
    const cleanJson = response.text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("Erro na análise de arquivo:", error);
    throw new Error(`Falha ao processar o arquivo (${mimeType}): ${error.message}`);
  }
}
