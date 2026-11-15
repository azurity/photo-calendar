import type { FallbackContent } from './fallback';

/**
 * css-doodle 通过固定版本 CDN 加载。脚本不可用时，2 秒后启用 CSS 背景降级。
 */
export function mountDoodle(container: HTMLElement, content: FallbackContent): void {
  const doodle = document.createElement('css-doodle') as HTMLElement;
  doodle.className = 'doodle-layer';
  doodle.setAttribute('seed', String(content.seed));
  doodle.setAttribute('aria-hidden', 'true');
  doodle.textContent = content.pattern.rule;
  container.prepend(doodle);

  let settled = false;
  const check = (): void => {
    if (settled) return;
    if (typeof customElements !== 'undefined' && customElements.get('css-doodle')) {
      settled = true;
      container.classList.remove('pattern-fallback');
      container.classList.add('doodle-ready');
      return;
    }
    container.classList.add('pattern-fallback');
  };

  if (typeof customElements !== 'undefined' && customElements.get('css-doodle')) {
    check();
    return;
  }

  window.addEventListener('load', check, { once: true });
  window.setTimeout(() => {
    if (!settled) check();
  }, 2000);
}
