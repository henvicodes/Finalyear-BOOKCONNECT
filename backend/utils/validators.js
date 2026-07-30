const { body, validationResult } = require("express-validator");

const validateRegister = [
  body("name").notEmpty().withMessage("Name is required").trim(),
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("role")
    .optional()
    .isIn(["reader", "author", "publisher"])
    .withMessage("Invalid role selected"),
];

const validateLogin = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors
        .array()
        .map((err) => ({ field: err.path, message: err.msg })),
    });
  }
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validate,
};
