
import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

export async function* streamChatResponse(prompt: string, history: Message[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: 'Você é o Assistente CaçaPequi. Ajude o usuário a entender editais de cultura, fornecendo dicas sobre documentação, prazos e como escrever bons projetos. Seja profissional e encorajador.',
    },
  });

  const response = await chat.sendMessageStream({ message: prompt });
  
  for await (const chunk of response) {
    yield chunk.text;
  }
}
