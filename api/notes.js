import { createNotesHandler } from '../src/notes-api.mjs';
import { createDeviceGate } from '../src/device-gate.mjs';
import { createObservedHandler } from '../src/request-observation.mjs';
import config from '../aleph.config.json' with { type: 'json' };
export { createNotesHandler } from '../src/notes-api.mjs';
const handler = createNotesHandler();
const protectedHandler = config.step >= 11 ? createDeviceGate(handler) : handler;
export default config.step >= 12
  ? createObservedHandler(protectedHandler, { resource: 'notes_collection' }) : protectedHandler;
