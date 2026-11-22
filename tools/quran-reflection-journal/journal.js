'use strict';

const fields = document.querySelector('#entry-fields');
const ayah = document.querySelector('#ayah');
const date = document.querySelector('#entry-date');
const reflection = document.querySelector('#reflection');
const status = document.querySelector('#entry-status');
const manualCopy = document.querySelector('#manual-copy');
const copyText = document.querySelector('#copy-text');
const printBlank = document.querySelector('#print-blank');
const printDate = document.querySelector('#print-date');
const printAyah = document.querySelector('#print-ayah');
const printPrompts = document.querySelector('#print-prompts');
const printReflection = document.querySelector('#print-reflection');
const printLines = document.querySelector('#print-lines');

let copyRevision = 0;
let printMode;

const dateFormat = new Intl.DateTimeFormat(document.documentElement.lang, {
  dateStyle: 'long',
  timeZone: 'UTC',
});

function localDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function readEntry() {
  const chosenDate = date.validity.valid ? date.valueAsDate : null;
  return {
    ayah: ayah.value.trim(),
    date: chosenDate ? dateFormat.format(chosenDate) : '',
    reflection: reflection.value.trim(),
  };
}

function requireReflection() {
  const entry = readEntry();
  if (!entry.reflection) {
    reflection.focus();
    status.textContent = 'Write a reflection first.';
    return null;
  }
  if (!date.validity.valid) {
    date.focus();
    status.textContent = 'Choose a valid date with a year from 1 to 9999.';
    return null;
  }
  return entry;
}

function resetFeedback() {
  copyRevision += 1;
  status.textContent = '';
  manualCopy.hidden = true;
  copyText.value = '';
}

document.querySelector('#copy-entry').addEventListener('click', async () => {
  resetFeedback();
  const revision = copyRevision;
  const entry = requireReflection();
  if (!entry) return;

  const heading = [
    'Quran reflection',
    entry.date,
    entry.ayah ? `Ayah reference: ${entry.ayah}` : '',
  ].filter(Boolean).join('\n');
  const text = `${heading}\n\n${entry.reflection}`;

  try {
    await navigator.clipboard.writeText(text);
    if (revision === copyRevision) status.textContent = 'Reflection copied.';
  } catch {
    if (revision !== copyRevision) return;
    copyText.value = text;
    manualCopy.hidden = false;
    copyText.focus();
    copyText.select();
  }
});

function preparePrint(entry) {
  const hasReflection = Boolean(entry?.reflection);
  printDate.textContent = hasReflection
    ? (entry.date ? `Date: ${entry.date}` : '')
    : 'Date: ____________________';
  printAyah.textContent = hasReflection
    ? (entry.ayah ? `Ayah reference: ${entry.ayah}` : '')
    : 'Ayah reference: ____________________';
  printPrompts.hidden = hasReflection;
  printReflection.textContent = entry?.reflection ?? '';
  printLines.hidden = hasReflection;
}

window.addEventListener('beforeprint', () => {
  preparePrint(printMode === 'blank' ? null : readEntry());
});

window.addEventListener('afterprint', () => {
  printMode = undefined;
  preparePrint(null);
});

document.querySelector('#print-entry').addEventListener('click', () => {
  resetFeedback();
  const entry = requireReflection();
  if (!entry) return;
  printMode = 'entry';
  preparePrint(entry);
  window.print();
});

printBlank.addEventListener('click', () => {
  printMode = 'blank';
  preparePrint(null);
  window.print();
});

document.querySelector('#clear-entry').addEventListener('click', () => {
  const hasDetails = ayah.value || reflection.value || date.value !== localDate() || !date.validity.valid;
  if (hasDetails && !window.confirm('Clear this journal entry?')) return;
  ayah.value = '';
  reflection.value = '';
  date.value = localDate();
  resetFeedback();
  ayah.focus();
  status.textContent = 'Entry cleared.';
});

fields.addEventListener('input', resetFeedback);

date.value = localDate();
fields.disabled = false;
printBlank.hidden = false;
