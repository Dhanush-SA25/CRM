import api from "./api";

export const dealService = {
  list(params = {}) {
    return api.get("/deals/", { params }).then((r) => r.data);
  },
  get(id) {
    return api.get(`/deals/${id}`).then((r) => r.data.deal);
  },
  create(data) {
    return api.post("/deals/", data).then((r) => r.data.deal);
  },
  update(id, data) {
    return api.put(`/deals/${id}`, data).then((r) => r.data.deal);
  },
  delete(id) {
    return api.delete(`/deals/${id}`).then((r) => r.data);
  },
  lostReasons() {
    return api.get("/deals/lost-reasons").then((r) => r.data);
  },
};
