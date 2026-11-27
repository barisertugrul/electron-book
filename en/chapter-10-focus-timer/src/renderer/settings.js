// settings.js — The settings window.
//
// Fills the form with the settings from the main process and sends them back
// when Save is pressed. Validation happens in the main process (settings.js /
// normalizeSettings); it returns the corrected settings and we refresh the
// form with them.

import { api, closeOnEscape } from './common.js';

const form = document.querySelector('#settings-form');
const status = document.querySelector('#status');

const NUMBER_FIELDS = ['focusMinutes', 'shortBreakMinutes', 'longBreakMinutes', 'sessionsBeforeLongBreak'];
const CHECK_FIELDS = ['autoStartNext', 'alwaysOnTop', 'openAtLogin'];

function fillForm(settings) {
  for (const name of NUMBER_FIELDS) form.elements[name].value = settings[name];
  for (const name of CHECK_FIELDS) form.elements[name].checked = settings[name];
}

function readForm() {
  const settings = {};
  for (const name of NUMBER_FIELDS) settings[name] = Number(form.elements[name].value);
  for (const name of CHECK_FIELDS) settings[name] = form.elements[name].checked;
  return settings;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault(); // Don't let the form reload the page
  const saved = await api.saveSettings(readForm());
  fillForm(saved);
  status.textContent = 'Saved';
  setTimeout(() => {
    status.textContent = '';
  }, 2000);
});

document.querySelector('#btn-close').addEventListener('click', () => api.closeWindow());
closeOnEscape();

const { settings, shortcut } = await api.getSettings();
fillForm(settings);
document.querySelector('#shortcut').textContent = shortcut.accelerator.replace('CommandOrControl', 'Ctrl');
document.querySelector('#shortcut-warning').hidden = shortcut.registered;
