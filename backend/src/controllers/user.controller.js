import TryCatch from "../middlewares/TryCatch.js";
import sanitize from "mongo-sanitize";
import { User } from "../models/user.model.js";
import { registerSchema } from "../utils/zod.js";

export const registerUser = TryCatch(async (req, res) => {
  //    const {name , email , password}  = sanitize(req.body);  /// to aviod the $ from hacker

  const cleandata = sanitize(req.body);
  const validation = registerSchema.safeParse(cleandata);

  if (!validation.success) {
    const zodError = validation.error;
    let firstErrorMessage = "validation Failed";
    let allErrors = [];
    if (zodError?.issues && Array.isArray(zodError.issues)) {
      allErrors = zodError.issues.map((issue) => ({
        field: issue.path ? issue.path.join(".") : "Unknown",
        message: issue.message || "validation Error",
        code: issue.code,
      }));


      firstErrorMessage = allErrors[0]?.message  || "validation Error"
    }

    return res.status(400).json({
      message: firstErrorMessage,
      error: allErrors
    });
  }
  const { name, email, password } = validation.data;

  //    res.json({
  //     name,
  //     email,
  //     password
  //    });

  console.log("Register request:", name, email);
  res
    .status(201)
    .json({ message: "User registered successfully", User: { name, email } });
});
