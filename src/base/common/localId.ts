let nextLocalId = 0;

/** Sequential id generator for transient UI entities. */
export const localId = (): string => `l${++nextLocalId}`;
