import { mkdirSync, copyFileSync } from 'fs';

mkdirSync('www', { recursive: true });
copyFileSync('html/index.html', 'www/index.html');
copyFileSync('dist/solver.bundle.js', 'www/solver.bundle.js');
