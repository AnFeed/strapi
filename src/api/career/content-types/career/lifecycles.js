module.exports = {
  async afterCreate(event) {
    const { result } = event;
    console.log(event);
    const { model } = event;
    const file = model.attributes;
    console.log(file);
    const name = result.name;
    const email = result.email;
    const phone = result.phone;
    try {
      await strapi.plugins["email-designer"].services.email.sendTemplatedEmail(
        {
          to: email,
          from: "levente.kiss@prismasolutions.ro",
        },
        {
          templateReferenceId: 2,
          subject: `Anfeed - Mulțumim că ați completat formularul`,
        },
        {
          name: name,
        }
      );

      await strapi.plugins["email"].services.email.send({
        to: "attila.szasz@prismasolutions.ro",
        from: "levente.kiss@prismasolutions.ro",
        subject: "Contact Form",
        html: `
          Nume: ${name}<br>
          Email: ${email}<br>
          Telefon: ${phone}<br>`,
        attachments: [
          {
            filename: file.name, // Set the filename
            content: Buffer.from(file.buffer, "base64"), // File content as Buffer
            encoding: "base64", // Encoding type
          },
        ],
      });
    } catch (err) {
      console.log(err);
    }
  },
};
