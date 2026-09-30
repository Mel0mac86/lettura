import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

import { parseBridgeMessage } from '@/services/reader/bridge';

import type { ReaderWebViewHandle, ReaderWebViewProps } from './ReaderWebView';

export type { ReaderWebViewHandle, ReaderWebViewProps } from './ReaderWebView';

type ReceiverWindow = Window & { __mbrReceive?: (command: object) => void };

/** Web implementation: a same-origin `srcdoc` iframe using postMessage as bridge. */
export const ReaderWebView = forwardRef<ReaderWebViewHandle, ReaderWebViewProps>(function ReaderWebView(
  { html, onMessage, onReady, backgroundColor },
  ref,
) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const queue = useRef<object[]>([]);

  const deliver = useCallback((command: object) => {
    const target = frameRef.current?.contentWindow as ReceiverWindow | null | undefined;
    target?.__mbrReceive?.(command);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      send(command: object) {
        if (ready.current) deliver(command);
        else queue.current.push(command);
      },
    }),
    [deliver],
  );

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { __mbr?: boolean; data?: string } | null;
      if (!data?.__mbr || typeof data.data !== 'string') return;
      const message = parseBridgeMessage(data.data);
      if (message?.type === 'ready') {
        ready.current = true;
        const pending = queue.current;
        queue.current = [];
        pending.forEach(deliver);
        onReady();
        return;
      }
      onMessage(data.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [deliver, onMessage, onReady]);

  return (
    <iframe
      ref={frameRef}
      srcDoc={html}
      title="Lettore"
      style={{ flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor }}
    />
  );
});
