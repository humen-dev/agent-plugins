import type { Catalog } from '../catalog/types.ts';
import { t } from '../i18n/en.ts';
import type { Route } from '../router.ts';
import { NotFound } from '../ui/states.tsx';

type PageRoute = Exclude<Route, { name: 'home' | 'notfound' }>;

const Page = ({ title }: { title: string }) => (
  <div className="wrap"><div className="page-ph"><h1>{title}</h1></div></div>
);

/** M2 stand-ins; M3 (plugin, artifact) and M4 (install, new) replace them. */
export function Placeholder({ route, catalog, url }: { route: PageRoute; catalog: Catalog; url: string }) {
  switch (route.name) {
    case 'install': return <Page title={t('pages.installTitle')} />;
    case 'new': return <Page title={t('pages.newTitle')} />;
    case 'plugin':
      return catalog.plugins.some((p) => p.name === route.plugin) ? <Page title={route.plugin} /> : <NotFound url={url} />;
    case 'artifact':
      return catalog.artifacts.some((a) => a.plugin === route.plugin && a.kind === route.kind && a.name === route.artifact)
        ? <Page title={route.artifact} />
        : <NotFound url={url} />;
  }
}
