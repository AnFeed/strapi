module.exports = {
  async afterCreate(event) {
    const { result } = event;
    const Email = result.Email;

    try {
      await strapi.plugins["email-designer"].services.email.sendTemplatedEmail(
        {
          to: Email,
          from: "noreply@anfeed.ro",
        },
        {
          templateReferenceId: 1,
          subject: `Anfeed Newsletter`,
        }
      );
      await strapi.plugins["email"].services.email.send({
        to: "comenzi@anfeed.ro",
        from: "noreply@anfeed.ro",
        subject: "Newsletter",
        html: `
        Email: ${Email}`,
      });
    } catch (err) {
      console.log(err);
    }
  },
};
