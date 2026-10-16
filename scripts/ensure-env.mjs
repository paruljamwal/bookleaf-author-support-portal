import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (!existsSync("backend/.env")) {
  const access = randomBytes(32).toString("hex");
  const refresh = randomBytes(32).toString("hex");
  writeFileSync(
    "backend/.env",
    [
      "NODE_ENV=development",
      "PORT=4000",
      "MONGODB_URI=",
      `JWT_ACCESS_SECRET=${access}`,
      `JWT_REFRESH_SECRET=${refresh}`,
      "JWT_ACCESS_TTL=15m",
      "JWT_REFRESH_TTL=7d",
      "COOKIE_SECURE=false",
      "COOKIE_SAMESITE=lax",
      "CORS_ORIGIN=http://localhost:5173",
      "AI_BASE_URL=https://api.openai.com/v1",
      "AI_API_KEY=",
      "AI_MODEL=gpt-4o-mini",
      "AI_TIMEOUT_MS=12000",
      "AI_AUTO_PROCESS=true",
      "PUSHER_APP_ID=",
      "PUSHER_KEY=",
      "PUSHER_SECRET=",
      "PUSHER_CLUSTER=",
      "DEMO_ADMIN_EMAIL=ops@bookleaf.demo",
      "DEMO_ADMIN_PASSWORD=\"BookLeaf#Admin1\"",
      "DEMO_AUTHOR_PASSWORD=\"BookLeaf#Author1\"",
      "SEED_DATA_PATH=",
      "LOG_LEVEL=info",
      "",
    ].join("\n"),
  );
  console.log("Created backend/.env with generated JWT secrets.");
}

if (!existsSync("frontend/.env")) {
  writeFileSync(
    "frontend/.env",
    ["VITE_API_URL=", "VITE_PUSHER_KEY=", "VITE_PUSHER_CLUSTER=mt1", ""].join("\n"),
  );
  console.log("Created frontend/.env.");
}
