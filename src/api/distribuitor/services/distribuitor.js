'use strict';

/**
 * distribuitor service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::distribuitor.distribuitor');
