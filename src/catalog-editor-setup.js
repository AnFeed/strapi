'use strict';

const VERSION = 1;
const definitions = {
  'api::catalog-product.catalog-product': {
    main: 'name', sort: 'productCode',
    list: ['productCode', 'name', 'category', 'availability', 'updatedAt'],
    rows: [
      [['productCode', 4], ['name', 8]],
      [['category', 6], ['subcategory', 6]],
      [['availability', 4], ['feedType', 4], ['lifeStage', 4]],
      [['introduction', 12]], [['image', 6], ['imageAlt', 6]],
      [['forms', 12]], [['packages', 12]], [['ingredients', 12]],
      [['analyticalValues', 12]], [['benefits', 12]], [['usage', 12]],
      [['labelPdf', 6], ['labelFileName', 6]], [['relatedProductCodes', 12]],
      [['slug', 12]], [['seoTitle', 12]], [['metaDescription', 12]],
    ],
    fields: {
      productCode: ['Kód / Cod', 'Állandó azonosító, közös HU/RO. / Identificator comun HU/RO.'],
      name: ['Név / Denumire', 'Az éppen kiválasztott nyelvű terméknév. / Denumirea în limba selectată.'],
      category: ['Kategória / Categorie', 'A termékkel azonos nyelvű kategóriát válassz. / Alege categoria în aceeași limbă.'],
      subcategory: ['Alkategória / Subcategorie', 'A kategórián belüli csoport neve. / Grupul din categorie.'],
      availability: ['Elérhetőség / Disponibilitate', 'in_store = boltban / în magazin; preorder = rendelésre / la comandă. Az üres érték egyeztetést jelent.'],
      feedType: ['Típus / Tip', 'Például takarmány, koncentrátum, premix. / De exemplu furaj, concentrat, premix.'],
      lifeStage: ['Életszakasz / Etapă', 'Az életkor vagy felhasználási időszak, a kiválasztott nyelven.'],
      introduction: ['Rövid bevezető / Introducere', 'A termékkártyán is megjelenő rövid leírás. / Descrierea scurtă de pe card.'],
      image: ['Fő kép / Imagine principală', 'Négyzetes termékkép, közös HU/RO. / Imagine pătrată, comună HU/RO.'],
      imageAlt: ['Kép leírása / Text alternativ', 'A kép rövid, értelmes leírása a kiválasztott nyelven.'],
      forms: ['Formák és képek / Forme și imagini', 'Minden formához külön kép adható. Közös HU/RO. / Câte o imagine pentru fiecare formă; comun HU/RO.'],
      packages: ['Kiszerelések / Ambalaje', 'Csak a ténylegesen elérhető kiszereléseket add hozzá. Közös HU/RO. / Adaugă ambalajele disponibile.'],
      ingredients: ['Összetevők / Ingrediente', 'A kiválasztott nyelven. / În limba selectată.'],
      analyticalValues: ['Beltartalom / Valori analitice', 'Közös számadatok és mértékegységek HU/RO; az előnézet a megnevezéseket fordítja.'],
      benefits: ['Előnyök / Avantaje', 'Termékspecifikus előnyök, a kiválasztott nyelven.'],
      usage: ['Használat és figyelmeztetések / Utilizare', 'Az etetési útmutató és minden szükséges figyelmeztetés helye.'],
      labelPdf: ['Terméklap PDF / Fișă PDF', 'Jóváhagyott PDF, közös HU/RO. / Fișier PDF aprobat, comun HU/RO.'],
      labelFileName: ['PDF fájlnév / Nume fișier PDF', 'A letöltéshez használt fájlnév. / Numele folosit la descărcare.'],
      relatedProductCodes: ['Kapcsolódó kódok / Coduri asociate', 'Termékkódok vesszővel elválasztva. / Coduri de produs separate prin virgulă.'],
      slug: ['URL-azonosító / Identificator URL', 'Kisbetű, szám, kötőjel; nyelvenként egyedi. Élesítés után csak átirányítással módosítsd.'],
      seoTitle: ['SEO-cím / Titlu SEO', 'A keresési találat címe a kiválasztott nyelven.'],
      metaDescription: ['Meta leírás / Descriere meta', 'A keresési találat rövid leírása a kiválasztott nyelven.'],
      updatedAt: ['Módosítva / Actualizat'],
    },
  },
  'api::catalog-category.catalog-category': {
    main: 'name', sort: 'categoryCode',
    list: ['categoryCode', 'name', 'slug', 'updatedAt'],
    rows: [[['categoryCode', 4], ['name', 8]], [['introduction', 12]], [['products', 12]], [['slug', 12]], [['seoTitle', 12]], [['metaDescription', 12]]],
    fields: {
      categoryCode: ['Kód / Cod', 'Állandó kategóriaazonosító, közös HU/RO.'],
      name: ['Név / Denumire', 'A kategória neve a kiválasztott nyelven.'],
      introduction: ['Bevezető / Introducere', 'A kategóriaoldal bevezetője a kiválasztott nyelven.'],
      products: ['Termékek / Produse', 'Az ide kapcsolt, azonos nyelvű termékek.'],
      slug: ['URL-azonosító / Identificator URL', 'Nyelvenként egyedi URL-azonosító.'],
      seoTitle: ['SEO-cím / Titlu SEO'],
      metaDescription: ['Meta leírás / Descriere meta'],
      updatedAt: ['Módosítva / Actualizat'],
    },
  },
  'catalog.form-variant': {
    component: true, main: 'form', rows: [[['form', 12]], [['image', 12]]],
    fields: { form: ['Forma / Formă', 'pellet = granulált / granulat; meal = dercés / făinos; crumbled = morzsázott / brizurat.'], image: ['Kép / Imagine', 'Az adott forma négyzetes képe. / Imagine pătrată pentru această formă.'] },
  },
  'catalog.package-option': {
    component: true, main: 'size', rows: [[['size', 12]]],
    fields: { size: ['Kiszerelés / Ambalaj', 'kg_5 = 5 kg; kg_20 = 20 kg; kg_25 = 25 kg; big_bag = Big Bag; bulk = ömlesztett / vrac.'] },
  },
};

