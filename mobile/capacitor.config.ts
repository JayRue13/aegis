// Capacitor wraps the hosted AEGIS web app in a native Android/iOS shell.
// Set AEGIS_URL to your deployment before syncing, for example:
//   AEGIS_URL=https://your-aegis.vercel.app npm run sync
// Without it the app shows a short page explaining what to configure.
import type { CapacitorConfig } from "@capacitor/cli";

const url = process.env.AEGIS_URL?.trim();
if (url && !/^https:\/\//.test(url)) {
  throw new Error("AEGIS_URL must start with https://");
}

const config: CapacitorConfig = {
  appId: "app.aegis.mobile",
  appName: "AEGIS",
  webDir: "www",
  ...(url ? { server: { url, cleartext: false } } : {}),
  android: { allowMixedContent: false },
  ios: { contentInset: "automatic" },
};

export default config;
