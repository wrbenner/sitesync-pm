/**
 * Local ESLint plugin for SiteSync-specific lint rules.
 *
 * Adding a rule:
 *   1. Drop `<rule-name>.js` in this directory exporting a default rule object.
 *   2. Import and add it to `rules` below.
 *   3. Wire it into `eslint.config.js` under the `'sitesync'` plugin
 *      namespace and set its severity.
 */

import noRawUserIdInJsx from './no-raw-user-id-in-jsx.js';

export default {
  rules: {
    'no-raw-user-id-in-jsx': noRawUserIdInJsx,
  },
};
