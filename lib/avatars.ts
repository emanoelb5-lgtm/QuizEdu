import catalog from "../public/avatars/catalog.json";
import { AVATARS as LEGACY_AVATAR_VALUES } from "./quiz";

export const AVATAR_OPTIONS = catalog;
export const DEFAULT_AVATAR = catalog[0].id;
// Keep older apps and saved rooms compatible while displaying illustrations.
export const LEGACY_AVATARS = LEGACY_AVATAR_VALUES;
export const AVATARS = [...catalog.map(avatar => avatar.id), ...LEGACY_AVATARS];
export function avatarOption(value: string) {
  return catalog.find(avatar => avatar.id === value) || catalog[Math.max(0, LEGACY_AVATARS.indexOf(value))] || catalog[0];
}
export function avatarSource(value: string) {
  return `/avatars/${avatarOption(value).id}.svg`;
}
