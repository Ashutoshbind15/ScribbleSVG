import type { DiagramElement } from "@scribblesvg/core";

export interface ElementPatch {
  id: string;
  patch: Partial<DiagramElement>;
}

/** `ids` plus every other member of any group they touch, in document order. */
export function expandToGroups(
  elements: DiagramElement[],
  ids: Iterable<string>,
): string[] {
  const picked = new Set(ids);
  const groups = new Set<string>();
  for (const el of elements) {
    if (picked.has(el.id) && el.groupId !== undefined) groups.add(el.groupId);
  }
  return elements
    .filter(
      (el) =>
        picked.has(el.id) || (el.groupId !== undefined && groups.has(el.groupId)),
    )
    .map((el) => el.id);
}

/**
 * True when the selection is exactly the group `id` belongs to, so a double-click
 * on `id` should narrow the selection to that one member.
 */
export function isWholeGroupSelected(
  elements: DiagramElement[],
  selectedIds: ReadonlySet<string>,
  id: string,
): boolean {
  if (selectedIds.size < 2 || !selectedIds.has(id)) return false;
  const members = expandToGroups(elements, [id]);
  return (
    members.length === selectedIds.size &&
    members.every((member) => selectedIds.has(member))
  );
}

/**
 * Patches putting all `ids` into the new group `groupId`; any groups they were
 * in merge into it. Empty when fewer than two elements are given or they
 * already form one group.
 */
export function groupPatches(
  elements: DiagramElement[],
  ids: ReadonlySet<string>,
  groupId: string,
): ElementPatch[] {
  const members = elements.filter((el) => ids.has(el.id));
  if (members.length < 2) return [];
  const first = members[0]!.groupId;
  if (first !== undefined && members.every((el) => el.groupId === first)) return [];
  return members.map((el) => ({ id: el.id, patch: { groupId } }));
}

/** Patches taking every grouped element in `ids` out of its group. */
export function ungroupPatches(
  elements: DiagramElement[],
  ids: ReadonlySet<string>,
): ElementPatch[] {
  return elements
    .filter((el) => ids.has(el.id) && el.groupId !== undefined)
    .map((el) => ({ id: el.id, patch: { groupId: undefined } }));
}
