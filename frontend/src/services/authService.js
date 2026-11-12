import api from "./api";

export const authService = {
  async login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    return data;
  },

  async register(name, email, password) {
    const { data } = await api.post("/auth/register", { name, email, password });
    return data;
  },

  async getMe() {
    const { data } = await api.get("/auth/me");
    return data.user;
  },
};
