import type { ReactNode } from 'react';
import { Icon } from './Icon.tsx';

export function Collapsible({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <details className="coll">
      <summary>
        <span className="chev"><Icon name="chevR" size="sm" /></span>{title} <span className="sub">{sub}</span>
      </summary>
      <div className="coll-body">{children}</div>
    </details>
  );
}
