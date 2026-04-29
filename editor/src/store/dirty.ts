// Removed: dirty tracking replaced by immediate DB writes.
// This file kept as a stub to avoid import errors during migration.
export function markDirty(_path: string) {}
export function getDirtyFiles(): Set<string> { return new Set(); }
export function renameDirtyPath(_old: string, _new: string) {}
export function clearDirty() {}
