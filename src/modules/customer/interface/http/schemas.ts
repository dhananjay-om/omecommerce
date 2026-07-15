import { z } from 'zod';

export const registerCustomerSchema = z.object({
  websiteCode: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8).max(256),
  firstName: z.string().max(255).nullish(),
  lastName: z.string().max(255).nullish(),
});

export const loginCustomerSchema = z.object({
  websiteCode: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

export const addCustomerAddressSchema = z.object({
  name: z.string().min(1).max(255),
  company: z.string().max(255).nullish(),
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).nullish(),
  city: z.string().min(1).max(128),
  region: z.string().max(128).nullish(),
  postalCode: z.string().min(1).max(32),
  country: z.string().length(2),
  phone: z.string().max(32).nullish(),
  isDefaultShipping: z.boolean().optional(),
  isDefaultBilling: z.boolean().optional(),
});
