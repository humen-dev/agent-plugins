import { useEffect, useState } from 'react';
import type { Catalog, Change } from '../catalog/types.ts';
import { utcDay } from '../format.ts';
import { t } from '../i18n/en.ts';
import { ChangeRow } from '../ui/ChangeRow.tsx';
import { Icon } from '../ui/Icon.tsx';

const newHash = (plugin: string | null) => (plugin === null ? '#/new' : `#/new?plugin=${encodeURIComponent(plugin)}`);

export function NewPage({ catalog }: { catalog: Catalog }) {
  const names = catalog.plugins.map((p) => p.name).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  // `?plugin=` filters only for a catalog plugin; anything else shows all (AC-43).
  const read = () => {
    const h = location.hash;
    const qi = h.indexOf('?');
    const v = qi < 0 ? null : new URLSearchParams(h.slice(qi + 1)).get('plugin');
    return v !== null && names.includes(v) ? v : null;
  };
  const [plugin, setPlugin] = useState<string | null>(read);
  useEffect(() => {
    const on = () => setPlugin(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  });

  const pick = (p: string | null) => {
    setPlugin(p);
    history.replaceState(null, '', newHash(p));
  };

  const shown = plugin === null ? catalog.changes : catalog.changes.filter((c) => c.plugin === plugin);
  const days: { day: string; date: string; items: Change[] }[] = [];
  for (const c of shown) {
    const day = utcDay(c.date);
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(c);
    else days.push({ day, date: c.date, items: [c] });
  }
  const count = (p: string) => catalog.changes.filter((c) => c.plugin === p).length;
  const chip = (key: string, label: string, p: string | null, n: number) => (
    <button key={key} type="button" className="chip" aria-pressed={plugin === p} onClick={() => pick(p)}>
      <Icon name="check" size="sm" />{label}<span className="n">{n}</span>
    </button>
  );

  return (
    <div className="wrap page">
      <header className="ph">
        <h1>{t('pages.newTitle')}</h1>
        <p className="lead">{t('new.lead')}</p>
      </header>
      <div className="chips">
        {chip('', t('new.allPlugins'), null, catalog.changes.length)}
        {names.map((n) => chip(`p:${n}`, n, n, count(n)))}
      </div>
      <p className="small muted" role="status">
        {t('new.countLine', { changes: t('new.changes', { n: shown.length }), days: t('new.days', { n: days.length }) })}
      </p>
      {days.map((d) => (
        <section key={d.day} className="sec" aria-labelledby={`day-${d.day}`}>
          <h2 className="day-h" id={`day-${d.day}`}><time dateTime={d.date}>{d.day}</time></h2>
          <ol className="chg-list">{d.items.map((c) => <ChangeRow key={c.commit} c={c} catalog={catalog} second="plugin" />)}</ol>
        </section>
      ))}
    </div>
  );
}
