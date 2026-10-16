'use strict';

const { ValidationError } = require('@strapi/utils').errors;

// Strapi 4 UID validation is global, but catalog URLs are scoped by locale.
module.exports = function catalogLifecycles(uid, codeField) {
  async function check(event, updating) {
    const { data = {}, where } = event.params;
    const existing = updating ? await strapi.db.query(uid).findOne({ where }) : null;
    const locale = data.locale || existing?.locale ||
      await strapi.plugin('i18n').service('locales').getDefaultLocale();
    for (const field of ['slug', codeField]) {
      const value = data[field] === undefined ? existing?.[field] : data[field];
      // Draft editing may leave required fields blank until publication.
      if (!value) continue;
      if (field === 'slug' && !/^[A-Za-z0-9_.~-]+$/.test(value)) {
        throw new ValidationError('Catalog URL contains unsupported characters');
      }
      const duplicate = await strapi.db.query(uid).findOne({
        where: {
          [field]: value,
          locale,
          ...(existing ? { id: { $ne: existing.id } } : {}),
        },
        select: ['id'],
      });
      if (duplicate) throw new ValidationError(`Catalog ${field} must be unique within the selected locale`);
    }
  }
  return {
    beforeCreate(event) { return check(event, false); },
    beforeUpdate(event) { return check(event, true); },
  };
};

