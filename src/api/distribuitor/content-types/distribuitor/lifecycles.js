module.exports = {
  async afterCreate(event) {
    const { result } = event;
    const CompanyName = result.CompanyName;
    const TaxNumber = result.TaxNumber;
    const ContactPersonName = result.ContactPersonName;
    const PhoneNumber = result.PhoneNumber;
    const EmailAddress = result.EmailAddress;
    const City = result.City;
    const County = result.County;

    setTimeout(async () => {
      try {
        await strapi.plugins["email-designer"].services.email.sendTemplatedEmail(
          {
            to: EmailAddress,
            from: "noreply@anfeed.ro",
          },
          {
            templateReferenceId: 3,
            subject: `Anfeed Distribuitor`,
          }
        );
      } catch (err) {
        console.error("Hiba az auto-reply emailnel:", err);
      }

      try {
        /**"manm@anfeed.ro", "laszloi@anfeed.ro" */
        await strapi.plugins["email"].services.email.send({
          to: ["comenzi@anfeed.ro", "bedoa@anfeed.ro", "laszloi@anfeed.ro", "manm@anfeed.ro"],
          from: "noreply@anfeed.ro",
          subject: "Distribuitor",
          html: `
          CompanyName: ${CompanyName}<br>
          TaxNumber: ${TaxNumber}<br>
          ContactPersonName: ${ContactPersonName}<br>
          PhoneNumber: ${PhoneNumber}<br>
          EmailAddress: ${EmailAddress}<br>
          City: ${City}<br>
          County: ${County}<br>
          `,
        });
      } catch (err) {
        console.error("Hiba az admin notification emailnel:", err);
      }
    }, 0);
  },
};
