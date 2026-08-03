'use strict';

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap(/*{ strapi }*/) {
    const net = require('net');

    console.log("=== HALOZATI TESZT INDUL ===");
    const client = new net.Socket();
    client.setTimeout(5000); // 5 masodperc timeout

    client.connect(587, 'smtp.gmail.com', function() {
      console.log('>>> SIKER: Kapcsolodas az smtp.gmail.com:587-hez SIKERES! A port nyitva van.');
      client.destroy(); 
    });

    client.on('error', function(err) {
      console.error('>>> HIBA: Nem sikerult kapcsolodni az smtp.gmail.com:587-hez.', err.message);
    });

    client.on('timeout', function() {
      console.error('>>> TIMEOUT: Idotullepes az smtp.gmail.com:587-hez! A Railway vagy a Google blokkolja a portot.');
      client.destroy();
    });
  },
};
