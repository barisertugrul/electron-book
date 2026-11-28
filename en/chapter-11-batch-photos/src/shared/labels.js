// labels.js — Text the user sees and the words used in the name template.
//
// This file is used by both the main process and the renderer, so it does
// not import anything specific to Node or Electron.

export const APP_NAME = 'Batch Photos';

// Number and date format (decimal point, weekday names).
export const LOCALE = 'en-US';

// Words written inside curly braces in the name template. The keys on the
// left are used in the code, the values on the right are what the user types:
// "{year}-{month}-{day}" -> "2026-11-27".
export const NAME_TOKENS = {
  year: 'year',
  month: 'month',
  day: 'day',
  hour: 'hour',
  minute: 'minute',
  second: 'second',
  counter: 'counter',
  name: 'name',
};

export const DEFAULT_TEMPLATE = '{year}-{month}-{day}_{hour}{minute}{second}';

export const GROUPING_LABELS = {
  none: 'All in one folder',
  year: 'By year (2026)',
  month: 'By month (2026/2026-11)',
};

export const DIALOG_TEXT = {
  pickPhotos: 'Choose photos',
  pickOutput: 'Choose the output folder',
  images: 'Photos',
};

export const ERRORS = {
  busy: 'The previous job has not finished yet.',
  noOutput: 'Choose an output folder first.',
  noPhotos: 'There are no photos to process.',
  workerStopped: 'The background worker stopped unexpectedly.',
};
