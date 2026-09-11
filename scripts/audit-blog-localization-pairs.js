"use strict";

/**
 * Dry-run audit for linking existing HU/RO blog localizations.
 *
 * IMPORTANT:
 * - This script does NOT write to the database.
 * - It is not imported by Strapi bootstrap and does not run on deploy.
 * - Run manually from a Strapi console with:
 *
 *   const { auditBlogLocalizationPairs } = require("./scripts/audit-blog-localization-pairs");
 *   await auditBlogLocalizationPairs(strapi);
 */

const BLOG_UID = "api::blog.blog";

const EXPECTED_PAIRS = [
  {
    ro: { id: 64, slug: "schimbare-furaj-vitei-peste-3-luni-melasa" },
    hu: { id: 63, slug: "takarmanyvaltas-3-honapos-borjak-melasz" },
    topic: "calf-feed-transition-molasses",
  },
  {
    ro: { id: 62, slug: "eficienta-furajarii-vaci-de-lapte" },
    hu: { id: 61, slug: "takarmanyhasznulas-tejelo-teheneknel" },
    topic: "dairy-feed-efficiency",
  },
  {
    ro: { id: 51, slug: "de-ce-nu-este-suficient-un-furaj-bun" },
    hu: { id: 52, slug: "tojotap-0-70-hetes-korig-miert-nem-eleg-egyetlen-jo-tap" },
    topic: "layers-0-70-weeks",
  },
  {
    ro: { id: 60, slug: "furajul-se-altereaza-7-semne-importante" },
    hu: { id: 59, slug: "takarmany-romlas-jelei" },
    topic: "feed-spoilage-signs",
  },
  {
    ro: {
      id: 55,
      slug: "probleme-de-crestere-la-miei-cum-sustinem-dezvoltarea-din-prima-zi",
    },
    hu: {
      id: 56,
      slug: "a-baranyok-noevekedesi-problemai-hogyan-tamogassuk-a-fejlodest-az-elso-naptol",
    },
    topic: "lamb-growth",
  },
  {
    ro: {
      id: 49,
      slug: "recuperarea-investitiei-intr-un-robot-de-muls-nu-este-accelerata-de-masina-ci-de-ceea-ce-mananca-vaca",
    },
    hu: {
      id: 50,
      slug: "a-fejorobot-megterueleset-nem-a-gep-gyorsitja-hanem-amit-a-tehen-eszik",
    },
    topic: "milking-robot-roi",
  },
  {
    ro: {
      id: 45,
      slug: "cum-au-obtinut-doi-fermieri-din-judetul-sibiu-rezultate-masurabile-cu-furajele-an-feed",
    },
    hu: {
      id: 46,
      slug: "hogyan-ert-el-ket-gazda-merheto-eredmenyeket-an-feed-takarmannyal-valos-tapasztalatok-szeben-megyebol",
    },
    topic: "sibiu-testimonial",
  },
  {
    ro: {
      id: 53,
      slug: "un-taur-frumos-nu-inseamna-neaparat-un-taur-bun-de-reproductie",
    },
    hu: {
      id: 54,
      slug: "a-szep-bika-meg-nem-biztos-hogy-jo-tenyeszbika",
    },
    topic: "breeding-bull",
  },
  {
    ro: { id: 40, slug: "ce-se-afla-in-spatele-logo-ului-rosu" },
    hu: { id: 41, slug: "mi-van-a-piros-logo-moegoett" },
    topic: "red-logo",
  },
  {
    ro: { id: 47, slug: "de-ce-pierde-anual-milioane-o-ferma-de-ovine" },
    hu: { id: 48, slug: "miert-veszit-evente-milliokat-egy-juhfarm-a-takarmanyon" },
    topic: "sheep-farm-feed-losses",
  },
  {
    ro: { id: 43, slug: "ne-vedem-la-mures-agro-expo-2026" },
    hu: { id: 44, slug: "talalkozzunk-az-agro-expo-maros-2026-on" },
    topic: "mures-agro-expo-2026",
  },
];

async function readBlog(strapi, id) {
  return strapi.db.query(BLOG_UID).findOne({
    where: { id },
    populate: ["localizations"],
  });
}

function compactLocalization(entry) {
  return {
    id: entry?.id ?? null,
    locale: entry?.locale ?? null,
    slug: entry?.Slug ?? null,
    name: entry?.Name ?? null,
  };
}

function localizationIds(entry) {
  if (!Array.isArray(entry?.localizations)) {
    return [];
  }

  return entry.localizations
    .map((item) => item?.id)
    .filter((id) => Number.isInteger(id))
    .sort((a, b) => a - b);
}

function validateSide(entry, expected, expectedLocale, oppositeId) {
  const checks = {
    exists: Boolean(entry),
    idMatches: entry?.id === expected.id,
    localeMatches: entry?.locale === expectedLocale,
    slugMatches: entry?.Slug === expected.slug,
  };

  const linkedIds = localizationIds(entry);
  const hasUnexpectedLinks = linkedIds.some((id) => id !== oppositeId);
  const alreadyLinkedToOpposite = linkedIds.includes(oppositeId);

  return {
    checks,
    linkedIds,
    alreadyLinkedToOpposite,
    hasUnexpectedLinks,
    safeIdentity:
      checks.exists &&
      checks.idMatches &&
      checks.localeMatches &&
      checks.slugMatches,
  };
}

async function auditBlogLocalizationPairs(strapiInstance) {
  if (!strapiInstance?.db?.query) {
    throw new Error("A running Strapi instance is required.");
  }

  const results = [];

  for (const pair of EXPECTED_PAIRS) {
    const [roEntry, huEntry] = await Promise.all([
      readBlog(strapiInstance, pair.ro.id),
      readBlog(strapiInstance, pair.hu.id),
    ]);

    const ro = validateSide(roEntry, pair.ro, "ro", pair.hu.id);
    const hu = validateSide(huEntry, pair.hu, "hu", pair.ro.id);

    const bothAlreadyLinked =
      ro.alreadyLinkedToOpposite && hu.alreadyLinkedToOpposite;

    const neitherHasLinks =
      ro.linkedIds.length === 0 && hu.linkedIds.length === 0;

    const safeToLink =
      ro.safeIdentity &&
      hu.safeIdentity &&
      !ro.hasUnexpectedLinks &&
      !hu.hasUnexpectedLinks &&
      !bothAlreadyLinked &&
      neitherHasLinks;

    const status = bothAlreadyLinked
      ? "already-linked"
      : safeToLink
        ? "safe-to-link"
        : "review-required";

    results.push({
      topic: pair.topic,
      status,
      safeToLink,
      expected: pair,
      ro: {
        actual: compactLocalization(roEntry),
        ...ro,
      },
      hu: {
        actual: compactLocalization(huEntry),
        ...hu,
      },
    });
  }

  const summary = {
    totalPairs: results.length,
    safeToLink: results.filter((item) => item.status === "safe-to-link").length,
    alreadyLinked: results.filter((item) => item.status === "already-linked").length,
    reviewRequired: results.filter((item) => item.status === "review-required").length,
  };

  const output = { summary, results };

  console.dir(output, { depth: null });
  return output;
}

module.exports = {
  EXPECTED_PAIRS,
  auditBlogLocalizationPairs,
};
