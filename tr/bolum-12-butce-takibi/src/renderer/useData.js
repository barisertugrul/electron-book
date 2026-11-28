// useData.js — Veri yükleyen küçük bir React kancası (hook).
//
//   const { data, error } = useData(() => api.monthSummary(month), [month, version]);
//
// deps listesindeki bir değer değişince veri yeniden yüklenir.

import { useEffect, useState } from 'react';

export function useData(load, deps) {
  const [state, setState] = useState({ data: null, error: null });

  useEffect(() => {
    // Yükleme bitmeden bileşen kapanır ya da deps değişirse, eski sonucu
    // ekrana yazmayalım.
    let active = true;
    load()
      .then((data) => active && setState({ data, error: null }))
      .catch((error) => active && setState({ data: null, error: error.message }));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
