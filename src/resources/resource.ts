import type { Transport } from "../core/transport.js";

export abstract class APIResource {
  constructor(protected readonly transport: Transport) {}
}
