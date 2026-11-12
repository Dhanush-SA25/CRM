import api from "./api";

export const activityService = {
  list(params = {}) {
    return api.get("/activities/", { params }).then((r) => r.data);
  },
  get(id) {
    return api.get(`/activities/${id}`).then((r) => r.data.activity);
  },
  options() {
    return api.get("/activities/options").then((r) => r.data);
  },
  create(data) {
    return api.post("/activities/", data).then((r) => r.data.activity);
  },
  update(id, data) {
    return api.put(`/activities/${id}`, data).then((r) => r.data.activity);
  },
  delete(id) {
    return api.delete(`/activities/${id}`).then((r) => r.data);
  },
};
