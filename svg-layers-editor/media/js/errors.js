import { vscode } from './state.js';
import { toast } from './util.js';

export function report(error, where) {
  const message = (error && error.message) || String(error);
  try {
    vscode.postMessage({
      type: 'log',
      message: (where ? `${where}: ` : '') + message,
      stack: error && error.stack ? String(error.stack) : '',
    });
  } catch {
    // The host may already be gone.
  }
  toast(`Something went wrong: ${message}`);
}

export function guard(fn, where) {
  return function guarded(...args) {
    try {
      return fn.apply(this, args);
    } catch (error) {
      report(error, where);
      return undefined;
    }
  };
}

export function listen(target, type, fn, options) {
  target.addEventListener(type, guard(fn, type), options);
}

window.addEventListener('error', (e) => report(e.error || e.message, 'error'));
window.addEventListener('unhandledrejection', (e) => report(e.reason, 'promise'));
