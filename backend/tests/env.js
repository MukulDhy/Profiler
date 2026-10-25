// Runs before the test framework and before any application module is loaded.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test_jwt_secret_do_not_use_in_production";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test_refresh_secret_do_not_use";
process.env.JWT_EXPIRE = "15m";
process.env.CLIENT_URL = "http://localhost:8080";
process.env.DEMO_MODE = "false";
process.env.AI_SERVICE_TOKEN = "";
process.env.REQUIRE_EMAIL_VERIFICATION = "false";
process.env.RATE_LIMIT_MAX = "10000";
