const fs = require('fs');

const replaceInFile = (file, replacements) => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;
  for (const { regex, replacement } of replacements) {
    newContent = newContent.replace(regex, replacement);
  }
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
  }
};

// 1. main.tsx
replaceInFile('src/main.tsx', [
  { regex: /import {apiFetch} from '.\/config'/g, replacement: "import {api} from './services/api'" },
  { regex: /apiFetch\('\/api\/auth\/verify'\)/g, replacement: "api.get('/api/auth/verify')" },
  { regex: /apiFetch\('\/api\/logout', { method: 'POST' }\)/g, replacement: "api.post('/api/logout')" },
  { regex: /if \(res.ok\)/g, replacement: "if (res && res.success)" } // wait, verify returns JSON { success: true }
]);

// Wait, the original code in main.tsx did: 
// res.ok -> setIsAuthenticated(true).
// With api.get(), if it succeeds, it returns the json and doesn't throw. If it fails, it throws an error.
// Let's modify main.tsx separately with multi_replace_file_content since logic changes slightly.
