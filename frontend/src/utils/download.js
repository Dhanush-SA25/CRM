import api from "../services/api";

function filenameFromDisposition(disposition, fallback) {
  if (!disposition) return fallback;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

/**
 * Trigger a browser download for an already-fetched Blob.
 */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}

function filenameFromResponse(response, fallback) {
  return filenameFromDisposition(
    response.headers?.["content-disposition"],
    fallback
  );
}

export async function downloadExport(resource, params = {}) {
  const response = await api.get(`/export/${resource}`, {
    params,
    responseType: "blob",
  });
  const filename = filenameFromResponse(response, `smartcrm-${resource}.csv`);
  saveBlob(response.data, filename);
  return filename;
}

/**
 * GET a CSV endpoint as a blob and save it with the server-provided filename.
 */
export async function downloadCsv(path, fallbackName = "smartcrm.csv") {
  const response = await api.get(path, { responseType: "blob" });
  const filename = filenameFromResponse(response, fallbackName);
  saveBlob(response.data, filename);
  return filename;
}
