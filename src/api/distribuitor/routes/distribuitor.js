'use strict';

/**
 * distribuitor router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::distribuitor.distribuitor');
