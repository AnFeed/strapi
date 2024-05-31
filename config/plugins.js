module.exports = ({ env }) => ({
  "users-permissions": {
    config: {
      jwtSecret: env("JWT_SECRET"),
    },
  },
  upload: {
    config: {
      provider: "cloudinary",
      providerOptions: {
        cloud_name: env("CLOUDINARY_NAME"),
        api_key: env("CLOUDINARY_KEY"),
        api_secret: env("CLOUDINARY_SECRET"),
      },
      actionOptions: {
        upload: {},
        delete: {},
      },
    },
  },
  "drag-drop-content-types": {
    enabled: true,
  },
  email: {
    config: {
      provider: "nodemailer",
      providerOptions: {
        host: "smtp.gmail.com",
        port: 465,
        auth: {
          user: "levente.kiss@prismasolutions.ro",
          pass: "igcx ncme grxj ehhr",
        },
        // ... any custom nodemailer options
      },
      settings: {
        defaultFrom: "levente.kiss@prismasolutions.ro",
        defaultReplyTo: "levente.kiss@prismasolutions.ro",
      },
    },
  },
});
