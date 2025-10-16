import express from "express";
import { registerUser, verifyUser } from "../controllers/user.controller.js";
// import { validate } from "../middlewares/validate.js";
// import { registerSchema } from "../utils/zod.js";

const router = express.Router();

router.post("/register", registerUser);

router.post("/verify/:token",verifyUser);
// router.post("/register", validate(registerSchema), registerUser);

export default router;
