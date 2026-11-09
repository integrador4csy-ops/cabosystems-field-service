const fs = require('node:fs');
const path = require('node:path');

function readFirebaseAndroidApiKey(projectRoot) {
  const googleServicesPath = path.join(projectRoot, 'google-services.json');
  const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
  return googleServices.client
    ?.flatMap(client => client.api_key || [])
    .map(entry => entry.current_key)
    .find(Boolean);
}

module.exports = ({ config }) => {
  const androidGoogleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY || readFirebaseAndroidApiKey(__dirname);

  if (!androidGoogleMapsApiKey) {
    throw new Error('Google Maps Android API key is not configured.');
  }

  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      [
        'react-native-maps',
        { androidGoogleMapsApiKey },
      ],
    ],
  };
};
