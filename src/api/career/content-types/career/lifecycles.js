module.exports = {
  async afterCreate(event) {
    const { result } = event;
    const name = result.name;
    const email = result.email;
    const phone = result.phone;

    const existingData = await strapi.entityService.findOne(
      "api::career.career",
      result.id,
      { populate: ["file"] }
    );
    const mediaFileIsNullHere = existingData.file;

    setTimeout(async () => {
      const existingData = await strapi.entityService.findOne(
        "api::career.career",
        result.id,
        { populate: ["file"] }
      );
      const mediaFileIsAvailableHere = existingData.file;
      console.log(mediaFileIsAvailableHere);

      try {
        await strapi.plugins[
          "email-designer"
        ].services.email.sendTemplatedEmail(
          {
            to: email,
            from: "noreply@anfeed.ro",
          },
          {
            templateReferenceId: 4,
            subject: `Anfeed - Mulțumim că ați completat formularul`,
          },
          {
            name: name,
          }
        );

        await strapi.plugins["email"].services.email.send({
          to: "comenzi@anfeed.ro",
          from: "noreply@anfeed.ro",
          subject: "Contact Form",
          html: `
            Nume: ${name}<br>
            Email: ${email}<br>
            Telefon: ${phone}<br>`,
          attachments: [
            {
              filename: mediaFileIsAvailableHere.name,
              path: mediaFileIsAvailableHere.url,
            },
          ],
        });
      } catch (err) {
        console.log(err);
      }
    }, 5000);
  },
};
