import * as zod from "zod";

/**
 * Registration schema with required email
 * @summary Validates user registration data with mandatory email
 */
export const registerSchema = zod.object({
  name: zod
    .string()
    .min(1, "Name is required")
    .trim(),

  email: zod
    .string()
    .email("Invalid email format")
    .min(1, "Email is required")
    .trim()
    .toLowerCase(),

  mobile: zod
    .string()
    .regex(/^(\+?20|0)(1[0125][0-9]{8})$/, "Invalid Egyptian mobile number"),

  password: zod
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must include lowercase letters")
    .regex(/[A-Z]/, "Password must include uppercase letters")
    .regex(/[0-9]/, "Password must include numbers")
    .regex(/[^A-Za-z0-9]/, "Password must include special characters"),

  role: zod
    .enum(["client", "technician"])
    .optional()
    .default("client"),

  nationalId: zod
    .string()
    .optional(),

  governorateId: zod
    .string()
    .optional(),

  areaId: zod
    .string()
    .optional(),

  address: zod
    .string()
    .optional(),

  street: zod.string().optional(),
  buildingNo: zod.string().optional(),
  floorNo: zod.string().optional(),
  aptNo: zod.string().optional(),

  latitude: zod
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional(),

  longitude: zod
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional(),

  verificationToken: zod
    .string()
    .optional(),

  serviceCategories: zod
    .array(zod.string())
    .optional(),

  profession: zod
    .string()
    .optional(),

  specialty: zod
    .string()
    .optional(),

  serviceStart: zod
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Service start must be in HH:mm format (e.g., 08:00)")
    .optional(),

  serviceEnd: zod
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Service end must be in HH:mm format (e.g., 22:00)")
    .optional(),

  nationalIdFrontUrl: zod.string().optional(),
  nationalIdBackUrl: zod.string().optional(),
  licenseCardUrl: zod.string().optional(),
  bio: zod.string().max(500, "Bio must be at most 500 characters").optional(),
  yearsOfExperience: zod.number().int().min(0).max(50).optional(),
}).refine(
  (data) => {
    // If both latitude and longitude are provided, both must be numbers
    if ((data.latitude !== undefined && data.longitude === undefined) ||
        (data.latitude === undefined && data.longitude !== undefined)) {
      return false;
    }
    return true;
  },
  {
    message: "Both latitude and longitude must be provided together",
    path: ["latitude"],
  },
).refine(
  (data) => {
    // If both service times are provided, end must be after start
    if (data.serviceStart && data.serviceEnd) {
      const toMinutes = (time: string) => {
        const [h, m] = time.split(":").map(Number);
        return h * 60 + m;
      };
      return toMinutes(data.serviceEnd) > toMinutes(data.serviceStart);
    }
    return true;
  },
  {
    message: "Service end time must be after service start time",
    path: ["serviceEnd"],
  },
);

export type RegisterRequest = zod.infer<typeof registerSchema>;

/**
 * Login schema with password
 * @summary Validates user login with email/mobile and password
 */
export const loginWithPasswordSchema = zod.object({
  identifier: zod
    .string()
    .min(1, "Email or mobile number is required"),

  password: zod
    .string()
    .min(1, "Password is required"),
});

export type LoginWithPasswordRequest = zod.infer<typeof loginWithPasswordSchema>;
