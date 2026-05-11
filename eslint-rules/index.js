/**
 * Local ESLint plugin for SiteSync-specific lint rules.
 *
 * Adding a rule:
 *   1. Drop `<rule-name>.js` in this directory exporting a default rule object.
 *   2. Import and add it to `rules` below.
 *   3. Wire it into `eslint.config.js` under the `'sitesync'` plugin
 *      namespace and set its severity.
 */

import noRawIngest from './no-raw-ingest.js';
import noRawIrisSystem from './no-raw-iris-system.js';
import noRawUserIdInJsx from './no-raw-user-id-in-jsx.js';

export default {
  rules: {
    'no-raw-ingest': noRawIngest,
    'no-raw-iris-system': noRawIrisSystem,
    'no-raw-user-id-in-jsx': noRawUserIdInJsx,
  },
};
