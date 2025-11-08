import express from "express";
import { loginUser, myProfile, registerUser, verifyOtp, verifyUser } from "../controllers/user.controller.js";
import { isAuth } from "../middlewares/isAuth.js";
// import { validate } from "../middlewares/validate.js";
// import { registerSchema } from "../utils/zod.js";

const router = express.Router();

router.post("/register", registerUser);

router.post("/verify/:token",verifyUser);

router.post("/login" , loginUser);

router.post("/verify" ,verifyOtp)

router.get("me" , isAuth , myProfile)


// router.post("/register", validate(registerSchema), registerUser);

export default router;
