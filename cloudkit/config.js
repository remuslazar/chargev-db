require('dotenv').config();

// @see https://developer.apple.com/documentation/cloudkitjs/cloudkit.containerconfig
module.exports = {
  // Replace this with a container that you own.
  containerIdentifier: process.env.CLOUDKIT_CONTAINER,

  environment: process.env.CLOUDKIT_ENV,

  serverToServerKeyAuth: {
    // Generate a key ID through CloudKit Dashboard and insert it here.
    keyID: process.env.CLOUDKIT_KEY_ID,

    // This should reference the private key file that you used to generate the above key ID.
    privateKeyFile: __dirname + '/eckey.pem'
  }
};