// api.js — A small wrapper around the preload bridge (window.budget).
//
// When something goes wrong, the main process returns { error: "message" }.
// Here we turn that into a real error, so components can catch it with
// try/catch.

async function call(name, ...args) {
  const result = await window.budget[name](...args);
  if (result && typeof result === 'object' && 'error' in result) throw new Error(result.error);
  return result;
}

// Creates a wrapper with the same name for every function in window.budget:
// api.listCategories(), api.addTransaction({...}) ...
export const api = Object.fromEntries(
  Object.keys(window.budget).map((name) => [name, (...args) => call(name, ...args)]),
);
