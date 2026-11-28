// useData.js — A small React hook that loads data.
//
//   const { data, error } = useData(() => api.monthSummary(month), [month, version]);
//
// The data is loaded again when a value in the deps list changes.

import { useEffect, useState } from 'react';

export function useData(load, deps) {
  const [state, setState] = useState({ data: null, error: null });

  useEffect(() => {
    // If the component goes away or deps change before loading finishes,
    // don't put the old result on screen.
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
