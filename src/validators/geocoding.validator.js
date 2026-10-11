import { z } from 'zod';

const coordinateSchema = (min, max, name) =>
  z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : Number(val)),
    z
      .number({
        required_error: `Query parameter "${name}" is required`,
        invalid_type_error: `Query parameter "${name}" must be a valid number`,
      })
      .min(min, `${name === 'lat' ? 'Latitude' : 'Longitude'} must be between ${min} and ${max}`)
      .max(max, `${name === 'lat' ? 'Latitude' : 'Longitude'} must be between ${min} and ${max}`)
  );

export const resolveLocationQuerySchema = z.object({
  lat: coordinateSchema(-90, 90, 'lat'),
  lon: coordinateSchema(-180, 180, 'lon'),
});

export const resolvePincodeQuerySchema = z.object({
  pincode: z
    .string({ required_error: 'Query parameter "pincode" is required' })
    .trim()
    .regex(/^\d{6}$/, 'Query parameter "pincode" must be a valid 6-digit Indian postal code'),
});

export const searchPlacesQuerySchema = z.object({
  q: z
    .string({ required_error: 'Query parameter "q" is required' })
    .trim()
    .min(3, 'Query parameter "q" must be between 3 and 60 characters')
    .max(60, 'Query parameter "q" must be between 3 and 60 characters'),
});

export default {
  resolveLocationQuerySchema,
  resolvePincodeQuerySchema,
  searchPlacesQuerySchema,
};
