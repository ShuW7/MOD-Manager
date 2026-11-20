"use strict";

const path = require("path");

// Path helpers for the Windows install flows. They are deliberately string
// based: the manager shows and stores Windows paths verbatim instead of
// round-tripping them through the host runtime.
function normalizeDisplayPath(value) {
  const normalized = String(value || "").trim().replace(/\//g, "\\");
  if (!normalized) return "";
  if (/^[a-z]:\\+$/i.test(normalized)) return `${normalized.slice(0, 2)}\\`;
  return normalized.replace(/\\+$/, "");
}
function getWindowsPathLeaf(value) {
  const normalized = normalizeDisplayPath(value);
  if (!normalized || /^[a-z]:\\$/i.test(normalized)) return "";
  const index = normalized.lastIndexOf("\\");
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}
function getWindowsParentPath(value) {
  const normalized = normalizeDisplayPath(value);
  if (!normalized || /^[a-z]:\\$/i.test(normalized)) return "";
  const index = normalized.lastIndexOf("\\");
  if (index < 0) return "";
  if (index === 2 && /^[a-z]:/i.test(normalized)) return normalized.slice(0, 3);
  return normalizeDisplayPath(normalized.slice(0, index));
}
function joinWindowsPath(baseDir, childName) {
  const base = normalizeDisplayPath(baseDir);
  const child = String(childName || "").trim().replace(/^[\\/]+|[\\/]+$/g, "");
  if (!base) return child;
  if (!child) return base;
  return `${base}${base.endsWith("\\") ? "" : "\\"}${child}`;
}
function resolveNamedInstallDirectory(baseDir, folderName) {
  const base = normalizeDisplayPath(baseDir);
  const folder = String(folderName).trim();
  if (!base || !folder) return "";
  return getWindowsPathLeaf(base).toLowerCase() === folder.toLowerCase() ? base : joinWindowsPath(base, folder);
}
const MANAGED_INSTALL_CONTENT_TYPES = new Set(["mod", "fixer"]);
function normalizeManagedInstallContentType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return MANAGED_INSTALL_CONTENT_TYPES.has(normalized) ? normalized : "mod";
}
function inferManagedInstallFromName(sourcePath, activeGameId = "") {
  const fileName = path.basename(String(sourcePath || ""));
  const stem = fileName.replace(/\.(zip|rar|7z|exe)$/i, "");
  const fixerLike = /(^|[\s._-])fix(?:er|tool)?(?=$|[\s._-])/i.test(stem) || /修复(?:器|工具)?/i.test(stem);
  return {
    contentType: fixerLike ? "fixer" : "mod",
    targetGameId: String(activeGameId || ""),
    importerName: ""
  };
}
function relativePathTouchesMods(relativePath) {
  return String(relativePath || "").replace(/\\/g, "/").split("/").filter(Boolean).some(segment => segment.toLowerCase() === "mods");
}
module.exports = {
  getWindowsPathLeaf,
  resolveNamedInstallDirectory,
  normalizeManagedInstallContentType,
  inferManagedInstallFromName,
  relativePathTouchesMods
};
