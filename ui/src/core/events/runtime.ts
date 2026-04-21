import { createEventBus } from "./bus";

// Shared in-memory event bus for current UI runtime.
export const eventBus = createEventBus();