export type Descriptor<T> = {
    [P in keyof T]: (v: any) => T[P];
};

export function arraySatisfiesDescriptor<T>(d: Descriptor<T>): (v: any) => T[] {
    return (v: any) =>
        Array.isArray(v)
            ? v.map((e) => satisfiesDescriptor(e, d))
            : ((() => {
                  throw new Error();
              }) as any);
}

export function arraySatisfiesPredicate<T>(d: (v: any) => T): (v: any) => T[] {
    return (v: any) =>
        Array.isArray(v)
            ? v.map((e) => d(e))
            : ((() => {
                  throw new Error();
              }) as any);
}

export function satisfiesDescriptor<T>(v: any, d: Descriptor<T>): T {
    const ret: any = {};
    for (const key in d) {
        try {
            const val = d[key](v[key]);
            if (typeof val !== "undefined") {
                ret[key] = val;
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Descriptor is not satisfied for ${key}: ${msg}`);
        }
    }
    return ret;
}
