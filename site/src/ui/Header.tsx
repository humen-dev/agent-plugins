import { useId, useState } from 'react';
import { t } from '../i18n/en.ts';
import { requestUrl } from '../links/request-url.ts';
import type { Route } from '../router.ts';
import { Icon } from './Icon.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

const THEME_KEY = 'catalog.theme';

/** `repoUrl` is null while the catalog loads: external links wait for it (Decision 12). */
export function Header({ route, repoUrl, query = '', installCount }: { route: Route['name']; repoUrl: string | null; query?: string; installCount?: number }) {
  const menuId = useId();
  const [menu, setMenu] = useState(false);
  const [light, setLight] = useState(() => document.documentElement.dataset.theme === 'light');

  const toggleTheme = () => {
    const next = light ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch { /* storage blocked: the choice lasts for this page only */ }
    setLight(!light);
  };
  const cur = (name: Route['name']) => (route === name ? 'page' : undefined);

  const links = (icons: boolean) => (
    <>
      <a href="#/" aria-current={cur('home')}>{icons && <Icon name="search" size="sm" />}{t('header.search')}</a>
      <a href="#/install" aria-current={cur('install')}>{icons && <Icon name="list" size="sm" />}{t('header.install')}
        {installCount !== undefined && (
          <>
            <span className={installCount > 0 ? 'count-pill on' : 'count-pill'} aria-hidden="true">{installCount}</span>
            <span className="sr-only">{t('header.installCountSr', { n: installCount })}</span>
          </>
        )}
      </a>
      <a href="#/new" aria-current={cur('new')}>{icons && <Icon name="clock" size="sm" />}{t('header.whatsNew')}</a>
      {repoUrl !== null && (
        <>
          <a href={requestUrl(repoUrl, query)} target="_blank" rel="noopener noreferrer">
            {t('header.request')}<Icon name="ext" size="sm" /><span className="sr-only">{t('header.opensOnGithub')}</span>
          </a>
          <a href={repoUrl} target="_blank" rel="noopener noreferrer">
            <Icon name="code" size="sm" />{t('header.github')}<span className="sr-only">{t('header.githubRepo')}</span>
          </a>
        </>
      )}
    </>
  );

  return (
    <header className="hdr">
      <div className="wrap">
        <a className="brand" href="#/"><Icon name="logo" />{t('header.brand')} <span className="muted">{t('header.brandSuffix')}</span></a>
        <nav className="nav" aria-label={t('header.nav')}>{links(true)}</nav>
        <ThemeToggle className="btn ghost theme-toggle desk" light={light} onToggle={toggleTheme} />
        <button type="button" className="btn menu-btn" aria-expanded={menu} aria-controls={menuId} onClick={() => setMenu(!menu)}>
          <Icon name={menu ? 'x' : 'menu'} />{t('header.menu')}
        </button>
      </div>
      {menu && (
        <nav className="mnav" id={menuId} aria-label={t('header.nav')} onClick={(e) => (e.target as Element).closest('a') && setMenu(false)}>
          {links(true)}
          <ThemeToggle className="btn theme-toggle" light={light} onToggle={toggleTheme} />
        </nav>
      )}
    </header>
  );
}
