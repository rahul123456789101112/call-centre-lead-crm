'use strict';
// Prints the column tables of docs/COLUMN_DICTIONARY.md from FIELD_DICTIONARY in apps-script/Guide.gs,
// so the document and the Field Guide sheet always say the same thing.
// Usage: node tools/build-column-dictionary.js > /tmp/tables.md
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'apps-script');
const ctx = { console };
vm.createContext(ctx);
['Config.gs', 'Web.gs', 'Guide.gs'].forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
const esc = s => String(s).replace(/\|/g, '\\|');
const out = [];
const rows = vm.runInContext('fieldGuideRows_()', ctx).map((r, i) => (i === 4 ? ['E-N', 'Custom Field 1-10'].concat(r.slice(2)) : r))
  .filter((r, i) => i < 5 || i > 13);
const H = vm.runInContext('GUIDE_HEADERS', ctx);
out.push('### Summary', '', '| Col | Field | Type | Counsellors can edit? | Admins can edit? |', '|---|---|---|---|---|');
rows.forEach(r => out.push('| ' + [r[0], r[1], r[3], /^No/.test(r[8]) ? 'Yes (own leads)' : 'No', r[9]].map(esc).join(' | ') + ' |'));
out.push('');
rows.forEach(r => {
  out.push('### ' + r[0] + ' - ' + r[1], '', '| | |', '|---|---|');
  for (let k = 2; k < H.length; k++) out.push('| **' + H[k] + '** | ' + esc(r[k]) + ' |');
  out.push('');
});
out.push('### Lead Entry sheet (admins only)', '', '| Col | Field | Definition | Type | Format (example) |', '|---|---|---|---|---|');
vm.runInContext('ENTRY_DICTIONARY', ctx).forEach(r => out.push('| ' + r.map(esc).join(' | ') + ' |'));
console.log(out.join('\n'));
