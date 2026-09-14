import { Link } from 'react-router';

const HIGHLIGHTS = [
  {
    title: 'Colecionáveis',
    description: 'Figures, action figures e itens de edição limitada para completar sua coleção.',
  },
  {
    title: 'Mídia',
    description: 'Mangás, artbooks e trilhas sonoras dos seus animes favoritos.',
  },
  {
    title: 'Vestuário',
    description: 'Camisetas, moletons e acessórios para vestir o seu fandom todos os dias.',
  },
] as const;

export function AboutPage() {
  return (
    <main className="w-full px-4 py-10 md:px-8">
      <h1 className="mb-6 font-display text-2xl font-bold">Sobre nós</h1>

      <p className="font-display text-lg font-bold text-fg">
        Otaku<span className="text-neon-pink">Verso</span>
      </p>
      <p className="mt-2 text-sm text-muted">Seu universo otaku em um só lugar.</p>

      <p className="mt-6 max-w-2xl text-sm text-muted">
        Nossa missão é conectar fãs de anime e cultura pop japonesa aos produtos que eles amam, com
        curadoria cuidadosa, preços justos e uma experiência de compra pensada para otakus de
        verdade.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {HIGHLIGHTS.map(({ title, description }) => (
          <div key={title} className="rounded-xl border border-ink-700 bg-ink-900 p-6">
            <p className="font-semibold text-fg">{title}</p>
            <p className="mt-2 text-sm text-muted">{description}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link to="/" className="text-neon-cyan hover:underline">
          Voltar ao catálogo
        </Link>
      </div>
    </main>
  );
}
