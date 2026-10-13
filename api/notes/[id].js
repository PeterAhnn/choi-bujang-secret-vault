import { createNotesHandler } from '../../src/notes-api.mjs';
import { createDeviceGate } from '../../src/device-gate.mjs';
import config from '../../aleph.config.json' with { type: 'json' };
const handler = createNotesHandler({ itemRoute: true });
export default config.step >= 11 ? createDeviceGate(handler) : handler;
