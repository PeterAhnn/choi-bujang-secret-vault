import { createNotesHandler } from '../../src/notes-api.mjs';
import { createDeviceGate } from '../../src/device-gate.mjs';
import { createObservedHandler } from '../../src/request-observation.mjs';
import config from '../../aleph.config.json' with { type: 'json' };
const handler = createNotesHandler({ itemRoute: true });
const protectedHandler = config.step >= 11 ? createDeviceGate(handler) : handler;
export default config.step >= 12
  ? createObservedHandler(protectedHandler, { resource: 'note_item' }) : protectedHandler;
