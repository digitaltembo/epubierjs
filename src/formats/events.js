/** A minimal event emitter, for sessions' `on` */
export function emitter() {
  const handlers = {};
  return {
    on(type, handler) {
      (handlers[type] ||= []).push(handler);
    },
    emit(type, ...args) {
      for (const handler of handlers[type] || []) handler(...args);
    },
  };
}
