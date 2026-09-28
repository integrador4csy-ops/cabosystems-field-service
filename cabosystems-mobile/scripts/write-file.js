const fs = require('fs');
const filePath = process.argv[2];
const b64 = process.argv[3];
fs.writeFileSync(filePath, Buffer.from(b64, 'base64').toString('utf8'), 'utf8');
console.log('Successfully wrote ' + filePath);
