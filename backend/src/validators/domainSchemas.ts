import { z } from "zod";

const uuid = z.string().uuid();
const nonEmpty = (max: number) => z.string().trim().min(1).max(max);
const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export const idParams = z.object({ id: uuid });
export const userIdParams = z.object({ userId: uuid });
export const assignmentIdParams = z.object({ assignmentId: uuid });
export const proofIdParams = z.object({ proofId: uuid });
export const donationIdParams = z.object({ donationId: uuid });
export const notificationIdParams = z.object({ notificationId: uuid });
export const rescueIdParams = z.object({ rescueId: uuid });
export const listQuery = pageQuery;

export const profileUpdateSchema = z
  .object({
    full_name: nonEmpty(120).optional(),
    phone: z.string().trim().min(7).max(40).regex(/^\+?[0-9\s().-]+$/).optional(),
    organization_name: nonEmpty(160).optional(),
    address: nonEmpty(500).optional(),
    city: nonEmpty(120).optional(),
    vehicle_type: nonEmpty(80).optional(),
    vehicle_number: nonEmpty(40).optional(),
    availability: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one profile field.");

export const partnerAvailabilitySchema = z.object({
  availability: z.boolean(),
});

export const donationCreateSchema = z.object({
  food_name: nonEmpty(160),
  description: z.string().trim().max(2000).optional().default(""),
  food_category: nonEmpty(80),
  quantity: z.coerce.number().positive().max(1_000_000),
  quantity_unit: nonEmpty(40),
  pickup_address: nonEmpty(1000),
  expiry_time: z.coerce.date().refine((value) => value.getTime() > Date.now(), {
    message: "Expiry time must be in the future.",
  }),
  image_url: z.string().url().max(2000).optional().nullable(),
});

export const donationUpdateSchema = donationCreateSchema
  .partial()
  .omit({ expiry_time: true })
  .extend({
    expiry_time: z.coerce
      .date()
      .refine((value) => value.getTime() > Date.now(), {
        message: "Expiry time must be in the future.",
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one donation field.");

export const deliveryStatusSchema = z.object({
  status: z.enum(["picked_up", "delivered"]),
  description: z.string().trim().max(500).optional(),
});

export const suspensionSchema = z.object({
  is_suspended: z.boolean(),
});

export const rescueUpdateSchema = z.object({
  status: z.enum(["open", "assigned", "resolved", "cancelled"]),
  assigned_partner_id: uuid.nullable().optional(),
});

export const notificationReadSchema = z.object({
  is_read: z.literal(true).default(true),
});

export const paginationQuery = pageQuery.extend({
  status: z.string().trim().min(1).max(40).optional(),
});

export const donationImageSchema = z.object({
  image_url: z.string().url().max(2000),
});
