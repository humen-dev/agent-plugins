import { t } from '../i18n/en.ts';
import { Icon } from './Icon.tsx';

export function ThemeToggle({ light, onToggle, className }: { light: boolean; onToggle: () => void; className: string }) {
  return (
    <button type="button" className={className} aria-pressed={light} onClick={onToggle}>
      <Icon name={light ? 'moon' : 'sun'} />
      {t('theme.light')}
    </button>
  );
}
