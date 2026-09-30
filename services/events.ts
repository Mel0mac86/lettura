/**
 * Tiny pub/sub used to refresh screens when data changes (e.g. the library
 * reloads after a book is imported in another screen).
 */
export type DataTopic = 'books' | 'annotations' | 'categories' | 'settings' | 'stats';

type Listener = (topic: DataTopic) => void;

const listeners = new Set<Listener>();

export const dataEvents = {
  emit(...topics: DataTopic[]): void {
    for (const topic of topics) listeners.forEach((listener) => listener(topic));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
