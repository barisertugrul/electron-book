// api.js — Preload köprüsünün (window.budget) küçük bir sarmalayıcısı.
//
// Ana süreç bir hata olduğunda { error: "mesaj" } döndürür. Burada bunu
// gerçek bir hataya çeviriyoruz; böylece bileşenlerde try/catch ile
// yakalayabiliriz.

async function call(name, ...args) {
  const result = await window.budget[name](...args);
  if (result && typeof result === 'object' && 'error' in result) throw new Error(result.error);
  return result;
}

// window.budget'taki her fonksiyon için aynı adla bir sarmalayıcı üretir:
// api.listCategories(), api.addTransaction({...}) ...
export const api = Object.fromEntries(
  Object.keys(window.budget).map((name) => [name, (...args) => call(name, ...args)]),
);
