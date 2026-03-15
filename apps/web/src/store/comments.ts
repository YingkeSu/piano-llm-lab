import { defineStore } from "pinia";

import type { CommentRecord } from "@piano-llm-lab/shared-types";

import { deleteComment, listComments, publishComment } from "../app/http";

export const useCommentsStore = defineStore("comments", {
  state: () => ({
    pageId: "piano",
    list: [] as CommentRecord[],
    pageIndex: 1,
    pageSize: 20,
    total: 0,
    q: "",
    loading: false,
    error: "",
  }),
  actions: {
    async load(pageIndex = 1) {
      this.loading = true;
      this.error = "";
      try {
        const data = await listComments({
          id: this.pageId,
          pageIndex,
          q: this.q,
        });
        this.list = data.list;
        this.total = data.total;
        this.pageIndex = data.pageIndex;
        this.pageSize = data.pageSize;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Load comments failed";
      } finally {
        this.loading = false;
      }
    },
    async publish(text: string, opts: { anonymous: boolean; nickname?: string }) {
      this.loading = true;
      this.error = "";
      try {
        await publishComment({
          id: this.pageId,
          text,
          anonymous: opts.anonymous,
          nickname: opts.nickname,
        });
        await this.load(1);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Publish failed";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async remove(id: number) {
      this.loading = true;
      this.error = "";
      try {
        await deleteComment({ id });
        await this.load(this.pageIndex);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Delete failed";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    setQuery(q: string) {
      this.q = q;
    },
    setPageId(pageId: string) {
      this.pageId = pageId;
    },
  },
});
