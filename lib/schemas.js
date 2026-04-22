import z from "zod";

 
export const loginSchema = z.object({
  phone: z
    .string()
    .min(10, "Phone must be at least 10 digits")
    .max(13, "Invalid phone number")
    .regex(/^[0-9]+$/, "Only numbers allowed"),
  pin: z
    .string()
    .length(4, "PIN must be exactly 4 digits")
    .regex(/^[0-9]+$/, "PIN must be numeric"),
});
 
export const reportSchema = z.object({
  issue_type: z.string().min(1, "Please select an issue type"),
  note: z.string().optional(),
});