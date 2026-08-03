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
        /**"manm@anfeed.ro", "laszloi@anfeed.ro" */
        await strapi.plugins["email"].services.email.send({
          to: ["anfeed@anfeed.ro", "bedoa@anfeed.ro"],
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
        console.log(err);
      }
    }, 0);
  },
};
