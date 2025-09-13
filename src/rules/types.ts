export interface Rule {
    name: string | RegExp;
    binding?: BindingSchema;
    bindings?: ArraySchema<BindingElementSchema>;
    arguments?: ArraySchema<ArgumentSchema>;
}

export type GenericSchema<T extends object> = T | {
    $or: GenericSchema<T>[];
} | {
    $properties: Record<string, GenericSchema<T>>;
};

export type ArraySchema<T extends object> = T[] | {
    $any: SchemaRaw<T>;
};

export type AccessTypeSchema = `.${string}` | "()" | `.${string}()`;

export type BindingSchema = GenericSchema<{
    accessTypes: AccessTypeSchema[];
}>;

export type BindingElementSchema = GenericSchema<{
    name?: string | RegExp;
    accessTypes: AccessTypeSchema[];
}>;

export type ArgumentSchema = GenericSchema<{
    type: "accessor" | "callback" | "effect";
}>;

export type SchemaRaw<T> = T extends GenericSchema<infer U> ? U : never;
