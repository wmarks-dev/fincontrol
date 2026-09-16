import { Category, TransactionType } from '../types';

interface KeywordRule {
  categoryId: string;
  keywords: string[];
}

const RULES: KeywordRule[] = [
  {
    categoryId: 'food',
    keywords: [
      'ifood',
      'rappi',
      'mcdonald',
      'mc donald',
      'burger king',
      'bk brasil',
      'restaurante',
      'mercado',
      'supermercado',
      'hipermercado',
      'padaria',
      'panificadora',
      'acougue',
      'carrefour',
      'pao de acucar',
      'extra',
      'assai',
      'atacadao',
      'bar',
      'lanchonete',
      'hortifruti',
      'sacolao',
      'pizzaria',
      'churrascaria',
      'doceria',
      'sorveteria',
      'cafeteria',
      'starbucks',
      'subway',
      'habib',
      'bobs',
      'outback',
      'madero',
      'emporio',
      'mercearia',
      'peixaria',
    ],
  },
  {
    categoryId: 'transport',
    keywords: [
      'uber',
      '99app',
      '99pop',
      '99 tecnologia',
      'posto',
      'gasolina',
      'etanol',
      'diesel',
      'shell',
      'ipiranga',
      'br distribuidora',
      'combustivel',
      'pedagio',
      'sem parar',
      'conectcar',
      'veloe',
      'estacionamento',
      'estapar',
      'metro',
      'passagem',
      'oficina',
      'mecanica',
      'pneus',
      'latam',
      'gol linhas',
      'voeazul',
      'azul linhas',
      'taxi',
      'velotax',
      'mobilidade',
      'recarga transporte',
      'bilhete unico',
    ],
  },
  {
    categoryId: 'health',
    keywords: [
      'farmacia',
      'drogasil',
      'droga raia',
      'pague menos',
      'drogaria',
      'drogao',
      'panvel',
      'consulta',
      'hospital',
      'laboratorio',
      'fleury',
      'delboni',
      'lavoisier',
      'exame',
      'dentista',
      'odonto',
      'medico',
      'psicologo',
      'fisioterapia',
      'clinica',
      'plano de saude',
      'unimed',
      'bradesco saude',
      'amil',
      'sulamerica',
      'otica',
      'oftalmo',
    ],
  },
  {
    categoryId: 'subscriptions',
    keywords: [
      'netflix',
      'spotify',
      'amazon prime',
      'prime video',
      'hbo',
      'max.com',
      'disney',
      'starplus',
      'star+',
      'globoplay',
      'apple.com/bill',
      'icloud',
      'google storage',
      'youtube premium',
      'deezer',
      'crunchyroll',
      'chatgpt',
      'openai',
      'claude.ai',
      'canva',
      'adobe',
      'globo comun',
    ],
  },
  {
    categoryId: 'bills',
    keywords: [
      'internet',
      'claro',
      'vivo',
      'tim celular',
      'oi fixo',
      'telefone',
      'fibra',
      'operadora',
      'net servicos',
      'enel',
      'cpfl',
      'cemig',
      'celesc',
      'coelba',
      'light',
      'sabesp',
      'sanepar',
      'copasa',
      'saneago',
      'compesa',
      'energia eletrica',
      'agua e esgoto',
      'ultragaz',
      'liquigas',
      'gas brasiliano',
      'comgas',
    ],
  },
  {
    categoryId: 'housing',
    keywords: [
      'aluguel',
      'condominio',
      'imobiliaria',
      'quintoandar',
      'loft',
      'iptu',
      'taxa condominial',
      'conserto',
      'reparo residencia',
      'marcenaria',
      'vidracaria',
      'dedetizacao',
    ],
  },
  {
    categoryId: 'shopping',
    keywords: [
      'amazon',
      'mercado livre',
      'mercadolivre',
      'shopee',
      'shein',
      'magalu',
      'magazine luiza',
      'zara',
      'riachuelo',
      'renner',
      'c&a',
      'americanas',
      'casas bahia',
      'ponto frio',
      'kabum',
      'pichau',
      'terabyte',
      'leroy merlin',
      'telhanorte',
      'kalunga',
      'centauro',
      'decathlon',
      'nike',
      'adidas',
      'aliexpress',
    ],
  },
  {
    categoryId: 'education',
    keywords: [
      'curso',
      'faculdade',
      'universidade',
      'escola',
      'colegio',
      'udemy',
      'alura',
      'coursera',
      'edx',
      'hotmart',
      'kiwify',
      'livro',
      'livraria',
      'saraiva',
      'leitura',
      'mensalidade escolar',
      'idiomas',
      'wizard',
      'cna',
      'fisk',
    ],
  },
  {
    categoryId: 'leisure',
    keywords: [
      'cinema',
      'ingresso',
      'cinemark',
      'cinepolis',
      'teatro',
      'show',
      'steam',
      'playstation',
      'psn',
      'xbox',
      'nintendo',
      'riot games',
      'blizzard',
      'epic games',
      'viagem',
      'hotel',
      'airbnb',
      'booking.com',
      'parque',
      'clube',
      'barbearia',
      'salao de beleza',
      'spa',
      'sympla',
      'eventim',
    ],
  },
  {
    categoryId: 'salary',
    keywords: [
      'salario',
      'folha de pagamento',
      'remuneracao',
      'adiantamento salarial',
      'ordenado',
      'proventos',
      'vencimentos',
      'ted recebida folha',
      'pix recebido salario',
    ],
  },
  {
    categoryId: 'investment',
    keywords: [
      'rendimento',
      'dividendo',
      'jcp',
      'tesouro direto',
      'cdb',
      'rdb',
      'lci',
      'lca',
      'fundo de investimento',
      'b3',
      'xp investimentos',
      'nu invest',
      'nuinvest',
      'rico corretora',
      'clear corretora',
      'btg pactual',
      'inter dtvm',
      'cripto',
      'binance',
    ],
  },
  {
    categoryId: 'loans',
    keywords: [
      'emprestimo',
      'financiamento',
      'credito pessoal',
      'parcela veiculo',
      'parcela imovel',
      'consorcio',
    ],
  },
];

/**
 * Normalizes string by lowering case and removing diacritics / accents.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Suggests the best category ID based on the transaction description and type.
 */
export function suggestCategory(
  description: string,
  type: TransactionType,
  availableCategories: Category[]
): string {
  const norm = normalizeText(description);

  // If income, check salary and investment first
  if (type === TransactionType.INCOME) {
    if (norm.includes('salario') || norm.includes('remunera') || norm.includes('folha')) {
      const found = availableCategories.find((c) => c.id === 'salary');
      if (found) return found.id;
    }
    if (norm.includes('rendimento') || norm.includes('dividendo') || norm.includes('invest')) {
      const found = availableCategories.find((c) => c.id === 'investment');
      if (found) return found.id;
    }
  }

  // Iterate rules
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (norm.includes(kw)) {
        const found = availableCategories.find((c) => c.id === rule.categoryId);
        if (found) return found.id;
      }
    }
  }

  // Custom categories match by name
  for (const cat of availableCategories) {
    if (cat.isCustom) {
      const catNorm = normalizeText(cat.name);
      if (norm.includes(catNorm)) {
        return cat.id;
      }
    }
  }

  // Fallback
  const fallback = availableCategories.find((c) => c.id === 'other');
  return fallback ? fallback.id : availableCategories[0]?.id || 'other';
}
