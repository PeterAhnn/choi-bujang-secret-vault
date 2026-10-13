import { createDeviceGate } from '../src/device-gate.mjs';
import { createOperationsHandler } from '../src/operations-api.mjs';

export default createDeviceGate(createOperationsHandler());
