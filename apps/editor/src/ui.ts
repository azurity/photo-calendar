import { formatChineseDate, weekdayName } from '@photo-calendar/shared';

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | number | null | undefined> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'text') element.textContent = String(value);
    else if (
      key === 'value' &&
      (element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement)
    )
      element.value = String(value);
    else if (value === true) element.setAttribute(key, '');
    else element.setAttribute(key, String(value));
  }
  for (const child of children) {
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return element;
}

export function clear(element: Element): void {
  element.replaceChildren();
}

export function dateLabel(date: string): string {
  return `${formatChineseDate(date)} · ${weekdayName(date)}`;
}

export function showToast(message: string, kind: 'error' | 'success' | 'info' = 'info'): void {
  const existing = document.querySelector('.toast');
  existing?.remove();
  const toast = h('div', { class: `toast toast-${kind}`, role: 'status' }, [message]);
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog lab-dialog';
    const text = h('p', { class: 'confirm-text' }, [message]);
    const cancel = h('button', { class: 'button button-ghost', type: 'button' }, ['取消']);
    const confirm = h('button', { class: 'button button-danger', type: 'button' }, ['确认']);
    const actions = h('div', { class: 'dialog-actions' }, [cancel, confirm]);
    dialog.append(text, actions);
    document.body.append(dialog);
    const close = (value: boolean): void => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    cancel.addEventListener('click', () => close(false));
    confirm.addEventListener('click', () => close(true));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close(false);
    });
    dialog.showModal();
    cancel.focus();
  });
}

export function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return typeof error === 'string' ? error : '操作失败';
}
