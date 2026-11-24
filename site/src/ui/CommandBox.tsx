import { useEffect, useId, useRef, useState } from 'react';
import { t } from '../i18n/en.ts';
import { Icon } from './Icon.tsx';

export function CommandBox({ text }: { text: string }) {
  const id = useId();
  const code = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    clearTimeout(timer.current);
    const fail = () => {
      setState('fail');
      const sel = window.getSelection();
      if (code.current && sel) {
        const range = document.createRange();
        range.selectNodeContents(code.current);
        sel.removeAllRanges();
        sel.addRange(range);
        code.current.focus();
      }
    };
    if (!navigator.clipboard?.writeText) return fail();
    navigator.clipboard.writeText(text).then(() => {
      setState('ok');
      timer.current = setTimeout(() => setState('idle'), 2000);
    }, fail);
  };

  return (
    <div>
      <div className="cmd" data-state={state}>
        <code className="cmd-text" id={id} ref={code} tabIndex={0} aria-label={t('card.install')}>{text}</code>
        <button type="button" className="cmd-copy" onClick={copy}>
          <Icon name={state === 'ok' ? 'check' : 'copy'} size="sm" /><span>{state === 'ok' ? t('card.copied') : t('card.copy')}</span>
        </button>
      </div>
      {state === 'fail' && <p className="cmd-hint"><Icon name="warn" size="sm" />{t('card.copyFailed')}</p>}
    </div>
  );
}
