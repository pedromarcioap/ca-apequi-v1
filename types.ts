
export interface Edital {
  id: string;
  nome_edital: string;
  ente_pagador: string;
  objeto_resumido: string;
  areas: string[];
  valor_teto: string;
  data_limite: string;
  elegibilidade: string;
  vedacoes: string;
  grau_dificuldade: number;
  link_origem: string;
  documentos_exigidos: string[];
}

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  setor?: string;
  regiao?: string;
  valor_estimado?: string;
  tipo_ente?: 'Federal' | 'Estadual' | 'Municipal' | 'Privado';
  data_publicacao?: string;
  status?: 'Aberto' | 'Suspenso' | 'Encerrado' | 'Em Análise';
  lat?: number;
  lng?: number;
}

export interface UserPreferences {
  keywords: string[];
  regions: string[];
  notificationTime: string;
  emailStyle: 'formal' | 'direto' | 'descontraido';
  autoExpand: boolean;
}

export enum AnalysisStatus {
  IDLE = 'idle',
  SCRAPING = 'scraping',
  ANALYZING = 'analyzing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface Message {
  role: 'user' | 'model';
  text: string;
}
