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
          user: "noreply@anfeed.ro",
          pass: "hzzh pzab fxqo wugk",
        },
        // ... any custom nodemailer options
      },
      settings: {
        defaultFrom: "noreply@anfeed.ro",
        defaultReplyTo: "anfeed@anfeed.ro",
      },
    },
  },
});
