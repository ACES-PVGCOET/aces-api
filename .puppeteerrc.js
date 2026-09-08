import { join } from "path";

export default {
  cacheDirectory: join(import.meta.dirname, ".cache", "puppeteer"),
};