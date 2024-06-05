'use strict';

/**
 * about-number service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::about-number.about-number');
