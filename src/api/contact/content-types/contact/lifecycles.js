module.exports = {
  async afterCreate(event) {
    const { result } = event;
    const FirstName = result.FirstName;
    const LastName = result.LastName;
    const Phone = result.Phone;
    const email = result.Email;
    const Message = result.Message;

    try {
      await strapi.plugins["email-designer"].services.email.sendTemplatedEmail(
        {
          to: email,
          from: "noreply@anfeed.ro",
        },
        {
          templateReferenceId: 2,
          subject: `Anfeed Contact`,
        }
      );
      await strapi.plugins["email"].services.email.send({
        to: "comenzi@anfeed.ro",
        from: "noreply@anfeed.ro",
        subject: "Contact",
        html: `
        FirstName: ${FirstName}<br>
        LastName: ${LastName}<br>
        Phone: ${Phone}<br>
        Email: ${email}<br>
        Message: ${Message}<br>
        `,
      });
    } catch (err) {
      console.log(err);
    }
  },
};
