#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the MCQScreenTypeA.tsx file
const filePath = path.join(__dirname, 'src', 'pages', 'MCQScreenTypeA.tsx');
const fileContent = fs.readFileSync(filePath, 'utf8');

console.log('Fixing audio field syntax...');

// Fix the malformed audio field syntax
let updatedContent = fileContent;

// Pattern 1: Fix the malformed closing brace before audio field
// Replace: }
//          ,
//            audio: "..."
//          }),
// With:    },
//          audio: "..."
//        },
updatedContent = updatedContent.replace(/}\s*,\s*audio:\s*"([^"]*)"[\s\n]*}\),/g, '},\n          audio: "$1"\n        },');

// Also handle cases where there might be single quotes
updatedContent = updatedContent.replace(/}\s*,\s*audio:\s*'([^']*)'[\s\n]*}\),/g, '},\n          audio: \'$1\'\n        },');

// Fix any remaining malformed patterns
updatedContent = updatedContent.replace(/}\s*,\s*audio:\s*"([^"]*)"[\s\n]*}\),/g, '},\n          audio: "$1"\n        },');

// Write the updated content back to the file
fs.writeFileSync(filePath, updatedContent, 'utf8');

console.log('Successfully fixed audio field syntax!');

