'use strict';

const { runCatalogStagingImport } = require('./catalog-staging-import');
const { runCatalogEditorSetup } = require('./catalog-editor-setup');

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * The catalog import is inert unless the explicit staging-only environment
   * guards are enabled. Production therefore keeps the normal no-op bootstrap.
   */
  async bootstrap({ strapi }) {
    await runCatalogStagingImport(strapi);
    await runCatalogEditorSetup(strapi);
  },
};
