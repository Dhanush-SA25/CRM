import api from "./api";

export const insightService = {
  search(query) {
    return api.get("/search", { params: { q: query } }).then((r) => r.data);
  },
  notifications() {
    return api.get("/notifications").then((r) => r.data);
  },
};
