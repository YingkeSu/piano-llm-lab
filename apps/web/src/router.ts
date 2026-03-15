import { createRouter, createWebHistory } from "vue-router";

import MetronomePage from "./pages/MetronomePage.vue";
import PianoPage from "./pages/PianoPage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "piano",
      component: PianoPage,
    },
    {
      path: "/metronome",
      name: "metronome",
      component: MetronomePage,
    },
  ],
});

export default router;
