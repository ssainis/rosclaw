import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import "./style.css";

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(router);

app.mount("#app");

// Expose pinia state for E2E testing in non-production builds.
if (import.meta.env.MODE !== "production") {
  (window as unknown as { __pinia: typeof pinia }).__pinia = pinia;
}
