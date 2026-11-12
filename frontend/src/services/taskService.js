import api from "./api";

export const taskService = {
  list(params = {}) {
    return api.get("/tasks/", { params }).then((r) => r.data);
  },
  get(id) {
    return api.get(`/tasks/${id}`).then((r) => r.data.task);
  },
  create(data) {
    return api.post("/tasks/", data).then((r) => r.data.task);
  },
  update(id, data) {
    return api.put(`/tasks/${id}`, data).then((r) => r.data.task);
  },
  delete(id) {
    return api.delete(`/tasks/${id}`).then((r) => r.data);
  },
};
