import api from "./api";

export const leadService = {
  list(params = {}) {
    return api.get("/leads/", { params }).then((r) => r.data);
  },
  get(id) {
    return api.get(`/leads/${id}`).then((r) => r.data.lead);
  },
  create(data) {
    return api.post("/leads/", data).then((r) => r.data.lead);
  },
  update(id, data) {
    return api.put(`/leads/${id}`, data).then((r) => r.data.lead);
  },
  delete(id) {
    return api.delete(`/leads/${id}`).then((r) => r.data);
  },
  rescore(id) {
    return api.post(`/leads/${id}/score`).then((r) => r.data);
  },
};
