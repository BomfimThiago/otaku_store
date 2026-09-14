import type { Product } from './types.js';

const IMAGE_PREFIX = 'https://placehold.co/600x600/1F1710/E2843F?text=';

function placeholderImage(label: string): string {
  return IMAGE_PREFIX + encodeURIComponent(label).replace(/%20/g, '+');
}

/**
 * In-memory seed of the product catalog. Prices are integer cents; the
 * limited-edition +20% surcharge (figures only) is applied at checkout time
 * and is intentionally not baked into these base prices.
 */
export const products: readonly Product[] = [
  {
    id: 'figure-nendoroid-kitsune',
    slug: 'nendoroid-kitsune-yokai',
    name: 'Nendoroid Kitsune Yokai',
    category: 'Action Figures',
    kind: 'figure',
    description:
      'Figure articulada estilo Nendoroid do espírito raposa Kitsune Yokai, com rosto e mãos intercambiáveis e acessórios de efeito.',
    basePriceCents: 34900,
    images: [placeholderImage('Nendoroid Kitsune Yokai')],
    isLimitedEdition: true,
    variants: [
      { id: 'padrao', label: 'Edição Padrão', priceDeltaCents: 0 },
      { id: 'deluxe', label: 'Edição Deluxe com Base Iluminada', priceDeltaCents: 8000 },
    ],
  },
  {
    id: 'figure-scale-samurai-carmesim',
    slug: 'estatua-escala-1-7-samurai-carmesim',
    name: 'Estátua Escala 1/7 Samurai Carmesim',
    category: 'Action Figures',
    kind: 'figure',
    description:
      'Estátua em escala 1/7 do Samurai Carmesim, esculpida com detalhes de armadura e efeito de lâmina em movimento.',
    basePriceCents: 89900,
    images: [placeholderImage('Estatua Samurai Carmesim')],
    isLimitedEdition: false,
    variants: [{ id: 'padrao', label: 'Escala 1/7', priceDeltaCents: 0 }],
  },
  {
    id: 'figure-figuarts-heroina-trovao',
    slug: 'figuarts-heroina-trovao',
    name: 'S.H.Figuarts Heroína do Trovão',
    category: 'Action Figures',
    kind: 'figure',
    description:
      'Figure articulada da Heroína do Trovão com peças de efeito de energia e conjunto de mãos alternativas para poses de batalha.',
    basePriceCents: 54900,
    images: [placeholderImage('Figuarts Heroina do Trovao')],
    isLimitedEdition: false,
    variants: [
      { id: 'padrao', label: 'Edição Padrão', priceDeltaCents: 0 },
      { id: 'com-efeitos', label: 'Com Efeitos de Energia Extra', priceDeltaCents: 3500 },
    ],
  },
  {
    id: 'manga-lamina-eterna-vol-1',
    slug: 'manga-lamina-eterna-vol-1',
    name: 'Mangá Lâmina Eterna Vol. 1',
    category: 'Mangás',
    kind: 'other',
    description: 'Primeiro volume da saga Lâmina Eterna, com arte em preto e branco e páginas coloridas de abertura.',
    basePriceCents: 3490,
    images: [placeholderImage('Mangá Lâmina Eterna Vol 1')],
    isLimitedEdition: false,
    variants: [
      { id: 'volume-unico', label: 'Volume Único', priceDeltaCents: 0 },
      { id: 'edicao-especial', label: 'Edição Especial com Encarte', priceDeltaCents: 1200 },
    ],
  },
  {
    id: 'manga-academia-dos-espectros-vol-3',
    slug: 'manga-academia-dos-espectros-vol-3',
    name: 'Mangá Academia dos Espectros Vol. 3',
    category: 'Mangás',
    kind: 'other',
    description: 'Terceiro volume da série Academia dos Espectros, continuando o treinamento da turma de exorcistas.',
    basePriceCents: 2990,
    images: [placeholderImage('Mangá Academia dos Espectros Vol 3')],
    isLimitedEdition: false,
    variants: [
      { id: 'capa-padrao', label: 'Capa Padrão', priceDeltaCents: 0 },
      { id: 'capa-variante', label: 'Capa Variante Colecionável', priceDeltaCents: 900 },
    ],
  },
  {
    id: 'camiseta-cla-da-fenix',
    slug: 'camiseta-cla-da-fenix',
    name: 'Camiseta Clã da Fênix',
    category: 'Vestuário',
    kind: 'other',
    description: 'Camiseta 100% algodão estampada com o brasão do Clã da Fênix, corte unissex.',
    basePriceCents: 7990,
    images: [placeholderImage('Camiseta Cla da Fenix')],
    isLimitedEdition: false,
    variants: [
      { id: 'pp', label: 'PP', priceDeltaCents: 0 },
      { id: 'p', label: 'P', priceDeltaCents: 0 },
      { id: 'm', label: 'M', priceDeltaCents: 0 },
      { id: 'g', label: 'G', priceDeltaCents: 0 },
      { id: 'gg', label: 'GG', priceDeltaCents: 0 },
    ],
  },
  {
    id: 'moletom-guilda-sombria',
    slug: 'moletom-guilda-sombria',
    name: 'Moletom Guilda Sombria',
    category: 'Vestuário',
    kind: 'other',
    description: 'Moletom com capuz e bolso canguru estampado com o emblema da Guilda Sombria, forro felpudo.',
    basePriceCents: 15990,
    images: [placeholderImage('Moletom Guilda Sombria')],
    isLimitedEdition: false,
    variants: [
      { id: 'pp', label: 'PP', priceDeltaCents: 0 },
      { id: 'p', label: 'P', priceDeltaCents: 0 },
      { id: 'm', label: 'M', priceDeltaCents: 0 },
      { id: 'g', label: 'G', priceDeltaCents: 0 },
      { id: 'gg', label: 'GG', priceDeltaCents: 0 },
    ],
  },
  {
    id: 'chaveiro-espada-lendaria',
    slug: 'chaveiro-espada-lendaria',
    name: 'Chaveiro Espada Lendária',
    category: 'Acessórios',
    kind: 'other',
    description: 'Chaveiro em metal fundido em formato da Espada Lendária, com acabamento envelhecido.',
    basePriceCents: 2490,
    images: [placeholderImage('Chaveiro Espada Lendaria')],
    isLimitedEdition: false,
    variants: [],
  },
];

export function findProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function findProductById(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

export type { Product, ProductVariant, Variant, ProductKind, ProductCategory } from './types.js';
