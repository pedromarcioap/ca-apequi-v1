
/**
 * Tenta extrair o conteúdo textual de uma URL utilizando um proxy CORS.
 * Projetado para ser silencioso: se falhar, fornece metadados para que a IA 
 * use sua capacidade de busca (grounding) para recuperar os dados.
 */
export async function scrapeUrl(url: string): Promise<string> {
  try {
    // Proxy AllOrigins com cache-busting
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&_=${Date.now()}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      return `[INSTRUÇÃO: O acesso direto falhou (Status ${response.status}). Use a busca do Google para analisar este edital: ${url}]`;
    }

    const data = await response.json();
    const html = data.contents;

    if (!html) {
      return `[INSTRUÇÃO: Conteúdo HTML vazio. Use o Grounding do Google para investigar a URL: ${url}]`;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    // Verificação básica de bloqueio
    const pageTitle = (doc.title || "").toLowerCase();
    if (pageTitle.includes("attention required") || pageTitle.includes("cloudflare") || pageTitle.includes("captcha")) {
      return `[INSTRUÇÃO: Bloqueio de bot detectado na fonte. Use o Google Search para encontrar informações públicas sobre este edital: ${url}]`;
    }

    // Limpeza de tags
    const tagsToRemove = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'iframe'];
    tagsToRemove.forEach(tag => doc.querySelectorAll(tag).forEach(el => el.remove()));

    const mainContent = doc.querySelector('main, article, #content, .content, #main') || doc.body;
    const text = (mainContent?.textContent || "").trim();
    
    const cleanedText = text
      .replace(/\t+/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Se o texto for muito curto, provavelmente não pegou o conteúdo real
    if (cleanedText.length < 300) {
      return `[INSTRUÇÃO: Texto extraído insuficiente. Valide as informações via Google Search para a URL: ${url}]`;
    }

    return cleanedText.substring(0, 45000);
  } catch (error: any) {
    // Falha de rede ou CORS - Retornamos apenas a URL para o Grounding da IA
    return `[INSTRUÇÃO DE FALLBACK: Erro de conexão (Failed to fetch). O scraper não conseguiu acessar o site. Por favor, utilize o Google Search Tool para buscar e extrair todos os detalhes necessários deste edital: ${url}]`;
  }
}
