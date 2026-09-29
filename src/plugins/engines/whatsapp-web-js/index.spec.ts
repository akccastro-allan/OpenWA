jest.mock('../../../engine/adapters/whatsapp-web-js.adapter', () => ({
  WhatsAppWebJsAdapter: jest.fn().mockImplementation((config: unknown) => ({ config })),
}));

import { WhatsAppWebJsPlugin } from './index';
import { WhatsAppWebJsAdapter } from '../../../engine/adapters/whatsapp-web-js.adapter';
import { PluginContext } from '../../../core/plugins';
import type { LidMappingStore } from '../../../engine/identity/lid-mapping-store.service';

/** The production default for sessionDataPath, as set by createEngine. */
const PRODUCTION_DEFAULT_SESSION_DATA_PATH = '/app/data/sessions';

function adapterConfig(): Record<string, unknown> {
  const mock = WhatsAppWebJsAdapter as unknown as jest.Mock;
  const firstCall: unknown[] | undefined = mock.mock.calls[0];
  return (firstCall?.[0] ?? {}) as Record<string, unknown>;
}

describe('WhatsAppWebJsPlugin.createEngine (opaque config)', () => {
  beforeEach(() => {
    (WhatsAppWebJsAdapter as unknown as jest.Mock).mockClear();
  });

  function withContext(plugin: WhatsAppWebJsPlugin, config: Record<string, unknown>): void {
    // onLoad sets this.context synchronously; the returned promise can be ignored here.
    void plugin.onLoad({ config, logger: { log: jest.fn() } } as unknown as PluginContext);
  }

  it('reads browser config from context.config (the opaque engine blob), not per-call', () => {
    const plugin = new WhatsAppWebJsPlugin();
    withContext(plugin, {
      sessionDataPath: '/data/sessions',
      puppeteer: { headless: false, args: ['--single-process'], executablePath: '/usr/bin/chromium' },
    });

    plugin.createEngine({ sessionId: 'sess-1', proxyUrl: 'http://p', proxyType: 'http' });

    expect(WhatsAppWebJsAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-1',
        sessionDataPath: '/data/sessions',
        puppeteer: { headless: false, args: ['--single-process'], executablePath: '/usr/bin/chromium' },
        proxy: { url: 'http://p', type: 'http' },
      }),
    );
  });

  it('falls back to safe defaults when context has no config', () => {
    const plugin = new WhatsAppWebJsPlugin();

    plugin.createEngine({ sessionId: 'sess-2' });

    // The production default is the container path, not a relative one. The old
    // expectation here was stale and would have failed on a real deployment.
    expect(WhatsAppWebJsAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-2',
        sessionDataPath: PRODUCTION_DEFAULT_SESSION_DATA_PATH,
        puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'], executablePath: undefined },
      }),
    );
  });

  it('Uses the constructor-supplied engine config when onLoad never ran (enable-failure path)', () => {
    // EngineFactory now also passes the engine blob at construction. If enablePlugin fails before
    // onLoad runs, this.context is never set — the ctor blob must still supply operator config
    // instead of silently degrading to defaults (which dropped sessionDataPath/executablePath).
    const plugin = new WhatsAppWebJsPlugin({
      sessionDataPath: '/op/sessions',
      puppeteer: { headless: false, args: ['--flag'], executablePath: '/usr/bin/chromium' },
    });

    plugin.createEngine({ sessionId: 'sess-3' });

    expect(WhatsAppWebJsAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-3',
        sessionDataPath: '/op/sessions',
        puppeteer: { headless: false, args: ['--flag'], executablePath: '/usr/bin/chromium' },
      }),
    );
  });

  it('Prefers context.config over the constructor blob on the healthy enable path', () => {
    const plugin = new WhatsAppWebJsPlugin({ sessionDataPath: '/ctor/path' });
    withContext(plugin, { sessionDataPath: '/context/path' });

    plugin.createEngine({ sessionId: 'sess-4' });

    expect(WhatsAppWebJsAdapter).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-4', sessionDataPath: '/context/path' }),
    );
  });

  it('uses a per-call config only for engine-neutral fields, never for browser config', () => {
    const plugin = new WhatsAppWebJsPlugin();
    withContext(plugin, { sessionDataPath: '/context/path', puppeteer: { headless: false, args: ['--ctx'] } });

    // A per-call config that tries to smuggle browser settings must be ignored.
    plugin.createEngine({
      sessionId: 'sess-5',
      sessionDataPath: '/injected/path',
      puppeteer: { headless: true, args: ['--injected'] },
    });

    const config = adapterConfig();
    expect(config.sessionDataPath).toBe('/context/path');
    expect(config.puppeteer).toEqual({ headless: false, args: ['--ctx'], executablePath: undefined });
  });

  it('passes the constructor-supplied lid mapping store into the adapter config', () => {
    const store = { get: jest.fn(), set: jest.fn() } as unknown as LidMappingStore;
    const plugin = new WhatsAppWebJsPlugin(undefined, store);

    plugin.createEngine({ sessionId: 'sess-6' });

    // The adapter needs the store to persist learned phone<->lid pairs. The mock
    // adapter records whatever config it receives, so this asserts the real
    // dependency actually arrives rather than being silently dropped.
    expect(adapterConfig().lidMappingStore).toBe(store);
  });

  it('passes the lid mapping store even when context.config supplies the browser config', () => {
    const store = { get: jest.fn(), set: jest.fn() } as unknown as LidMappingStore;
    const plugin = new WhatsAppWebJsPlugin(undefined, store);
    withContext(plugin, { sessionDataPath: '/context/path' });

    plugin.createEngine({ sessionId: 'sess-7' });

    const config = adapterConfig();
    expect(config.lidMappingStore).toBe(store);
    expect(config.sessionDataPath).toBe('/context/path');
  });

  it('leaves the lid mapping store undefined when none is supplied', () => {
    const plugin = new WhatsAppWebJsPlugin();
    plugin.createEngine({ sessionId: 'sess-8' });
    expect(adapterConfig().lidMappingStore).toBeUndefined();
  });

  it('applies the proxy from the per-call config with an http default type', () => {
    const plugin = new WhatsAppWebJsPlugin();
    plugin.createEngine({ sessionId: 'sess-9', proxyUrl: 'socks5://h:1080' });

    expect(adapterConfig().proxy).toEqual({ url: 'socks5://h:1080', type: 'http' });
  });

  it('omits proxy entirely when the per-call config has no proxy url', () => {
    const plugin = new WhatsAppWebJsPlugin();
    plugin.createEngine({ sessionId: 'sess-10' });
    expect(adapterConfig().proxy).toBeUndefined();
  });
});
