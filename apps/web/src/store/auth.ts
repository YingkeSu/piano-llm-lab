import { defineStore } from "pinia";

import type { UserSession } from "@piano-llm-lab/shared-types";

import { fetchMe, login, logout, register } from "../app/http";

const guest: UserSession = {
  id: 0,
  username: "",
  nickname: "",
  role: "user",
  loggedIn: false,
};

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: { ...guest } as UserSession,
    loading: false,
    error: "",
  }),
  actions: {
    async hydrate() {
      this.loading = true;
      this.error = "";
      try {
        this.user = await fetchMe();
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Failed to load session";
        this.user = { ...guest };
      } finally {
        this.loading = false;
      }
    },
    async doRegister(payload: { username: string; password: string; nickname: string }) {
      this.loading = true;
      this.error = "";
      try {
        this.user = await register(payload);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Register failed";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async doLogin(payload: { username: string; password: string }) {
      this.loading = true;
      this.error = "";
      try {
        this.user = await login(payload);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Login failed";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async doLogout() {
      this.loading = true;
      this.error = "";
      try {
        await logout();
        this.user = { ...guest };
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Logout failed";
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});
