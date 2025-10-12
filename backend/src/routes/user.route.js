import express from "express";
import { registerUser } from "../controllers/user.controller.js";
// import { validate } from "../middlewares/validate.js";
// import { registerSchema } from "../utils/zod.js";

const router = express.Router();

router.post("/register", registerUser);
// router.post("/register", validate(registerSchema), registerUser);

export default router;