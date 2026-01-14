
import { GoogleGenAI, Type } from "@google/genai";
import { SearchResult } from "../types";

const REGION_COORDS: Record<string, { lat: number, lng: number }> = {
  'AC': { lat: -9.97, lng: -67.81 }, 'AL': { lat: -9.66, lng: -35.73 }, 'AM': { lat: -3.11, lng: -60.02 },
  'AP': { lat: 0.03, lng: -51.06 }, 'BA': { lat: -12.97, lng: -38.50 }, 'CE': { lat: -3.71, lng: -38.54 },
  'DF': { lat: -15.79, lng: -47.88 }, 'ES': { lat: -20.31, lng: -40.31 }, 'GO': { lat: -16.68, lng: -49.25 },
  'MA': { lat: -2.53, lng: -44.30 }, 'MG': { lat: -19.92, lng: -43.94 }, 'MS': { lat: -20.44, lng: -54.61 },
  'MT': { lat: -15.60, lng: -56.09 }, 'PA': { lat: -1.45, lng: -48.50 }, 'PB': { lat: -7.11, lng: -34.86 },
  'PE': { lat: -8.05, lng: -34.88 }, 'PI': { lat: -5.09, lng: -42.80 }, 'PR': { lat: -25.42, lng: -49.27 },
  'RJ': { lat: -22.90, lng: -43.17 }, 'RN': { lat: -5.79, lng: -35.20 }, 'RO': { lat: -8.76, lng: -63.90 },
  'RR': { lat: 2.82, lng: -60.67 }, 'RS': { lat: -30.03, lng: -51.23 }, 'SC': { lat: -27.59, lng: -48.54 },
  'SE': { lat: -10.91, lng: -37.07 }, 'SP': { lat: -23.55, lng: -46.63 }, 'TO': { lat: -10.16, lng: -48.33 },
  'Nacional': { lat: -14.23, lng: -51.92 }
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, initialDelay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if ((error.message?.includes("503") || error.status === 503) && i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function searchEditais(query: string, expandedKeywords: string[] = []): Promise<SearchResult[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const keywordsText = expandedKeywords.length > 0 ? ` Temas de interesse da ONG: ${expandedKeywords.join(', ')}.` : '';

  const executeSearch = async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", 
      contents: `Realize uma BUSCA SEMÂNTICA CONCEITUAL para uma ONG: "${query}".${keywordsText}
      
      INSTRUÇÃO DE EXPANSÃO PARA OSCs:
      Busque por editais de:
      1. Chamamento Público (MROSC)
      2. Leis de Incentivo (Rouanet, Esporte, Audiovisual, FIA, Idoso)
      3. Editais de Fundações (Itaú Social, Bradesco, Fundação Banco do Brasil, etc)
      4. Verbas de emendas ou parcerias internacionais (ONU, Embaixadas).
      
      Se a busca for "meio ambiente", inclua "sustentabilidade", "recuperação de bacias", "educação ambiental".
      Se for "social", inclua "empoderamento feminino", "combate à fome", "capacitação profissional".
      
      Retorne até 30 resultados JSON.`,
      config: {
        systemInstruction: `Você é o CaçaPequi, motor de busca especializado em editais para ONGs e OSCs. Seu foco é encontrar recursos para projetos de impacto social.`,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              url: { type: Type.STRING },
              snippet: { type: Type.STRING },
              setor: { type: Type.STRING },
              regiao: { type: Type.STRING },
              tipo_ente: { type: Type.STRING, enum: ['Federal', 'Estadual', 'Municipal', 'Privado'] },
              valor_estimado: { type: Type.STRING },
              data_publicacao: { type: Type.STRING },
              status: { type: Type.STRING, enum: ['Aberto', 'Suspenso', 'Encerrado', 'Em Análise'] },
            },
            required: ["title", "url", "snippet", "status", "regiao"]
          }
        }
      },
    });
    return response;
  };

  try {
    const response = await withRetry(executeSearch);
    if (!response.text) throw new Error("Busca sem resultados.");
    const cleanJson = response.text.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    const results: SearchResult[] = JSON.parse(cleanJson);
    
    return results.map(r => ({
      ...r,
      lat: REGION_COORDS[r.regiao || 'Nacional']?.lat,
      lng: REGION_COORDS[r.regiao || 'Nacional']?.lng
    }));
  } catch (error: any) {
    throw new Error(error.message || "Erro na busca para OSC.");
  }
}
