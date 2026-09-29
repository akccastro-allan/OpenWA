// webhook by-id operations (findOne/update/delete/test) must be scoped to the URL
// :sessionId, and GET /webhooks must be scoped to the key's allowedSessions. Without it, an
// OPERATOR key for one session can read/edit/delete/redirect/fire another session's webhook,
// and enumerate every session's webhook URLs. These run against a real in-memory DB so the
// scoping is exercised end-to-end, not asserted on a mock's WHERE clause.
import { DataSource, type DataSourceOptions } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { WebhookService } from './webhook.service';
import { Webhook } from './entities/webhook.entity';
import { WebhookDeliveryFailure } from '../integration/entities/integration-delivery-failure.entity';
import { Session, SessionStatus } from '../session/entities/session.entity';
import { HookManager } from '../../core/hooks/hook-manager.service';

/**
 * Build a ConfigService-compatible fixture backed by a real key/value map.
 *
 * A positional `{}` placeholder silently drifts the moment the constructor reads
 * another key, and it fails at the call site rather than at the gap. This one
 * records the keys the service asked for, so a new dependency is visible.
 */
function createConfigFixture(overrides: Record<string, unknown> = {}): {
  service: ConfigService;
  readonly keysRead: string[];
} {
  const values: Record<string, unknown> = {
    'queue.enabled': false,
    'webhook.timeout': 10_000,
    'webhook.retryDelay': 5_000,
    ...overrides,
  };
  const keysRead: string[] = [];
  const service = {
    get<T>(key: string, defaultValue?: T): T {
      keysRead.push(key);
      return (key in values ? values[key] : defaultValue) as T;
    },
    has(key: string): boolean {
      return key in values;
    },
  } as unknown as ConfigService;
  return { service, keysRead };
}

/**
 * The entity set the real service needs.
 *
 * WebhookDeliveryFailure is included because the service injects its repository
 * even when the paths under test do not touch it; leaving it out would only
 * hide a future dependency.
 */
function createDataSourceOptions(): DataSourceOptions {
  return {
    type: 'sqlite',
    database: ':memory:',
    entities: [Session, Webhook, WebhookDeliveryFailure],
    synchronize: true,
  };
}

/**
 * One factory for the production-compatible collaborator set.
 *
 * Tests below only override the dependency they care about, so a future
 * constructor change breaks in exactly one place instead of once per test.
 */
function createWebhookServiceTestHarness() {
  const config = createConfigFixture();
  const construct = (
    webhookRepository: ConstructorParameters<typeof WebhookService>[0],
    sessionRepository: ConstructorParameters<typeof WebhookService>[2],
    overrides: Partial<{
      configService: ConfigService;
      hookManager: ConstructorParameters<typeof WebhookService>[4];
    }> = {},
  ) =>
    new WebhookService(
      webhookRepository,
      undefined as unknown as ConstructorParameters<typeof WebhookService>[1],
      sessionRepository,
      overrides.configService ?? config.service,
      overrides.hookManager ?? new HookManager(),
      undefined,
      undefined,
    );

  return { config, construct };
}

describe('WebhookService session-scoped access', () => {
  let ds: DataSource;
  let service: WebhookService;
  let whA: Webhook;
  let whB: Webhook;

  beforeEach(async () => {
    ds = new DataSource(createDataSourceOptions());
    await ds.initialize();

    const webhookRepository = ds.getRepository(Webhook);
    const sessionRepository = ds.getRepository(Session);
    const { construct } = createWebhookServiceTestHarness();
    service = construct(webhookRepository, sessionRepository);

    const sessions = ds.getRepository(Session);
    for (const id of ['sessA', 'sessB']) {
      await sessions.save(sessions.create({ id, name: id, status: SessionStatus.READY, config: {} }));
    }
    whA = await webhookRepository.save(
      webhookRepository.create({
        sessionId: 'sessA',
        url: 'https://a.example/hook',
        events: ['message.received'],
        headers: {},
        retryCount: 3,
      }),
    );
    whB = await webhookRepository.save(
      webhookRepository.create({
        sessionId: 'sessB',
        url: 'https://b.example/hook',
        events: ['message.received'],
        headers: {},
        retryCount: 3,
      }),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('findOne returns a webhook only for its owning session', async () => {
    expect((await service.findOne('sessA', whA.id)).id).toBe(whA.id);
    await expect(service.findOne('sessA', whB.id)).rejects.toThrow(NotFoundException);
  });

  it('update refuses (404) a webhook owned by another session and does not mutate it', async () => {
    await expect(service.update('sessA', whB.id, { url: 'https://evil.example/x' })).rejects.toThrow(NotFoundException);
    expect((await ds.getRepository(Webhook).findOneByOrFail({ id: whB.id })).url).toBe('https://b.example/hook');
  });

  it('delete refuses (404) a webhook owned by another session and does not remove it', async () => {
    await expect(service.delete('sessA', whB.id)).rejects.toThrow(NotFoundException);
    expect(await ds.getRepository(Webhook).countBy({ id: whB.id })).toBe(1);
  });

  it('test refuses (404) to fire a webhook owned by another session', async () => {
    await expect(service.test('sessA', whB.id)).rejects.toThrow(NotFoundException);
  });

  it('findAll scopes to allowedSessions when set, returns all when unrestricted', async () => {
    expect((await service.findAll(['sessA'])).map(w => w.id)).toEqual([whA.id]);
    expect((await service.findAll(null)).map(w => w.id).sort()).toEqual([whA.id, whB.id].sort());
    expect((await service.findAll([])).length).toBe(2); // empty allowlist = unrestricted (matches the guard)
  });

  it('rejects an unknown session id on every by-id operation', async () => {
    await expect(service.findOne('sessX', whA.id)).rejects.toThrow(NotFoundException);
    await expect(service.update('sessX', whA.id, { url: 'https://x.example' })).rejects.toThrow(NotFoundException);
    await expect(service.delete('sessX', whA.id)).rejects.toThrow(NotFoundException);
    await expect(service.test('sessX', whA.id)).rejects.toThrow(NotFoundException);
    // The webhooks themselves are untouched.
    expect(await ds.getRepository(Webhook).count()).toBe(2);
  });

  it('delete removes an owned webhook, proving the 404 is scoping and not a blanket refusal', async () => {
    await service.delete('sessA', whA.id);
    expect(await ds.getRepository(Webhook).countBy({ id: whA.id })).toBe(0);
    expect(await ds.getRepository(Webhook).countBy({ id: whB.id })).toBe(1);
  });
});
