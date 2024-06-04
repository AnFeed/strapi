import type { Schema, Attribute } from '@strapi/strapi';

export interface ProductDescription extends Schema.Component {
  collectionName: 'components_product_descriptions';
  info: {
    displayName: 'Description';
  };
  attributes: {
    description: Attribute.RichText;
  };
}

export interface ProductImagine extends Schema.Component {
  collectionName: 'components_product_imagines';
  info: {
    displayName: 'imagine';
  };
  attributes: {
    image1: Attribute.Media & Attribute.Required;
    image2: Attribute.Media & Attribute.Required;
  };
}

export interface ProductTitle extends Schema.Component {
  collectionName: 'components_product_titles';
  info: {
    displayName: 'title';
  };
  attributes: {
    title: Attribute.String;
  };
}

export interface SharedMetaSocial extends Schema.Component {
  collectionName: 'components_shared_meta_socials';
  info: {
    displayName: 'metaSocial';
    icon: 'project-diagram';
  };
  attributes: {
    socialNetwork: Attribute.Enumeration<['Facebook', 'Twitter']> &
      Attribute.Required;
    title: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        maxLength: 60;
      }>;
    description: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        maxLength: 65;
      }>;
    image: Attribute.Media;
  };
}

export interface SharedSeo extends Schema.Component {
  collectionName: 'components_shared_seos';
  info: {
    displayName: 'seo';
    icon: 'search';
  };
  attributes: {
    metaTitle: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        maxLength: 60;
      }>;
    metaDescription: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 50;
        maxLength: 160;
      }>;
    metaImage: Attribute.Media;
    metaSocial: Attribute.Component<'shared.meta-social', true>;
    keywords: Attribute.Text;
    metaRobots: Attribute.String;
    structuredData: Attribute.JSON;
    metaViewport: Attribute.String;
    canonicalURL: Attribute.String;
  };
}

export interface TableColumn extends Schema.Component {
  collectionName: 'components_table_columns';
  info: {
    displayName: 'Column';
  };
  attributes: {
    value: Attribute.String;
  };
}

export interface TableRow extends Schema.Component {
  collectionName: 'components_table_rows';
  info: {
    displayName: 'Row';
  };
  attributes: {
    column: Attribute.Component<'table.column', true>;
  };
}

export interface TableTable extends Schema.Component {
  collectionName: 'components_table_tables';
  info: {
    displayName: 'Table';
    icon: 'apps';
  };
  attributes: {
    row: Attribute.Component<'table.row', true>;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'product.description': ProductDescription;
      'product.imagine': ProductImagine;
      'product.title': ProductTitle;
      'shared.meta-social': SharedMetaSocial;
      'shared.seo': SharedSeo;
      'table.column': TableColumn;
      'table.row': TableRow;
      'table.table': TableTable;
    }
  }
}
