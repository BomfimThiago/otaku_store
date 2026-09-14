import { Link } from 'react-router';

export function HeroBanner() {
  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-neon-violet via-neon-pink to-neon-cyan">
      <div className="absolute inset-0 bg-black/35" aria-hidden="true" />
      <div className="relative flex flex-col gap-3 px-6 py-12 sm:px-10 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/90">OtakuVerso</p>
        <h2 className="max-w-xl font-display text-3xl font-bold text-white sm:text-4xl">
          Seu universo otaku em um só lugar
        </h2>
        <p className="max-w-lg text-white/90">
          Figures, mangás, vestuário e acessórios selecionados para quem vive a cultura pop japonesa.
        </p>
        <Link
          to="/?category=figures"
          className="mt-4 inline-flex w-fit items-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-fg shadow-neon transition hover:brightness-110"
        >
          Ver figures
        </Link>
      </div>
    </section>
  );
}
