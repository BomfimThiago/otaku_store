import { z } from 'zod';

export const productSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  priceCents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  images: z.array(z.string()),
});

export type Product = z.infer<typeof productSchema>;

export const products: Product[] = [
  {
    id: '1',
    slug: 'nendoroid-goku-super-saiyajin',
    name: 'Nendoroid Goku Super Saiyajin',
    description:
      'Estatueta articulada Nendoroid do Goku em sua forma Super Saiyajin, com rosto e mãos intercambiáveis.',
    category: 'figures',
    priceCents: 34990,
    stock: 12,
    images: ['/images/products/nendoroid-goku-super-saiyajin-1.jpg'],
  },
  {
    id: '2',
    slug: 'figuarts-luffy-gear-5',
    name: 'Figuarts Luffy Gear 5',
    description:
      'Action figure em escala do Luffy na forma Gear 5, com base temática e acessórios de efeito para pose dinâmica.',
    category: 'figures',
    priceCents: 54990,
    stock: 8,
    images: ['/images/products/figuarts-luffy-gear-5-1.jpg'],
  },
  {
    id: '3',
    slug: 'one-piece-volume-1',
    name: 'One Piece Volume 1',
    description: 'Primeiro volume do mangá clássico que acompanha a jornada de um jovem pirata rumo ao One Piece.',
    category: 'mangas',
    priceCents: 2990,
    stock: 40,
    images: ['/images/products/one-piece-volume-1-1.jpg'],
  },
  {
    id: '4',
    slug: 'attack-on-titan-box-set',
    name: 'Attack on Titan Box Set',
    description: 'Box set com os primeiros volumes do mangá de Attack on Titan, incluindo pôster exclusivo.',
    category: 'mangas',
    priceCents: 24990,
    stock: 15,
    images: ['/images/products/attack-on-titan-box-set-1.jpg'],
  },
  {
    id: '5',
    slug: 'camiseta-akatsuki-preta',
    name: 'Camiseta Akatsuki Preta',
    description: 'Camiseta licenciada com estampa da nuvem vermelha da organização Akatsuki, tecido 100% algodão.',
    category: 'vestuario',
    priceCents: 7990,
    stock: 30,
    images: ['/images/products/camiseta-akatsuki-preta-1.jpg'],
  },
  {
    id: '6',
    slug: 'chaveiro-totoro-pelucia',
    name: 'Chaveiro Totoro de Pelúcia',
    description: 'Chaveiro fofo do personagem Totoro, feito em pelúcia macia, ideal para presentear fãs do Studio Ghibli.',
    category: 'acessorios',
    priceCents: 3490,
    stock: 50,
    images: ['/images/products/chaveiro-totoro-pelucia-1.jpg'],
  },
  {
    id: '7',
    slug: 'poster-demon-slayer-a2',
    name: 'Pôster Demon Slayer A2',
    description: 'Pôster de alta qualidade com arte oficial de Demon Slayer, tamanho A2, ideal para decorar o quarto.',
    category: 'papelaria',
    priceCents: 4990,
    stock: 25,
    images: ['/images/products/poster-demon-slayer-a2-1.jpg'],
  },
  {
    id: '8',
    slug: 'pelucia-pikachu-30cm',
    name: 'Pelúcia Pikachu 30cm',
    description: 'Pelúcia oficial do Pikachu com 30cm, tecido super macio e acabamento bordado nos detalhes do rosto.',
    category: 'pelucias',
    priceCents: 12990,
    stock: 20,
    images: ['/images/products/pelucia-pikachu-30cm-1.jpg'],
  },
];
