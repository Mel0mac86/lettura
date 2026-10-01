// Extends app.json. EXPO_BASE_URL lets the web build live in a sub-path,
// e.g. GitHub Pages: https://<user>.github.io/lettura/ → EXPO_BASE_URL=/lettura
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || '' },
});
