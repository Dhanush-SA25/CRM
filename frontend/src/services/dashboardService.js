import api from "./api";

export const dashboardService = {
  getSummary() {
    return api.get("/dashboard/summary").then((r) => r.data);
  },

  getAnalytics() {
    return api.get("/dashboard/analytics").then((r) => r.data);
  },
};
