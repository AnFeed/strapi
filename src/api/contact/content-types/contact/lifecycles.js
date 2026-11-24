module.exports = {
  async afterCreate(event) {
    const { result } = event;
    const FirstName = result.FirstName;
    const LastName = result.LastName;
    const Phone = result.Phone;
    const email = result.Email;
    const Message = result.Message;
    // Preview submissions are explicitly marked by the server, never by the form UI.
    const isFarmPreviewTest = typeof Message === "string" && Message.startsWith("[ANFEED FARM PREVIEW TEST]\\n");

    setTimeout(async () => {
      if (email && !isFarmPreviewTest) {
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
      }

      try {
        /** "manm@anfeed.ro", "laszloi@anfeed.ro" */
        await strapi.plugins["email"].services.email.send({
          to: isFarmPreviewTest
            ? ["bedoa@anfeed.ro"]
            : ["comenzi@anfeed.ro", "bedoa@anfeed.ro", "laszloi@anfeed.ro", "manm@anfeed.ro"],
          from: "noreply@anfeed.ro",
          subject: isFarmPreviewTest ? "[TEST] AnFeed farm ajánlatkérés" : "Contact",
          html: `
          FirstName: ${FirstName}<br>
          LastName: ${LastName}<br>
          Phone: ${Phone}<br>
          Email: ${email || "—"}<br>
          Message: ${Message}<br>
          `,
        });
      } catch (err) {
        console.error("Hiba az admin notification emailnel:", err);
      }
    }, 0);
  },
};
