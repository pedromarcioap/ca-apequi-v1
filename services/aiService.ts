
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

export async function analyzeEditalWithAI(text: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Você é um motor de busca e análise. Recebeu o seguinte conteúdo:
      
      "${text}"

      TAREFA:
      1. Se o texto acima contiver "INSTRUÇÃO" ou "FALLBACK", significa que o scraper falhou. 
      2. Nesses casos, use OBRIGATORIAMENTE a ferramenta 'googleSearch' para pesquisar o edital e extrair os dados oficiais.
      3. Se o texto for conteúdo real de um edital, analise-o e use a busca apenas para confirmar datas ou valores ambíguos.
      4. Retorne o JSON seguindo estritamente a estrutura solicitada.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
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

    if (!response.text) {
      throw new Error("Não foi possível obter uma resposta válida da IA.");
    }

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response.text;
    const data = JSON.parse(jsonStr);

    // Validação mínima de sanidade
    if (!data.nome_edital || data.nome_edital.length < 3) {
      throw new Error("A IA não conseguiu identificar os dados básicos deste edital.");
    }

    return data;
  } catch (error: any) {
    console.error("Erro na análise profunda:", error);
    throw new Error(`Falha na decodificação inteligente: ${error.message}`);
  }
}
