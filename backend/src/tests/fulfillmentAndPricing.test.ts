import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveFulfillmentProviderFromSettings,
  resolveAfaFulfillmentProviderFromSettings,
  normalizeNetworkRoute,
  normalizeAfaRoute,
  migrateFulfillmentSettings,
} from '../services/settingsService.js';
import { IFulfillmentSettings } from '../models/Setting.js';
import {
  mapNetworkToDatamaxCode,
  mapDatamaxVolume,
} from '../services/datamaxClient.js';
import { mapProviderStatus } from '../services/fulfillmentProviderService.js';
import { validateAgentCustomPrice } from '../services/agentPricingService.js';
import { AppError } from '../middleware/errorHandler.js';

const baseSettings = (): IFulfillmentSettings => ({
  enabled: true,
  defaultProvider: 'smartdatahub',
  networkRouting: {
    MTN: 'default',
    Telecel: 'default',
    AirtelTigo: 'default',
  },
  afaRouting: 'datamax',
});

test('normalizeNetworkRoute migrates legacy booleans', () => {
  assert.equal(normalizeNetworkRoute(true), 'smartdatahub');
  assert.equal(normalizeNetworkRoute(false), 'off');
  assert.equal(normalizeNetworkRoute('datamax'), 'datamax');
});

test('resolveFulfillmentProviderFromSettings uses default provider', () => {
  const settings = baseSettings();
  assert.equal(resolveFulfillmentProviderFromSettings(settings, 'MTN'), 'smartdatahub');

  settings.defaultProvider = 'datamax';
  assert.equal(resolveFulfillmentProviderFromSettings(settings, 'MTN'), 'datamax');
});

test('resolveFulfillmentProviderFromSettings respects network overrides', () => {
  const settings = baseSettings();
  settings.defaultProvider = 'datamax';
  settings.networkRouting.MTN = 'smartdatahub';
  settings.networkRouting.Telecel = 'off';

  assert.equal(resolveFulfillmentProviderFromSettings(settings, 'MTN'), 'smartdatahub');
  assert.equal(resolveFulfillmentProviderFromSettings(settings, 'Telecel'), null);
  assert.equal(resolveFulfillmentProviderFromSettings(settings, 'AirtelTigo'), 'datamax');
});

test('resolveFulfillmentProviderFromSettings returns null when master switch off', () => {
  const settings = baseSettings();
  settings.enabled = false;
  assert.equal(resolveFulfillmentProviderFromSettings(settings, 'MTN'), null);
});

test('migrateFulfillmentSettings converts boolean routing', () => {
  const { settings, dirty } = migrateFulfillmentSettings({
    enabled: true,
    networkRouting: {
      MTN: true,
      Telecel: false,
      AirtelTigo: true,
    },
  } as unknown as IFulfillmentSettings);

  assert.equal(dirty, true);
  assert.equal(settings.networkRouting.MTN, 'smartdatahub');
  assert.equal(settings.networkRouting.Telecel, 'off');
  assert.equal(settings.networkRouting.AirtelTigo, 'smartdatahub');
  assert.equal(settings.defaultProvider, 'smartdatahub');
  assert.equal(settings.afaRouting, 'datamax');
});

test('resolveAfaFulfillmentProviderFromSettings routes to Datamax or off', () => {
  const settings = baseSettings();
  assert.equal(resolveAfaFulfillmentProviderFromSettings(settings), 'datamax');

  settings.afaRouting = 'off';
  assert.equal(resolveAfaFulfillmentProviderFromSettings(settings), null);

  settings.afaRouting = 'default';
  settings.enabled = false;
  assert.equal(resolveAfaFulfillmentProviderFromSettings(settings), null);
});

test('normalizeAfaRoute defaults unknown values to datamax', () => {
  assert.equal(normalizeAfaRoute('datamax'), 'datamax');
  assert.equal(normalizeAfaRoute('off'), 'off');
  assert.equal(normalizeAfaRoute(false), 'off');
  assert.equal(normalizeAfaRoute('invalid'), 'datamax');
});

test('mapNetworkToDatamaxCode maps Ghana networks', () => {
  assert.equal(mapNetworkToDatamaxCode('MTN'), 'mtn');
  assert.equal(mapNetworkToDatamaxCode('Telecel'), 'telecel');
  assert.equal(mapNetworkToDatamaxCode('AirtelTigo'), 'airteltigo');
});

test('mapDatamaxVolume parses bundle sizes', () => {
  assert.equal(mapDatamaxVolume('2GB'), '2');
  assert.equal(mapDatamaxVolume('1.5GB'), '1.5');
});

test('mapProviderStatus maps Datamax statuses', () => {
  assert.equal(mapProviderStatus('in-progress'), 'processing');
  assert.equal(mapProviderStatus('completed'), 'delivered');
});

test('validateAgentCustomPrice enforces price ladder', () => {
  const pkg = { costPrice: 4, maxSellingPrice: 10 };
  assert.doesNotThrow(() => validateAgentCustomPrice(5, pkg));

  assert.throws(
    () => validateAgentCustomPrice(3, pkg),
    (err: unknown) => err instanceof AppError
  );
  assert.throws(
    () => validateAgentCustomPrice(11, pkg),
    (err: unknown) => err instanceof AppError
  );
});
