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

export default resolveLocationQuerySchema;
