"use strict";

async function notifyWebsite(event) {
  const url = process.env.SEASONAL_BANNER_REVALIDATION_URL;
  const secret = process.env.STRAPI_SEASONAL_BANNER_WEBHOOK_SECRET;
  if (!url || !secret) return;

  const body = JSON.stringify({ event, model: "seasonal-banner" });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) return;
      if (response.status < 500 && response.status !== 429) {
        strapi.log.warn(`[seasonal-banner] Website refresh rejected (${response.status})`);
        return;
      }
    } catch {
      // Retry once if the website could not be reached.
    }
  }

  strapi.log.warn("[seasonal-banner] Website refresh failed after two attempts");
}

module.exports = {
  async afterCreate() {
    await notifyWebsite("entry.create");
  },
  async afterUpdate() {
    await notifyWebsite("entry.update");
  },
  async afterDelete() {
    await notifyWebsite("entry.delete");
  },
};
