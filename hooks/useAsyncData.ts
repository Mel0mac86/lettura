import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { dataEvents, type DataTopic } from '@/services/events';
import { toUserMessage } from '@/utils/errors';

export interface AsyncData<T> {
  data: T | undefined;
  /** True until the current `loader` has produced a result (stale data stays visible meanwhile). */
  loading: boolean;
  error: string | null;
  reload: () => void;
}

interface State<T> {
  data: T | undefined;
  error: string | null;
  /** The loader that produced `data`/`error`: when it changes, a new load is in progress. */
  source: (() => Promise<T>) | null;
}

/**
 * Loads data asynchronously and keeps it fresh: reloads when the screen gains
 * focus again and when one of `topics` is emitted on {@link dataEvents}.
 * `loader` must be memoised (useCallback): a new loader triggers a new load.
 * Responses from outdated requests are ignored.
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  topics: readonly DataTopic[] = [],
  options: { refreshOnFocus?: boolean } = {},
): AsyncData<T> {
  const refreshOnFocus = options.refreshOnFocus ?? true;
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, source: null });
  const requestId = useRef(0);

  const reload = useCallback(() => {
    const id = ++requestId.current;
    loader()
      .then((data) => {
        if (id === requestId.current) setState({ data, error: null, source: loader });
      })
      .catch((e: unknown) => {
        if (id === requestId.current) setState((prev) => ({ data: prev.data, error: toUserMessage(e), source: loader }));
      });
  }, [loader]);

  useEffect(() => {
    reload();
  }, [reload]);

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      // The initial load is done by the effect above; refresh only when coming back.
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (refreshOnFocus) reload();
    }, [reload, refreshOnFocus]),
  );

  const topicKey = topics.join(',');
  useEffect(() => {
    if (!topicKey) return undefined;
    const wanted = new Set(topicKey.split(','));
    return dataEvents.subscribe((topic) => {
      if (wanted.has(topic)) reload();
    });
  }, [topicKey, reload]);

  return { data: state.data, loading: state.source !== loader, error: state.error, reload };
}
