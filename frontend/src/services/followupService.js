import api from "./api";

export const followupService = {
  list(params = {}) {
    return api.get("/followups/", { params }).then((r) => r.data);
  },
  get(id) {
    return api.get(`/followups/${id}`).then((r) => r.data.followup);
  },
  create(data) {
    return api.post("/followups/", data).then((r) => r.data.followup);
  },
  update(id, data) {
    return api.put(`/followups/${id}`, data).then((r) => r.data.followup);
  },
  delete(id) {
    return api.delete(`/followups/${id}`).then((r) => r.data);
  },
};
