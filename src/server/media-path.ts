import { MANIFEST_FILE_NAME } from "@/storage/paths";
import { DATE_PATTERN } from "@/time/date";

// Dot-separated segments of safe characters: no slashes, no leading dot, no "..", so a request cannot leave the set directory.
const MEDIA_FILE_PATTERN = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/;

export const isValidMediaDate = (date: string) => DATE_PATTERN.test(date);

export const isValidMediaFile = (file: string) =>
  MEDIA_FILE_PATTERN.test(file) && file !== MANIFEST_FILE_NAME;

export const getMediaUrl = (date: string, file: string) =>
  `/media/${date}/${file}`;
