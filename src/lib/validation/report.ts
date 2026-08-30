import { z } from 'zod';

export const issueCategorySchema = z.enum([
  'POTHOLE',
  'DRAINAGE',
  'STREETLIGHT',
  'GARBAGE',
  'INFRASTRUCTURE',
  'WATER',
  'OTHER',
]);

export const createReportSchema = z.object({
  title: z
    .string()
    .trim()
    .min(4, 'Title must be at least 4 characters.')
    .max(200, 'Title must be at most 200 characters.'),
  category: issueCategorySchema,
  description: z
    .string()
    .trim()
    .max(5000, 'Description must be at most 5000 characters.')
    .optional()
    .or(z.literal('')),
  location: z
    .string()
    .trim()
    .max(300, 'Location must be at most 300 characters.')
    .optional()
    .or(z.literal('')),
  contact: z
    .string()
    .trim()
    .max(200, 'Contact information must be at most 200 characters.')
    .optional()
    .or(z.literal('')),
  latitude: z
    .number({ error: 'Latitude must be a number.' })
    .min(-90)
    .max(90)
    .nullable()
    .optional(),
  longitude: z
    .number({ error: 'Longitude must be a number.' })
    .min(-180)
    .max(180)
    .nullable()
    .optional(),
  evidence: z
    .array(
      z.object({
        type: z.enum(['IMAGE', 'VIDEO', 'URL']),
        url: z.string().trim().min(1).max(1000),
        fileName: z.string().max(255).optional().nullable(),
        mimeType: z.string().max(120).optional().nullable(),
        sizeBytes: z.number().int().nonnegative().optional().nullable(),
      }),
    )
    .max(10, 'At most 10 evidence items per report.')
    .optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const ACCEPTED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
export const ACCEPTED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per file (UI copy: up to 10MB)