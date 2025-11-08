import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  nome: string;
  email: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nome, email }: RequestBody = await req.json();

    // Validação básica
    if (!nome || !email) {
      throw new Error("Nome e e-mail são obrigatórios");
    }

    if (nome.length < 2 || nome.length > 100) {
      throw new Error("Nome inválido");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("E-mail inválido");
    }

    // Obter data e hora atual no formato brasileiro
    const now = new Date();
    const dataHora = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);

    // URL do Google Apps Script Web App
    // IMPORTANTE: Você precisa criar um Web App no Google Apps Script da sua planilha
    // Veja as instruções no console quando esta função for executada
    const RAW_GOOGLE_SCRIPT = (Deno.env.get('GOOGLE_SCRIPT_URL') || '').trim();
    // Aceita URL completa do Web App (terminando com /exec) ou apenas o ID (começando com AKfycb...)
    const isFullUrl = RAW_GOOGLE_SCRIPT.startsWith('http');
    const isLikelyApiKey = RAW_GOOGLE_SCRIPT.startsWith('AIza');

    const GOOGLE_SCRIPT_URL = RAW_GOOGLE_SCRIPT
      ? (isFullUrl
          ? RAW_GOOGLE_SCRIPT
          : `https://script.google.com/macros/s/${RAW_GOOGLE_SCRIPT}/exec`)
      : '';
    
    if (!GOOGLE_SCRIPT_URL) {
      console.error(`\nCONFIGURAÇÃO NECESSÁRIA - Google Sheets\nCrie um Web App no Apps Script da planilha e use a URL completa (termina com /exec) ou apenas o ID (AKfycb...).`);
      throw new Error("Configure GOOGLE_SCRIPT_URL primeiro. Veja as instruções no log.");
    }

    // Validação extra para evitar valores incorretos (ex.: chave de API Google 'AIza...')
    if (isLikelyApiKey || (isFullUrl && !/script\.google\.com\/macros\/s\/.+\/exec/.test(GOOGLE_SCRIPT_URL))) {
      console.error(`\nGOOGLE_SCRIPT_URL inválida. Informe:\n- a URL do Web App publicada (deve conter 'script.google.com/macros/s/.../exec'), ou\n- APENAS o ID do deployment (ex.: AKfycb...)`);
      throw new Error("GOOGLE_SCRIPT_URL inválida. Use a URL do Web App (/exec) ou o ID AKfycb...");
    }

    console.log('Enviando dados para Google Sheets via:', GOOGLE_SCRIPT_URL);

    // Enviar dados para o Google Apps Script
    const sheetsResponse = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nome,
        email,
        dataHora,
      }),
    });

    if (!sheetsResponse.ok) {
      const errorText = await sheetsResponse.text();
      console.error('Erro do Google Sheets:', errorText);
      throw new Error(`Erro ao salvar no Google Sheets: ${sheetsResponse.status}`);
    }

    const result = await sheetsResponse.json();
    console.log('Sucesso ao salvar no Google Sheets:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Dados salvos com sucesso',
        data: { nome, email, dataHora }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro na função salvar-acesso-desktop:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar solicitação';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
