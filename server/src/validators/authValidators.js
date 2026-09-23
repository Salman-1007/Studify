import { z } from 'zod';

export const SUPPORTED_CLASSES = ['9', '10', '11', '12'];
export const SUPPORTED_BOARDS = ['Punjab', 'Federal', 'Federal/FBISE', 'Sindh', 'KPK'];

export const signupSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().optional(),
    class: z.union([z.string(), z.number()]).optional(),
    grade: z.union([z.string(), z.number()]).optional(),
    board: z.string().min(1, 'Board is required'),
    username: z.string().min(3).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric').optional(),
    institution: z.string().optional(),
    educationLevel: z.enum(['SCHOOL', 'COLLEGE', 'UNIVERSITY', 'OTHER']).optional(),
}).transform((data) => {
    // Normalize class/grade:
    const rawClass = data.class !== undefined ? String(data.class) : (data.grade !== undefined ? String(data.grade) : '');
    return {
        ...data,
        grade: rawClass,
    };
}).refine((data) => SUPPORTED_CLASSES.includes(data.grade), {
    message: 'Class must be 9, 10, 11, or 12',
    path: ['class'],
}).refine((data) => {
    const norm = data.board.trim().toLowerCase();
    return SUPPORTED_BOARDS.some((b) => b.toLowerCase() === norm);
}, {
    message: 'Board must be Punjab, Federal/FBISE, Sindh, or KPK',
    path: ['board'],
}).refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

export const registerSchema = z.object({
    name: z.string().min(2, 'Name is too short'),
    username: z.string().min(3, 'Username is too short').regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric'),
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    educationLevel: z.enum(['SCHOOL', 'COLLEGE', 'UNIVERSITY', 'OTHER']).default('OTHER'),
    grade: z.string().optional(),
    board: z.string().optional(),
    institution: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

export const loginSchema = z.object({
    identifier: z.string().optional(),
    email: z.string().optional(),
    password: z.string().min(1, 'Password is required'),
}).transform((data) => ({
    identifier: data.identifier || data.email || '',
    password: data.password,
})).refine((data) => data.identifier.length > 0, {
    message: 'Email or username is required',
    path: ['identifier'],
});

export const profileUpdateSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    grade: z.union([z.string(), z.number()]).optional(),
    class: z.union([z.string(), z.number()]).optional(),
    board: z.string().optional(),
    institution: z.string().optional(),
    educationLevel: z.enum(['SCHOOL', 'COLLEGE', 'UNIVERSITY', 'OTHER']).optional(),
}).refine((data) => {
    const c = data.class !== undefined ? String(data.class) : (data.grade !== undefined ? String(data.grade) : undefined);
    if (c === undefined) return true;
    return SUPPORTED_CLASSES.includes(c);
}, {
    message: 'Class must be 9, 10, 11, or 12',
    path: ['class'],
}).refine((data) => {
    if (!data.board) return true;
    const norm = data.board.trim().toLowerCase();
    return SUPPORTED_BOARDS.some((b) => b.toLowerCase() === norm);
}, {
    message: 'Board must be Punjab, Federal/FBISE, Sindh, or KPK',
    path: ['board'],
});