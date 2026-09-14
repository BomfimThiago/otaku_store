import { Link } from 'react-router';

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
      <path d="M4 4l16 16M20 4 4 20" strokeLinecap="round" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="m10.5 10 4 2-4 2z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TiktokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
      <path d="M14 3v11a3.5 3.5 0 1 1-3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 3a5 5 0 0 0 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://instagram.com', Icon: InstagramIcon },
  { label: 'X (Twitter)', href: 'https://x.com', Icon: TwitterIcon },
  { label: 'YouTube', href: 'https://youtube.com', Icon: YoutubeIcon },
  { label: 'TikTok', href: 'https://tiktok.com', Icon: TiktokIcon },
] as const;

export function Footer() {
  return (
    <footer className="w-full border-t border-ink-700 bg-ink-800 px-4 py-10 md:px-8">
      <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
        <div>
          <p className="font-display text-lg font-bold text-fg">
            Otaku<span className="text-neon-pink">Verso</span>
          </p>
          <p className="mt-2 text-sm text-muted">Seu universo otaku em um só lugar.</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-fg">Institucional</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>
              <Link to="/" className="hover:text-fg">
                Sobre nós
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-fg">Ajuda</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>
              <Link to="/" className="hover:text-fg">
                Central de ajuda
              </Link>
            </li>
            <li>
              <Link to="/" className="hover:text-fg">
                Trocas e devoluções
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-fg">Contato</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>
              <Link to="/contato" className="hover:text-fg">
                Fale conosco
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-fg">Políticas</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>
              <Link to="/" className="hover:text-fg">
                Políticas de privacidade
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-4">
        {SOCIAL_LINKS.map(({ label, href, Icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="text-muted hover:text-fg"
          >
            <Icon />
          </a>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted">
        © {new Date().getFullYear()} OtakuVerso. Todos os direitos reservados.
      </p>
    </footer>
  );
}
