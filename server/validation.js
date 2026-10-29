import { z } from 'zod';
import { phoneHref } from '../shared/contact.js';
import { PROJECT_CATEGORIES, DEMO_MODES, IMAGE_KINDS } from '../shared/projects.js';

const text = (max = 500) => z.string().trim().max(max);
const required = (max = 500) => text(max).min(1, 'This field is required.');
export const phoneNumber = text(40).refine(value => value === '' || !!phoneHref(value), 'Use a phone number with 7–15 digits, optionally including +, spaces, parentheses, or hyphens.');
const isWebURL = value => { try { const url=new URL(value); return ['https:', 'http:'].includes(url.protocol)&&!url.username&&!url.password; } catch { return false; } };
export const webURL = text(2000).refine(value => value === '' || isWebURL(value), 'Use a public http:// or https:// URL without embedded credentials.');
export const projectDemoURL = text(2000).refine(value => value === '' || isWebURL(value) || (/^\/demos\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..')), 'Use a full web URL or an isolated /demos/ preview path.');
export const assetURL = text(2000).refine(value => value === '' || isWebURL(value) || (/^\/(media|images|resume)\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..')), 'Use an uploaded file, or a full web URL.');
const strings = (count = 30, length = 100) => z.array(required(length)).max(count);
const id = required(100).regex(/^[a-zA-Z0-9_-]+$/);

export const profileSchema = z.object({
  name: required(80), fullName: required(160), role: required(100), location: text(120),
  email: z.email().max(200), phone: phoneNumber.default(''), github: webURL, linkedin: webURL, resume: assetURL, photo: assetURL.default(''),
  available: z.boolean(), availability: required(100),
  heroHeading: required(70), heroSubheading: required(60), heroAccent: required(40),
  intro: required(500), about: required(3000), aboutMore: text(4000),
  frontend: strings(), backend: strings(), tools: strings(),
  education: z.array(z.object({school: required(200), degree: required(200), dates: text(80), note: text(200)})).max(8),
  achievements: strings(15, 200)
});
export const projectSchema = z.object({
  id, title: required(140), shortTitle: required(140), category: z.enum(PROJECT_CATEGORIES),
  description: required(650), details: text(6000), role: text(200), year: text(30),
  stack: strings(20, 80), highlights: strings(12, 1200), repo: webURL, showSource: z.boolean().default(true), demo: projectDemoURL, image: assetURL,
  demoMode: z.enum(DEMO_MODES).default('live'), imageKind: z.enum(IMAGE_KINDS).default('capture'), imageCaption: text(140).default(''),
  artwork: z.enum(['egypt', 'confit', 'platform', 'campus', 'madar', 'commerce', 'legal', 'automation']),
  sourceType: z.enum(['github', 'cv', 'personal']), sourceNote: text(1500),
  featured: z.boolean(), published: z.boolean()
});
export const certificateSchema = z.object({
  id, title: required(200), issuer: required(200), shortIssuer: required(15), year: text(40),
  type: text(150), description: text(3000), file: assetURL, url: webURL, published: z.boolean()
});
export const portfolioSchema = z.object({
  profile: profileSchema,
  projects: z.array(projectSchema).max(100),
  certificates: z.array(certificateSchema).max(100)
}).refine(value => new Set(value.projects.map(x => x.id)).size === value.projects.length && new Set(value.certificates.map(x => x.id)).size === value.certificates.length, 'Each item must have a unique ID.');
export const messageSchema = z.object({
  name: required(120), email: z.email().max(200),
  opportunity: z.enum(['Full-time role', 'Part-time role', 'Internship', 'Collaboration', 'Other']),
  message: text(5000).min(15, 'Please write at least 15 characters.'),
  website: text(500).optional().default('')
});