function buildConfiguration(current, definition) {
  const config = JSON.parse(JSON.stringify(current));
  config.settings = { ...config.settings, mainField: definition.main };
  if (!definition.component) Object.assign(config.settings, { pageSize: 50, searchable: true, filterable: true, defaultSortBy: definition.sort, defaultSortOrder: 'ASC' });
  config.layouts = { ...config.layouts, edit: definition.rows.map(row => row.map(([name, size]) => ({ name, size }))) };
  if (definition.list) config.layouts.list = definition.list;
  for (const [name, [label, description = '']] of Object.entries(definition.fields)) {
    if (!config.metadatas[name]) continue;
    config.metadatas[name].edit = { ...config.metadatas[name].edit, label, description };
    config.metadatas[name].list = { ...config.metadatas[name].list, label };
    if (name === 'category' || name === 'products') config.metadatas[name].edit.mainField = 'name';
  }
  config.options = { ...config.options, catalogEditorVersion: VERSION };
  return config;
}

async function runCatalogEditorSetup(strapi) {
  if (process.env.CATALOG_EDITOR_SETUP !== '1') return;
  // Opt-in setup only touches the two new catalog models and their components.
  // It never imports entries, changes roles, creates tokens or edits legacy views.
  for (const [uid, definition] of Object.entries(definitions)) {
    const service = strapi.plugin('content-manager').service(definition.component ? 'components' : 'content-types');
    const model = definition.component ? service.findComponent(uid) : service.findContentType(uid);
    const current = await service.findConfiguration(model);
    if (current.options?.catalogEditorVersion === VERSION) continue;
    const next = buildConfiguration(current, definition);
    const fields = next.layouts.edit.flat().map(field => field.name);
    const expected = Object.keys(model.attributes).filter(name => !['id', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy', 'localizations', 'locale'].includes(name));
    if (expected.length !== fields.length || expected.some(name => !fields.includes(name)) || new Set(fields).size !== fields.length) throw Error('Catalog editor layout must include each content field exactly once');
    await service.updateConfiguration(model, next);
    const saved = await service.findConfiguration(model);
    if (JSON.stringify(saved.layouts) !== JSON.stringify(next.layouts)) throw Error('Catalog editor layout verification failed');
  }
  strapi.log.info('[catalog-editor] verified catalog-only bilingual field labels, complete edit layouts and searchable lists');
}

module.exports = { buildConfiguration, definitions, runCatalogEditorSetup };

