import mongoose from "mongoose";

// import bcrypt from 'bcryptjs';
// import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      require: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    email: {
      type: String,
      require: true,
      trim: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      require: [true, "Password is required"],
      minlength: [8, "Password must be at least 6 characters"],
    },

    // refreshTokens: [
    //   {
    //     type: String,
    //   },
    // ],
    role:{
        type : String,
        default :"user"

    }
  },
  { timestamps: true }
);

// // Hash password before saving the user
// userSchema.pre('save', async function (next) {
//   if (!this.isModified('password')) {
//     return next();
//   }
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

// // Method to compare password
// userSchema.methods.isPasswordMatch = async function (password) {
//   return bcrypt.compare(password, this.password);
// };

// // Method to generate JWT
// userSchema.methods.generateAccessToken = function () {
//   return jwt.sign(
//     {
//       id: this._id,
//       username: this.username,
//       email: this.email,
//       fullName: this.fullName,
//     },
//     process.env.ACCESS_TOKEN_SECRET,
//     {
//       expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
//     }
//   );
// };

// userSchema.methods.generateRefreshToken = function () {
//   return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
//     expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
//   });
// };

export const User = mongoose.model("User", userSchema);
