import api from "./api";

export const adminService = {
  listUsers() {
    return api.get("/admin/users").then((r) => r.data.users);
  },
  createUser(data) {
    return api.post("/admin/users", data).then((r) => r.data.user);
  },
  updateUser(id, data) {
    return api.put(`/admin/users/${id}`, data).then((r) => r.data.user);
  },
};
