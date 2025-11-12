import jwt from "jsonwebtoken";
import { redisClient } from "../../index.js";
import { User } from "../models/user.model.js";

export const isAuth = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      return res.status(403).json({ message: "Please login - no Token" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Token expired or invalid" });
    }

    const cacheUser = await redisClient.get(`user:${decoded.id}`);
    if (cacheUser) {
      req.user = JSON.parse(cacheUser);
      return next();
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await redisClient.setEx(`user:${user._id}`, 3600, JSON.stringify(user));
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
