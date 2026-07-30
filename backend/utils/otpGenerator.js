const crypto = require("crypto");

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const generateOTPExpiry = (minutes = 10) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

module.exports = { generateOTP, generateOTPExpiry };
