import api from "./api";

export const customerService = {
  list(params = {}) {
    return api.get("/customers/", { params }).then((r) => r.data);
  },
  get(id) {
    return api.get(`/customers/${id}`).then((r) => r.data.customer);
  },
  create(data) {
    return api.post("/customers/", data).then((r) => r.data.customer);
  },
  update(id, data) {
    return api.put(`/customers/${id}`, data).then((r) => r.data.customer);
  },
  delete(id) {
    return api.delete(`/customers/${id}`).then((r) => r.data);
  },
  get360(id) {
    return api.get(`/customers/${id}/360`).then((r) => r.data);
  },
  duplicates() {
    return api.get("/customers/duplicates").then((r) => r.data);
  },
};
