import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { parseBridgeMessage } from '@/services/reader/bridge';

export interface ReaderWebViewHandle {
  /** Sends a command to the page. Commands sent before the page is ready are queued. */
  send(command: object): void;
}

export interface ReaderWebViewProps {
  html: string;
  /** Raw JSON message from the page (already filtered: never the "ready" handshake). */
  onMessage(raw: string): void;
  /** Called every time the page (re)loads and is ready to receive commands. */
  onReady(): void;
  backgroundColor: string;
  allowZoom?: boolean;
}

/**
 * Sandboxed WebView hosting the reader pages. Book content never navigates
 * away: every navigation request other than the initial document is blocked.
 */
export const ReaderWebView = forwardRef<ReaderWebViewHandle, ReaderWebViewProps>(function ReaderWebView(
  { html, onMessage, onReady, backgroundColor, allowZoom = false },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const ready = useRef(false);
  const queue = useRef<string[]>([]);

  const inject = useCallback((payload: string) => {
    webRef.current?.injectJavaScript(`window.__mbrReceive && window.__mbrReceive(${payload}); true;`);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      send(command: object) {
        const payload = JSON.stringify(command);
        if (ready.current) inject(payload);
        else queue.current.push(payload);
      },
    }),
    [inject],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const raw = event.nativeEvent.data;
      const message = parseBridgeMessage(raw);
      if (message?.type === 'ready') {
        ready.current = true;
        const pending = queue.current;
        queue.current = [];
        pending.forEach(inject);
        onReady();
        return;
      }
      onMessage(raw);
    },
    [inject, onMessage, onReady],
  );

  const reload = useCallback(() => {
    ready.current = false;
    webRef.current?.reload();
  }, []);

  return (
    <WebView
      ref={webRef}
      originWhitelist={['*']}
      source={{ html, baseUrl: '' }}
      onMessage={handleMessage}
      style={[styles.webview, { backgroundColor }]}
      containerStyle={{ backgroundColor }}
      javaScriptEnabled
      domStorageEnabled={false}
      scrollEnabled={allowZoom}
      bounces={false}
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      allowsLinkPreview={false}
      setSupportMultipleWindows={false}
      allowFileAccess={false}
      setBuiltInZoomControls={allowZoom}
      setDisplayZoomControls={false}
      scalesPageToFit={allowZoom}
      textZoom={100}
      onShouldStartLoadWithRequest={(request) => /^(about:|data:)/.test(request.url) || request.url === ''}
      onContentProcessDidTerminate={reload}
      onRenderProcessGone={reload}
    />
  );
});

const styles = StyleSheet.create({
  webview: { flex: 1 },
});
