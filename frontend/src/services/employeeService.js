import api from "./api";

export const employeeService = {
  list(params = {}) {
    return api.get("/admin/employees/", { params }).then((r) => r.data);
  },
  importCsv(file, onUploadProgress) {
    const form = new FormData();
    form.append("file", file);
    return api
      .post("/admin/employees/import", form, { onUploadProgress })
      .then((r) => r.data);
  },
  downloadTemplate() {
    return api
      .get("/admin/employees/template.csv", { responseType: "blob" })
      .then((r) => r.data);
  },
  downloadErrors(batch) {
    return api
      .get(`/admin/employees/imports/${batch}/errors.csv`, { responseType: "blob" })
      .then((r) => r.data);
  },
};
