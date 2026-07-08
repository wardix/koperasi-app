const fs = require('fs');
const path = require('path');

const components = [
  'AddLoanDialog.tsx',
  'AddMemberDialog.tsx',
  'ComingSoon.tsx',
  'EditMemberDialog.tsx',
  'ErrorBoundary.tsx',
  'ErrorBoundary.test.tsx',
  'LoanDetailDialog.tsx',
  'TransactionHistoryDialog.tsx',
  'UpdateSavingsDialog.tsx',
  'Shell.tsx',
  'Shell.test.tsx'
];

const pages = [
  'Loans.tsx',
  'Login.tsx',
  'Login.test.tsx',
  'Members.tsx',
  'Members.test.tsx',
  'Settings.tsx',
  'SHU.tsx'
];

fs.mkdirSync('src/components', { recursive: true });
fs.mkdirSync('src/pages', { recursive: true });

components.forEach(f => {
  if (fs.existsSync(`src/${f}`)) fs.renameSync(`src/${f}`, `src/components/${f}`);
});

pages.forEach(f => {
  if (fs.existsSync(`src/${f}`)) fs.renameSync(`src/${f}`, `src/pages/${f}`);
});

function replaceInFile(filePath, searchRegex, replacement) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const newContent = content.replace(searchRegex, replacement);
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
  }
}

// Update imports in App.tsx
let appContent = fs.readFileSync('src/App.tsx', 'utf8');
appContent = appContent.replace(/from '\.\/Shell'/g, "from './components/Shell'");
appContent = appContent.replace(/from '\.\/Members'/g, "from './pages/Members'");
appContent = appContent.replace(/from '\.\/Loans'/g, "from './pages/Loans'");
appContent = appContent.replace(/from '\.\/Settings'/g, "from './pages/Settings'");
appContent = appContent.replace(/from '\.\/SHU'/g, "from './pages/SHU'");
appContent = appContent.replace(/from '\.\/Login'/g, "from './pages/Login'");
appContent = appContent.replace(/from '\.\/ErrorBoundary'/g, "from './components/ErrorBoundary'");
fs.writeFileSync('src/App.tsx', appContent);

// Update imports in pages (e.g. Members.tsx, Loans.tsx, etc.)
pages.filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx')).forEach(page => {
  const pagePath = `src/pages/${page}`;
  let content = fs.readFileSync(pagePath, 'utf8');
  
  // Adjust config import
  content = content.replace(/from '\.\/config'/g, "from '../config'");
  
  // Adjust hooks import
  content = content.replace(/from '\.\/hooks\//g, "from '../hooks/");
  
  // Adjust component imports (if they exist)
  components.forEach(c => {
    const cName = c.replace('.tsx', '');
    const regex = new RegExp(`from '\\.\\/${cName}'`, 'g');
    content = content.replace(regex, `from '../components/${cName}'`);
  });

  fs.writeFileSync(pagePath, content);
});

// Update imports in tests
replaceInFile('src/pages/Members.test.tsx', /from '\.\/Members'/g, "from './Members'");
replaceInFile('src/pages/Login.test.tsx', /from '\.\/Login'/g, "from './Login'");
replaceInFile('src/components/Shell.test.tsx', /from '\.\/Shell'/g, "from './Shell'");
replaceInFile('src/components/ErrorBoundary.test.tsx', /from '\.\/ErrorBoundary'/g, "from './ErrorBoundary'");
