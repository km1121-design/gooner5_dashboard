// AUTH_SECRET 用のランダム文字列を生成する: npm run secret
import { randomBytes } from "crypto";
console.log(randomBytes(48).toString("base64"));
