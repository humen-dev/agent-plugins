import { t } from '../i18n/en.ts';
import type { Route } from '../router.ts';

type PageRoute = Extract<Route, { name: 'install' | 'new' }>;

const Page = ({ title }: { title: string }) => (
  <div className="wrap"><div className="page-ph"><h1>{title}</h1></div></div>
);

/** M2 stand-ins; M4 (install, new) replaces them. */
export function Placeholder({ route }: { route: PageRoute }) {
  const title = route.name === 'install' ? t('pages.installTitle') : t('pages.newTitle');
  return <Page title={title} />;
}
