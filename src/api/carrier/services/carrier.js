'use strict';

/**
 * carrier service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::carrier.carrier');
