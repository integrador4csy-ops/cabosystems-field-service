const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Expo injects the existing Android key into the react-native-maps plugin', () => {
  const root = path.join(__dirname, '..');
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  const googleServices = JSON.parse(fs.readFileSync(path.join(root, 'google-services.json'), 'utf8'));
  const expected = googleServices.client.flatMap(client => client.api_key || []).map(entry => entry.current_key).find(Boolean);
  const resolved = require('../app.config.js')({ config: app });
  const mapsPlugin = resolved.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'react-native-maps');
  assert.ok(expected);
  assert.ok(mapsPlugin);
  assert.equal(mapsPlugin[1].androidGoogleMapsApiKey, expected);
});
