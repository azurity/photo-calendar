function findMeta(attribute: 'name' | 'property', key: string): HTMLMetaElement | null {
  return document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
}

function setMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = findMeta(attribute, key);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.setAttribute('content', content);
}

function removeMeta(attribute: 'name' | 'property', key: string): void {
  findMeta(attribute, key)?.remove();
}

export interface PageMeta {
  title: string;
  description: string;
  image?: string;
}

export function updatePageMeta({ title, description, image }: PageMeta): void {
  document.title = title;
  setMeta('name', 'description', description);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  if (image) {
    setMeta('property', 'og:image', image);
  } else {
    removeMeta('property', 'og:image');
  }
}
