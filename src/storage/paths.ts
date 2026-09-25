import path from "node:path";

export const MANIFEST_FILE_NAME = "manifest.json";

export const getSetsDir = (dataDir: string) => path.join(dataDir, "sets");

export const getSetDir = (dataDir: string, date: string) =>
  path.join(getSetsDir(dataDir), date);

export const getManifestPath = (dataDir: string, date: string) =>
  path.join(getSetDir(dataDir, date), MANIFEST_FILE_NAME);

export const getTmpDir = (dataDir: string) => path.join(dataDir, "tmp");
