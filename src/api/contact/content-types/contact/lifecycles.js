module.exports = {
  async afterCreate(event) {
    const { result } = event;
    const FirstName = result.FirstName;
    const LastName = result.LastName;
    const Phone = result.Phone;
    const email = result.Email;
    const Message = result.Message;

    setTimeout(async () => {
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
      } catch (err) {
        console.error("Hiba az auto-reply emailnel:", err);
      }

      try {
        /** "manm@anfeed.ro", "laszloi@anfeed.ro" */
        await strapi.plugins["email"].services.email.send({
          to: ["anfeed@anfeed.ro", "bedoa@anfeed.ro"],
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
        console.error("Hiba az admin notification emailnel:", err);
      }
    }, 0);
  },
};
