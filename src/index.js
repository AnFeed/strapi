'use strict';

const { runCatalogEditorSetup } = require('./catalog-editor-setup');

module.exports = {
  register() {},
  async bootstrap({ strapi }) {
    try {
      await runCatalogEditorSetup(strapi);
    } catch (error) {
      // An optional editor-layout failure must not prevent the existing CMS
      // and its public API from starting. Editors can configure the new views
      // manually; no content, credentials or permissions are modified here.
      strapi.log.error('[catalog-editor] optional layout setup failed; existing CMS startup continues. Configure the new catalog views manually before editing.');
    }
  },
};
