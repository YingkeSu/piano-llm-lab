<script setup lang="ts">
import { onMounted, ref } from "vue";

import { useAuthStore } from "../store/auth";
import { useCommentsStore } from "../store/comments";

const auth = useAuthStore();
const comments = useCommentsStore();

const mode = ref<"login" | "register">("login");
const username = ref("");
const password = ref("");
const nickname = ref("");
const content = ref("");
const anonymous = ref(false);
const anonymousNickname = ref("访客");
const searchText = ref("");

onMounted(async () => {
  await auth.hydrate();
  await comments.load(1);
});

const loginSubmit = async () => {
  await auth.doLogin({ username: username.value, password: password.value });
  username.value = "";
  password.value = "";
  await comments.load(1);
};

const registerSubmit = async () => {
  await auth.doRegister({
    username: username.value,
    password: password.value,
    nickname: nickname.value,
  });
  username.value = "";
  password.value = "";
  nickname.value = "";
  await comments.load(1);
};

const submitComment = async () => {
  if (!content.value.trim()) {
    return;
  }
  await comments.publish(content.value, {
    anonymous: anonymous.value || !auth.user.loggedIn,
    nickname: anonymousNickname.value,
  });
  content.value = "";
};

const doSearch = async () => {
  comments.setQuery(searchText.value);
  await comments.load(1);
};

const gotoPage = async (step: -1 | 1) => {
  const next = comments.pageIndex + step;
  const max = Math.max(1, Math.ceil(comments.total / comments.pageSize));
  if (next < 1 || next > max) {
    return;
  }
  await comments.load(next);
};
</script>

<template>
  <section class="comments-card">
    <header class="comments-head">
      <h2>Comments</h2>
      <div class="auth-actions" v-if="!auth.user.loggedIn">
        <button type="button" @click="mode = 'login'" :class="{ active: mode === 'login' }" data-testid="switch-login">Login</button>
        <button type="button" @click="mode = 'register'" :class="{ active: mode === 'register' }" data-testid="switch-register">Register</button>
      </div>
      <div v-else class="auth-session">
        <span>{{ auth.user.nickname }} ({{ auth.user.role }})</span>
        <button type="button" @click="auth.doLogout()">Logout</button>
      </div>
    </header>

    <div class="auth-form" v-if="!auth.user.loggedIn">
      <input v-model="username" placeholder="username" data-testid="auth-username" />
      <input v-model="password" placeholder="password" type="password" data-testid="auth-password" />
      <input v-if="mode === 'register'" v-model="nickname" placeholder="nickname" data-testid="auth-nickname" />
      <button type="button" @click="mode === 'login' ? loginSubmit() : registerSubmit()" data-testid="auth-submit">
        {{ mode === 'login' ? 'Login' : 'Register' }}
      </button>
    </div>

    <div class="publish-box">
      <textarea v-model="content" placeholder="Write your comment..." maxlength="600" data-testid="comment-content" />
      <div class="publish-opts">
        <label><input type="checkbox" v-model="anonymous" /> anonymous</label>
        <input v-if="anonymous || !auth.user.loggedIn" v-model="anonymousNickname" placeholder="anonymous nickname" />
        <button type="button" @click="submitComment" data-testid="comment-publish">Publish</button>
      </div>
    </div>

    <div class="search-row">
      <input v-model="searchText" placeholder="Search comments" @keyup.enter="doSearch" />
      <button type="button" @click="doSearch">Search</button>
    </div>

    <p v-if="comments.error" class="error-text">{{ comments.error }}</p>

    <div class="comment-list">
      <article class="comment-item" v-for="item in comments.list" :key="item.id">
        <header>
          <strong>{{ item.user.nickname }}</strong>
          <span>{{ item.createdAt }}</span>
        </header>
        <p>{{ item.content }}</p>
        <div class="meta">
          <span>Status: {{ item.status }}</span>
          <button
            v-if="auth.user.loggedIn && (item.user.self || auth.user.role === 'admin')"
            type="button"
            @click="comments.remove(item.id)"
          >
            Delete
          </button>
        </div>
      </article>
    </div>

    <footer class="pager">
      <button type="button" @click="gotoPage(-1)">Prev</button>
      <span>{{ comments.pageIndex }} / {{ Math.max(1, Math.ceil(comments.total / comments.pageSize)) }}</span>
      <button type="button" @click="gotoPage(1)">Next</button>
      <span>Total {{ comments.total }}</span>
    </footer>
  </section>
</template>
