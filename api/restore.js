import { createRestoreHandler } from '../src/restore-api.mjs';
import { createDeviceGate } from '../src/device-gate.mjs';
import config from '../aleph.config.json' with { type: 'json' };
const handler = createRestoreHandler();
export default config.step >= 11 ? createDeviceGate(handler) : handler;
