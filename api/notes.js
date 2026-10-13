import { createNotesHandler } from '../src/notes-api.mjs';
import { createDeviceGate } from '../src/device-gate.mjs';
import config from '../aleph.config.json' with { type: 'json' };
export { createNotesHandler } from '../src/notes-api.mjs';
const handler = createNotesHandler();
export default config.step >= 11 ? createDeviceGate(handler) : handler;
