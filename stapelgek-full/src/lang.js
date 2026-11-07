// English by default; Dutch when the phone is set to Dutch, or when picked in the settings.
import { store } from './store.js';

const saved = store.get('stapelgekfull-lang', '');
const phone = (navigator.languages && navigator.languages[0]) || navigator.language || '';
export const NL = saved ? saved === 'nl' : /^nl\b/i.test(phone);
export const tr = (en, nl) => (NL ? nl : en);
export const NAME = 'Stacking Mad';
document.documentElement.lang = NL ? 'nl' : 'en';

// The page is written in English; elements carry their Dutch text in data-nl and data-nl-label.
if (NL) {
  for (const el of document.querySelectorAll('[data-nl]')) el.innerHTML = el.dataset.nl;
  for (const el of document.querySelectorAll('[data-nl-label]')) el.setAttribute('aria-label', el.dataset.nlLabel);
}

export function switchLanguage() {
  store.set('stapelgekfull-lang', NL ? 'en' : 'nl');
  location.reload();
}
