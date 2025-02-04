const bcrypt = require("bcryptjs");

// Hash Function
exports.hashPassword = (password) => {
  return new Promise((resolve, reject) => {
    bcrypt.genSalt(10, (err, salt) => {
      if (err) return reject(err); // Return to stop execution on error

      bcrypt.hash(password, salt, (err, hash) => {
        if (err) return reject(err); // Return to stop execution on error

        resolve(hash);
      });
    });
  });
};

// Compare Function
exports.comparePassword = async (password, hashed) => {
  try {
    return await bcrypt.compare(password, hashed);
  } catch (error) {
    throw error;
  }
};
