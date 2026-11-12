import api from "./api";

export const targetService = {
  list(period) {
    return api.get("/admin/targets/", { params: period ? { period } : {} }).then((r) => r.data);
  },
  set({ userId, period, targetAmount }) {
    return api
      .put("/admin/targets/", {
        user_id: userId,
        period,
        target_amount: targetAmount,
      })
      .then((r) => r.data);
  },
};
