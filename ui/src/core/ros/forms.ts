export interface RosFormValidationResult {
  ok: boolean;
  errors: string[];
  parsed: Record<string, unknown> | null;
}

type Validator = (value: Record<string, unknown>) => string[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRosType(type: string): string {
  return type.trim().replace("/msg/", "/").replace("/srv/", "/");
}

function requireNumberField(
  value: Record<string, unknown>,
  key: string,
  label: string,
): string[] {
  return typeof value[key] === "number" ? [] : [`${label} must be a number`];
}

function requireBooleanField(
  value: Record<string, unknown>,
  key: string,
  label: string,
): string[] {
  return typeof value[key] === "boolean" ? [] : [`${label} must be a boolean`];
}

function requireStringField(
  value: Record<string, unknown>,
  key: string,
  label: string,
): string[] {
  return typeof value[key] === "string" ? [] : [`${label} must be a string`];
}

function requireNestedRecord(
  value: Record<string, unknown>,
  key: string,
  label: string,
): [Record<string, unknown> | null, string[]] {
  const nested = value[key];
  if (!isRecord(nested)) {
    return [null, [`${label} must be an object`]];
  }
  return [nested, []];
}

const twistValidator: Validator = (value) => {
  const [linear, linearErrors] = requireNestedRecord(value, "linear", "linear");
  const [angular, angularErrors] = requireNestedRecord(value, "angular", "angular");

  return [
    ...linearErrors,
    ...(linear
      ? [
          ...requireNumberField(linear, "x", "linear.x"),
          ...requireNumberField(linear, "y", "linear.y"),
          ...requireNumberField(linear, "z", "linear.z"),
        ]
      : []),
    ...angularErrors,
    ...(angular
      ? [
          ...requireNumberField(angular, "x", "angular.x"),
          ...requireNumberField(angular, "y", "angular.y"),
          ...requireNumberField(angular, "z", "angular.z"),
        ]
      : []),
  ];
};

const triggerValidator: Validator = (value) => {
  return Object.keys(value).length === 0 ? [] : ["Trigger requests must be an empty object"];
};

const setBoolValidator: Validator = (value) => {
  return requireBooleanField(value, "data", "data");
};

const getCapabilitiesValidator: Validator = (value) => {
  return requireStringField(value, "robot_namespace", "robot_namespace");
};

const messageValidators = new Map<string, Validator>([["geometry_msgs/Twist", twistValidator]]);

const serviceValidators = new Map<string, Validator>([
  ["std_srvs/Trigger", triggerValidator],
  ["std_srvs/SetBool", setBoolValidator],
  ["rosclaw_msgs/GetCapabilities", getCapabilitiesValidator],
]);

const templates = new Map<string, string>([
  [
    "geometry_msgs/Twist",
    JSON.stringify(
      {
        linear: { x: 0, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: 0 },
      },
      null,
      2,
    ),
  ],
  ["std_srvs/Trigger", JSON.stringify({}, null, 2)],
  ["std_srvs/SetBool", JSON.stringify({ data: true }, null, 2)],
  ["rosclaw_msgs/GetCapabilities", JSON.stringify({ robot_namespace: "" }, null, 2)],
]);

function validateJsonObject(rawValue: string): RosFormValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON payload";
    return {
      ok: false,
      errors: [`Invalid JSON: ${message}`],
      parsed: null,
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      errors: ["Payload must be a JSON object"],
      parsed: null,
    };
  }

  return {
    ok: true,
    errors: [],
    parsed,
  };
}

function validateWithRegistry(
  registry: Map<string, Validator>,
  type: string,
  rawValue: string,
): RosFormValidationResult {
  const base = validateJsonObject(rawValue);
  if (!base.ok || !base.parsed) {
    return base;
  }

  const validator = registry.get(normalizeRosType(type));
  if (!validator) {
    return base;
  }

  const errors = validator(base.parsed);
  return {
    ok: errors.length === 0,
    errors,
    parsed: base.parsed,
  };
}

export function validatePublishPayload(type: string, rawValue: string): RosFormValidationResult {
  return validateWithRegistry(messageValidators, type, rawValue);
}

export function validateServiceArgs(type: string, rawValue: string): RosFormValidationResult {
  return validateWithRegistry(serviceValidators, type, rawValue);
}

export function getRosTypeTemplate(type: string): string {
  return templates.get(normalizeRosType(type)) ?? JSON.stringify({}, null, 2);
}

export function hasKnownPublishSchema(type: string): boolean {
  return messageValidators.has(normalizeRosType(type));
}

export function hasKnownServiceSchema(type: string): boolean {
  return serviceValidators.has(normalizeRosType(type));
}